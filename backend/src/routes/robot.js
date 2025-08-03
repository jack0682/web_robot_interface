/**
 * 로봇 제어 API 라우터
 * MQTT Processor의 로봇 제어 기능을 HTTP API로 노출
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();

// MQTT Processor 서비스 (나중에 의존성 주입으로 설정)
let mqttService = null;

// 의존성 주입을 위한 설정 함수
const setMqttService = (service) => {
  mqttService = service;
};

// 입력 검증 스키마
const schemas = {
  moveJoint: Joi.object({
    positions: Joi.array().items(Joi.number().min(-360).max(360)).length(6).required(),
    speed: Joi.number().min(1).max(100).default(50),
    acceleration: Joi.number().min(1).max(100).default(50)
  }),
  
  moveLinear: Joi.object({
    position: Joi.object({
      x: Joi.number().min(-1000).max(1000).required(),
      y: Joi.number().min(-1000).max(1000).required(),
      z: Joi.number().min(0).max(1000).required(),
      rx: Joi.number().min(-180).max(180).default(0),
      ry: Joi.number().min(-180).max(180).default(0),
      rz: Joi.number().min(-180).max(180).default(0)
    }).required(),
    speed: Joi.number().min(1).max(100).default(50),
    acceleration: Joi.number().min(1).max(100).default(50)
  }),
  
  setSpeed: Joi.object({
    speed: Joi.number().min(1).max(100).required()
  })
};

// 미들웨어: MQTT 서비스 연결 확인
const requireMqttConnection = (req, res, next) => {
  if (!mqttService || !mqttService.isHealthy()) {
    return res.status(503).json({
      error: 'MQTT service unavailable',
      message: 'Robot communication service is not connected',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// 입력 검증 미들웨어
const validateInput = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message),
        timestamp: new Date().toISOString()
      });
    }
    req.validatedData = value;
    next();
  };
};

/**
 * @route GET /api/robot/status
 * @desc 로봇 현재 상태 조회
 */
router.get('/status', requireMqttConnection, async (req, res) => {
  try {
    const status = mqttService.getCurrentStatus();
    
    // ROS2 토픽 정보 추가
    const ros2Topics = mqttService.getROS2Topics();
    
    const response = {
      ...status,
      ros2_topics: ros2Topics ? ros2Topics.data : null,
      api_timestamp: new Date().toISOString()
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get robot status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/robot/ros2-topics
 * @desc ROS2 토픽 목록 조회
 */
router.get('/ros2-topics', requireMqttConnection, async (req, res) => {
  try {
    const ros2Data = mqttService.getROS2Topics();
    
    if (!ros2Data) {
      return res.status(404).json({
        error: 'ROS2 topics not available',
        message: 'No ROS2 topic data received yet',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      topics: ros2Data.data,
      last_updated: ros2Data.timestamp,
      api_timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get ROS2 topics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/move/joint
 * @desc 관절 이동 명령
 */
router.post('/move/joint', requireMqttConnection, validateInput(schemas.moveJoint), async (req, res) => {
  try {
    const commandData = {
      command: 'move_joint',
      ...req.validatedData,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    };
    
    const result = await mqttService.publishRobotCommand('move_joint', commandData);
    
    res.json({
      success: true,
      message: 'Joint movement command sent',
      command: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send joint movement command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/move/linear
 * @desc 직선 이동 명령
 */
router.post('/move/linear', requireMqttConnection, validateInput(schemas.moveLinear), async (req, res) => {
  try {
    const commandData = {
      command: 'move_linear',
      ...req.validatedData,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    };
    
    const result = await mqttService.publishRobotCommand('move_linear', commandData);
    
    res.json({
      success: true,
      message: 'Linear movement command sent',
      command: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send linear movement command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/stop
 * @desc 로봇 정지
 */
router.post('/stop', requireMqttConnection, async (req, res) => {
  try {
    const commandData = {
      command: 'stop',
      immediate: true,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    };
    
    const result = await mqttService.publishRobotCommand('stop', commandData);
    
    res.json({
      success: true,
      message: 'Stop command sent',
      command: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send stop command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/emergency-stop
 * @desc 비상정지
 */
router.post('/emergency-stop', requireMqttConnection, async (req, res) => {
  try {
    const result = mqttService.triggerEmergencyStop('backend_api');
    
    res.json({
      success: true,
      message: 'Emergency stop activated',
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger emergency stop',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/home
 * @desc 홈 위치로 이동
 */
router.post('/home', requireMqttConnection, async (req, res) => {
  try {
    const speed = req.body.speed || 30; // 홈 이동은 낮은 속도
    
    const commandData = {
      command: 'move_home',
      speed: Math.max(1, Math.min(50, speed)),
      source: 'backend_api',
      timestamp: new Date().toISOString()
    };
    
    const result = await mqttService.publishRobotCommand('home', commandData);
    
    res.json({
      success: true,
      message: 'Home position command sent',
      command: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to send home command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/robot/speed
 * @desc 로봇 속도 설정
 */
router.post('/speed', requireMqttConnection, validateInput(schemas.setSpeed), async (req, res) => {
  try {
    const commandData = {
      command: 'set_speed',
      ...req.validatedData,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    };
    
    const result = await mqttService.publishRobotCommand('speed', commandData);
    
    res.json({
      success: true,
      message: 'Speed setting command sent',
      command: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to set robot speed',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/robot/history
 * @desc 로봇 제어 명령 히스토리
 */
router.get('/history', requireMqttConnection, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const history = mqttService.getHandlerStats('robotControl');
    
    res.json({
      history: history,
      count: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get robot history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/robot/performance
 * @desc 로봇 성능 메트릭
 */
router.get('/performance', requireMqttConnection, async (req, res) => {
  try {
    const metrics = mqttService.getPerformanceMetrics();
    
    res.json({
      metrics: metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 에러 핸들러
router.use((error, req, res, next) => {
  console.error('Robot API error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = { router, setMqttService };
