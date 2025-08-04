/**
 * 로봇 제어 API 라우터 - 정밀 수정
 * MQTT Processor의 로봇 제어 기능을 HTTP API로 노출
 * 
 * 🎯 토픽 매핑 수정:
 * - test: ROS2 토픽 리스트 조회
 * - 로봇 연결 여부는 test 토픽 구독 상태로 판단
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

// 🎯 새로운 미들웨어: 로봇 연결 상태 확인 (test 토픽 기반)
const requireRobotConnection = (req, res, next) => {
  try {
    const ros2Topics = mqttService.getROS2Topics();
    
    if (!ros2Topics || !ros2Topics.data) {
      return res.status(503).json({
        error: 'Robot not connected',
        message: 'No ROS2 topic data received from test topic - robot appears to be disconnected',
        expected_topic: 'ros2_topic_list',
        timestamp: new Date().toISOString()
      });
    }
    
    // ROS2 토픽 데이터가 있으면 로봇이 연결된 것으로 간주
    req.robotConnected = true;
    req.ros2Topics = ros2Topics.data;
    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to check robot connection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
 * @desc 로봇 현재 상태 조회 - 토픽 매핑 수정
 */
router.get('/status', requireMqttConnection, async (req, res) => {
  try {
    const status = mqttService.getCurrentStatus();
    
    // 🎯 ROS2 토픽 정보 추가 (test 토픽에서)
    const ros2Topics = mqttService.getROS2Topics();
    
    // 🎯 로봇 연결 상태 판단
    const robotConnected = !!(ros2Topics && ros2Topics.data);
    
    const response = {
      ...status,
      robot_connection: {
        connected: robotConnected,
        status: robotConnected ? 'connected' : 'disconnected',
        last_topic_update: ros2Topics?.timestamp || null,
        topic_source: 'test'
      },
      ros2_topics: ros2Topics ? ros2Topics.data : null,
      topic_count: ros2Topics ? Object.keys(ros2Topics.data?.topic_data || {}).length : 0,
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
 * @desc ROS2 토픽 목록 조회 - 토픽명 수정
 */
router.get('/ros2-topics', requireMqttConnection, async (req, res) => {
  try {
    // 🎯 'test' 토픽에서 ROS2 토픽 리스트 가져오기
    const ros2Data = mqttService.getROS2Topics();
    
    if (!ros2Data) {
      return res.status(404).json({
        error: 'ROS2 topics not available',
        message: 'No ROS2 topic data received from test topic yet',
        expected_topic: 'ros2_topic_list',
        available_topics: Object.keys(mqttService.getLatestData() || {}),
        timestamp: new Date().toISOString()
      });
    }
    
    // 토픽 데이터 파싱
    let topicList = [];
    let topicData = {};
    
    if (ros2Data.data && ros2Data.data.topic_data) {
      topicData = ros2Data.data.topic_data;
      topicList = Object.keys(topicData);
    } else if (Array.isArray(ros2Data.data)) {
      topicList = ros2Data.data;
    }
    
    res.json({
      topics: topicList,
      topic_data: topicData,
      topic_count: topicList.length,
      robot_connected: topicList.length > 0,
      source_topic: 'ros2_topic_list',
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
 * @desc 관절 이동 명령 - 로봇 연결 확인 추가
 */
router.post('/move/joint', requireMqttConnection, requireRobotConnection, validateInput(schemas.moveJoint), async (req, res) => {
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
      robot_connected: req.robotConnected,
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
 * @desc 직선 이동 명령 - 로봇 연결 확인 추가
 */
router.post('/move/linear', requireMqttConnection, requireRobotConnection, validateInput(schemas.moveLinear), async (req, res) => {
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
      robot_connected: req.robotConnected,
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
 * @desc 로봇 정지 - 로봇 연결 확인 추가
 */
router.post('/stop', requireMqttConnection, requireRobotConnection, async (req, res) => {
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
      robot_connected: req.robotConnected,
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
 * @desc 비상정지 - 연결 상태와 관계없이 항상 허용
 */
router.post('/emergency-stop', requireMqttConnection, async (req, res) => {
  try {
    const result = mqttService.triggerEmergencyStop('backend_api');
    
    res.json({
      success: true,
      message: 'Emergency stop activated',
      result: result,
      note: 'Emergency stop sent regardless of robot connection status',
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
 * @desc 홈 위치로 이동 - 로봇 연결 확인 추가
 */
router.post('/home', requireMqttConnection, requireRobotConnection, async (req, res) => {
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
      robot_connected: req.robotConnected,
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
 * @desc 로봇 속도 설정 - 로봇 연결 확인 추가
 */
router.post('/speed', requireMqttConnection, requireRobotConnection, validateInput(schemas.setSpeed), async (req, res) => {
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
      robot_connected: req.robotConnected,
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
    
    // 로봇 제어 관련 토픽들의 히스토리 가져오기
    const robotTopics = [
      'robot/control/move_joint',
      'robot/control/move_linear', 
      'robot/control/stop',
      'robot/control/emergency_stop',
      'robot/control/home',
      'robot/control/speed'
    ];
    
    let allHistory = [];
    for (const topic of robotTopics) {
      const topicHistory = mqttService.getDataHistory(topic, count);
      allHistory = allHistory.concat(topicHistory);
    }
    
    // 시간순 정렬
    allHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    allHistory = allHistory.slice(0, count);
    
    res.json({
      history: allHistory,
      count: allHistory.length,
      requested_count: count,
      robot_topics: robotTopics,
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
    
    // 로봇 관련 메트릭 추출
    const robotMetrics = {
      mqtt_connected: metrics.websocket_connected,
      data_cache_size: metrics.data_cache_size,
      reconnect_attempts: metrics.reconnect_attempts,
      uptime: metrics.uptime,
      memory: metrics.memory,
      robot_status: {
        connected: !!(mqttService.getROS2Topics()?.data),
        last_ros2_update: mqttService.getROS2Topics()?.timestamp || null
      },
      timestamp: metrics.timestamp
    };
    
    res.json(robotMetrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get performance metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/robot/connection-test
 * @desc 로봇 연결 테스트 - test 토픽 상태 확인
 */
router.get('/connection-test', requireMqttConnection, async (req, res) => {
  try {
    const ros2Topics = mqttService.getROS2Topics();
    const allData = mqttService.getLatestData();
    
    const connectionTest = {
      test_result: {
        passed: !!(ros2Topics && ros2Topics.data),
        message: ros2Topics ? 'Robot connection verified via test topic' : 'No data received from test topic'
      },
      ros2_data: {
        available: !!ros2Topics,
        last_update: ros2Topics?.timestamp || null,
        topic_count: ros2Topics ? Object.keys(ros2Topics.data?.topic_data || {}).length : 0,
        sample_topics: ros2Topics ? Object.keys(ros2Topics.data?.topic_data || {}).slice(0, 5) : []
      },
      mqtt_status: {
        connected: mqttService.isHealthy(),
        total_topics: Object.keys(allData).length,
        available_topics: Object.keys(allData)
      },
      expected_behavior: {
        test_topic: 'Should contain ROS2 topic list in JSON format',
        scale_raw_topic: 'Should contain weight sensor data',
        connection_indicator: 'test topic presence indicates robot connection'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(connectionTest);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to perform connection test',
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