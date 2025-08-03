/**
 * 통합 로봇 제어 시스템 타입 정의
 * 모든 타입의 완전한 일관성과 상호 호환성 보장
 */

// ===== 기본 유틸리티 타입 =====
export type Timestamp = string;
export type Quality = 'excellent' | 'good' | 'fair' | 'poor' | 'error';
export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'reconnecting';

// ===== 로봇 관련 타입 =====
export type RobotStatus = 'disconnected' | 'connected' | 'idle' | 'moving' | 'stopped' | 'error' | 'emergency' | 'homing';
export type RobotMode = 'manual' | 'auto' | 'program' | 'teaching';
export type SafetyStatus = 'normal' | 'warning' | 'emergency' | 'protective_stop';
export type OperationMode = 'manual' | 'auto' | 'teaching';
export type ConnectionQuality = 'disconnected' | 'excellent' | 'good' | 'poor';

// ===== 로봇 정보 =====
export interface RobotInfo {
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  ipAddress: string;
  port: number;
  lastMaintenance?: string;
}

// ===== 3D 포즈 및 위치 =====
export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface Rotation3D {
  rx: number;
  ry: number;
  rz: number;
}

export interface RobotPose extends Position3D, Rotation3D {
  // 카르테시안 좌표 (mm, degrees)
}

export interface CartesianPosition extends RobotPose {
  // 별칭으로 사용
}

// ===== 조인트 관련 =====
export interface JointLimits {
  min: number;
  max: number;
}

export interface Joint {
  id: number;
  name: string;
  position: number; // degrees
  velocity?: number; // degrees/s
  effort?: number; // Nm
  temperature?: number; // °C
  limits: JointLimits;
  enabled?: boolean;
}

export interface JointState {
  joints: [Joint, Joint, Joint, Joint, Joint, Joint]; // 6축 고정
  positions: number[]; // 별칭 배열
  velocities: number[]; // 별칭 배열
  efforts: number[]; // 별칭 배열
  temperatures: number[]; // 별칭 배열
  timestamp: Timestamp;
}

export interface RobotPostureState {
  position: RobotPose;
  jointsAngle: number[]; // 6개 조인트 각도
  timestamp: Timestamp;
}

// ===== 완전한 로봇 상태 =====
export interface RobotState {
  // 기본 정보
  info: RobotInfo;
  status: RobotStatus;
  mode: RobotMode;
  pose: RobotPostureState;
  jointState: JointState;
  
  // 운동 상태
  isMoving: boolean;
  speed: number; // %
  acceleration: number; // %
  
  // 안전 및 상태
  safetyStatus: SafetyStatus;
  errorCodes: string[];
  connectionQuality: ConnectionQuality;
  
  // 확장 속성 (에러 해결용)
  isConnected: boolean;
  errorMessage: string | null;
  lastUpdate: Timestamp;
  operationMode: OperationMode;
  batteryLevel: number | null;
  temperature: number | null;
  jointPositions: number[];
  endEffectorPosition: RobotPose | null;
  
  // 추가 누락 프로퍼티들
  cartesianPosition?: RobotPose;
  jointVelocities?: number[];
  jointTorques?: number[];
  robotMode?: RobotMode;
  currentProgram?: any;
}

// ===== 로봇 명령 시스템 =====
export type CommandType = 
  | 'move_joint' 
  | 'move_linear' 
  | 'move_circular'
  | 'stop' 
  | 'emergency_stop' 
  | 'home' 
  | 'set_speed'
  | 'set_mode'
  | 'calibrate'
  | 'speed_control'
  | 'servo_control'
  | 'jog';

export interface BaseCommand {
  id: string;
  type: CommandType;
  timestamp: Timestamp;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface JointMoveCommand extends BaseCommand {
  type: 'move_joint';
  payload: {
    positions: number[]; // 6개 조인트 각도
    speed?: number;
    acceleration?: number;
    waitForCompletion?: boolean;
  };
}

export interface LinearMoveCommand extends BaseCommand {
  type: 'move_linear';
  payload: {
    target: RobotPose;
    speed?: number;
    acceleration?: number;
    blendRadius?: number;
    waitForCompletion?: boolean;
  };
}

export interface CircularMoveCommand extends BaseCommand {
  type: 'move_circular';
  payload: {
    via: RobotPose;
    target: RobotPose;
    speed?: number;
    acceleration?: number;
    waitForCompletion?: boolean;
  };
}

export interface EmergencyStopCommand extends BaseCommand {
  type: 'emergency_stop';
  payload: {
    reason: string;
    source: string;
  };
}

export type RobotCommand = 
  | JointMoveCommand 
  | LinearMoveCommand 
  | CircularMoveCommand
  | EmergencyStopCommand;

export interface CommandResult {
  commandId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';
  message?: string;
  error?: string;
  executionTime?: number;
  timestamp: Timestamp;
}

// ===== 액션 시스템 =====
export type RobotActionType = 
  | 'SET_CONNECTION_STATUS'
  | 'SET_ROBOT_STATUS'
  | 'SET_JOINT_POSITIONS'
  | 'SET_END_EFFECTOR_POSITION'
  | 'SET_ROBOT_MODE'
  | 'SET_MOVING_STATUS'
  | 'SET_SPEED'
  | 'SET_ERROR_MESSAGE'
  | 'SET_OPERATION_MODE'
  | 'SET_SAFETY_STATUS'
  | 'SET_SYSTEM_INFO'
  | 'UPDATE_ROBOT_STATE';

export interface RobotAction {
  type: RobotActionType;
  payload: any;
  timestamp?: Timestamp;
}

// ===== 센서 시스템 통합 =====
export interface BaseSensorData {
  id: string;
  name: string;
  value: number;
  unit: string;
  quality: Quality;
  timestamp: Timestamp;
  status: 'normal' | 'warning' | 'error';
}

export interface WeightSensorData extends BaseSensorData {
  weight: number; // kg
  unit: 'kg' | 'g' | 'lb';
  type?: string;
  connected?: boolean;
  lastUpdate?: string;
  rawValue?: number;
  calibrated?: boolean;
  config?: any;
  processed?: {
    weight: number;
    smoothed: boolean;
  };
}

export interface ConcentrationSensorData extends BaseSensorData {
  targetValue: number; // ppm 또는 %
  unit: 'ppm' | '%' | 'mg/L';
  type?: string;
  connected?: boolean;
  lastUpdate?: string;
  currentValue?: number;
  tolerance?: number;
  config?: any;
  processed?: {
    target: number;
    filtered: boolean;
  };
}

// ===== 메시지 타입 (MQTT/WebSocket 호환) =====
export interface WeightSensorMessage extends WeightSensorData {
  // 완전 호환성을 위한 확장
}

export interface ConcentrationMessage extends ConcentrationSensorData {
  // 완전 호환성을 위한 확장
}

// ===== MQTT 시스템 =====
export interface MqttMessage {
  type: string;
  topic?: string;
  data?: any;
  timestamp: Timestamp;
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

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
  timestamp: Timestamp;
}

export interface RobotControlMessage {
  topic: string;
  command_type: CommandType;
  original: any;
  validation: {
    status: 'accepted' | 'rejected';
    reason?: string;
    validated_data?: any;
    safety_checks: string[];
    warnings?: string[];
  };
  timestamp: Timestamp;
  safety_level: 'critical' | 'normal' | 'safe' | 'low' | 'blocked' | 'unknown';
}

// ===== 설정 시스템 =====
export interface WebSocketConfig {
  url: string;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  pingInterval?: number;
  pongTimeout?: number;
  reconnectInterval?: number;
}

export interface MqttConfig {
  brokerUrl: string;
  clientId: string;
  keepalive: number;
  reconnectPeriod: number;
  clean: boolean;
}

export interface AppConfig {
  API_BASE_URL: string;
  WS_URL: string;
  MQTT_BROKER_URL: string;
  MQTT_CLIENT_ID: string;
  ROBOT_IP: string;
  ROBOT_PORT: number;
  
  UPDATE_INTERVALS: {
    ROBOT_STATUS: number;
    JOINT_POSITIONS: number;
    SENSOR_DATA: number;
    CHART_REFRESH: number;
    CONNECTION_CHECK: number;
  };
  
  CHART: {
    MAX_DATA_POINTS: number;
    UPDATE_RATE: number;
    ANIMATION_DURATION: number;
  };
  
  MQTT: MqttConfig;
  
  THRESHOLDS: {
    WEIGHT_MIN: number;
    WEIGHT_MAX: number;
    CONCENTRATION_MIN: number;
    CONCENTRATION_MAX: number;
  };
  
  DEVELOPMENT: {
    ENABLE_MOCK_DATA: boolean;
    LOG_LEVEL: string;
  };
  
  websocket: WebSocketConfig;
}

// ===== Hook 반환 타입 =====
export interface MqttDataHookReturn {
  // 기본 연결 상태
  isConnected: boolean;
  connectionAttempts: number;
  lastMessage: MqttMessage | null;
  
  // 센서 데이터
  weightSensor: WeightSensorMessage | null;
  concentration: ConcentrationMessage | null;
  
  // ROS2 데이터
  ros2Topics: ROS2TopicListMessage | null;
  robotCommands: RobotControlMessage[];
  
  // 통합 센서 데이터 (에러 해결용)
  sensorData: {
    weight: WeightSensorMessage | null;
    concentration: ConcentrationMessage | null;
    temperature?: any;
  };
  
  // 상태 정보
  connectionStatus: ConnectionStatus;
  lastUpdate: Timestamp | null;
  messageCount: number;
  subscriptions: string[];
  error: string | null;
  warnings: string[];
  
  // 제어 함수
  subscribe: (topic: string) => void;
  unsubscribe: (topic: string) => void;
  reconnect: () => void;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  quality?: Quality;
  label?: string;
  weight?: number;
  concentration?: number;
  temperature?: number;
  vibration?: number;
}

export interface RealtimeChartHookReturn {
  // 차트 데이터
  weightData: ChartDataPoint[];
  concentrationData: ChartDataPoint[];
  temperatureData: ChartDataPoint[];
  customData: Map<string, ChartDataPoint[]>;
  
  // 통합 데이터 (에러 해결용)
  data: ChartDataPoint[];
  
  // 상태
  isLoading: boolean;
  isUpdating: boolean;
  error: string | null;
  lastUpdate: Timestamp | null;
  
  // 통계
  weightStats: { min: number; max: number; avg: number; current: number } | null;
  concentrationStats: { min: number; max: number; avg: number; current: number } | null;
  
  // 제어 함수
  addCustomDataPoint: (key: string, point: ChartDataPoint) => void;
  clearData: (dataKey?: string) => void;
  exportData: (dataKey: string, format: 'json' | 'csv') => string;
  updateConfig: (config: any) => void;
}

// ===== 스토어 타입 =====
export interface RobotStore extends RobotState {
  // 추가 상태
  commandQueue: RobotCommand[];
  commandHistory: CommandResult[];
  isCommandInProgress: boolean;
  selectedJoint: number | null;
  
  // 서비스 인스턴스
  commandService: any; // CommandSenderService
  
  // 액션 메서드
  updateRobotState: (state: Partial<RobotState>) => void;
  updateJointPosition: (jointIndex: number, position: number) => void;
  updateCartesianPosition: (position: Partial<CartesianPosition>) => void;
  setRobotStatus: (status: RobotStatus) => void;
  setRobotMode: (mode: RobotMode) => void;
  
  // 명령 메서드
  sendJointMoveCommand: (positions: number[], speed?: number, acceleration?: number) => Promise<boolean>;
  sendLinearMoveCommand: (position: CartesianPosition, speed?: number, acceleration?: number) => Promise<boolean>;
  sendStopCommand: () => Promise<boolean>;
  sendEmergencyStop: () => Promise<boolean>;
  sendHomeCommand: (speed?: number) => Promise<boolean>;
  setRobotSpeed: (speed: number) => Promise<boolean>;
  
  // 큐 관리
  addCommandToQueue: (command: RobotCommand) => void;
  removeCommandFromQueue: (commandId: string) => void;
  clearCommandQueue: () => void;
  executeNextCommand: () => Promise<void>;
  
  // 히스토리 관리
  addCommandResult: (result: CommandResult) => void;
  clearCommandHistory: () => void;
  
  // 선택 관리
  selectJoint: (jointIndex: number | null) => void;
  
  // 유틸리티
  getCurrentPose: () => { joints: number[]; cartesian: CartesianPosition };
  isRobotReady: () => boolean;
  canSendCommand: () => boolean;
  getConnectionStatus: () => ConnectionStatus;
}

// ===== 기본값 정의 =====
export const DEFAULT_ROBOT_INFO: RobotInfo = {
  model: 'M0609',
  serialNumber: 'Unknown',
  firmwareVersion: 'Unknown',
  ipAddress: '192.168.137.100',
  port: 12345,
};

export const DEFAULT_ROBOT_POSE: RobotPose = {
  x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0,
};

export const DEFAULT_JOINT_STATE: JointState = {
  joints: [
    { id: 1, name: 'Base', position: 0, limits: { min: -360, max: 360 } },
    { id: 2, name: 'Shoulder', position: 0, limits: { min: -95, max: 95 } },
    { id: 3, name: 'Elbow', position: 0, limits: { min: -180, max: 180 } },
    { id: 4, name: 'Wrist1', position: 0, limits: { min: -360, max: 360 } },
    { id: 5, name: 'Wrist2', position: 0, limits: { min: -180, max: 180 } },
    { id: 6, name: 'Wrist3', position: 0, limits: { min: -360, max: 360 } },
  ] as [Joint, Joint, Joint, Joint, Joint, Joint],
  positions: [0, 0, 0, 0, 0, 0],
  velocities: [0, 0, 0, 0, 0, 0],
  efforts: [0, 0, 0, 0, 0, 0],
  temperatures: [0, 0, 0, 0, 0, 0],
  timestamp: new Date().toISOString(),
};

export const DEFAULT_ROBOT_STATE: RobotState = {
  info: DEFAULT_ROBOT_INFO,
  status: 'disconnected',
  mode: 'manual',
  pose: {
    position: DEFAULT_ROBOT_POSE,
    jointsAngle: [0, 0, 0, 0, 0, 0],
    timestamp: new Date().toISOString(),
  },
  jointState: DEFAULT_JOINT_STATE,
  isMoving: false,
  speed: 50,
  acceleration: 50,
  safetyStatus: 'normal',
  errorCodes: [],
  connectionQuality: 'disconnected',
  isConnected: false,
  errorMessage: null,
  lastUpdate: new Date().toISOString(),
  operationMode: 'manual',
  batteryLevel: null,
  temperature: null,
  jointPositions: [0, 0, 0, 0, 0, 0],
  endEffectorPosition: null,
};
