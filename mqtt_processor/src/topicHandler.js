class TopicHandler {
  constructor(dataBuffer, logger) {
    this.dataBuffer = dataBuffer;
    this.logger = logger;
    
    // 토픽별 처리 통계
    this.processingStats = new Map();
    
    // ROS2 토픽 파싱 규칙
    this.ros2TopicPatterns = {
      jointStates: /\/dsr01\/joint_states$/,
      dynamicJointStates: /\/dsr01\/dynamic_joint_states$/,
      robotDescription: /\/dsr01\/robot_description$/,
      errorTopic: /\/dsr01\/error$/,
      robotDisconnection: /\/dsr01\/robot_disconnection$/,
      
      // 제어 관련 토픽들
      servojStream: /\/dsr01\/servoj.*stream$/,
      servolStream: /\/dsr01\/servol.*stream$/,
      speedjStream: /\/dsr01\/speedj.*stream$/,
      speedlStream: /\/dsr01\/speedl.*stream$/,
      torqueStream: /\/dsr01\/torque.*stream$/,
      
      // ROS 표준 토픽들
      tf: /^\/tf$/,
      tfStatic: /^\/tf_static$/,
      clickedPoint: /^\/clicked_point$/,
      initialPose: /^\/initialpose$/,
      moveBaseGoal: /^\/move_base_simple\/goal$/,
      parameterEvents: /^\/parameter_events$/,
      rosout: /^\/rosout$/
    };
  }

  /**
   * ROS2 토픽 리스트 처리
   */
  processROS2TopicList(topicList) {
    try {
      this.logger.info('🔍 Processing ROS2 topic list...');
      
      if (!Array.isArray(topicList)) {
        this.logger.warn('⚠️  ROS2 topic list is not an array');
        return null;
      }

      const categorizedTopics = this.categorizeROS2Topics(topicList);
      const topicAnalysis = this.analyzeTopicHealth(categorizedTopics);
      
      this.logger.info(`📊 Processed ${topicList.length} ROS2 topics:`);
      this.logger.info(`  - Robot Control: ${categorizedTopics.robotControl.length}`);
      this.logger.info(`  - Robot Status: ${categorizedTopics.robotStatus.length}`);
      this.logger.info(`  - System: ${categorizedTopics.system.length}`);
      this.logger.info(`  - Navigation: ${categorizedTopics.navigation.length}`);
      this.logger.info(`  - Other: ${categorizedTopics.other.length}`);

      return {
        total: topicList.length,
        categorized: categorizedTopics,
        analysis: topicAnalysis,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('❌ Error processing ROS2 topic list:', error);
      return null;
    }
  }

  /**
   * ROS2 토픽들을 카테고리별로 분류
   */
  categorizeROS2Topics(topics) {
    const categories = {
      robotControl: [],
      robotStatus: [],
      system: [],
      navigation: [],
      diagnostics: [],
      other: []
    };

    topics.forEach(topic => {
      if (this.ros2TopicPatterns.jointStates.test(topic) ||
          this.ros2TopicPatterns.dynamicJointStates.test(topic)) {
        categories.robotStatus.push(topic);
        
      } else if (this.ros2TopicPatterns.servojStream.test(topic) ||
                 this.ros2TopicPatterns.servolStream.test(topic) ||
                 this.ros2TopicPatterns.speedjStream.test(topic) ||
                 this.ros2TopicPatterns.speedlStream.test(topic) ||
                 this.ros2TopicPatterns.torqueStream.test(topic)) {
        categories.robotControl.push(topic);
        
      } else if (this.ros2TopicPatterns.errorTopic.test(topic) ||
                 this.ros2TopicPatterns.robotDisconnection.test(topic)) {
        categories.diagnostics.push(topic);
        
      } else if (this.ros2TopicPatterns.clickedPoint.test(topic) ||
                 this.ros2TopicPatterns.initialPose.test(topic) ||
                 this.ros2TopicPatterns.moveBaseGoal.test(topic)) {
        categories.navigation.push(topic);
        
      } else if (this.ros2TopicPatterns.tf.test(topic) ||
                 this.ros2TopicPatterns.tfStatic.test(topic) ||
                 this.ros2TopicPatterns.parameterEvents.test(topic) ||
                 this.ros2TopicPatterns.rosout.test(topic)) {
        categories.system.push(topic);
        
      } else {
        categories.other.push(topic);
      }
    });

    return categories;
  }

  /**
   * 토픽 상태 분석
   */
  analyzeTopicHealth(categorizedTopics) {
    const analysis = {
      status: 'healthy',
      issues: [],
      recommendations: []
    };

    // 필수 토픽 확인
    const requiredTopics = [
      '/dsr01/joint_states',
      '/dsr01/robot_description'
    ];

    const allTopics = [
      ...categorizedTopics.robotControl,
      ...categorizedTopics.robotStatus,
      ...categorizedTopics.system,
      ...categorizedTopics.navigation,
      ...categorizedTopics.diagnostics,
      ...categorizedTopics.other
    ];

    requiredTopics.forEach(required => {
      if (!allTopics.includes(required)) {
        analysis.issues.push(`Missing required topic: ${required}`);
        analysis.status = 'warning';
      }
    });

    // 에러 토픽 확인
    if (categorizedTopics.diagnostics.length > 0) {
      const errorTopics = categorizedTopics.diagnostics.filter(topic => 
        topic.includes('error') || topic.includes('disconnection')
      );
      
      if (errorTopics.length > 0) {
        analysis.issues.push(`Error topics detected: ${errorTopics.join(', ')}`);
        analysis.recommendations.push('Monitor error topics for system health');
      }
    }

    // 제어 토픽 확인
    if (categorizedTopics.robotControl.length === 0) {
      analysis.issues.push('No robot control topics found');
      analysis.recommendations.push('Verify robot controller is running');
      analysis.status = 'warning';
    }

    // 상태 토픽 확인
    if (categorizedTopics.robotStatus.length === 0) {
      analysis.issues.push('No robot status topics found');
      analysis.recommendations.push('Check robot state publisher');
      analysis.status = 'warning';
    }

    return analysis;
  }

  /**
   * 아두이노 무게 센서 데이터 처리
   */
  processWeightSensorData(data) {
    try {
      this.updateProcessingStats('weight_sensor');
      
      let weightValue = 0;
      let rawData = data;

      // 다양한 데이터 형식 처리
      if (typeof data === 'object') {
        if (data.weight !== undefined) {
          weightValue = parseFloat(data.weight) || 0;
        } else if (data.value !== undefined) {
          weightValue = parseFloat(data.value) || 0;
        } else if (data.data !== undefined) {
          weightValue = parseFloat(data.data) || 0;
        } else if (data.payload !== undefined) {
          weightValue = parseFloat(data.payload) || 0;
        }
      } else if (typeof data === 'number') {
        weightValue = data;
      } else if (typeof data === 'string') {
        // 문자열에서 숫자 추출 시도
        const numMatch = data.match(/[\d.-]+/);
        if (numMatch) {
          weightValue = parseFloat(numMatch[0]) || 0;
        }
      }

      // 데이터 검증 및 필터링
      const processedWeight = this.validateWeightData(weightValue);
      
      const result = {
        original: rawData,
        processed: {
          weight: processedWeight.value,
          unit: 'kg',
          status: processedWeight.status,
          quality: processedWeight.quality,
          timestamp: new Date().toISOString(),
          processing_info: {
            input_type: typeof data,
            raw_value: weightValue,
            filtered: processedWeight.filtered
          }
        }
      };

      this.logger.debug(`⚖️  Weight processed: ${processedWeight.value}kg (${processedWeight.status})`);
      
      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing weight sensor data:', error);
      return {
        error: error.message,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 무게 데이터 검증
   */
  validateWeightData(value) {
    const config = {
      minWeight: -1.0,    // 최소 무게 (음수 허용 - 영점 조정)
      maxWeight: 100.0,   // 최대 무게
      noiseThreshold: 0.01, // 노이즈 임계값
      stabilityWindow: 5,   // 안정성 확인 윈도우
    };

    let status = 'normal';
    let quality = 'good';
    let filtered = value;

    // 범위 검증
    if (value < config.minWeight || value > config.maxWeight) {
      status = 'out_of_range';
      quality = 'poor';
      filtered = Math.max(config.minWeight, Math.min(config.maxWeight, value));
    }

    // 노이즈 필터링 (간단한 라운딩)
    filtered = Math.round(filtered * 100) / 100;

    // 상태 분류
    if (filtered < 0.1) {
      status = 'empty';
    } else if (filtered > 50) {
      status = 'heavy';
      quality = 'warning';
    } else if (Math.abs(value - filtered) > config.noiseThreshold) {
      quality = 'filtered';
    }

    return {
      value: filtered,
      status,
      quality,
      filtered: value !== filtered
    };
  }

  /**
   * 목표 농도 설정 처리
   */
  processTargetConcentration(data) {
    try {
      this.updateProcessingStats('target_concentration');
      
      let targetValue = 75.0; // 기본값
      let source = 'unknown';
      let rawData = data;

      // 데이터 구조 파싱
      if (typeof data === 'object') {
        if (data.target !== undefined) {
          targetValue = parseFloat(data.target) || 75.0;
        } else if (data.value !== undefined) {
          targetValue = parseFloat(data.value) || 75.0;
        } else if (data.concentration !== undefined) {
          targetValue = parseFloat(data.concentration) || 75.0;
        }
        
        source = data.source || data.sender || 'web_dashboard';
      } else if (typeof data === 'number') {
        targetValue = data;
        source = 'direct_value';
      } else if (typeof data === 'string') {
        targetValue = parseFloat(data) || 75.0;
        source = 'string_value';
      }

      // 농도 범위 검증 (0-100%)
      const validatedValue = Math.max(0, Math.min(100, targetValue));
      
      const result = {
        original: rawData,
        processed: {
          target: validatedValue,
          unit: '%',
          source: source,
          valid: validatedValue === targetValue,
          clamped: validatedValue !== targetValue,
          timestamp: new Date().toISOString()
        }
      };

      this.logger.info(`🎯 Target concentration: ${validatedValue}% (source: ${source})`);
      
      if (result.processed.clamped) {
        this.logger.warn(`⚠️  Target value clamped from ${targetValue} to ${validatedValue}`);
      }

      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing target concentration:', error);
      return {
        error: error.message,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 로봇 제어 명령 처리
   */
  processRobotControlCommand(topic, data) {
    try {
      this.updateProcessingStats('robot_control');
      
      const commandType = this.extractCommandType(topic);
      const validatedCommand = this.validateRobotCommand(commandType, data);
      
      const result = {
        topic,
        command_type: commandType,
        original: data,
        processed: validatedCommand,
        timestamp: new Date().toISOString()
      };

      this.logger.info(`🤖 Robot command: ${commandType} - ${validatedCommand.status}`);
      
      if (validatedCommand.status === 'rejected') {
        this.logger.warn(`⚠️  Command rejected: ${validatedCommand.reason}`);
      }

      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing robot control command:', error);
      return {
        error: error.message,
        topic,
        original: data,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 토픽에서 명령 타입 추출
   */
  extractCommandType(topic) {
    if (topic.includes('move_joint')) return 'move_joint';
    if (topic.includes('move_linear')) return 'move_linear';
    if (topic.includes('stop')) return 'stop';
    if (topic.includes('home')) return 'home';
    if (topic.includes('emergency')) return 'emergency_stop';
    if (topic.includes('speed')) return 'speed_control';
    if (topic.includes('servo')) return 'servo_control';
    
    return 'unknown';
  }

  /**
   * 로봇 명령 검증
   */
  validateRobotCommand(commandType, data) {
    const validation = {
      status: 'accepted',
      reason: '',
      validated_data: data,
      safety_checks: []
    };

    switch (commandType) {
      case 'move_joint':
        validation.validated_data = this.validateJointCommand(data);
        break;
        
      case 'move_linear':
        validation.validated_data = this.validateLinearCommand(data);
        break;
        
      case 'stop':
      case 'emergency_stop':
        validation.validated_data = { command: 'stop', immediate: true };
        validation.safety_checks.push('Emergency stop - immediate execution');
        break;
        
      default:
        validation.status = 'rejected';
        validation.reason = `Unknown command type: ${commandType}`;
    }

    return validation;
  }

  /**
   * 관절 명령 검증
   */
  validateJointCommand(data) {
    const config = {
      jointCount: 6,
      jointLimits: [
        { min: -360, max: 360 }, // Joint 1
        { min: -360, max: 360 }, // Joint 2  
        { min: -158, max: 158 }, // Joint 3
        { min: -360, max: 360 }, // Joint 4
        { min: -360, max: 360 }, // Joint 5
        { min: -360, max: 360 }  // Joint 6
      ]
    };

    let jointPositions = [];
    
    if (Array.isArray(data)) {
      jointPositions = data;
    } else if (data.positions) {
      jointPositions = data.positions;
    } else if (data.joints) {
      jointPositions = data.joints;
    }

    // 관절 수 확인
    if (jointPositions.length !== config.jointCount) {
      throw new Error(`Invalid joint count. Expected ${config.jointCount}, got ${jointPositions.length}`);
    }

    // 관절 제한 확인
    const validatedPositions = jointPositions.map((pos, index) => {
      const limit = config.jointLimits[index];
      const degrees = parseFloat(pos) || 0;
      
      if (degrees < limit.min || degrees > limit.max) {
        this.logger.warn(`⚠️  Joint ${index + 1} position ${degrees}° exceeds limits [${limit.min}, ${limit.max}]`);
        return Math.max(limit.min, Math.min(limit.max, degrees));
      }
      
      return degrees;
    });

    return {
      command: 'move_joint',
      positions: validatedPositions,
      validated: true,
      speed: data.speed || 50, // 기본 속도 50%
      acceleration: data.acceleration || 50
    };
  }

  /**
   * 직선 명령 검증
   */
  validateLinearCommand(data) {
    const config = {
      workspace: {
        x: { min: -1000, max: 1000 },
        y: { min: -1000, max: 1000 },
        z: { min: 0, max: 1000 }
      }
    };

    let position = data.position || data.target || data;
    
    if (!position.x && !position.y && !position.z) {
      throw new Error('Invalid linear position data');
    }

    // 작업공간 제한 확인
    const validatedPosition = {
      x: Math.max(config.workspace.x.min, Math.min(config.workspace.x.max, position.x || 0)),
      y: Math.max(config.workspace.y.min, Math.min(config.workspace.y.max, position.y || 0)),
      z: Math.max(config.workspace.z.min, Math.min(config.workspace.z.max, position.z || 0)),
      rx: position.rx || 0,
      ry: position.ry || 0,
      rz: position.rz || 0
    };

    return {
      command: 'move_linear',
      position: validatedPosition,
      validated: true,
      speed: data.speed || 50,
      acceleration: data.acceleration || 50
    };
  }

  /**
   * 처리 통계 업데이트
   */
  updateProcessingStats(topicType) {
    if (!this.processingStats.has(topicType)) {
      this.processingStats.set(topicType, {
        count: 0,
        lastProcessed: null,
        errors: 0,
        successRate: 100
      });
    }

    const stats = this.processingStats.get(topicType);
    stats.count++;
    stats.lastProcessed = new Date().toISOString();
  }

  /**
   * 처리 통계 조회
   */
  getProcessingStats() {
    const stats = {};
    for (const [topic, data] of this.processingStats.entries()) {
      stats[topic] = { ...data };
    }
    return stats;
  }

  /**
   * 에러 메시지 처리
   */
  processErrorMessage(topic, data) {
    this.logger.error(`🚨 Error from ${topic}:`, data);
    
    const errorInfo = {
      topic,
      error: data,
      severity: this.determineErrorSeverity(topic, data),
      timestamp: new Date().toISOString(),
      action_required: this.determineRequiredAction(topic, data)
    };

    return errorInfo;
  }

  /**
   * 에러 심각도 결정
   */
  determineErrorSeverity(topic, data) {
    if (topic.includes('emergency') || topic.includes('safety')) {
      return 'critical';
    }
    
    if (topic.includes('error') || topic.includes('fault')) {
      return 'high';
    }
    
    if (topic.includes('warning') || topic.includes('disconnect')) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * 필요한 조치 결정
   */
  determineRequiredAction(topic, data) {
    if (topic.includes('emergency')) {
      return 'immediate_stop';
    }
    
    if (topic.includes('disconnect')) {
      return 'reconnect_robot';
    }
    
    if (topic.includes('error')) {
      return 'check_robot_status';
    }
    
    return 'monitor';
  }
}

module.exports = TopicHandler;
