/**
 * 통합 제어 API 라우터
 * 로봇 제어, 농도 제어, 시스템 제어를 통합 관리
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
  batchCommand: Joi.object({
    commands: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('robot', 'concentration', 'sensor').required(),
        action: Joi.string().required(),
        data: Joi.object().required(),
        delay: Joi.number().min(0).default(0) // 명령 간 지연 시간 (ms)
      })
    ).min(1).max(10).required()
  }),
  
  sequentialMove: Joi.object({
    waypoints: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('joint', 'linear').required(),
        positions: Joi.when('type', {
          is: 'joint',
          then: Joi.array().items(Joi.number().min(-360).max(360)).length(6).required(),
          otherwise: Joi.object({
            x: Joi.number().min(-1000).max(1000).required(),
            y: Joi.number().min(-1000).max(1000).required(),
            z: Joi.number().min(0).max(1000).required(),
            rx: Joi.number().min(-180).max(180).default(0),
            ry: Joi.number().min(-180).max(180).default(0),
            rz: Joi.number().min(-180).max(180).default(0)
          }).required()
        }),
        speed: Joi.number().min(1).max(100).default(50),
        wait_time: Joi.number().min(0).default(1000) // 웨이포인트에서 대기 시간
      })
    ).min(1).max(20).required()
  }),
  
  systemCommand: Joi.object({
    action: Joi.string().valid('restart', 'reset', 'calibrate_all', 'health_check').required(),
    options: Joi.object().default({})
  })
};

// 미들웨어: MQTT 서비스 연결 확인
const requireMqttConnection = (req, res, next) => {
  if (!mqttService || !mqttService.isHealthy()) {
    return res.status(503).json({
      error: 'MQTT service unavailable',
      message: 'Control service is not connected',
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
 * @route GET /api/control/status
 * @desc 전체 제어 시스템 상태 조회
 */
router.get('/status', requireMqttConnection, async (req, res) => {
  try {
    const systemStatus = mqttService.getCurrentStatus();
    const performance = mqttService.getPerformanceMetrics();
    
    const controlStatus = {
      system: {
        status: mqttService.isHealthy() ? 'operational' : 'degraded',
        mqtt_connected: systemStatus?.mqtt?.connected || false,
        websocket_connected: systemStatus?.websocket?.clients > 0,
        uptime: performance?.uptime || 0
      },
      robot: {
        control_available: true,
        last_command: null, // TODO: 마지막 로봇 명령 추가
        emergency_stop: false // TODO: 비상정지 상태 추가
      },
      sensors: {
        weight_active: !!mqttService.getWeightSensorData(),
        concentration_active: !!mqttService.getLatestData('web/target_concentration')
      },
      ros2: {
        topics_available: !!mqttService.getROS2Topics(),
        topic_count: mqttService.getROS2Topics()?.data?.total || 0
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(controlStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get control status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/control/emergency-stop
 * @desc 전체 시스템 비상정지
 */
router.post('/emergency-stop', requireMqttConnection, async (req, res) => {
  try {
    const source = req.body.source || 'control_api';
    
    // 로봇 비상정지 실행
    const emergencyResult = mqttService.triggerEmergencyStop(source);
    
    // 시스템 상태 메시지 발행
    await mqttService.publishMessage('system/emergency', {
      action: 'emergency_stop',
      source: source,
      timestamp: new Date().toISOString(),
      message: 'Emergency stop activated via control API'
    }, { qos: 2 });
    
    // WebSocket으로 즉시 알림
    mqttService.broadcastToWebSocket({
      type: 'emergency',
      action: 'emergency_stop',
      source: source,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Emergency stop activated',
      source: source,
      result: emergencyResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute emergency stop',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/control/batch-command
 * @desc 배치 명령 실행 (여러 명령을 순차적으로 실행)
 */
router.post('/batch-command', requireMqttConnection, validateInput(schemas.batchCommand), async (req, res) => {
  try {
    const { commands } = req.validatedData;
    const results = [];
    let totalDelay = 0;
    
    for (const [index, command] of commands.entries()) {
      try {
        // 지연 시간 적용
        if (command.delay > 0) {
          await new Promise(resolve => setTimeout(resolve, command.delay));
          totalDelay += command.delay;
        }
        
        let result = null;
        
        // 명령 타입별 처리
        switch (command.type) {
          case 'robot':
            result = await mqttService.publishRobotCommand(command.action, {
              ...command.data,
              source: 'batch_api',
              batch_index: index
            });
            break;
            
          case 'concentration':
            if (command.action === 'set_target') {
              result = mqttService.setConcentrationTarget(command.data.target, 'batch_api');
            }
            break;
            
          case 'sensor':
            if (command.action === 'calibrate_weight') {
              result = mqttService.calibrateWeightSensor(command.data.offset);
            }
            break;
            
          default:
            throw new Error(`Unknown command type: ${command.type}`);
        }
        
        results.push({
          index: index,
          command: command,
          result: result,
          status: 'success',
          timestamp: new Date().toISOString()
        });
        
      } catch (commandError) {
        results.push({
          index: index,
          command: command,
          error: commandError.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
        
        // 실패 시 중단할지 여부 (옵션으로 추가 가능)
        // break;
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    
    res.json({
      success: successCount > 0,
      message: `Batch command completed: ${successCount}/${commands.length} successful`,
      total_commands: commands.length,
      successful_commands: successCount,
      total_delay: totalDelay,
      results: results,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute batch command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/control/sequential-move
 * @desc 순차적 웨이포인트 이동
 */
router.post('/sequential-move', requireMqttConnection, validateInput(schemas.sequentialMove), async (req, res) => {
  try {
    const { waypoints } = req.validatedData;
    const moveResults = [];
    
    for (const [index, waypoint] of waypoints.entries()) {
      try {
        let commandData = {};
        
        if (waypoint.type === 'joint') {
          commandData = {
            command: 'move_joint',
            positions: waypoint.positions,
            speed: waypoint.speed,
            source: 'sequential_api',
            waypoint_index: index
          };
        } else if (waypoint.type === 'linear') {
          commandData = {
            command: 'move_linear',
            position: waypoint.positions,
            speed: waypoint.speed,
            source: 'sequential_api',
            waypoint_index: index
          };
        }
        
        const result = await mqttService.publishRobotCommand(waypoint.type === 'joint' ? 'move_joint' : 'move_linear', commandData);
        
        moveResults.push({
          waypoint_index: index,
          type: waypoint.type,
          result: result,
          status: 'sent',
          timestamp: new Date().toISOString()
        });
        
        // 웨이포인트 대기 시간
        if (waypoint.wait_time > 0) {
          await new Promise(resolve => setTimeout(resolve, waypoint.wait_time));
        }
        
      } catch (waypointError) {
        moveResults.push({
          waypoint_index: index,
          type: waypoint.type,
          error: waypointError.message,
          status: 'failed',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    const successCount = moveResults.filter(r => r.status === 'sent').length;
    
    res.json({
      success: successCount > 0,
      message: `Sequential move completed: ${successCount}/${waypoints.length} waypoints sent`,
      total_waypoints: waypoints.length,
      successful_waypoints: successCount,
      results: moveResults,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute sequential move',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/control/system
 * @desc 시스템 제어 명령
 */
router.post('/system', requireMqttConnection, validateInput(schemas.systemCommand), async (req, res) => {
  try {
    const { action, options } = req.validatedData;
    let result = null;
    
    switch (action) {
      case 'health_check':
        result = {
          mqtt_service: mqttService.isHealthy(),
          performance: mqttService.getPerformanceMetrics(),
          current_status: mqttService.getCurrentStatus()
        };
        break;
        
      case 'calibrate_all':
        // 모든 센서 캘리브레이션
        const weightCalibration = mqttService.calibrateWeightSensor(options.weight_offset);
        result = {
          weight_sensor: weightCalibration,
          calibration_time: new Date().toISOString()
        };
        break;
        
      case 'reset':
        // 데이터 버퍼 리셋 등
        await mqttService.publishMessage('system/command', {
          action: 'reset',
          source: 'control_api',
          timestamp: new Date().toISOString()
        });
        result = { message: 'System reset command sent' };
        break;
        
      case 'restart':
        // 시스템 재시작 (주의: 실제 재시작은 구현하지 않음)
        result = { message: 'Restart command not implemented for safety' };
        break;
        
      default:
        throw new Error(`Unknown system action: ${action}`);
    }
    
    res.json({
      success: true,
      action: action,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to execute system command',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/control/logs
 * @desc 제어 시스템 로그 조회
 */
router.get('/logs', requireMqttConnection, async (req, res) => {
  try {
    const type = req.query.type || 'all'; // 'robot', 'sensor', 'system', 'all'
    const count = parseInt(req.query.count) || 50;
    
    let logs = [];
    
    if (type === 'all' || type === 'robot') {
      const robotHistory = mqttService.getDataHistory('robot/control', count);
      logs = logs.concat(robotHistory.map(item => ({ ...item, type: 'robot' })));
    }
    
    if (type === 'all' || type === 'sensor') {
      const sensorHistory = mqttService.getDataHistory('web/target_concentration', count);
      logs = logs.concat(sensorHistory.map(item => ({ ...item, type: 'sensor' })));
    }
    
    // 시간순 정렬
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // 요청된 개수만큼 제한
    logs = logs.slice(0, count);
    
    res.json({
      logs: logs,
      total: logs.length,
      type: type,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get control logs',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 에러 핸들러
router.use((error, req, res, next) => {
  console.error('Control API error:', error);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    timestamp: new Date().toISOString()
  });
});

module.exports = { router, setMqttService };
