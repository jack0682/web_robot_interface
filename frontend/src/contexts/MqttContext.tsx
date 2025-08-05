/**
 * MQTT 컨텍스트 - 브라우저 호환 paho-mqtt 기반
 */
import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { BrowserMqttService } from '../services/mqttService';
import { 
  MqttMessage, 
  WeightSensorMessage, 
  ConcentrationMessage,
  ROS2TopicListMessage,
  RobotControlMessage,
  ConnectionStatus,
  Timestamp
} from '../types/robotTypes';

interface MqttContextType {
  // 연결 상태
  client: BrowserMqttService | null;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionAttempts: number;
  
  // 데이터
  weightSensor: WeightSensorMessage | null;
  concentration: ConcentrationMessage | null;
  ros2Topics: ROS2TopicListMessage | null;
  robotCommands: RobotControlMessage[];
  lastMessage: MqttMessage | null;
  
  // 통계
  messageCount: number;
  subscriptions: string[];
  lastUpdate: Timestamp | null;
  error: string | null;
  
  // 제어 함수
  subscribe: (topic: string) => Promise<boolean>;
  unsubscribe: (topic: string) => Promise<boolean>;
  publish: (topic: string, message: any) => Promise<boolean>;
  reconnect: () => void;
  
  // 유틸리티
  getConnectionInfo: () => {
    broker: string;
    clientId: string;
    uptime: number;
    lastPing: Timestamp | null;
  };
}

const MqttContext = createContext<MqttContextType | undefined>(undefined);

export const MqttProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 연결 상태
  const [client, setClient] = useState<BrowserMqttService | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  
  // 데이터 상태
  const [weightSensor, setWeightSensor] = useState<WeightSensorMessage | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationMessage | null>(null);
  const [ros2Topics, setRos2Topics] = useState<ROS2TopicListMessage | null>(null);
  const [robotCommands, setRobotCommands] = useState<RobotControlMessage[]>([]);
  const [lastMessage, setLastMessage] = useState<MqttMessage | null>(null);
  
  // 통계 및 상태
  const [messageCount, setMessageCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Timestamp | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // 내부 상태
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const startTimeRef = useRef<number>(Date.now());
  const lastPingRef = useRef<Timestamp | null>(null);
  const clientIdRef = useRef<string>(`web_dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const brokerUrlRef = useRef<string>('');

  // 메시지 업데이트 헬퍼
  const updateMessage = useCallback(() => {
    const now = new Date().toISOString();
    setLastUpdate(now);
    setMessageCount(prev => prev + 1);
    setError(null);
  }, []);

  // 메시지 처리 함수
  const handleMessage = useCallback((message: MqttMessage) => {
    try {
      setLastMessage(message);
      updateMessage();

      // 토픽별 데이터 처리
      switch (message.topic) {
        case 'test':  // 무게 센서 토픽 변경
        case 'sensor/weight':
          if (message.data && typeof message.data.weight === 'number') {
            const weightMessage: WeightSensorMessage = {
              id: 'weight_sensor_01',
              name: 'Weight Sensor',
              value: message.data.weight,
              unit: message.data.unit || 'kg',
              quality: message.data.quality || 'good',
              timestamp: message.timestamp,
              status: message.data.status || 'normal',
              weight: message.data.weight,
              processed: message.data.processed || { weight: message.data.weight, smoothed: false }
            };
            setWeightSensor(weightMessage);
          }
          break;
        
        case 'web/target_concentration':
        case 'sensor/concentration':
          if (message.data && typeof message.data.target === 'number') {
            const concentrationMessage: ConcentrationMessage = {
              id: 'concentration_sensor_01',
              name: 'Concentration Sensor',
              value: message.data.target,
              unit: message.data.unit || '%',
              quality: message.data.quality || 'good',
              timestamp: message.timestamp,
              status: message.data.status || 'normal',
              targetValue: message.data.target,
              processed: message.data.processed || { target: message.data.target, filtered: false }
            };
            setConcentration(concentrationMessage);
          }
          break;
        
        default:
          console.log(`📨 MQTT 메시지 수신: ${message.topic}`, message.data);
      }
    } catch (error) {
      console.error('❌ MQTT 메시지 처리 오류:', error);
      setError(`메시지 처리 실패: ${message.topic}`);
    }
  }, [updateMessage]);

  // MQTT 연결 함수
  const connectToMqtt = useCallback(() => {
    setConnectionStatus('connecting');
    setConnectionAttempts(prev => prev + 1);
    
    const brokerHost = 'localhost';
    const brokerPort = 1884;
    const clientId = clientIdRef.current;
    
    brokerUrlRef.current = `ws://${brokerHost}:${brokerPort}`;
    
    try {
      console.log(`🔄 MQTT 연결 시도: ${brokerUrlRef.current}`);
      
      const mqttClient = new BrowserMqttService({
        host: brokerHost,
        port: brokerPort,
        clientId: clientId,
        useSSL: false,
        keepAliveInterval: 60,
        timeout: 30,
        cleanSession: true
      });
      
      setClient(mqttClient);

      // 이벤트 핸들러 설정
      mqttClient.onConnected = () => {
        console.log('✅ MQTT 연결 성공');
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        setConnectionAttempts(0);
        lastPingRef.current = new Date().toISOString();
        
        // 기본 토픽 구독
        const defaultTopics = [
          'test',  // 무게 센서 토픽
          'web/target_concentration',
          'ros2_topic_list',
          'robot/control/+',
          'sensor/+',
          'robot/status'
        ];
        
        defaultTopics.forEach(topic => {
          mqttClient.subscribe(topic);
          setSubscriptions(prev => [...new Set([...prev, topic])]);
        });
      };

      mqttClient.onConnectionLost = (error: any) => {
        console.log('📡 MQTT 연결 해제:', error);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // 자동 재연결
        if (connectionAttempts < 10) {
          reconnectTimeoutRef.current = setTimeout(connectToMqtt, 5000);
        }
      };

      mqttClient.onError = (err: any) => {
        console.error('❌ MQTT 오류:', err);
        
        // Filter out non-critical WebSocket protocol errors
        const errorMessage = err.message || '연결 실패';
        if (errorMessage.includes('Unknown message type') && errorMessage.includes('subscribe')) {
          console.warn('⚠️ WebSocket 프로토콜 메시지 무시됨:', errorMessage);
          return; // Don't set error state for protocol messages
        }
        
        setConnectionStatus('disconnected');
        setIsConnected(false);
        setError(`MQTT 오류: ${errorMessage}`);
      };

      // 연결 시작
      mqttClient.connect().then(() => {
        // 모든 디폴트 토픽에 대한 메시지 핸들러 등록
        mqttClient.onMessage('*', handleMessage);
        mqttClient.onMessage('test', handleMessage);  // 무게 센서 토픽
        mqttClient.onMessage('web/target_concentration', handleMessage);
        mqttClient.onMessage('ros2_topic_list', handleMessage);
        mqttClient.onMessage('robot/control/+', handleMessage);
        mqttClient.onMessage('sensor/+', handleMessage);
        mqttClient.onMessage('robot/status', handleMessage);
      }).catch(console.error);

    } catch (error) {
      console.error('❌ MQTT 연결 실패:', error);
      setConnectionStatus('disconnected');
      setError(`연결 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    }
  }, [connectionAttempts, handleMessage]);

  // 초기 연결
  useEffect(() => {
    connectToMqtt();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (client) {
        console.log('🧹 MQTT 클라이언트 정리');
        client.disconnect();
      }
    };
  }, []);

  // 토픽 구독
  const subscribe = useCallback(async (topic: string): Promise<boolean> => {
    if (client && isConnected) {
      try {
        client.subscribe(topic);
        setSubscriptions(prev => [...new Set([...prev, topic])]);
        return true;
      } catch (error) {
        console.error(`❌ 토픽 구독 실패 ${topic}:`, error);
        return false;
      }
    }
    return false;
  }, [client, isConnected]);

  // 토픽 구독 해제
  const unsubscribe = useCallback(async (topic: string): Promise<boolean> => {
    if (client && isConnected) {
      try {
        client.unsubscribe(topic);
        setSubscriptions(prev => prev.filter(t => t !== topic));
        return true;
      } catch (error) {
        console.error(`❌ 토픽 구독 해제 실패 ${topic}:`, error);
        return false;
      }
    }
    return false;
  }, [client, isConnected]);

  // 메시지 발행
  const publish = useCallback(async (topic: string, message: any): Promise<boolean> => {
    if (client && isConnected) {
      try {
        const payload = typeof message === 'string' ? message : JSON.stringify(message);
        client.publish(topic, payload);
        return true;
      } catch (error) {
        console.error(`❌ 메시지 발행 실패 ${topic}:`, error);
        return false;
      }
    }
    return false;
  }, [client, isConnected]);

  // 재연결
  const reconnect = useCallback(() => {
    if (client) {
      console.log('🔄 MQTT 수동 재연결 시도');
      client.disconnect();
      setClient(null);
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setTimeout(connectToMqtt, 1000);
    } else {
      connectToMqtt();
    }
  }, [client, connectToMqtt]);

  // 연결 정보 반환
  const getConnectionInfo = useCallback(() => {
    return {
      broker: brokerUrlRef.current,
      clientId: clientIdRef.current,
      uptime: Date.now() - startTimeRef.current,
      lastPing: lastPingRef.current
    };
  }, []);

  const contextValue: MqttContextType = {
    client,
    isConnected,
    connectionStatus,
    connectionAttempts,
    weightSensor,
    concentration,
    ros2Topics,
    robotCommands,
    lastMessage,
    messageCount,
    subscriptions,
    lastUpdate,
    error,
    subscribe,
    unsubscribe,
    publish,
    reconnect,
    getConnectionInfo
  };

  return (
    <MqttContext.Provider value={contextValue}>
      {children}
    </MqttContext.Provider>
  );
};

export const useMqtt = (): MqttContextType => {
  const context = useContext(MqttContext);
  if (context === undefined) {
    throw new Error('useMqtt must be used within a MqttProvider');
  }
  return context;
};

export default MqttContext;