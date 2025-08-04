/**
 * 🎯 Backend WebSocket 기반 MQTT 서비스 (기존 인터페이스 호환)
 * 기존 mqttService.ts와 완전히 호환되면서 Backend WebSocket을 사용
 */
import BackendWebSocketService from './backendWebSocketService';
import { MqttMessage } from '../types/mqttTypes';

// 기존 MQTT 서비스 인터페이스와 완전 호환
export interface BrowserMqttOptions {
  host?: string;
  port?: number;
  clientId?: string;
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
  
  // 🎯 Backend WebSocket 옵션 추가
  backendUrl?: string;
  websocketUrl?: string;
  apiUrl?: string;
  debug?: boolean;
}

export class BrowserMqttService {
  private backendService: BackendWebSocketService;
  
  // 이벤트 핸들러 (기존 인터페이스 호환)
  public onConnected?: () => void;
  public onConnectionLost?: (error: any) => void;
  public onError?: (error: any) => void;

  constructor(options: BrowserMqttOptions = {}) {
    console.log('🔄 MQTT 서비스를 Backend WebSocket 모드로 초기화');
    
    // Backend WebSocket Service 초기화
    this.backendService = new BackendWebSocketService({
      backendUrl: options.backendUrl || 'http://localhost:5001',
      websocketUrl: options.websocketUrl || 'ws://localhost:8080',
      apiUrl: options.apiUrl || 'http://localhost:5001/api',
      reconnectDelay: options.reconnectDelay || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      debug: options.debug || true
    });
    
    // 이벤트 핸들러 연결
    this.backendService.onConnected = () => {
      console.log('✅ Backend WebSocket 연결됨 (MQTT 인터페이스 호환)');
      this.onConnected?.();
    };
    
    this.backendService.onConnectionLost = (error) => {
      console.warn('⚠️  Backend WebSocket 연결 끊김 (MQTT 인터페이스 호환)');
      this.onConnectionLost?.(error);
    };
    
    this.backendService.onError = (error) => {
      console.error('❌ Backend WebSocket 오류 (MQTT 인터페이스 호환)');
      this.onError?.(error);
    };
  }

  // 🎯 기존 MQTT 인터페이스와 완전 호환
  async connect(): Promise<void> {
    console.log('🔗 Backend WebSocket 연결 시도...');
    return this.backendService.connect();
  }

  disconnect(): void {
    console.log('🔌 Backend WebSocket 연결 해제');
    this.backendService.disconnect();
  }

  async reconnect(): Promise<void> {
    console.log('🔄 Backend WebSocket 재연결...');
    return this.backendService.reconnect();
  }

  subscribe(topic: string, qos: 0 | 1 | 2 = 0): void {
    console.log('📡 구독 요청 (Backend WebSocket):', topic);
    this.backendService.subscribe(topic, qos);
  }

  unsubscribe(topic: string): void {
    console.log('📡 구독 해제 (Backend WebSocket):', topic);
    this.backendService.unsubscribe(topic);
  }

  publish(topic: string, message: string, qos: 0 | 1 | 2 = 0, retained = false): void {
    console.log('📤 메시지 발행 (Backend API):', topic);
    this.backendService.publish(topic, message, qos, retained);
  }

  // 메시지 핸들러 등록/해제
  onMessage(topic: string, handler: (message: MqttMessage) => void): void {
    console.log('📝 메시지 핸들러 등록 (Backend WebSocket):', topic);
    this.backendService.onMessage(topic, handler);
  }

  offMessage(topic: string, handler?: (message: MqttMessage) => void): void {
    console.log('📝 메시지 핸들러 해제 (Backend WebSocket):', topic);
    this.backendService.offMessage(topic, handler);
  }

  // 연결 상태 변경 핸들러
  onConnectionChange(handler: (connected: boolean) => void): void {
    this.backendService.onConnectionChange(handler);
  }

  offConnectionChange(handler: (connected: boolean) => void): void {
    this.backendService.offConnectionChange(handler);
  }

  // 상태 확인 메서드들
  isConnected(): boolean {
    return this.backendService.isConnected();
  }

  getSubscriptions(): string[] {
    return this.backendService.getSubscriptions();
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    return this.backendService.getConnectionStatus();
  }

  getLastError(): string | null {
    return this.backendService.getLastError();
  }

  clearMessages(): void {
    this.backendService.clearMessages();
  }

  // 🎯 추가 Backend API 메서드들 (기존 코드에서 사용 가능)
  async getSystemHealth() {
    return this.backendService.getSystemHealth();
  }

  async getSensorData() {
    return this.backendService.getSensorData();
  }

  async getRobotStatus() {
    return this.backendService.getRobotStatus();
  }

  async getTopicMapping() {
    return this.backendService.getTopicMapping();
  }
}

export default BrowserMqttService;