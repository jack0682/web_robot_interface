const MqttClient = require('./src/mqttClient');
const Logger = require('./src/logger');
const fs = require('fs');
const path = require('path');

// 환경 변수 로드
require('dotenv').config();

const logger = new Logger('Main');

// ASCII 아트 로고
const displayLogo = () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║                                                                  ║
  ║        🤖 ROBOT WEB DASHBOARD - MQTT PROCESSOR 🤖               ║
  ║                                                                  ║
  ║        Doosan M0609 Real-time Data Processing System            ║
  ║        EMQX Cloud Integration • ROS2 Bridge • WebSocket         ║
  ║                                                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
  `);
};

// 설정 로드 및 검증
const loadConfiguration = () => {
  const config = {
    // EMQX Cloud 설정
    mqttHost: process.env.MQTT_HOST || 'p021f2cb.ala.asia-southeast1.emqxsl.com',
    mqttPort: parseInt(process.env.MQTT_PORT) || 8883,
    mqttUsername: process.env.MQTT_USERNAME || '',
    mqttPassword: process.env.MQTT_PASSWORD || '',
    
    // 로컬 서비스 설정
    wsPort: parseInt(process.env.WS_PORT) || 8080,
    
    // 로깅 설정
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || 'data/logs/mqtt/processor.log',
    
    // 성능 설정
    maxBufferSize: parseInt(process.env.MAX_BUFFER_SIZE) || 2000,
    dataRetentionHours: parseInt(process.env.DATA_RETENTION_HOURS) || 48,
    reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL) || 5000,
    maxReconnectAttempts: parseInt(process.env.MAX_RECONNECT_ATTEMPTS) || 10,
    heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL) || 30000,
    
    // 개발 설정
    debugMode: process.env.DEBUG_MODE === 'true',
    enableVerboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true',
    enableMockData: process.env.ENABLE_MOCK_DATA === 'true'
  };

  // 설정 검증
  if (!config.mqttUsername || !config.mqttPassword) {
    logger.warn('⚠️  MQTT credentials not set. Please configure MQTT_USERNAME and MQTT_PASSWORD');
  }

  return config;
};

// 로그 디렉토리 생성
const ensureLogDirectory = (logFile) => {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
    logger.info(`📁 Created log directory: ${logDir}`);
  }
};

// 시스템 정보 출력
const displaySystemInfo = (config) => {
  logger.info('🔧 System Configuration:');
  logger.info(`  📡 MQTT Host: ${config.mqttHost}:${config.mqttPort}`);
  logger.info(`  🌐 WebSocket Port: ${config.wsPort}`);
  logger.info(`  📊 Log Level: ${config.logLevel}`);
  logger.info(`  💾 Buffer Size: ${config.maxBufferSize}`);
  logger.info(`  🔄 Reconnect Interval: ${config.reconnectInterval}ms`);
  logger.info(`  🐛 Debug Mode: ${config.debugMode ? 'ON' : 'OFF'}`);
  logger.info(`  📝 Verbose Logging: ${config.enableVerboseLogging ? 'ON' : 'OFF'}`);
  
  // 시스템 리소스 정보
  const memUsage = process.memoryUsage();
  logger.info('💻 System Resources:');
  logger.info(`  🧠 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used`);
  logger.info(`  ⚡ Node.js: ${process.version}`);
  logger.info(`  🖥️  Platform: ${process.platform} ${process.arch}`);
  logger.info(`  📁 Working Directory: ${process.cwd()}`);
};

// 토픽 매핑 로드
const loadTopicMapping = () => {
  try {
    const topicMappingPath = path.join(__dirname, '../configs/mqtt/topic_mapping.json');
    if (fs.existsSync(topicMappingPath)) {
      const topicMapping = JSON.parse(fs.readFileSync(topicMappingPath, 'utf8'));
      logger.info('📋 Topic mapping loaded successfully');
      return topicMapping;
    } else {
      logger.warn('⚠️  Topic mapping file not found, using defaults');
      return null;
    }
  } catch (error) {
    logger.error('❌ Error loading topic mapping:', error);
    return null;
  }
};

// 헬스 체크 설정
const setupHealthCheck = (mqttClient) => {
  const healthCheckInterval = 60000; // 1분마다
  
  setInterval(() => {
    const health = {
      timestamp: new Date().toISOString(),
      service: 'mqtt_processor',
      status: mqttClient.isConnected ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      connections: {
        mqtt: mqttClient.isConnected,
        websocket_clients: mqttClient.wsClients ? mqttClient.wsClients.size : 0
      },
      performance: {
        event_loop_delay: process.hrtime(),
        cpu_usage: process.cpuUsage()
      }
    };

    // 상태에 따른 로깅
    if (health.status === 'healthy') {
      logger.debug('💓 Health check: System healthy');
    } else {
      logger.warn('⚠️  Health check: System unhealthy');
    }

    // 메모리 사용량 모니터링
    const memUsedMB = Math.round(health.memory.heapUsed / 1024 / 1024);
    if (memUsedMB > 500) {
      logger.warn(`⚠️  High memory usage: ${memUsedMB}MB`);
    }

  }, healthCheckInterval);
};

// 모니터링 대시보드 출력
const displayMonitoringInfo = (mqttClient) => {
  setInterval(() => {
    if (!mqttClient.isConnected) return;
    
    const stats = {
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      wsClients: mqttClient.wsClients ? mqttClient.wsClients.size : 0,
      mqttStatus: mqttClient.isConnected ? 'Connected' : 'Disconnected'
    };

    console.clear();
    displayLogo();
    console.log(`
  ┌─ REAL-TIME STATUS ─────────────────────────────────────────────┐
  │                                                               │
  │  🟢 MQTT Status: ${stats.mqttStatus.padEnd(20)} 🌐 WebSocket: ${stats.wsClients} clients  │
  │  ⏱️  Uptime: ${Math.floor(stats.uptime / 60)}m ${stats.uptime % 60}s                🧠 Memory: ${stats.memory}MB        │
  │  📊 Last Update: ${new Date().toLocaleTimeString()}                                   │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
  
  📋 Active Topics:
  • ros2_topic_list (ROS2 토픽 목록)
  • topic (아두이노 무게센서)  
  • web/target_concentration (웹 목표농도)
  • robot/control/+ (로봇 제어)
  • system/health (시스템 상태)
  
  🎯 Key Features:
  ✅ EMQX Cloud SSL/TLS 연결
  ✅ 실시간 WebSocket 브릿지
  ✅ ROS2 토픽 분석 및 분류
  ✅ 무게센서 데이터 처리
  ✅ 웹 농도 제어 인터페이스
  ✅ 로봇 명령 검증 및 안전성 체크
  
  Press Ctrl+C to stop...
    `);
  }, 5000); // 5초마다 업데이트
};

// MQTT 클라이언트 이벤트 핸들러 설정
const setupEventHandlers = (mqttClient) => {
  // 특별한 이벤트 처리
  mqttClient.dataBuffer.on('data', (topic, data) => {
    // 특정 토픽에 대한 실시간 로깅
    if (topic === 'ros2_topic_list') {
      logger.info('📋 ROS2 topic list updated');
    } else if (topic === 'topic') {
      logger.debug('⚖️  Weight sensor data received');
    } else if (topic === 'web/target_concentration') {
      logger.info('🎯 Target concentration updated from web');
    }
  });

  // 에러 처리
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    // 에러 발생 시 정상적으로 종료 시도
    gracefulShutdown(mqttClient, 1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    // 에러 발생 시 정상적으로 종료 시도
    gracefulShutdown(mqttClient, 1);
  });
};

// 우아한 종료 처리
const gracefulShutdown = async (mqttClient, exitCode = 0) => {
  logger.info('🛑 Initiating graceful shutdown...');
  
  try {
    // 상태 메시지 발행
    if (mqttClient && mqttClient.isConnected) {
      await mqttClient.publishMessage('system/health', {
        status: 'shutting_down',
        message: 'MQTT Processor is shutting down',
        timestamp: new Date().toISOString(),
        final_stats: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          processed_messages: mqttClient.dataBuffer ? mqttClient.dataBuffer.getAllTopics().length : 0
        }
      });
    }

    // 클라이언트 종료
    if (mqttClient) {
      await mqttClient.shutdown();
    }

    logger.info('✅ Graceful shutdown completed');
    process.exit(exitCode);
    
  } catch (error) {
    logger.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// 메인 실행 함수
async function main() {
  try {
    // 시작 화면 표시
    displayLogo();
    
    logger.info('🚀 Starting Robot Web Dashboard MQTT Processor...');
    logger.info('📅 Started at:', new Date().toISOString());
    
    // 설정 로드
    const config = loadConfiguration();
    ensureLogDirectory(config.logFile);
    displaySystemInfo(config);
    
    // 토픽 매핑 로드
    const topicMapping = loadTopicMapping();
    
    // MQTT 클라이언트 생성 및 초기화
    logger.info('🔌 Initializing MQTT Client...');
    const mqttClient = new MqttClient(config);
    
    // 이벤트 핸들러 설정
    setupEventHandlers(mqttClient);
    
    // 클라이언트 초기화
    await mqttClient.initialize();
    
    // 헬스 체크 시작
    setupHealthCheck(mqttClient);
    
    // 개발 모드에서 모니터링 대시보드 표시
    if (config.debugMode) {
      displayMonitoringInfo(mqttClient);
    }
    
    // 시그널 핸들러 설정
    process.on('SIGINT', () => {
      logger.info('📶 Received SIGINT (Ctrl+C)');
      gracefulShutdown(mqttClient, 0);
    });

    process.on('SIGTERM', () => {
      logger.info('📶 Received SIGTERM');
      gracefulShutdown(mqttClient, 0);
    });

    // 성공 메시지
    logger.info('🎉 MQTT Processor started successfully!');
    logger.info('🔗 Ready to process robot data and web commands');
    logger.info('📡 Monitoring EMQX Cloud topics...');
    
    // 초기 상태 메시지 발행
    if (mqttClient.isConnected) {
      await mqttClient.publishMessage('system/health', {
        status: 'started',
        message: 'MQTT Processor started successfully',
        version: '1.0.0',
        capabilities: [
          'ros2_topic_processing',
          'weight_sensor_handling', 
          'concentration_control',
          'robot_command_validation',
          'websocket_bridge'
        ],
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    logger.error('💥 Failed to start MQTT Processor:', error);
    process.exit(1);
  }
}

// 프로세스 정보 출력
logger.info('🔧 Process Information:');
logger.info(`  📊 PID: ${process.pid}`);
logger.info(`  👤 User: ${process.env.USER || 'unknown'}`);
logger.info(`  📁 Working Directory: ${process.cwd()}`);

// 메인 함수 실행
main().catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
