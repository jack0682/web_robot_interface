/**
 * 로봇 제어 핸들러
 * 로봇 제어 명령 처리 및 검증
 */
class RobotControlHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.commandHistory = [];
    this.maxHistorySize = 100;
    
    // 로봇 제어 설정
    this.config = {
      jointCount: 6,
      jointLimits: [
        { min: -360, max: 360, name: 'Joint 1' },
        { min: -360, max: 360, name: 'Joint 2' },
        { min: -158, max: 158, name: 'Joint 3' },
        { min: -360, max: 360, name: 'Joint 4' },
        { min: -360, max: 360, name: 'Joint 5' },
        { min: -360, max: 360, name: 'Joint 6' }
      ],
      workspace: {
        x: { min: -1000, max: 1000 },
        y: { min: -1000, max: 1000 },
        z: { min: 0, max: 1000 },
        rx: { min: -180, max: 180 },
        ry: { min: -180, max: 180 },
        rz: { min: -180, max: 180 }
      },
      maxSpeed: 100,
      maxAcceleration: 100,
      emergencyStopTopics: ['emergency_stop', 'stop', 'halt']
    };
  }

  /**
   * 로봇 제어 명령 처리
   */
  handle(topic, data) {
    try {
      const commandType = this.extractCommandType(topic);
      const validation = this.validateCommand(commandType, data);
      
      // 히스토리 업데이트
      this.updateHistory(topic, commandType, data, validation);
      
      const result = {
        topic: topic,
        command_type: commandType,
        original: data,
        validation: validation,
        timestamp: new Date().toISOString(),
        safety_level: this.determineSafetyLevel(commandType, validation)
      };

      // 로깅
      if (validation.status === 'accepted') {
        this.logger.info(`🤖 Robot command accepted: ${commandType}`);
      } else {
        this.logger.warn(`⚠️  Robot command rejected: ${commandType} - ${validation.reason}`);
      }

      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing robot control command:', error);
      return {
        error: error.message,
        topic: topic,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 토픽에서 명령 타입 추출
   */
  extractCommandType(topic) {
    const topicLower = topic.toLowerCase();
    
    if (topicLower.includes('move_joint') || topicLower.includes('movej')) {
      return 'move_joint';
    } else if (topicLower.includes('move_linear') || topicLower.includes('movel')) {
      return 'move_linear';
    } else if (topicLower.includes('emergency') || topicLower.includes('estop')) {
      return 'emergency_stop';
    } else if (topicLower.includes('stop') || topicLower.includes('halt')) {
      return 'stop';
    } else if (topicLower.includes('home')) {
      return 'home';
    } else if (topicLower.includes('speed')) {
      return 'speed_control';
    } else if (topicLower.includes('servo')) {
      return 'servo_control';
    } else if (topicLower.includes('jog')) {
      return 'jog';
    }
    
    return 'unknown';
  }

  /**
   * 명령 검증
   */
  validateCommand(commandType, data) {
    const validation = {
      status: 'rejected',
      reason: '',
      validated_data: null,
      safety_checks: [],
      warnings: []
    };

    try {
      switch (commandType) {
        case 'move_joint':
          validation.validated_data = this.validateJointCommand(data);
          validation.status = 'accepted';
          break;
          
        case 'move_linear':
          validation.validated_data = this.validateLinearCommand(data);
          validation.status = 'accepted';
          break;
          
        case 'emergency_stop':
        case 'stop':
          validation.validated_data = { command: 'stop', immediate: true };
          validation.status = 'accepted';
          validation.safety_checks.push('Emergency stop - highest priority');
          break;
          
        case 'home':
          validation.validated_data = this.validateHomeCommand(data);
          validation.status = 'accepted';
          break;
          
        case 'speed_control':
          validation.validated_data = this.validateSpeedCommand(data);
          validation.status = 'accepted';
          break;
          
        default:
          validation.reason = `Unknown or unsupported command type: ${commandType}`;
      }
      
    } catch (error) {
      validation.reason = error.message;
      validation.status = 'rejected';
    }

    return validation;
  }

  /**
   * 관절 이동 명령 검증
   */
  validateJointCommand(data) {
    let jointPositions = [];
    let speed = 50;
    let acceleration = 50;

    // 관절 위치 추출
    if (Array.isArray(data)) {
      jointPositions = data;
    } else if (data.positions || data.joints) {
      jointPositions = data.positions || data.joints;
    } else if (data.joint_positions) {
      jointPositions = data.joint_positions;
    } else {
      throw new Error('Joint positions not found in command data');
    }

    // 속도 및 가속도 추출
    if (data.speed !== undefined) {
      speed = Math.max(1, Math.min(this.config.maxSpeed, parseFloat(data.speed) || 50));
    }
    if (data.acceleration !== undefined) {
      acceleration = Math.max(1, Math.min(this.config.maxAcceleration, parseFloat(data.acceleration) || 50));
    }

    // 관절 수 확인
    if (jointPositions.length !== this.config.jointCount) {
      throw new Error(`Invalid joint count. Expected ${this.config.jointCount}, got ${jointPositions.length}`);
    }

    // 관절 제한 확인 및 수정
    const validatedPositions = jointPositions.map((pos, index) => {
      const limit = this.config.jointLimits[index];
      const degrees = parseFloat(pos) || 0;
      
      if (degrees < limit.min || degrees > limit.max) {
        const clamped = Math.max(limit.min, Math.min(limit.max, degrees));
        this.logger.warn(`⚠️  ${limit.name} position ${degrees}° clamped to ${clamped}° (limit: [${limit.min}, ${limit.max}])`);
        return clamped;
      }
      
      return degrees;
    });

    return {
      command: 'move_joint',
      positions: validatedPositions,
      speed: speed,
      acceleration: acceleration,
      validated: true
    };
  }

  /**
   * 직선 이동 명령 검증
   */
  validateLinearCommand(data) {
    let position = {};
    let speed = 50;
    let acceleration = 50;

    // 위치 정보 추출
    if (data.position) {
      position = data.position;
    } else if (data.target) {
      position = data.target;
    } else if (data.x !== undefined || data.y !== undefined || data.z !== undefined) {
      position = { x: data.x, y: data.y, z: data.z, rx: data.rx, ry: data.ry, rz: data.rz };
    } else {
      throw new Error('Position data not found in command');
    }

    // 속도 및 가속도 추출
    if (data.speed !== undefined) {
      speed = Math.max(1, Math.min(this.config.maxSpeed, parseFloat(data.speed) || 50));
    }
    if (data.acceleration !== undefined) {
      acceleration = Math.max(1, Math.min(this.config.maxAcceleration, parseFloat(data.acceleration) || 50));
    }

    // 작업공간 제한 확인
    const validatedPosition = {};
    for (const [axis, limit] of Object.entries(this.config.workspace)) {
      const value = parseFloat(position[axis]) || 0;
      if (value < limit.min || value > limit.max) {
        const clamped = Math.max(limit.min, Math.min(limit.max, value));
        this.logger.warn(`⚠️  ${axis.toUpperCase()} position ${value} clamped to ${clamped} (limit: [${limit.min}, ${limit.max}])`);
        validatedPosition[axis] = clamped;
      } else {
        validatedPosition[axis] = value;
      }
    }

    return {
      command: 'move_linear',
      position: validatedPosition,
      speed: speed,
      acceleration: acceleration,
      validated: true
    };
  }

  /**
   * 홈 위치 명령 검증
   */
  validateHomeCommand(data) {
    let speed = 30; // 홈 이동은 낮은 속도로

    if (data && data.speed !== undefined) {
      speed = Math.max(1, Math.min(50, parseFloat(data.speed) || 30));
    }

    return {
      command: 'move_home',
      speed: speed,
      validated: true
    };
  }

  /**
   * 속도 제어 명령 검증
   */
  validateSpeedCommand(data) {
    let speed = 50;

    if (typeof data === 'number') {
      speed = data;
    } else if (data.speed !== undefined) {
      speed = data.speed;
    } else if (data.value !== undefined) {
      speed = data.value;
    }

    speed = Math.max(1, Math.min(this.config.maxSpeed, parseFloat(speed) || 50));

    return {
      command: 'set_speed',
      speed: speed,
      validated: true
    };
  }

  /**
   * 안전 레벨 결정
   */
  determineSafetyLevel(commandType, validation) {
    if (validation.status === 'rejected') {
      return 'blocked';
    }

    switch (commandType) {
      case 'emergency_stop':
      case 'stop':
        return 'critical';
      case 'move_joint':
      case 'move_linear':
        return 'normal';
      case 'home':
        return 'safe';
      case 'speed_control':
        return 'low';
      default:
        return 'unknown';
    }
  }

  /**
   * 명령 히스토리 업데이트
   */
  updateHistory(topic, commandType, data, validation) {
    this.commandHistory.push({
      topic: topic,
      command_type: commandType,
      data: data,
      validation: validation,
      timestamp: new Date().toISOString()
    });
    
    if (this.commandHistory.length > this.maxHistorySize) {
      this.commandHistory.shift();
    }
  }

  /**
   * 로봇 응답 생성
   */
  generateResponse(commandType, validation, executionResult = null) {
    const response = {
      command_type: commandType,
      validation_status: validation.status,
      execution_status: executionResult ? executionResult.status : 'pending',
      message: this.generateResponseMessage(commandType, validation, executionResult),
      timestamp: new Date().toISOString()
    };

    if (validation.status === 'accepted' && validation.validated_data) {
      response.validated_command = validation.validated_data;
    }

    if (validation.reason) {
      response.rejection_reason = validation.reason;
    }

    if (validation.warnings && validation.warnings.length > 0) {
      response.warnings = validation.warnings;
    }

    return response;
  }

  /**
   * 응답 메시지 생성
   */
  generateResponseMessage(commandType, validation, executionResult) {
    if (validation.status === 'rejected') {
      return `Command ${commandType} rejected: ${validation.reason}`;
    }

    if (executionResult) {
      if (executionResult.status === 'success') {
        return `Command ${commandType} executed successfully`;
      } else {
        return `Command ${commandType} execution failed: ${executionResult.error}`;
      }
    }

    return `Command ${commandType} validated and queued for execution`;
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    const recentCommands = this.commandHistory.slice(-20);
    const commandTypes = {};
    const validationResults = { accepted: 0, rejected: 0 };

    recentCommands.forEach(cmd => {
      // 명령 타입별 통계
      commandTypes[cmd.command_type] = (commandTypes[cmd.command_type] || 0) + 1;
      
      // 검증 결과 통계
      validationResults[cmd.validation.status]++;
    });

    return {
      total_commands: this.commandHistory.length,
      recent_commands: recentCommands.length,
      command_types: commandTypes,
      validation_results: validationResults,
      success_rate: recentCommands.length > 0 
        ? Math.round((validationResults.accepted / recentCommands.length) * 100) 
        : 0,
      last_command: this.commandHistory.length > 0 
        ? this.commandHistory[this.commandHistory.length - 1].timestamp 
        : null
    };
  }

  /**
   * 명령 히스토리 조회
   */
  getHistory(count = 10) {
    return this.commandHistory.slice(-count);
  }

  /**
   * 설정 업데이트
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('🤖 Robot control handler configuration updated');
  }

  /**
   * 비상정지 명령 생성
   */
  createEmergencyStop(source = 'mqtt_processor') {
    return this.handle('robot/control/emergency_stop', {
      command: 'emergency_stop',
      immediate: true,
      source: source,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = RobotControlHandler;
