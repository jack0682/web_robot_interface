/**
 * 센서 데이터 타입 정의
 * 무게센서, 농도센서 등 모든 센서 타입
 */

// 기본 센서 인터페이스
export interface BaseSensor {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  lastUpdate: string;
  errorStatus?: string;
}

// 센서 값 품질 지표
export type DataQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'error';

// 무게센서 데이터
export interface WeightSensorData extends BaseSensor {
  type: 'weight';
  value: number; // kg
  unit: 'kg' | 'g' | 'lb';
  rawValue: number;
  calibrated: boolean;
  quality: DataQuality;
  status: 'normal' | 'empty' | 'overload' | 'underload' | 'error';
  
  // 센서 설정
  config: {
    minValue: number;
    maxValue: number;
    precision: number; // 소수점 자릿수
    calibrationOffset: number;
    noiseThreshold: number;
  };
  
  // 통계 정보
  stats?: {
    average: number;
    min: number;
    max: number;
    standardDeviation: number;
    sampleCount: number;
  };
}

// 농도센서 데이터
export interface ConcentrationSensorData extends BaseSensor {
  type: 'concentration';
  currentValue: number; // %
  targetValue: number; // %
  unit: '%' | 'ppm' | 'mg/L';
  tolerance: number; // ±%
  quality: DataQuality;
  status: 'normal' | 'high' | 'low' | 'adjusting' | 'error';
  
  // 제어 설정
  config: {
    minValue: number;
    maxValue: number;
    precision: number;
    responseTime: number; // seconds
    controlEnabled: boolean;
  };
  
  // 제어 히스토리
  controlHistory?: {
    timestamp: string;
    targetValue: number;
    actualValue: number;
    adjustment: number;
    source: string;
  }[];
}

// 온도센서 데이터
export interface TemperatureSensorData extends BaseSensor {
  type: 'temperature';
  value: number; // °C
  unit: '°C' | '°F' | 'K';
  quality: DataQuality;
  status: 'normal' | 'high' | 'low' | 'critical' | 'error';
  
  config: {
    minValue: number;
    maxValue: number;
    criticalThreshold: number;
    warningThreshold: number;
    precision: number;
  };
  
  alarmState?: {
    active: boolean;
    level: 'warning' | 'critical';
    message: string;
  };
}

// 압력센서 데이터
export interface PressureSensorData extends BaseSensor {
  type: 'pressure';
  value: number; // Pa, bar, psi 등
  unit: 'Pa' | 'kPa' | 'MPa' | 'bar' | 'psi';
  quality: DataQuality;
  status: 'normal' | 'high' | 'low' | 'critical' | 'error';
  
  config: {
    minValue: number;
    maxValue: number;
    warningThreshold: number;
    criticalThreshold: number;
    precision: number;
  };
}

// pH센서 데이터
export interface PHSensorData extends BaseSensor {
  type: 'ph';
  value: number; // pH 0-14
  unit: 'pH';
  quality: DataQuality;
  status: 'normal' | 'acidic' | 'basic' | 'critical' | 'error';
  
  config: {
    neutralRange: { min: number; max: number }; // 중성 범위
    warningRange: { min: number; max: number };
    precision: number;
    calibrationDate?: string;
  };
}

// 진동센서 데이터
export interface VibrationSensorData extends BaseSensor {
  type: 'vibration';
  amplitude: number; // mm/s 또는 g
  frequency: number; // Hz
  unit: 'mm/s' | 'g' | 'm/s²';
  quality: DataQuality;
  status: 'normal' | 'elevated' | 'high' | 'critical' | 'error';
  
  config: {
    normalThreshold: number;
    warningThreshold: number;
    criticalThreshold: number;
    frequencyRange: { min: number; max: number };
  };
  
  spectrumData?: {
    frequencies: number[];
    amplitudes: number[];
  };
}

// 센서 데이터 유니온 타입
export type SensorData = 
  | WeightSensorData
  | ConcentrationSensorData
  | TemperatureSensorData
  | PressureSensorData
  | PHSensorData
  | VibrationSensorData;

// 센서 시스템 상태
export interface SensorSystemState {
  sensors: Map<string, SensorData>;
  totalSensors: number;
  connectedSensors: number;
  activeSensors: number;
  errorSensors: number;
  lastUpdate: string;
  systemHealth: 'healthy' | 'warning' | 'error' | 'critical';
}

// 센서 알람 정보
export interface SensorAlarm {
  sensorId: string;
  sensorName: string;
  alarmType: 'warning' | 'critical' | 'error';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
  autoReset: boolean;
}

// 센서 트렌드 데이터
export interface SensorTrendData {
  sensorId: string;
  timeRange: 'hour' | 'day' | 'week' | 'month';
  dataPoints: {
    timestamp: string;
    value: number;
    quality: DataQuality;
  }[];
  statistics: {
    min: number;
    max: number;
    average: number;
    median: number;
    standardDeviation: number;
  };
}

// 센서 캘리브레이션 정보
export interface SensorCalibration {
  sensorId: string;
  calibrationType: 'zero' | 'span' | 'two_point' | 'multipoint';
  lastCalibration: string;
  nextCalibration?: string;
  calibrationValues: {
    reference: number;
    measured: number;
    offset: number;
  }[];
  accuracy: number; // %
  driftRate: number; // per day
}

// 센서 설정
export interface SensorConfig {
  sensorId: string;
  enabled: boolean;
  sampleRate: number; // Hz
  filterEnabled: boolean;
  filterType?: 'lowpass' | 'highpass' | 'bandpass' | 'moving_average';
  filterParameters?: any;
  alarmEnabled: boolean;
  alarmThresholds: {
    warning: { min?: number; max?: number };
    critical: { min?: number; max?: number };
  };
  dataLogging: {
    enabled: boolean;
    interval: number; // seconds
    retention: number; // days
  };
}

// 센서 진단 정보
export interface SensorDiagnostics {
  sensorId: string;
  connectionStatus: 'connected' | 'disconnected' | 'unstable';
  signalQuality: DataQuality;
  noiseLevel: number;
  driftAmount: number;
  responseTime: number; // ms
  lastDiagnostic: string;
  diagnosticTests: {
    name: string;
    status: 'pass' | 'fail' | 'warning';
    value?: number;
    expected?: number;
    message?: string;
  }[];
}

// 센서 데이터 처리 옵션
export interface SensorDataProcessing {
  enableFiltering: boolean;
  filterType: 'none' | 'moving_average' | 'exponential' | 'kalman';
  filterWindow: number;
  enableOutlierDetection: boolean;
  outlierThreshold: number; // standard deviations
  enableSmoothing: boolean;
  smoothingFactor: number;
}

export default SensorData;
