/**
 * 핸들러 통합 모듈
 * 모든 토픽 핸들러들을 관리하고 중앙 집중식으로 처리
 */
const ROS2TopicHandler = require('./ros2TopicHandler');
const WeightSensorHandler = require('./weightSensorHandler');
const ConcentrationHandler = require('./concentrationHandler');
const RobotControlHandler = require('./robotControlHandler');

class HandlerManager {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    
    // 각 핸들러 인스턴스 생성
    this.handlers = {
      ros2Topic: new ROS2TopicHandler(logger, dataBuffer),
      weightSensor: new WeightSensorHandler(logger, dataBuffer),
      concentration: new ConcentrationHandler(logger, dataBuffer),
      robotControl: new RobotControlHandler(logger, dataBuffer)
    };
    
    // 핸들러 통계
    this.stats = {
      totalProcessed: 0,
      handlerStats: {},
      lastUpdate: null
    };
    
    this.logger.info('🔧 Handler Manager initialized with all topic handlers');
  }

  /**
   * 토픽에 따라 적절한 핸들러로 라우팅
   */
  routeMessage(topic, data) {
    try {
      this.stats.totalProcessed++;
      this.stats.lastUpdate = new Date().toISOString();
      
      let result = null;
      let handlerUsed = 'none';

      // 토픽 기반 라우팅
      if (topic === 'ros2_topic_list') {
        result = this.handlers.ros2Topic.handle(data);
        handlerUsed = 'ros2Topic';
        
      } else if (topic === 'topic') { // 아두이노 무게센서
        result = this.handlers.weightSensor.handle(data);
        handlerUsed = 'weightSensor';
        
      } else if (topic === 'web/target_concentration') {
        result = this.handlers.concentration.handle(data);
        handlerUsed = 'concentration';
        
      } else if (topic.includes('robot/control/')) {
        result = this.handlers.robotControl.handle(topic, data);
        handlerUsed = 'robotControl';
        
      } else {
        // 알려지지 않은 토픽에 대한 기본 처리
        result = this.handleUnknownTopic(topic, data);
        handlerUsed = 'unknown';
      }

      // 핸들러 통계 업데이트
      this.updateHandlerStats(handlerUsed);
      
      return {
        success: true,
        handler: handlerUsed,
        result: result,
        topic: topic,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`❌ Error routing message for topic ${topic}:`, error);
      return {
        success: false,
        error: error.message,
        topic: topic,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 알려지지 않은 토픽 처리
   */
  handleUnknownTopic(topic, data) {
    this.logger.debug(`❓ Unknown topic received: ${topic}`);
    
    return {
      topic: topic,
      data: data,
      processed: false,
      note: 'No specific handler available for this topic',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 핸들러 통계 업데이트
   */
  updateHandlerStats(handlerName) {
    if (!this.stats.handlerStats[handlerName]) {
      this.stats.handlerStats[handlerName] = {
        count: 0,
        lastUsed: null
      };
    }
    
    this.stats.handlerStats[handlerName].count++;
    this.stats.handlerStats[handlerName].lastUsed = new Date().toISOString();
  }

  /**
   * 모든 핸들러의 통계 정보 조회
   */
  getAllStats() {
    const handlerStats = {};
    
    // 각 핸들러의 개별 통계 수집
    Object.keys(this.handlers).forEach(key => {
      if (this.handlers[key].getStats) {
        handlerStats[key] = this.handlers[key].getStats();
      }
    });

    return {
      manager: this.stats,
      handlers: handlerStats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 특정 핸들러의 통계 조회
   */
  getHandlerStats(handlerName) {
    if (this.handlers[handlerName] && this.handlers[handlerName].getStats) {
      return this.handlers[handlerName].getStats();
    }
    
    return null;
  }

  /**
   * 현재 농도 목표값 조회
   */
  getCurrentConcentrationTarget() {
    return this.handlers.concentration.getCurrentTarget();
  }

  /**
   * 무게센서 통계 조회
   */
  getWeightSensorStats() {
    return this.handlers.weightSensor.getStats();
  }

  /**
   * ROS2 토픽 분류 정보 조회
   */
  getROS2TopicCategories() {
    const stats = this.handlers.ros2Topic.getStats();
    return stats ? stats.categories : null;
  }

  /**
   * 로봇 제어 명령 히스토리 조회
   */
  getRobotControlHistory(count = 10) {
    return this.handlers.robotControl.getHistory(count);
  }

  /**
   * 농도 설정 히스토리 조회
   */
  getConcentrationHistory(count = 10) {
    return this.handlers.concentration.getHistory(count);
  }

  /**
   * 무게센서 히스토리 조회
   */
  getWeightHistory(count = 10) {
    return this.handlers.weightSensor.getHistory(count);
  }

  /**
   * 핸들러 설정 업데이트
   */
  updateHandlerConfig(handlerName, config) {
    if (this.handlers[handlerName] && this.handlers[handlerName].updateConfig) {
      this.handlers[handlerName].updateConfig(config);
      this.logger.info(`🔧 Updated configuration for ${handlerName} handler`);
      return true;
    }
    
    this.logger.warn(`⚠️  Handler ${handlerName} not found or doesn't support configuration updates`);
    return false;
  }

  /**
   * 무게센서 캘리브레이션
   */
  calibrateWeightSensor(offset = null) {
    if (offset !== null) {
      this.handlers.weightSensor.setCalibration(offset);
    } else {
      this.handlers.weightSensor.zeroCalibration();
    }
    
    return this.handlers.weightSensor.getStats();
  }

  /**
   * 농도 목표값 직접 설정
   */
  setConcentrationTarget(value, source = 'handler_manager') {
    return this.handlers.concentration.setTarget(value, source);
  }

  /**
   * 비상정지 명령 생성
   */
  emergencyStop(source = 'handler_manager') {
    return this.handlers.robotControl.createEmergencyStop(source);
  }

  /**
   * 핸들러 상태 체크
   */
  healthCheck() {
    const health = {
      status: 'healthy',
      handlers: {},
      issues: [],
      timestamp: new Date().toISOString()
    };

    // 각 핸들러 상태 확인
    Object.keys(this.handlers).forEach(key => {
      try {
        const stats = this.handlers[key].getStats ? this.handlers[key].getStats() : {};
        health.handlers[key] = {
          status: 'healthy',
          stats: stats
        };
      } catch (error) {
        health.handlers[key] = {
          status: 'error',
          error: error.message
        };
        health.issues.push(`Handler ${key}: ${error.message}`);
        health.status = 'degraded';
      }
    });

    // 전반적인 상태 체크
    if (this.stats.totalProcessed === 0) {
      health.issues.push('No messages processed yet');
      health.status = 'warning';
    }

    const timeSinceLastUpdate = this.stats.lastUpdate 
      ? Date.now() - new Date(this.stats.lastUpdate).getTime() 
      : null;
      
    if (timeSinceLastUpdate && timeSinceLastUpdate > 300000) { // 5분
      health.issues.push('No recent message processing activity');
      health.status = 'warning';
    }

    return health;
  }

  /**
   * 모든 핸들러 리셋
   */
  resetAll() {
    this.logger.info('🔄 Resetting all handlers...');
    
    // 통계 리셋
    this.stats = {
      totalProcessed: 0,
      handlerStats: {},
      lastUpdate: null
    };

    // 각 핸들러의 히스토리 클리어 (가능한 경우)
    Object.keys(this.handlers).forEach(key => {
      if (this.handlers[key].reset) {
        this.handlers[key].reset();
      }
    });

    this.logger.info('✅ All handlers reset complete');
  }

  /**
   * 특정 핸들러의 상세 정보 조회
   */
  getHandlerDetails(handlerName) {
    if (!this.handlers[handlerName]) {
      return null;
    }

    const handler = this.handlers[handlerName];
    const details = {
      name: handlerName,
      available_methods: Object.getOwnPropertyNames(Object.getPrototypeOf(handler))
        .filter(name => name !== 'constructor' && typeof handler[name] === 'function'),
      stats: handler.getStats ? handler.getStats() : null,
      config: handler.config || null,
      last_activity: this.stats.handlerStats[handlerName] || null
    };

    return details;
  }

  /**
   * 핸들러 성능 메트릭
   */
  getPerformanceMetrics() {
    const now = Date.now();
    const metrics = {
      total_processed: this.stats.totalProcessed,
      processing_rate: 0,
      handler_distribution: {},
      timestamp: new Date().toISOString()
    };

    // 핸들러별 메시지 분포
    const totalHandlerMessages = Object.values(this.stats.handlerStats)
      .reduce((sum, stat) => sum + stat.count, 0);

    Object.keys(this.stats.handlerStats).forEach(key => {
      const stat = this.stats.handlerStats[key];
      metrics.handler_distribution[key] = {
        count: stat.count,
        percentage: totalHandlerMessages > 0 
          ? Math.round((stat.count / totalHandlerMessages) * 100) 
          : 0,
        last_used: stat.lastUsed
      };
    });

    // 처리율 계산 (최근 1분간)
    if (this.stats.lastUpdate) {
      const timeDiff = now - new Date(this.stats.lastUpdate).getTime();
      if (timeDiff > 0) {
        metrics.processing_rate = Math.round((this.stats.totalProcessed / (timeDiff / 1000)) * 100) / 100;
      }
    }

    return metrics;
  }
}

module.exports = HandlerManager;
