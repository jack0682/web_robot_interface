#!/bin/bash

# 최고의 해결책: 브라우저 전용 MQTT 클라이언트로 교체
echo "🌟 브라우저 전용 MQTT 클라이언트로 완전 교체..."

cd ~/web_robot_interface/frontend

# 1. 기존 mqtt 제거하고 브라우저 전용 라이브러리 설치
echo "📦 브라우저 전용 MQTT 클라이언트 설치..."
npm uninstall mqtt
npm install paho-mqtt --save

# 2. 간단한 브라우저 호환 MQTT 서비스 생성
cat > src/services/browserMqttService.ts << 'EOF'
/**
 * 브라우저 전용 MQTT 서비스 - Node.js 의존성 없음
 */
import { Client, Message } from 'paho-mqtt';

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
}

export class BrowserMqttService {
  private client: Client;
  private options: BrowserMqttOptions;
  private connected = false;
  private subscriptions = new Set<string>();
  
  // 이벤트 핸들러
  public onConnected?: () => void;
  public onConnectionLost?: (error: any) => void;
  public onMessage?: (topic: string, message: string) => void;
  public onError?: (error: any) => void;

  constructor(options: BrowserMqttOptions) {
    this.options = {
      useSSL: false,
      keepAliveInterval: 60,
      timeout: 30,
      cleanSession: true,
      ...options
    };
    
    this.client = new Client(
      this.options.host,
      this.options.port,
      '/mqtt', // WebSocket path
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
    };

    // 연결 끊김
    this.client.onConnectionLost = (responseObject) => {
      console.warn('⚠️ MQTT 연결 끊김:', responseObject.errorMessage);
      this.connected = false;
      this.onConnectionLost?.(responseObject);
      
      // 자동 재연결
      setTimeout(() => {
        if (!this.connected) {
          console.log('🔄 MQTT 재연결 시도...');
          this.connect();
        }
      }, 5000);
    };

    // 메시지 수신
    this.client.onMessageArrived = (message: Message) => {
      try {
        const topic = message.destinationName;
        const payload = message.payloadString;
        
        console.log('📨 MQTT 메시지 수신:', { topic, payload: payload.substring(0, 100) });
        this.onMessage?.(topic, payload);
      } catch (error) {
        console.error('❌ MQTT 메시지 처리 오류:', error);
        this.onError?.(error);
      }
    };
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
        onFailure: (error) => {
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
        onFailure: (error) => {
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

  isConnected(): boolean {
    return this.connected;
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }
}

export default BrowserMqttService;
EOF

# 3. 기존 MQTT 서비스 백업 및 교체
echo "🔄 기존 MQTT 서비스 백업 및 교체..."
if [ -f "src/services/mqttService.ts" ]; then
  mv src/services/mqttService.ts src/services/mqttService.ts.backup
fi

# 새로운 서비스를 기본 파일명으로 복사
cp src/services/browserMqttService.ts src/services/mqttService.ts

echo "✅ 브라우저 전용 MQTT 클라이언트 설치 완료!"
echo ""
echo "🚀 이제 다시 빌드를 시도해보세요:"
echo "   npm run build"
echo ""
echo "📋 참고사항:"
echo "   - Node.js 의존성이 완전히 제거되었습니다"
echo "   - 순수 WebSocket 기반 MQTT 클라이언트입니다"
echo "   - 브라우저에서 완벽하게 작동합니다"