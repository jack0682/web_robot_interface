/**
 * MQTT 메시지 타입 정의
 * 백엔드 MQTT Processor와 동기화된 타입 스키마
 */

// 기본 MQTT 메시지 구조
export interface MqttMessage {
  type: string;
  topic?: string;
  data?: any;
  timestamp: string;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

// WebSocket 메시지 타입
export interface WebSocketMessage extends MqttMessage {
  clientId?: string;
  subscriptions?: string[];
}

// ROS2 토픽 리스트 메시지
export interface ROS2TopicListMessage {
  total: number;
  categories: {
    robotControl: string[];
    robotStatus: string[];
    navigation: string[];
    diagnostics: string[];
    system: string[];
    other: string[];
  };
  changes: {
    added: string[];
    removed: string[];
  };
  health: {
    status: 'healthy' | 'warning' | 'error';
    issues: string[];
    recommendations: string[];
  };
  timestamp: string;
}

// 무게센서 데이터 메시지
export interface WeightSensorMessage {
  original: any;
  processed: {
    weight: number;
    unit: string;
    status: 'normal' | 'empty' | 'heavy' | 'out_of_range';
    quality: 'good' | 'warning' | 'poor' | 'filtered';
    timestamp: string;
    processing_info: {
      input_type: string;
      raw_value: number;
      filtered: boolean;
    };
  };
}

// 농도 제어 메시지
export interface ConcentrationMessage {
  original: any;
  processed: {
    target: number;
    unit: string;
    source: string;
    valid: boolean;
    clamped: boolean;
    timestamp: string;
  };
}

// 로봇 제어 명령 메시지
export interface RobotControlMessage {
  topic: string;
  command_type: 'move_joint' | 'move_linear' | 'emergency_stop' | 'stop' | 'home' | 'speed_control' | 'servo_control' | 'jog';
  original: any;
  validation: {
    status: 'accepted' | 'rejected';
    reason?: string;
    validated_data?: any;
    safety_checks: string[];
    warnings?: string[];
  };
  timestamp: string;
  safety_level: 'critical' | 'normal' | 'safe' | 'low' | 'blocked' | 'unknown';
}

// 시스템 헬스 메시지
export interface SystemHealthMessage {
  status: 'healthy' | 'degraded' | 'error';
  mqtt_connected: boolean;
  ws_clients: number;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  handlers: any;
  timestamp: string;
}

// 에러 메시지
export interface ErrorMessage extends MqttMessage {
  type: 'error';
  topic: string;
  error: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

// 비상정지 메시지
export interface EmergencyMessage extends MqttMessage {
  type: 'emergency';
  action: 'emergency_stop';
  source: string;
  timestamp: string;
}

// 연결 상태 메시지
export interface ConnectionMessage extends MqttMessage {
  type: 'connection';
  status: 'connected' | 'disconnected' | 'reconnecting';
  clientId: string;
  mqttStatus: boolean;
  timestamp: string;
}

// 구독 메시지
export interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  topic: string;
  timestamp: string;
}

// 토픽별 메시지 유니온 타입
export type TopicMessage = 
  | ROS2TopicListMessage
  | WeightSensorMessage
  | ConcentrationMessage
  | RobotControlMessage
  | SystemHealthMessage
  | ErrorMessage
  | EmergencyMessage
  | ConnectionMessage;

// MQTT 토픽 구독 상태
export interface MqttSubscription {
  topic: string;
  qos: 0 | 1 | 2;
  subscribed: boolean;
  lastMessage?: MqttMessage;
  messageCount: number;
  lastActivity: string;
}

// MQTT 연결 상태
export interface MqttConnectionState {
  connected: boolean;
  connecting: boolean;
  connectionAttempts: number;
  lastError?: string;
  subscriptions: Map<string, MqttSubscription>;
  clientId: string;
  serverInfo?: {
    host: string;
    port: number;
    protocol: string;
  };
}

// 메시지 핸들러 타입
export type MessageHandler<T = any> = (message: T) => void;

// 토픽 핸들러 맵
export interface TopicHandlers {
  'ros2_topic_list': MessageHandler<ROS2TopicListMessage>;
  'topic': MessageHandler<WeightSensorMessage>;
  'web/target_concentration': MessageHandler<ConcentrationMessage>;
  'robot/control/+': MessageHandler<RobotControlMessage>;
  'system/health': MessageHandler<SystemHealthMessage>;
  'error': MessageHandler<ErrorMessage>;
  'emergency': MessageHandler<EmergencyMessage>;
  'connection': MessageHandler<ConnectionMessage>;
  [key: string]: MessageHandler<any>;
}

// MQTT 이벤트 타입
export type MqttEventType = 
  | 'connect'
  | 'disconnect'
  | 'message'
  | 'error'
  | 'subscribe'
  | 'unsubscribe'
  | 'reconnect';

// MQTT 설정
export interface MqttConfig {
  brokerUrl: string;
  clientId: string;
  username?: string;
  password?: string;
  keepalive?: number;
  connectTimeout?: number;
  reconnectPeriod?: number;
  clean?: boolean;
  rejectUnauthorized?: boolean;
}

// WebSocket 설정
export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval?: number;
  pongTimeout?: number;
}

export default MqttMessage;
