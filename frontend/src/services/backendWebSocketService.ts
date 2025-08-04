/**
 * 🎯 Backend WebSocket 기반 데이터 서비스
 * MQTT 브로커에 직접 연결하지 않고, Backend API와 WebSocket을 통해 데이터 수신
 */
import { MqttMessage } from '../types/mqttTypes';

export interface BackendWebSocketOptions {
  backendUrl?: string;
  websocketUrl?: string;
  apiUrl?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  debug?: boolean;
}

export class BackendWebSocketService {
  private websocket: WebSocket | null = null;
  private options: Required<BackendWebSocketOptions>;
  private connected = false;
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, (message: MqttMessage) => void>();
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  
  // 이벤트 핸들러 (기존 MQTT 인터페이스 호환)
  public onConnected?: () => void;
  public onConnectionLost?: (error: any) => void;
  public onError?: (error: any) => void;

  constructor(options: BackendWebSocketOptions = {}) {
    this.options = {
      backendUrl: options.backendUrl || 'http://localhost:5001',
      websocketUrl: options.websocketUrl || 'ws://localhost:8080',
      apiUrl: options.apiUrl || 'http://localhost:5001/api',
      reconnectDelay: options.reconnectDelay || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      debug: options.debug || false
    };
    
    this.log('Backend WebSocket Service 초기화:', this.options);
  }

  private log(message: string, ...args: any[]) {
    if (this.options.debug) {
      console.log(`[BackendWS] ${message}`, ...args);
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.log('WebSocket 연결 시도:', this.options.websocketUrl);
        
        this.websocket = new WebSocket(this.options.websocketUrl);

        this.websocket.onopen = () => {
          this.log('✅ Backend WebSocket 연결 성공');
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // 연결 확인 메시지 전송
          this.sendMessage({
            type: 'connection',
            timestamp: new Date().toISOString()
          });
          
          // 기존 구독 복원
          this.restoreSubscriptions();
          
          this.onConnected?.();
          this.connectionHandlers.forEach(handler => handler(true));
          resolve();
        };

        this.websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            this.log('❌ WebSocket 메시지 파싱 오류:', error);
          }
        };

        this.websocket.onclose = (event) => {
          this.log('⚠️  WebSocket 연결 끊김:', event.code, event.reason);
          this.connected = false;
          this.websocket = null;
          
          this.onConnectionLost?.(event);
          this.connectionHandlers.forEach(handler => handler(false));
          
          // 자동 재연결 시도
          this.attemptReconnect();
        };

        this.websocket.onerror = (error) => {
          this.log('❌ WebSocket 오류:', error);
          this.onError?.(error);
          
          if (!this.connected) {
            reject(error);
          }
        };

      } catch (error) {
        this.log('❌ WebSocket 연결 시도 오류:', error);
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log('🚨 최대 재연결 시도 횟수 초과');
      return;
    }

    this.reconnectAttempts++;
    this.log(`🔄 재연결 시도 ${this.reconnectAttempts}/${this.options.maxReconnectAttempts}...`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(error => {
        this.log('❌ 재연결 실패:', error);
      });
    }, this.options.reconnectDelay * this.reconnectAttempts);
  }

  private sendMessage(message: any) {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private handleMessage(data: any) {
    this.log('📨 WebSocket 메시지 수신:', data);

    switch (data.type) {
      case 'connection_acknowledged':
        this.log('🔗 연결 확인됨');
        break;

      case 'mqtt_message':
        // MQTT 메시지를 기존 형식으로 변환
        const mqttMessage: MqttMessage = {
          type: 'message',
          topic: data.topic,
          data: data.data,
          timestamp: data.timestamp || new Date().toISOString()
        };
        this.dispatchMessage(mqttMessage);
        break;

      case 'sensor_data':
        // 센서 데이터를 MQTT 메시지 형식으로 변환
        const sensorMessage: MqttMessage = {
          type: 'message',
          topic: data.topic || `sensor/${data.sensor}`,
          data: data.data,
          timestamp: data.timestamp || new Date().toISOString()
        };
        this.dispatchMessage(sensorMessage);
        break;

      case 'ros2_topics':
        // ROS2 토픽 데이터
        const ros2Message: MqttMessage = {
          type: 'message',
          topic: data.topic || 'ros2_topic_list',
          data: data.data,
          timestamp: data.timestamp || new Date().toISOString()
        };
        this.dispatchMessage(ros2Message);
        break;

      case 'concentration':
        // 농도 데이터
        const concentrationMessage: MqttMessage = {
          type: 'message',
          topic: data.topic || 'web/target_concentration',
          data: data.data,
          timestamp: data.timestamp || new Date().toISOString()
        };
        this.dispatchMessage(concentrationMessage);
        break;

      case 'error':
        this.log('❌ 서버 오류:', data.message);
        this.onError?.(new Error(data.message));
        break;

      default:
        this.log('❓ 알 수 없는 메시지 타입:', data.type);
    }
  }

  private dispatchMessage(message: MqttMessage) {
    this.log('📋 메시지 디스패치:', message.topic);

    // topic이 undefined인 경우 처리
    if (!message.topic) {
      this.log('❌ 메시지 토픽이 없습니다:', message);
      return;
    }

    // 토픽별 핸들러 호출
    this.messageHandlers.forEach((handler, handlerTopic) => {
      if (this.topicMatches(handlerTopic, message.topic)) {
        try {
          handler(message);
        } catch (error) {
          this.log('❌ 메시지 핸들러 오류:', error);
        }
      }
    });

    // 와일드카드 핸들러 호출
    const wildcardHandler = this.messageHandlers.get('*');
    if (wildcardHandler) {
      try {
        wildcardHandler(message);
      } catch (error) {
        this.log('❌ 와일드카드 핸들러 오류:', error);
      }
    }
  }

  // 토픽 매칭 (MQTT 와일드카드 지원)
  private topicMatches(pattern: string, topic: string | undefined): boolean {
    if (!topic) return false; // topic이 undefined인 경우 false 반환
    if (pattern === '*' || pattern === '#') return true;
    if (pattern === topic) return true;
    
    // + 와일드카드 지원
    if (pattern.includes('+')) {
      const patternParts = pattern.split('/');
      const topicParts = topic.split('/');
      
      if (patternParts.length !== topicParts.length) return false;
      
      return patternParts.every((part, index) => 
        part === '+' || part === topicParts[index]
      );
    }
    
    return false;
  }

  private restoreSubscriptions() {
    this.log('🔄 구독 복원:', Array.from(this.subscriptions));
    // WebSocket 연결이므로 별도 구독 과정은 필요 없음
    // 모든 데이터는 자동으로 브로드캐스트됨
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.connected = false;
    this.log('🔌 WebSocket 연결 해제');
  }

  async reconnect(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.connect();
  }

  // 🎯 기존 MQTT 인터페이스 호환 메서드들
  subscribe(topic: string, qos: 0 | 1 | 2 = 0): void {
    this.log('📡 구독 요청:', topic);
    this.subscriptions.add(topic);
    
    // WebSocket을 통해 Backend에 알리기 (선택적)
    if (this.connected) {
      this.sendMessage({
        type: 'subscribe',
        topic: topic,
        qos: qos
      });
    }
  }

  unsubscribe(topic: string): void {
    this.log('📡 구독 해제:', topic);
    this.subscriptions.delete(topic);
    
    if (this.connected) {
      this.sendMessage({
        type: 'unsubscribe',
        topic: topic
      });
    }
  }

  publish(topic: string, message: string, qos: 0 | 1 | 2 = 0, retained = false): void {
    this.log('📤 메시지 발행 요청:', topic);
    
    if (!this.connected) {
      this.log('⚠️  연결되지 않음. 발행 실패:', topic);
      return;
    }

    // Backend API를 통해 발행
    fetch(`${this.options.apiUrl}/debug/test-publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: topic,
        message: JSON.parse(message)
      })
    }).then(response => {
      if (response.ok) {
        this.log('✅ 메시지 발행 성공:', topic);
      } else {
        this.log('❌ 메시지 발행 실패:', topic);
      }
    }).catch(error => {
      this.log('❌ 메시지 발행 오류:', error);
    });
  }

  // 메시지 핸들러 등록/해제
  onMessage(topic: string, handler: (message: MqttMessage) => void): void {
    this.messageHandlers.set(topic, handler);
    this.log('📝 메시지 핸들러 등록:', topic);
  }

  offMessage(topic: string, handler?: (message: MqttMessage) => void): void {
    this.messageHandlers.delete(topic);
    this.log('📝 메시지 핸들러 해제:', topic);
  }

  // 연결 상태 변경 핸들러
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  offConnectionChange(handler: (connected: boolean) => void): void {
    const index = this.connectionHandlers.indexOf(handler);
    if (index > -1) {
      this.connectionHandlers.splice(index, 1);
    }
  }

  // 상태 확인 메서드들
  isConnected(): boolean {
    return this.connected;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (this.websocket?.readyState === WebSocket.CONNECTING) return 'connecting';
    return this.connected ? 'connected' : 'disconnected';
  }

  getLastError(): string | null {
    return null;
  }

  clearMessages(): void {
    // 메시지 캐시 클리어
  }

  // 🎯 Backend API 직접 호출 메서드들
  async getSystemHealth() {
    const response = await fetch(`${this.options.apiUrl}/debug/system-health`);
    return response.json();
  }

  async getSensorData() {
    const response = await fetch(`${this.options.apiUrl}/sensors/all`);
    return response.json();
  }

  async getRobotStatus() {
    const response = await fetch(`${this.options.apiUrl}/robot/status`);
    return response.json();
  }

  async getTopicMapping() {
    const response = await fetch(`${this.options.apiUrl}/debug/topic-mapping`);
    return response.json();
  }
}

export default BackendWebSocketService;