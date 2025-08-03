/**
 * 브라우저 전용 MQTT 서비스 - 기존 인터페이스와 완전 호환
 */
import { Client, Message } from 'paho-mqtt';
import { MqttMessage } from '../types/mqttTypes';

export interface BrowserMqttOptions {
  host: string;
  port: number;
  clientId: string;
  useSSL?: boolean;
  username?: string;
  password?: string;
  keepAliveInterval?: number;
  timeout?: number;
  cleanSession?: boolean;
  url?: string;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  reconnectInterval?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

export class BrowserMqttService {
  private client: Client;
  private options: BrowserMqttOptions;
  private connected = false;
  private subscriptions = new Set<string>();
  private messageHandlers = new Map<string, (topic: string, message: string) => void>();
  private connectionHandlers: ((connected: boolean) => void)[] = [];
  
  // 이벤트 핸들러 (기존 인터페이스 호환)
  public onConnected?: () => void;
  public onConnectionLost?: (error: any) => void;
  public onError?: (error: any) => void;

  constructor(options: BrowserMqttOptions) {
    this.options = {
      useSSL: false,
      keepAliveInterval: 60,
      timeout: 30,
      cleanSession: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 5000,
      ...options
    };
    
    // URL에서 host와 port 추출
    if (this.options.url) {
      try {
        const url = new URL(this.options.url);
        this.options.host = url.hostname;
        this.options.port = parseInt(url.port) || (url.protocol === 'wss:' ? 443 : 80);
      } catch (error) {
        console.warn('URL 파싱 실패, 기본값 사용:', error);
      }
    }
    
    this.client = new Client(
      this.options.host || 'localhost',
      this.options.port || 1884,
      '/mqtt',
      this.options.clientId
    );
    
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // 연결 성공
    this.client.onConnected = () => {
      console.log('✅ MQTT WebSocket 연결 성공');
      this.connected = true;
      this.onConnected?.();
      this.connectionHandlers.forEach(handler => handler(true));
    };

    // 연결 끊김
    this.client.onConnectionLost = (responseObject: any) => {
      console.warn('⚠️ MQTT 연결 끊김:', responseObject.errorMessage);
      this.connected = false;
      this.onConnectionLost?.(responseObject);
      this.connectionHandlers.forEach(handler => handler(false));
      
      // 자동 재연결
      setTimeout(() => {
        if (!this.connected) {
          console.log('🔄 MQTT 재연결 시도...');
          this.connect().catch(console.error);
        }
      }, this.options.reconnectDelay);
    };

    // 메시지 수신
    this.client.onMessageArrived = (message: Message) => {
      try {
        const topic = message.destinationName;
        const payload = message.payloadString;
        
        console.log('📨 MQTT 메시지 수신:', { topic, payload: payload.substring(0, 100) });
        
        // 토픽별 핸들러 호출
        this.messageHandlers.forEach((handler, handlerTopic) => {
          if (this.topicMatches(handlerTopic, topic)) {
            handler(topic, payload);
          }
        });
        
        // 와일드카드 핸들러 호출
        const wildcardHandler = this.messageHandlers.get('*');
        if (wildcardHandler) {
          wildcardHandler(topic, payload);
        }
      } catch (error) {
        console.error('❌ MQTT 메시지 처리 오류:', error);
        this.onError?.(error);
      }
    };
  }

  // 토픽 매칭 (MQTT 와일드카드 지원)
  private topicMatches(pattern: string, topic: string): boolean {
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

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const connectOptions: any = {
          useSSL: this.options.useSSL,
          keepAliveInterval: this.options.keepAliveInterval,
          timeout: this.options.timeout,
          cleanSession: this.options.cleanSession,
          
          onSuccess: () => {
            console.log('🔗 MQTT 연결 성공');
            this.connected = true;
            
            // 기존 구독 복원
            this.subscriptions.forEach(topic => {
              this.subscribe(topic);
            });
            
            resolve();
          },
          
          onFailure: (error: any) => {
            console.error('❌ MQTT 연결 실패:', error);
            this.connected = false;
            reject(error);
          }
        };

        if (this.options.username) {
          connectOptions.userName = this.options.username;
          connectOptions.password = this.options.password;
        }

        this.client.connect(connectOptions);
      } catch (error) {
        console.error('❌ MQTT 연결 시도 오류:', error);
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.connected) {
      this.client.disconnect();
      this.connected = false;
      console.log('🔌 MQTT 연결 해제');
    }
  }

  // 기존 인터페이스 호환: reconnect 메서드
  async reconnect(): Promise<void> {
    this.disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.connect();
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 0): void {
    if (!this.connected) {
      console.warn('⚠️ MQTT 연결되지 않음. 구독 예약:', topic);
      this.subscriptions.add(topic);
      return;
    }

    try {
      this.client.subscribe(topic, {
        qos,
        onSuccess: () => {
          console.log('✅ MQTT 구독 성공:', topic);
          this.subscriptions.add(topic);
        },
        onFailure: (error: any) => {
          console.error('❌ MQTT 구독 실패:', topic, error);
        }
      });
    } catch (error) {
      console.error('❌ MQTT 구독 오류:', error);
    }
  }

  unsubscribe(topic: string): void {
    if (!this.connected) {
      this.subscriptions.delete(topic);
      return;
    }

    try {
      this.client.unsubscribe(topic, {
        onSuccess: () => {
          console.log('✅ MQTT 구독 해제 성공:', topic);
          this.subscriptions.delete(topic);
        },
        onFailure: (error: any) => {
          console.error('❌ MQTT 구독 해제 실패:', topic, error);
        }
      });
    } catch (error) {
      console.error('❌ MQTT 구독 해제 오류:', error);
    }
  }

  publish(topic: string, message: string, qos: 0 | 1 | 2 = 0, retained = false): void {
    if (!this.connected) {
      console.warn('⚠️ MQTT 연결되지 않음. 발행 실패:', topic);
      return;
    }

    try {
      const msg = new Message(message);
      msg.destinationName = topic;
      msg.qos = qos;
      msg.retained = retained;
      
      this.client.send(msg);
      console.log('📤 MQTT 메시지 발행:', { topic, message: message.substring(0, 100) });
    } catch (error) {
      console.error('❌ MQTT 발행 오류:', error);
    }
  }

  // 기존 인터페이스 호환: 메시지 핸들러 등록/해제
  onMessage(topic: string, handler: (message: MqttMessage) => void): void {
    this.messageHandlers.set(topic, (receivedTopic: string, payload: string) => {
      try {
        const mqttMessage: MqttMessage = {
          type: 'message',
          topic: receivedTopic,
          data: JSON.parse(payload),
          timestamp: new Date().toISOString()
        };
        handler(mqttMessage);
      } catch (error) {
        console.error('메시지 파싱 오류:', error);
        const mqttMessage: MqttMessage = {
          type: 'message',
          topic: receivedTopic,
          data: payload,
          timestamp: new Date().toISOString()
        };
        handler(mqttMessage);
      }
    });
  }

  offMessage(topic: string, handler?: (message: MqttMessage) => void): void {
    this.messageHandlers.delete(topic);
  }

  // 기존 인터페이스 호환: 연결 상태 변경 핸들러
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.connectionHandlers.push(handler);
  }

  offConnectionChange(handler: (connected: boolean) => void): void {
    const index = this.connectionHandlers.indexOf(handler);
    if (index > -1) {
      this.connectionHandlers.splice(index, 1);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  // 호환성 메서드들
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.connected ? 'connected' : 'disconnected';
  }

  getLastError(): string | null {
    return null; // 기본 구현
  }

  clearMessages(): void {
    // 메시지 캐시 클리어 (기본 구현)
  }
}

export default BrowserMqttService;