/**
 * MQTT 데이터 수신 훅 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '../contexts/WebSocketContext';
import { BrowserMqttService as MqttWebSocketService } from '../services/mqttService';
import DataProcessorService from '../services/dataProcessor';
import { 
  MqttMessage, 
  ROS2TopicListMessage, 
  WeightSensorMessage, 
  ConcentrationMessage,
  RobotControlMessage,
  MqttDataHookReturn,
  ConnectionStatus,
  Timestamp
} from '../types/robotTypes';
import config from '../config';

export const useMqttData = (autoSubscribe: string[] = []): MqttDataHookReturn => {
  // 기본 연결 상태
  const [isConnected, setIsConnected] = useState(false);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [lastMessage, setLastMessage] = useState<MqttMessage | null>(null);
  
  // 센서 데이터 상태
  const [weightSensor, setWeightSensor] = useState<WeightSensorMessage | null>(null);
  const [concentration, setConcentration] = useState<ConcentrationMessage | null>(null);
  
  // ROS2 데이터 상태
  const [ros2Topics, setRos2Topics] = useState<ROS2TopicListMessage | null>(null);
  const [robotCommands, setRobotCommands] = useState<RobotControlMessage[]>([]);
  
  // 상태 정보
  const [lastUpdate, setLastUpdate] = useState<Timestamp | null>(null);
  const [messageCount, setMessageCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  
  // 서비스 인스턴스
  const mqttServiceRef = useRef<MqttWebSocketService | null>(null);
  const dataProcessorRef = useRef<DataProcessorService | null>(null);
  const isInitializedRef = useRef(false);
  
  // WebSocket 컨텍스트
  const webSocketContext = useWebSocket();

  // 연결 상태 매핑
  const connectionStatus: ConnectionStatus = isConnected 
    ? 'connected' 
    : (connectionAttempts > 0 ? 'connecting' : 'disconnected');

  // 통합 센서 데이터 (에러 해결용)
  const sensorData = {
    weight: weightSensor,
    concentration: concentration
  };

  // 서비스 초기화
  useEffect(() => {
    if (!isInitializedRef.current) {
      try {
        mqttServiceRef.current = new MqttWebSocketService({
          host: 'localhost',
          port: 1884,
          clientId: `robot_dashboard_${Date.now()}`,
          ...config.websocket,
          reconnectInterval: config.websocket.reconnectInterval || 5000
        });
        dataProcessorRef.current = new DataProcessorService();
        isInitializedRef.current = true;
        console.log('✅ MQTT 서비스 초기화 완료');
      } catch (error) {
        console.error('❌ MQTT 서비스 초기화 실패:', error);
        setError(`서비스 초기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    }

    return () => {
      if (mqttServiceRef.current) {
        mqttServiceRef.current.disconnect();
        isInitializedRef.current = false;
      }
    };
  }, []);

  // 메시지 업데이트 헬퍼
  const updateWithTimestamp = useCallback(() => {
    const now = new Date().toISOString();
    setLastUpdate(now);
    setMessageCount(prev => prev + 1);
  }, []);

  // 메시지 핸들러 설정
  useEffect(() => {
    if (!mqttServiceRef.current || !dataProcessorRef.current) return;

    const mqttService = mqttServiceRef.current;
    const dataProcessor = dataProcessorRef.current;

    // ROS2 토픽 리스트 핸들러
    const handleRos2Topics = (message: MqttMessage) => {
      try {
        const processed = dataProcessor.processROS2TopicList(message);
        if (processed) {
          setRos2Topics(processed);
          updateWithTimestamp();
          console.log('📋 ROS2 토픽 리스트 업데이트:', processed.total);
        }
      } catch (error) {
        console.error('❌ ROS2 토픽 처리 오류:', error);
        setError('ROS2 토픽 데이터 처리 실패');
      }
    };

    // 무게센서 핸들러
    const handleWeightSensor = (message: MqttMessage) => {
      try {
        const processed = dataProcessor.processWeightSensorData(message);
        if (processed) {
          setWeightSensor(processed);
          updateWithTimestamp();
          console.log('⚖️ 무게센서 데이터:', processed.weight, processed.unit);
        }
      } catch (error) {
        console.error('❌ 무게센서 처리 오류:', error);
        setWarnings(prev => [...prev, `무게센서 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`].slice(-5));
      }
    };

    // 농도센서 핸들러
    const handleConcentration = (message: MqttMessage) => {
      try {
        const processed = dataProcessor.processConcentrationData(message);
        if (processed) {
          setConcentration(processed);
          updateWithTimestamp();
          console.log('🧪 농도센서 데이터:', processed.targetValue, processed.unit);
        }
      } catch (error) {
        console.error('❌ 농도센서 처리 오류:', error);
        setWarnings(prev => [...prev, `농도센서 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`].slice(-5));
      }
    };

    // 로봇 제어 핸들러
    const handleRobotControl = (message: MqttMessage) => {
      try {
        const processed = dataProcessor.processRobotControlData(message);
        if (processed) {
          setRobotCommands(prev => {
            const updated = [...prev, processed].slice(-20); // 최근 20개만 유지
            return updated;
          });
          updateWithTimestamp();
          console.log('🤖 로봇 제어 명령:', processed.command_type, processed.validation.status);
        }
      } catch (error) {
        console.error('❌ 로봇 제어 처리 오류:', error);
        setWarnings(prev => [...prev, `로봇 제어 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`].slice(-5));
      }
    };

    // 에러 핸들러
    const handleError = (message: MqttMessage) => {
      if (message.type === 'error') {
        const errorMsg = message.data?.message || 'MQTT 통신 오류 발생';
        setError(errorMsg);
        setWarnings(prev => [...prev, `${new Date().toLocaleTimeString()}: ${errorMsg}`].slice(-10));
        console.error('💥 MQTT 에러:', errorMsg);
      }
    };

    // 전체 메시지 핸들러 (디버깅 및 통계용)
    const handleAllMessages = (message: MqttMessage) => {
      setLastMessage(message);
      console.debug('📨 MQTT 메시지 수신:', {
        type: message.type,
        topic: message.topic,
        timestamp: message.timestamp
      });
    };

    // 핸들러 등록 - 🎯 정밀 수정된 토픽명 사용
    try {
      mqttService!.onMessage('test', handleWeightSensor);              // 무게센서 데이터 (변경됨)
      mqttService!.onMessage('ros2_topic_list', handleRos2Topics);     // ROS2 토픽 리스트
      mqttService!.onMessage('web/target_concentration', handleConcentration);
      mqttService!.onMessage('robot/control/+', handleRobotControl);
      mqttService!.onMessage('error', handleError);
      mqttService!.onMessage('*', handleAllMessages);

      console.log('✅ MQTT 메시지 핸들러 등록 완료 (정밀 수정된 토픽 사용)');
    } catch (error) {
      console.error('❌ 메시지 핸들러 등록 실패:', error);
      setError('메시지 핸들러 설정 실패');
    }

    // 연결 상태 핸들러
    const handleConnection = (connected: boolean) => {
      setIsConnected(connected);
      if (!connected) {
        setError('MQTT 연결이 끊어졌습니다');
        setConnectionAttempts(prev => prev + 1);
      } else {
        setError(null);
        setConnectionAttempts(0);
        console.log('✅ MQTT 연결 복원됨');
      }
    };

    try {
      mqttService!.onConnectionChange(handleConnection);
    } catch (error) {
      console.error('❌ 연결 상태 핸들러 등록 실패:', error);
    }

    // 정리 함수 - 🎯 정밀 수정된 토픽명 사용
    return () => {
      try {
        mqttService.offMessage('test', handleWeightSensor);              // 무게센서 데이터 (변경됨)
        mqttService.offMessage('ros2_topic_list', handleRos2Topics);     // ROS2 토픽 리스트
        mqttService.offMessage('web/target_concentration', handleConcentration);
        mqttService.offMessage('robot/control/+', handleRobotControl);
        mqttService.offMessage('error', handleError);
        mqttService.offMessage('*', handleAllMessages);
        mqttService.offConnectionChange(handleConnection);
        console.log('🧹 MQTT 핸들러 정리 완료 (정밀 수정된 토픽 사용)');
      } catch (error) {
        console.error('❌ MQTT 핸들러 정리 실패:', error);
      }
    };
  }, [updateWithTimestamp]);

  // 자동 구독 설정 - 무한 루프 방지
  useEffect(() => {
    if (!mqttServiceRef.current || !isInitializedRef.current) return;

    const mqttService = mqttServiceRef.current;
    
    // 기본 토픽들 + 사용자 지정 토픽들 - 🎯 정밀 수정된 토픽명 사용
    const defaultTopics = [
      'test',                        // 무게센서 데이터 (변경됨)
      'ros2_topic_list',            // ROS2 토픽 리스트
      'web/target_concentration',    // 농도 목표값
      'robot/control/+',             // 로봇 제어 명령
      'system/health',               // 시스템 상태
      'error',                       // 에러 메시지
      ...autoSubscribe
    ];

    const uniqueTopics = [...new Set(defaultTopics)]; // 중복 제거

    // 이미 구독된 토픽과 비교하여 변경된 경우만 업데이트
    const currentSubs = new Set(subscriptions);
    const newSubs = new Set(uniqueTopics);
    const hasChanges = uniqueTopics.length !== subscriptions.length || 
                      uniqueTopics.some(topic => !currentSubs.has(topic));
    
    if (!hasChanges) {
      return; // 변경사항이 없으면 아무것도 하지 않음
    }

    try {
      uniqueTopics.forEach(topic => {
        if (!currentSubs.has(topic)) {
          mqttService.subscribe(topic);
        }
      });
      
      setSubscriptions(uniqueTopics);
      console.log('📡 자동 구독 완료 (정밀 수정된 토픽 사용):', uniqueTopics);
    } catch (error) {
      console.error('❌ 자동 구독 실패:', error);
      setError('토픽 구독 설정 실패');
    }
  }, [subscriptions]); // autoSubscribe 의존성 제거로 무한루프 방지

  // WebSocket Context와 동기화
  useEffect(() => {
    if (webSocketContext) {
      setIsConnected(webSocketContext.isConnected);
      setConnectionAttempts(webSocketContext.connectionAttempts);
      if (webSocketContext.lastMessage) {
        setLastMessage(webSocketContext.lastMessage);
      }
    }
  }, [webSocketContext]);

  // 수동 구독 함수
  const subscribe = useCallback((topic: string) => {
    if (mqttServiceRef.current && topic) {
      try {
        mqttServiceRef.current.subscribe(topic);
        setSubscriptions(prev => [...new Set([...prev, topic])]);
        console.log('📡 토픽 구독:', topic);
      } catch (error) {
        console.error('❌ 토픽 구독 실패:', error);
        setError(`토픽 구독 실패: ${topic}`);
      }
    }
  }, []);

  // 구독 해제 함수
  const unsubscribe = useCallback((topic: string) => {
    if (mqttServiceRef.current && topic) {
      try {
        mqttServiceRef.current.unsubscribe(topic);
        setSubscriptions(prev => prev.filter(t => t !== topic));
        console.log('📡 토픽 구독 해제:', topic);
      } catch (error) {
        console.error('❌ 토픽 구독 해제 실패:', error);
        setError(`토픽 구독 해제 실패: ${topic}`);
      }
    }
  }, []);

  // 재연결 함수
  const reconnect = useCallback(() => {
    if (mqttServiceRef.current) {
      try {
        setError(null);
        setConnectionAttempts(prev => prev + 1);
        mqttServiceRef.current!.reconnect();
        console.log('🔄 MQTT 재연결 시도');
      } catch (error) {
        console.error('❌ MQTT 재연결 실패:', error);
        setError('재연결 실패');
      }
    }
  }, []);

  // 에러 자동 복구
  useEffect(() => {
    if (error && !isConnected) {
      const timer = setTimeout(() => {
        if (connectionAttempts < 5) { // 최대 5회 재시도
          reconnect();
        }
      }, 5000); // 5초 후 재시도

      return () => clearTimeout(timer);
    }
  }, [error, isConnected, connectionAttempts, reconnect]);

  return {
    // 기본 연결 상태
    isConnected,
    connectionAttempts,
    lastMessage,
    
    // 센서 데이터
    weightSensor,
    concentration,
    
    // ROS2 데이터
    ros2Topics,
    robotCommands,
    
    // 통합 센서 데이터 (에러 해결용)
    sensorData,
    
    // 상태 정보
    connectionStatus,
    lastUpdate,
    messageCount,
    subscriptions,
    error,
    warnings,
    
    // 제어 함수
    subscribe,
    unsubscribe,
    reconnect,
  };
};

export default useMqttData;
