/**
 * 업데이트된 메인 서버 파일
 * MQTT Processor 서비스와 모든 라우터 통합
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// 서비스 및 라우터 import
const MqttProcessorService = require('./services/mqttProcessor');
const apiRouter = require('./routes/api');
const { router: robotRouter, setMqttService: setRobotMqttService } = require('./routes/robot');
const { router: sensorsRouter, setMqttService: setSensorsMqttService } = require('./routes/sensors');
const { router: controlRouter, setMqttService: setControlMqttService } = require('./routes/control');

// Express 앱 생성
const app = express();
const PORT = process.env.PORT || 5000;

// 로그 디렉토리 생성
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 로거 설정
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'robot-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ASCII 로고 출력
const displayLogo = () => {
  console.log(`
  ╔══════════════════════════════════════════════════════════════════╗
  ║                                                                  ║
  ║        🤖 ROBOT WEB DASHBOARD - BACKEND API 🤖                  ║
  ║                                                                  ║
  ║        Doosan M0609 REST API + MQTT Integration                 ║
  ║        Express.js • WebSocket • Real-time Control              ║
  ║                                                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
  `);
};

// MQTT Processor 서비스 초기화
const mqttService = new MqttProcessorService(logger);
let mqttInitialized = false;

// 미들웨어 설정
app.use(helmet());
app.use(compression());

// CORS 설정
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 1000, // 최대 요청 수
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

// 로깅 미들웨어
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 정적 파일 제공
app.use(express.static('public'));

// MQTT 서비스를 각 라우터에 주입
const initializeRouters = () => {
  setRobotMqttService(mqttService);
  setSensorsMqttService(mqttService);
  setControlMqttService(mqttService);
  logger.info('🔧 MQTT service injected into all routers');
};

// API 라우터 설정
app.use('/api', apiRouter);
app.use('/api/robot', robotRouter);
app.use('/api/sensors', sensorsRouter);
app.use('/api/control', controlRouter);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'Robot Web Dashboard Backend API',
    version: '1.0.0',
    status: 'running',
    mqtt_connected: mqttService.isHealthy(),
    features: [
      'Robot Control API',
      'Sensor Data Management',
      'MQTT Integration',
      'Real-time WebSocket',
      'ROS2 Topic Monitoring'
    ],
    endpoints: {
      robot: '/api/robot/*',
      sensors: '/api/sensors/*',
      control: '/api/control/*',
      health: '/health',
      websocket: 'ws://localhost:8080'
    },
    timestamp: new Date().toISOString()
  });
});

// 통합 헬스체크 엔드포인트
app.get('/health', async (req, res) => {
  try {
    const mqttHealth = mqttService.isHealthy();
    const performance = mqttService.isHealthy() ? mqttService.getPerformanceMetrics() : null;
    
    const healthStatus = {
      status: mqttHealth ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        api: {
          status: 'healthy',
          port: PORT
        },
        mqtt: {
          status: mqttHealth ? 'connected' : 'disconnected',
          processor_initialized: mqttService !== null
        },
        websocket: {
          status: mqttHealth ? 'active' : 'inactive',
          port: 8080,
          clients: performance?.handler_stats?.websocket_clients || 0
        }
      },
      features: {
        robot_control: mqttHealth,
        sensor_monitoring: mqttHealth,
        ros2_integration: mqttHealth,
        real_time_data: mqttHealth
      }
    };
    
    const statusCode = mqttHealth ? 200 : 503;
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// API 문서 엔드포인트
app.get('/api-docs', (req, res) => {
  res.json({
    title: 'Robot Web Dashboard API Documentation',
    version: '1.0.0',
    endpoints: {
      robot: {
        'GET /api/robot/status': 'Get current robot status',
        'GET /api/robot/ros2-topics': 'Get ROS2 topic list',
        'POST /api/robot/move/joint': 'Send joint movement command',
        'POST /api/robot/move/linear': 'Send linear movement command',
        'POST /api/robot/stop': 'Stop robot movement',
        'POST /api/robot/emergency-stop': 'Emergency stop',
        'POST /api/robot/home': 'Move to home position',
        'POST /api/robot/speed': 'Set robot speed',
        'GET /api/robot/history': 'Get command history',
        'GET /api/robot/performance': 'Get performance metrics'
      },
      sensors: {
        'GET /api/sensors/all': 'Get all sensor data',
        'GET /api/sensors/weight': 'Get weight sensor data',
        'GET /api/sensors/weight/history': 'Get weight sensor history',
        'POST /api/sensors/weight/calibrate': 'Calibrate weight sensor',
        'GET /api/sensors/concentration': 'Get concentration data',
        'POST /api/sensors/concentration/target': 'Set target concentration',
        'GET /api/sensors/health': 'Get sensor system health'
      },
      control: {
        'GET /api/control/status': 'Get control system status',
        'POST /api/control/emergency-stop': 'System emergency stop',
        'POST /api/control/batch-command': 'Execute batch commands',
        'POST /api/control/sequential-move': 'Execute sequential movements',
        'POST /api/control/system': 'System control commands',
        'GET /api/control/logs': 'Get control logs'
      }
    },
    websocket: {
      url: 'ws://localhost:8080',
      description: 'Real-time data stream from MQTT topics'
    },
    timestamp: new Date().toISOString()
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    available_endpoints: [
      '/api/robot/*',
      '/api/sensors/*', 
      '/api/control/*',
      '/health',
      '/api-docs'
    ],
    timestamp: new Date().toISOString()
  });
});

// 전역 에러 핸들러
app.use((error, req, res, next) => {
  logger.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : error.message,
    timestamp: new Date().toISOString(),
    request_id: req.headers['x-request-id'],
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: error.stack,
      details: error.details 
    })
  });
});

// MQTT 서비스 이벤트 핸들러
const setupMqttEventHandlers = () => {
  mqttService.on('connected', () => {
    logger.info('🟢 MQTT Processor connected successfully');
    mqttInitialized = true;
  });

  mqttService.on('disconnected', () => {
    logger.warn('🔴 MQTT Processor disconnected');
    mqttInitialized = false;
  });

  mqttService.on('error', (error) => {
    logger.error('🚨 MQTT Processor error:', error);
  });

  mqttService.on('data', (data) => {
    logger.debug('📊 MQTT data received:', { topic: data.topic });
  });

  mqttService.on('reconnectFailed', () => {
    logger.error('💥 MQTT reconnection failed - service degraded');
  });
};

// 서버 시작 함수
const startServer = async () => {
  try {
    displayLogo();
    
    logger.info('🚀 Starting Robot Web Dashboard Backend...');
    logger.info(`📅 Started at: ${new Date().toISOString()}`);
    logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🌐 CORS origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    
    // MQTT 이벤트 핸들러 설정
    setupMqttEventHandlers();
    
    // MQTT Processor 초기화 시도
    logger.info('🔌 Initializing MQTT Processor...');
    const mqttSuccess = await mqttService.initialize();
    
    if (mqttSuccess) {
      logger.info('✅ MQTT Processor initialized successfully');
      mqttInitialized = true;
    } else {
      logger.warn('⚠️  MQTT Processor initialization failed - continuing without MQTT');
      mqttInitialized = false;
    }
    
    // 라우터에 MQTT 서비스 주입
    initializeRouters();
    
    // HTTP 서버 시작
    const server = app.listen(PORT, () => {
      logger.info(`🎯 Backend API server running on port ${PORT}`);
      logger.info(`📡 Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API docs: http://localhost:${PORT}/api-docs`);
      
      if (mqttInitialized) {
        logger.info(`🔄 WebSocket available: ws://localhost:8080`);
        logger.info(`📊 MQTT topics being processed`);
      }
      
      logger.info('🎉 Robot Web Dashboard Backend ready!');
    });

    // 우아한 종료 핸들러
    const gracefulShutdown = async (signal) => {
      logger.info(`📶 Received ${signal}. Starting graceful shutdown...`);
      
      try {
        // HTTP 서버 종료
        server.close(async () => {
          logger.info('🛑 HTTP server closed');
          
          // MQTT 서비스 종료
          if (mqttService) {
            await mqttService.shutdown();
            logger.info('🔌 MQTT service shutdown complete');
          }
          
          logger.info('✅ Graceful shutdown completed');
          process.exit(0);
        });
        
        // 강제 종료 타임아웃 (30초)
        setTimeout(() => {
          logger.error('⏰ Graceful shutdown timeout - forcing exit');
          process.exit(1);
        }, 30000);
        
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // 시그널 핸들러 등록
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // 예외 처리
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// 서버 시작
startServer();

module.exports = app;
