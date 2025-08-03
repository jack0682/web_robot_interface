/**
 * 로봇 제어 핸들러
 * 로봇 제어 명령 검증 및 처리
 */
class RobotControlHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.stats = {
      totalProcessed: 0,
      commandTypes: {},
      lastUpdate: null,
      emergencyStops: 0
    };
    this.history = [];
    this.allowedCommands = [
      'move_joint',
      'move_linear',
      'stop',
      'emergency_stop',
      'set_speed',
      'get_status'
    ];
  }

  handle(topic, data) {
    try {
      this.stats.totalProcessed++;
      this.stats.lastUpdate = new Date().toISOString();

      // 토픽에서 명령 타입 추출
      const commandType = this.extractCommandType(topic);
      
      // 명령 검증
      const validation = this.validateCommand(commandType, data);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // 통계 업데이트
      this.updateCommandStats(commandType);

      // 명령 처리
      const result = this.processCommand(commandType, data);

      // 히스토리 저장
      this.history.push({
        topic,
        commandType,
        data,
        result,
        timestamp: new Date().toISOString()
      });
      if (this.history.length > 100) {
        this.history.shift();
      }

      this.logger.info(`🎮 Robot command processed: ${commandType}`);

      return {
        success: true,
        commandType,
        result,
        validated: true
      };
    } catch (error) {
      this.logger.error('❌ Robot control handler error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  extractCommandType(topic) {
    // robot/control/move_joint -> move_joint
    const parts = topic.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  validateCommand(commandType, data) {
    // 허용된 명령인지 확인
    if (!this.allowedCommands.includes(commandType)) {
      return {
        valid: false,
        error: `Unknown command type: ${commandType}`
      };
    }

    // 명령별 데이터 검증
    switch (commandType) {
      case 'move_joint':
        if (!data.joints || !Array.isArray(data.joints) || data.joints.length !== 6) {
          return {
            valid: false,
            error: 'move_joint requires 6 joint angles'
          };
        }
        break;

      case 'move_linear':
        if (!data.position || !Array.isArray(data.position) || data.position.length !== 6) {
          return {
            valid: false,
            error: 'move_linear requires 6D position [x,y,z,rx,ry,rz]'
          };
        }
        break;

      case 'set_speed':
        if (!data.speed || typeof data.speed !== 'number' || data.speed <= 0 || data.speed > 100) {
          return {
            valid: false,
            error: 'set_speed requires valid speed value (1-100)'
          };
        }
        break;
    }

    return { valid: true };
  }

  processCommand(commandType, data) {
    switch (commandType) {
      case 'move_joint':
        return this.processMoveJoint(data);
      
      case 'move_linear':
        return this.processMoveLinear(data);
      
      case 'stop':
        return this.processStop(data);
      
      case 'emergency_stop':
        return this.processEmergencyStop(data);
      
      case 'set_speed':
        return this.processSetSpeed(data);
      
      case 'get_status':
        return this.processGetStatus(data);
      
      default:
        return {
          acknowledged: true,
          message: `Command ${commandType} received but not implemented`
        };
    }
  }

  processMoveJoint(data) {
    // 조인트 한계값 검증
    const jointLimits = [
      [-360, 360], [-360, 360], [-158, 158],
      [-360, 360], [-360, 360], [-360, 360]
    ];

    for (let i = 0; i < data.joints.length; i++) {
      const joint = data.joints[i];
      const [min, max] = jointLimits[i];
      
      if (joint < min || joint > max) {
        throw new Error(`Joint ${i+1} angle ${joint}° exceeds limits [${min}, ${max}]`);
      }
    }

    return {
      command: 'move_joint',
      joints: data.joints,
      speed: data.speed || 30,
      acceleration: data.acceleration || 30,
      validated: true,
      safe: true
    };
  }

  processMoveLinear(data) {
    // 작업공간 한계값 검증
    const [x, y, z, rx, ry, rz] = data.position;
    
    if (Math.sqrt(x*x + y*y) > 900 || z < 0 || z > 1000) {
      throw new Error(`Position [${x}, ${y}, ${z}] outside workspace limits`);
    }

    return {
      command: 'move_linear',
      position: data.position,
      speed: data.speed || 100,
      acceleration: data.acceleration || 100,
      validated: true,
      safe: true
    };
  }

  processStop(data) {
    return {
      command: 'stop',
      immediate: true,
      source: data.source || 'control_handler'
    };
  }

  processEmergencyStop(data) {
    this.stats.emergencyStops++;
    
    return {
      command: 'emergency_stop',
      immediate: true,
      priority: 'highest',
      source: data.source || 'control_handler',
      timestamp: new Date().toISOString()
    };
  }

  processSetSpeed(data) {
    return {
      command: 'set_speed',
      speed: data.speed,
      unit: 'percent',
      applied: true
    };
  }

  processGetStatus(data) {
    return {
      command: 'get_status',
      handler_stats: this.stats,
      last_commands: this.history.slice(-5)
    };
  }

  updateCommandStats(commandType) {
    if (!this.stats.commandTypes[commandType]) {
      this.stats.commandTypes[commandType] = 0;
    }
    this.stats.commandTypes[commandType]++;
  }

  createEmergencyStop(source = 'api') {
    return this.handle('robot/control/emergency_stop', {
      source: source,
      timestamp: new Date().toISOString()
    });
  }

  getStats() {
    return this.stats;
  }

  getHistory(count = 10) {
    return this.history.slice(-count);
  }

  reset() {
    this.stats = {
      totalProcessed: 0,
      commandTypes: {},
      lastUpdate: null,
      emergencyStops: 0
    };
    this.history = [];
  }
}

module.exports = RobotControlHandler;