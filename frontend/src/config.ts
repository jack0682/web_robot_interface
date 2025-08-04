/**
 * 애플리케이션 설정 파일 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import { AppConfig } from './types/robotTypes';

// 환경 변수 기본값
const CONFIG: AppConfig = {
  // API 설정 - Backend 포트 5001로 수정
  API_BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:5001',
  WS_URL: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
  
  // MQTT 설정 - Backend WebSocket으로 변경
  MQTT_BROKER_URL: process.env.REACT_APP_MQTT_BROKER_URL || 'ws://localhost:8080',
  MQTT_CLIENT_ID: process.env.REACT_APP_MQTT_CLIENT_ID || `robot_dashboard_${Date.now()}`,
  
  // 로봇 설정
  ROBOT_IP: process.env.REACT_APP_ROBOT_IP || '192.168.137.100',
  ROBOT_PORT: parseInt(process.env.REACT_APP_ROBOT_PORT || '12345'),
  
  // 업데이트 주기 (ms)
  UPDATE_INTERVALS: {
    ROBOT_STATUS: 100,     // 로봇 상태 업데이트
    JOINT_POSITIONS: 50,   // 조인트 위치 업데이트
    SENSOR_DATA: 200,      // 센서 데이터 업데이트
    CHART_REFRESH: 1000,   // 차트 새로고침
    CONNECTION_CHECK: 5000 // 연결 상태 확인
  },
  
  // 차트 설정
  CHART: {
    MAX_DATA_POINTS: 100,  // 차트에 표시할 최대 데이터 포인트
    UPDATE_RATE: 1000,     // 차트 업데이트 주기
    ANIMATION_DURATION: 300
  },
  
  // MQTT 상세 설정
  MQTT: {
    brokerUrl: process.env.REACT_APP_MQTT_BROKER_URL || 'ws://localhost:8080',
    clientId: process.env.REACT_APP_MQTT_CLIENT_ID || `robot_dashboard_${Date.now()}`,
    keepalive: 60,
    reconnectPeriod: 1000,
    clean: true
  },
  
  // 임계값 설정
  THRESHOLDS: {
    WEIGHT_MIN: -1.0,
    WEIGHT_MAX: 100.0,
    CONCENTRATION_MIN: 0.0,
    CONCENTRATION_MAX: 100.0
  },
  
  // 개발 모드 설정
  DEVELOPMENT: {
    ENABLE_MOCK_DATA: process.env.REACT_APP_MOCK_DATA === 'true',
    LOG_LEVEL: process.env.REACT_APP_LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'warn')
  },
  
  // WebSocket 설정
  websocket: {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    maxReconnectAttempts: 3, // 재연결 시도 횟수 감소
    reconnectDelay: 2000, // 재연결 지연 증가
    pingInterval: 60000, // Ping 간격 증가 (1분)
    pongTimeout: 10000
  }
};

// 조인트 제한값 (Doosan M0609 기준)
export const JOINT_LIMITS = [
  { min: -360, max: 360, name: 'Base' },      // J1
  { min: -95, max: 95, name: 'Shoulder' },    // J2
  { min: -180, max: 180, name: 'Elbow' },     // J3
  { min: -360, max: 360, name: 'Wrist1' },    // J4
  { min: -180, max: 180, name: 'Wrist2' },    // J5
  { min: -360, max: 360, name: 'Wrist3' }     // J6
];

// 카르테시안 작업공간 제한값
export const CARTESIAN_LIMITS = {
  x: { min: -1000, max: 1000 },   // mm
  y: { min: -1000, max: 1000 },   // mm
  z: { min: 0, max: 1000 },       // mm
  rx: { min: -180, max: 180 },    // degrees
  ry: { min: -180, max: 180 },    // degrees
  rz: { min: -180, max: 180 }     // degrees
};

// 안전 설정
export const SAFETY_SETTINGS = {
  MAX_VELOCITY: 100,              // mm/s
  MAX_ACCELERATION: 100,          // mm/s²
  EMERGENCY_STOP_TIMEOUT: 5000,   // ms
  PROTECTIVE_STOP_TIMEOUT: 10000, // ms
  CONNECTION_TIMEOUT: 3000        // ms
};

// UI 설정
export const UI_SETTINGS = {
  THEME: process.env.REACT_APP_THEME || 'auto', // 'light', 'dark', 'auto'
  ANIMATION_ENABLED: process.env.REACT_APP_ANIMATIONS !== 'false',
  TOAST_DURATION: 4000,
  LOADING_TIMEOUT: 30000,
  SIDEBAR_COLLAPSED: false
};

// 로깅 설정
export const LOGGING = {
  LEVEL: process.env.REACT_APP_LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  ENABLE_CONSOLE: process.env.NODE_ENV === 'development',
  ENABLE_REMOTE: process.env.REACT_APP_REMOTE_LOGGING === 'true'
};

// 차트 색상 팔레트
export const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'
];

// MQTT 토픽 설정 - 정밀 수정된 토픽 매핑
export const MQTT_TOPICS = {
  WEIGHT_SENSOR: 'scale/raw',              // 무게센서 데이터 (아두이노)
  ROS2_TOPICS: 'test',                     // ROS2 토픽 리스트 (모든 토픽 JSON 형식)
  CONCENTRATION: 'web/target_concentration', // 농도 목표값 (웹 인터페이스)
  ROBOT_CONTROL: 'robot/control/+',        // 로봇 제어 명령
  SYSTEM_HEALTH: 'system/health',          // 시스템 상태
  
  // 하위 호환성 유지
  ROBOT_STATUS: 'robot/status',
  ROBOT_JOINTS: 'robot/joint_positions',
  ROBOT_ERROR: 'robot/error',
  SYSTEM_PING: 'system/ping'
};

// 설정 유효성 검사
const validateConfig = (): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // 필수 URL 검사
  try {
    new URL(CONFIG.API_BASE_URL);
  } catch {
    errors.push('Invalid API_BASE_URL');
  }
  
  try {
    new URL(CONFIG.WS_URL);
  } catch {
    errors.push('Invalid WS_URL');
  }
  
  // 포트 번호 검사
  if (CONFIG.ROBOT_PORT < 1 || CONFIG.ROBOT_PORT > 65535) {
    errors.push('Invalid ROBOT_PORT range');
  }
  
  // 업데이트 주기 검사
  Object.entries(CONFIG.UPDATE_INTERVALS).forEach(([key, interval]) => {
    if (interval < 10 || interval > 60000) {
      errors.push(`Invalid update interval for ${key}: ${interval}`);
    }
  });
  
  // MQTT 설정 검사
  if (!CONFIG.MQTT.clientId || CONFIG.MQTT.clientId.length === 0) {
    errors.push('Invalid MQTT client ID');
  }
  
  if (CONFIG.MQTT.keepalive < 10 || CONFIG.MQTT.keepalive > 300) {
    errors.push('Invalid MQTT keepalive period');
  }
  
  // 차트 설정 검사
  if (CONFIG.CHART.MAX_DATA_POINTS < 10 || CONFIG.CHART.MAX_DATA_POINTS > 1000) {
    errors.push('Invalid chart max data points');
  }
  
  // 임계값 검사
  if (CONFIG.THRESHOLDS.WEIGHT_MIN >= CONFIG.THRESHOLDS.WEIGHT_MAX) {
    errors.push('Invalid weight thresholds');
  }
  
  if (CONFIG.THRESHOLDS.CONCENTRATION_MIN >= CONFIG.THRESHOLDS.CONCENTRATION_MAX) {
    errors.push('Invalid concentration thresholds');
  }
  
  if (errors.length > 0) {
    console.error('⚠️ Configuration validation errors:', errors);
  } else {
    console.log('✅ Configuration validation passed');
  }
  
  return { isValid: errors.length === 0, errors };
};

// 환경별 설정 오버라이드
const getEnvironmentConfig = (): AppConfig => {
  const env = process.env.NODE_ENV;
  
  switch (env) {
    case 'development':
      return {
        ...CONFIG,
        DEVELOPMENT: {
          ENABLE_MOCK_DATA: true,
          LOG_LEVEL: 'debug'
        },
        UPDATE_INTERVALS: {
          ...CONFIG.UPDATE_INTERVALS,
          ROBOT_STATUS: 200,     // 개발 시 좀 더 느리게
          JOINT_POSITIONS: 100,
          SENSOR_DATA: 500
        }
      };
      
    case 'production':
      return {
        ...CONFIG,
        DEVELOPMENT: {
          ENABLE_MOCK_DATA: false,
          LOG_LEVEL: 'warn'
        },
        UPDATE_INTERVALS: {
          ...CONFIG.UPDATE_INTERVALS,
          ROBOT_STATUS: 50,      // 프로덕션에서는 더 빠르게
          JOINT_POSITIONS: 30,
          SENSOR_DATA: 100
        }
      };
      
    case 'test':
      return {
        ...CONFIG,
        DEVELOPMENT: {
          ENABLE_MOCK_DATA: true,
          LOG_LEVEL: 'error'
        },
        UPDATE_INTERVALS: {
          ROBOT_STATUS: 1000,
          JOINT_POSITIONS: 1000,
          SENSOR_DATA: 1000,
          CHART_REFRESH: 2000,
          CONNECTION_CHECK: 10000
        },
        MQTT: {
          ...CONFIG.MQTT,
          brokerUrl: 'ws://localhost:8080', // 테스트용 브로커
          clientId: `test_client_${Date.now()}`
        }
      };
      
    default:
      return CONFIG;
  }
};

// 런타임 설정 업데이트 함수
export const updateConfig = (updates: Partial<AppConfig>): AppConfig => {
  Object.assign(finalConfig, updates);
  console.log('🔧 Configuration updated:', updates);
  return finalConfig;
};

// 설정값 조회 헬퍼 함수들
export const getApiUrl = (endpoint: string): string => {
  return `${finalConfig.API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
};

export const getWebSocketUrl = (): string => {
  return finalConfig.websocket.url;
};

export const getMqttConfig = () => {
  return finalConfig.MQTT;
};

export const getUpdateInterval = (type: keyof AppConfig['UPDATE_INTERVALS']): number => {
  return finalConfig.UPDATE_INTERVALS[type];
};

export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

export const isProduction = (): boolean => {
  return process.env.NODE_ENV === 'production';
};

export const isMockDataEnabled = (): boolean => {
  return finalConfig.DEVELOPMENT.ENABLE_MOCK_DATA;
};

export const getLogLevel = (): string => {
  return finalConfig.DEVELOPMENT.LOG_LEVEL;
};

// 환경별 설정 적용
const finalConfig = getEnvironmentConfig();

// 설정 유효성 검사 실행
const validation = validateConfig();
if (!validation.isValid) {
  console.error('❌ Critical configuration errors detected:', validation.errors);
  // 개발 환경에서만 에러 발생, 프로덕션에서는 경고만
  if (process.env.NODE_ENV === 'development') {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }
}

// 설정 정보 로깅 (개발 환경에서만)
if (isDevelopment()) {
  console.log('🛠️ Application Configuration:', {
    environment: process.env.NODE_ENV,
    apiUrl: finalConfig.API_BASE_URL,
    wsUrl: finalConfig.WS_URL,
    mqttBroker: finalConfig.MQTT_BROKER_URL,
    robotIp: finalConfig.ROBOT_IP,
    mockData: finalConfig.DEVELOPMENT.ENABLE_MOCK_DATA,
    logLevel: finalConfig.DEVELOPMENT.LOG_LEVEL
  });
}

// 최종 설정 내보내기
export default finalConfig;

// 개별 설정 섹션 내보내기 (편의성을 위해)
export const {
  API_BASE_URL,
  WS_URL,
  MQTT_BROKER_URL,
  MQTT_CLIENT_ID,
  ROBOT_IP,
  ROBOT_PORT,
  UPDATE_INTERVALS,
  CHART,
  MQTT,
  THRESHOLDS,
  DEVELOPMENT
} = finalConfig;

// 타입 내보내기
export type { AppConfig } from './types/robotTypes';