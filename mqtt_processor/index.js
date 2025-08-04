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
  // JSON 설정 파일 경로
  const configPath = path.join(__dirname, 'config', 'processor.config.json');
  
  let config = {};
  
  // JSON 설정 파일 로드 시도
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(configData);
      logger.info('📋 Configuration loaded from processor.config.json');
    } else {
      logger.warn('⚠️  Configuration file not found, using environment variables');
    }
  } catch (error) {
    logger.error('❌ Failed to load configuration file:', error);
    logger.info('🔄 Falling back to environment variables');
  }
  
  // 환경 변수로 덮어쓰기 (우선순위: 환경변수 > 설정파일)
  const envConfig = {
    // MQTT 연결 설정 덮어쓰기
    mqtt: {
      ...config.mqtt,
      connection: {
        ...config.mqtt?.connection,
        host: process.env.MQTT_HOST || config.mqtt?.connection?.host || 'p021f2cb.ala.asia-southeast1.emqxsl.com',
        port: parseInt(process.env.MQTT_PORT) || config.mqtt?.connection?.port || 8883,
        username: process.env.MQTT_USERNAME || '',
        password: process.env.MQTT_PASSWORD || ''
      }
    },
    
    // WebSocket 설정 덮어쓰기
    websocket: {
      ...config.websocket,
      port: parseInt(process.env.WS_PORT) || config.websocket?.port || 8080
    },
    
    // 로깅 설정 덮어쓰기
    logging: {
      ...config.logging,
      level: process.env.LOG_LEVEL || config.logging?.level || 'info',
      file: process.env.LOG_FILE || config.logging?.file || 'data/logs/mqtt/processor.log'
    },
    
    // 데이터 처리 설정 덮어쓰기
    data_processing: {
      ...config.data_processing,
      buffer_size: parseInt(process.env.MAX_BUFFER_SIZE) || config.data_processing?.buffer_size || 2000,
      retention_hours: parseInt(process.env.DATA_RETENTION_HOURS) || config.data_processing?.retention_hours || 48
    },
    
    // 성능 설정 덮어쓰기
    performance: {
      ...config.performance,
      health_check_interval: parseInt(process.env.HEARTBEAT_INTERVAL) || config.performance?.health_check_interval || 30000
    },
    
    // 개발 설정
    debugMode: process.env.DEBUG_MODE === 'true' || config.debugMode || false,
    enableVerboseLogging: process.env.ENABLE_VERBOSE_LOGGING === 'true' || config.enableVerboseLogging || false,
    enableMockData: process.env.ENABLE_MOCK_DATA === 'true' || config.enableMockData || false
  };

  // 최종 설정 병합
  const finalConfig = { ...config, ...envConfig };
  
  // 설정 검증
  if (!finalConfig.mqtt?.connection?.username || !finalConfig.mqtt?.connection?.password) {
    logger.warn('⚠️  MQTT credentials not set. Please configure MQTT_USERNAME and MQTT_PASSWORD');
  }

  return finalConfig;
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
  logger.info(`  📡 MQTT Host: ${config.mqtt?.connection?.host}:${config.mqtt?.connection?.port}`);
  logger.info(`  🌐 WebSocket Port: ${config.websocket?.port}`);
  logger.info(`  📊 Log Level: ${config.logging?.level}`);
  logger.info(`  💾 Buffer Size: ${config.data_processing?.buffer_size}`);
  logger.info(`  🐛 Debug Mode: ${config.debugMode ? 'ON' : 'OFF'}`);
  logger.info(`  📝 Verbose Logging: ${config.enableVerboseLogging ? 'ON' : 'OFF'}`);
  
  // 토픽 매핑 정보 출력
  if (config.mqtt?.topics) {
    logger.info('📡 Configured MQTT Topics:');
    for (const [key, topicConfig] of Object.entries(config.mqtt.topics)) {
      logger.info(`  • ${key}: ${topicConfig.name} (QoS: ${topicConfig.qos})`);
    }
  }
  
  // 시스템 리소스 정보
  const memUsage = process.memoryUsage();
  logger.info('💻 System Resources:');
  logger.info(`  🧠 Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB used`);
  logger.info(`  ⚡ Node.js: ${process.version}`);
  logger.info(`  🖥️  Platform: ${process.platform} ${process.arch}`);
  logger.info(`  📁 Working Directory: ${process.cwd()}`);
};

// 헬스 체크 설정
const setupHealthCheck = (mqttClient, config) => {
  const healthCheckInterval = config.performance?.health_check_interval || 60000;
  
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
    const memThreshold = config.performance?.memory_warning_threshold || 500;
    if (memUsedMB > memThreshold) {
      logger.warn(`⚠️  High memory usage: ${memUsedMB}MB`);
    }

  }, healthCheckInterval);
};

// 모니터링 대시보드 출력
const displayMonitoringInfo = (mqttClient, config) => {
  setInterval(() => {
    if (!mqttClient.isConnected && !config.debugMode) return;
    
    const stats = {
      uptime: Math.floor(process.uptime()),
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      wsClients: mqttClient.wsClients ? mqttClient.wsClients.size : 0,
      mqttStatus: mqttClient.isConnected ? 'Connected' : 'Disconnected',
      messageCount: mqttClient.messageCount || 0,
      bufferedTopics: mqttClient.dataBuffer ? mqttClient.dataBuffer.size : 0
    };

    console.clear();
    displayLogo();
    console.log(`
  ┌─ REAL-TIME STATUS ─────────────────────────────────────────────┐
  │                                                               │
  │  🟢 MQTT Status: ${stats.mqttStatus.padEnd(20)} 🌐 WebSocket: ${stats.wsClients} clients  │
  │  ⏱️  Uptime: ${Math.floor(stats.uptime / 60)}m ${stats.uptime % 60}s                🧠 Memory: ${stats.memory}MB        │
  │  📊 Messages: ${stats.messageCount}             📦 Buffered Topics: ${stats.bufferedTopics}    │
  │  📅 Last Update: ${new Date().toLocaleTimeString()}                                   │
  │                                                               │
  └───────────────────────────────────────────────────────────────┘
  
  📋 Active Topics:
  • scale/raw, scale/moving_average, scale/exponential_average (저울 센서 7개 필터)
  • scale/kalman_simple, scale/kalman_pv, scale/ekf, scale/ukf
  • test (로봇 시나리오 이벤트: 설탕 투입, 컵 배치 등)
  • web/commands/start, web/commands/concentration, web/commands/emergency_stop (웹 대시보드 명령)
  • system/health (시스템 상태)
  
  🎯 Integration Features:
  ✅ 저울 센서 7개 필터 실시간 처리 (Raw, MA, EMA, Kalman, EKF, UKF)
  ✅ 로봇 시나리오 이벤트 추적 (설탕 투입, 컵 배치)
  ✅ 웹 대시보드 명령 발행 (시작, 농도 설정, 긴급 정지)
  ✅ EMQX Cloud SSL/TLS 연결 with 완벽한 토픽 매칭
  ✅ 실시간 WebSocket 브릿지 for React 프론트엔드
  ✅ 무게 데이터 버퍼링 및 분석
  
  Press Ctrl+C to stop...
    `);
  }, 5000); // 5초마다 업데이트
};

// MQTT 클라이언트 이벤트 핸들러 설정
const setupEventHandlers = (mqttClient) => {
  // 에러 처리
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', error);
    gracefulShutdown(mqttClient, 1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
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
          processed_messages: mqttClient.dataBuffer ? mqttClient.dataBuffer.size : 0
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
    ensureLogDirectory(config.logging?.file || 'data/logs/mqtt/processor.log');
    displaySystemInfo(config);
    
    // MQTT 클라이언트 생성 및 초기화
    logger.info('🔌 Initializing MQTT Client...');
    const mqttClient = new MqttClient(config);
    
    // 로거를 MQTT 클라이언트에 주입
    mqttClient.setLogger(logger);
    
    // 이벤트 핸들러 설정
    setupEventHandlers(mqttClient);
    
    // 클라이언트 초기화
    await mqttClient.initialize();
    
    // 헬스 체크 시작
    setupHealthCheck(mqttClient, config);
    
    // 개발 모드에서 모니터링 대시보드 표시
    if (config.debugMode) {
      displayMonitoringInfo(mqttClient, config);
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
