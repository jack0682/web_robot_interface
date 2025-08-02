// 애플리케이션 설정
export const config = {
  // API 엔드포인트
  api: {
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:5000',
    timeout: 5000,
  },

  // WebSocket 설정
  websocket: {
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:8080',
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
  },

  // MQTT 설정
  mqtt: {
    brokerUrl: process.env.REACT_APP_MQTT_URL || 'ws://localhost:8083/mqtt',
    clientId: `dashboard_${Math.random().toString(16).slice(2)}`,
    username: process.env.REACT_APP_MQTT_USERNAME || '',
    password: process.env.REACT_APP_MQTT_PASSWORD || '',
    topics: {
      robotStatus: 'robot/status',
      sensorData: 'sensors/+',
      controlCommands: 'robot/control/+',
      ros2Topics: 'ros2_topic_list',
    },
  },

  // 로봇 설정
  robot: {
    model: 'M0609',
    ipAddress: process.env.REACT_APP_ROBOT_IP || '192.168.137.100',
    port: parseInt(process.env.REACT_APP_ROBOT_PORT || '12345'),
    jointCount: 6,
    updateInterval: 100, // ms
  },

  // 차트 설정
  charts: {
    maxDataPoints: 1000,
    updateInterval: 100,
    colors: {
      primary: '#3b82f6',
      secondary: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#6366f1',
    },
  },

  // 센서 설정
  sensors: {
    weight: {
      min: 0,
      max: 50,
      unit: 'kg',
      precision: 2,
    },
    concentration: {
      min: 0,
      max: 100,
      unit: '%',
      precision: 1,
      target: 75.0,
    },
    temperature: {
      min: -10,
      max: 60,
      unit: '°C',
      precision: 1,
    },
  },

  // UI 설정
  ui: {
    theme: 'light', // 'light' | 'dark' | 'auto'
    language: 'ko',
    gridLayout: {
      columns: 12,
      rowHeight: 60,
      margin: [10, 10],
    },
    notifications: {
      duration: 5000,
      position: 'top-right',
    },
  },

  // 개발 모드 설정
  development: {
    enableMockData: process.env.NODE_ENV === 'development',
    enableDebugLogs: process.env.REACT_APP_DEBUG === 'true',
    mockDataInterval: 1000,
  },
};

export default config;
