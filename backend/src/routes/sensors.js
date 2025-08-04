/**
 * 센서 데이터 API 라우터 - 정밀 수정
 * 무게센서, 농도 등 센서 데이터 관리
 * 
 * 🎯 토픽 매핑 수정:
 * - test: ROS2 토픽 리스트
 * - scale/raw: 무게센서 데이터
 */
const express = require('express');
const Joi = require('joi');
const router = express.Router();

// MQTT Processor 서비스
let mqttService = null;

const setMqttService = (service) => {
  mqttService = service;
};

// 입력 검증 스키마
const schemas = {
  setConcentration: Joi.object({
    target: Joi.number().min(0).max(100).required(),
    source: Joi.string().default('backend_api')
  }),
  
  calibrateWeight: Joi.object({
    offset: Joi.number().optional()
  })
};

// 미들웨어: MQTT 서비스 연결 확인
const requireMqttConnection = (req, res, next) => {
  if (!mqttService || !mqttService.isHealthy()) {
    return res.status(503).json({
      error: 'MQTT service unavailable',
      message: 'Sensor communication service is not connected',
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
 * @route GET /api/sensors/all
 * @desc 모든 센서 데이터 조회 - 토픽명 수정
 */
router.get('/all', requireMqttConnection, async (req, res) => {
  try {
    const allData = mqttService.getLatestData();
    
    // 🎯 센서 데이터만 필터링 - 정확한 토픽명 사용
    const sensorData = {
      weight: allData['test'] || null,  // 🟢 무게센서 데이터
      concentration: allData['web/target_concentration'] || null,  // 🟢 농도 목표값
      ros2_topics: allData['ros2_topic_list'] || null,  // 🟢 ROS2 토픽 리스트
      system_health: allData['system/health'] || null,  // 🟢 시스템 상태
      connection_status: {
        mqtt_connected: mqttService.isHealthy(),
        data_cache_size: Object.keys(allData).length,
        available_topics: Object.keys(allData)
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(sensorData);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sensor data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/weight
 * @desc 무게센서 데이터 조회 - 토픽명 수정
 */
router.get('/weight', requireMqttConnection, async (req, res) => {
  try {
    // 🎯 'scale/raw' 토픽에서 무게센서 데이터 가져오기
    const weightData = mqttService.getWeightSensorData();
    
    if (!weightData) {
      return res.status(404).json({
        error: 'Weight sensor data not available',
        message: 'No weight sensor data received from scale/raw topic yet',
        expected_topic: 'test',
        available_topics: Object.keys(mqttService.getLatestData() || {}),
        timestamp: new Date().toISOString()
      });
    }
    
    // 무게 데이터 파싱 및 정규화
    let parsedWeight = 0;
    let unit = 'g';
    let rawData = weightData.data;
    
    // 데이터 타입에 따른 파싱
    if (typeof rawData === 'object') {
      parsedWeight = parseFloat(rawData.weight || rawData.value || rawData.data || 0);
      unit = rawData.unit || 'g';
    } else if (typeof rawData === 'number') {
      parsedWeight = rawData;
    } else if (typeof rawData === 'string') {
      parsedWeight = parseFloat(rawData) || 0;
    }
    
    res.json({
      weight: {
        value: parsedWeight,
        unit: unit,
        status: parsedWeight > 0 ? 'active' : 'inactive'
      },
      raw_data: rawData,
      topic: 'scale/raw',
      last_updated: weightData.timestamp,
      api_timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get weight sensor data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/weight/history
 * @desc 무게센서 히스토리 조회 - 토픽명 수정
 */
router.get('/weight/history', requireMqttConnection, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 50;
    
    // 🎯 'scale/raw' 토픽의 히스토리 가져오기
    const history = mqttService.getDataHistory('test', count);
    
    res.json({
      history: history,
      count: history.length,
      requested_count: count,
      topic: 'test',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get weight sensor history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/sensors/weight/calibrate
 * @desc 무게센서 캘리브레이션 - 토픽명 수정
 */
router.post('/weight/calibrate', requireMqttConnection, validateInput(schemas.calibrateWeight), async (req, res) => {
  try {
    const { offset } = req.validatedData;
    
    // 🎯 아두이노 캘리브레이션 토픽으로 메시지 발행
    const result = mqttService.calibrateWeightSensor(offset);
    
    // 추가적으로 직접 MQTT 메시지도 발행
    await mqttService.publishMessage('scale/calibrate', {
      command: 'calibrate',
      offset: offset,
      source: 'backend_api',
      timestamp: new Date().toISOString()
    }, { qos: 1 });
    
    res.json({
      success: true,
      message: offset !== undefined ? 'Weight sensor calibrated with offset' : 'Weight sensor zero calibration completed',
      calibration: result,
      target_topic: 'scale/calibrate',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to calibrate weight sensor',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/weight/stats
 * @desc 무게센서 통계 정보
 */
router.get('/weight/stats', requireMqttConnection, async (req, res) => {
  try {
    const stats = mqttService.getHandlerStats('weightSensor');
    
    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get weight sensor stats',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/concentration
 * @desc 농도 센서 데이터 조회
 */
router.get('/concentration', requireMqttConnection, async (req, res) => {
  try {
    const concentrationData = mqttService.getLatestData('web/target_concentration');
    
    if (!concentrationData) {
      return res.status(404).json({
        error: 'Concentration data not available',
        message: 'No concentration data received yet',
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      concentration: concentrationData.data,
      last_updated: concentrationData.timestamp,
      api_timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get concentration data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/sensors/concentration/target
 * @desc 목표 농도 설정
 */
router.post('/concentration/target', requireMqttConnection, validateInput(schemas.setConcentration), async (req, res) => {
  try {
    const { target, source } = req.validatedData;
    const result = mqttService.setConcentrationTarget(target, source);
    
    // MQTT로도 발행
    await mqttService.publishMessage('web/target_concentration', {
      target: target,
      source: source,
      timestamp: new Date().toISOString()
    }, { qos: 1, retain: true });
    
    res.json({
      success: true,
      message: 'Target concentration set successfully',
      target: target,
      source: source,
      result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to set target concentration',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/concentration/history
 * @desc 농도 설정 히스토리
 */
router.get('/concentration/history', requireMqttConnection, async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 20;
    const history = mqttService.getDataHistory('web/target_concentration', count);
    
    res.json({
      history: history,
      count: history.length,
      requested_count: count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get concentration history',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/concentration/stats
 * @desc 농도 제어 통계
 */
router.get('/concentration/stats', requireMqttConnection, async (req, res) => {
  try {
    const stats = mqttService.getHandlerStats('concentration');
    
    res.json({
      stats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get concentration stats',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/performance
 * @desc 센서 시스템 성능 메트릭
 */
router.get('/performance', requireMqttConnection, async (req, res) => {
  try {
    const performance = mqttService.getPerformanceMetrics();
    
    // 센서 관련 메트릭만 추출
    const sensorMetrics = {
      weight_sensor: performance.handler_stats?.handlers?.weightSensor || null,
      concentration: performance.handler_stats?.handlers?.concentration || null,
      data_cache_size: performance.data_cache_size,
      mqtt_connected: performance.websocket_connected,
      uptime: performance.uptime,
      memory: performance.memory,
      timestamp: performance.timestamp
    };
    
    res.json(sensorMetrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sensor performance metrics',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/sensors/health
 * @desc 센서 시스템 헬스체크
 */
router.get('/health', requireMqttConnection, async (req, res) => {
  try {
    const currentStatus = mqttService.getCurrentStatus();
    const latestWeight = mqttService.getWeightSensorData();
    const latestConcentration = mqttService.getLatestData('web/target_concentration');
    const latestROS2 = mqttService.getROS2Topics();
    
    const healthStatus = {
      overall_status: 'healthy',
      sensors: {
        weight: {
          status: latestWeight ? 'active' : 'inactive',
          last_data: latestWeight?.timestamp || null,
          data_available: !!latestWeight,
          topic: 'scale/raw'
        },
        concentration: {
          status: latestConcentration ? 'active' : 'inactive',
          last_data: latestConcentration?.timestamp || null,
          data_available: !!latestConcentration,
          topic: 'web/target_concentration'
        },
        ros2_topics: {
          status: latestROS2 ? 'active' : 'inactive',
          last_data: latestROS2?.timestamp || null,
          data_available: !!latestROS2,
          topic: 'test'
        }
      },
      mqtt_connection: currentStatus?.connected || false,
      cache_size: currentStatus?.cache_size || 0,
      reconnect_attempts: currentStatus?.reconnect_attempts || 0,
      timestamp: new Date().toISOString()
    };
    
    // 전체 상태 결정
    if (!healthStatus.mqtt_connection) {
      healthStatus.overall_status = 'degraded';
    } else if (!healthStatus.sensors.weight.data_available && !healthStatus.sensors.concentration.data_available && !healthStatus.sensors.ros2_topics.data_available) {
      healthStatus.overall_status = 'warning';
    }
    
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get sensor health status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 에러 핸들러
router.use((error, req, res, next) => {
  console.error('Sensors API error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = { router, setMqttService };