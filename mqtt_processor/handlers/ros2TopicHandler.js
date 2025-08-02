/**
 * ROS2 토픽 핸들러
 * ros2_topic_list 토픽에서 받은 ROS2 토픽들을 처리
 */
class ROS2TopicHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.lastTopicList = [];
    this.topicCategories = {
      robotControl: [],
      robotStatus: [],
      navigation: [],
      diagnostics: [],
      system: [],
      other: []
    };
  }

  /**
   * ROS2 토픽 리스트 처리
   */
  handle(topicList) {
    try {
      if (!Array.isArray(topicList)) {
        this.logger.warn('⚠️  Invalid ROS2 topic list format');
        return null;
      }

      this.logger.info(`📋 Processing ${topicList.length} ROS2 topics`);
      
      // 토픽 분류
      const categorized = this.categorizeTopics(topicList);
      
      // 변경 사항 감지
      const changes = this.detectChanges(topicList);
      
      // 상태 분석
      const analysis = this.analyzeTopicHealth(categorized);
      
      const result = {
        total: topicList.length,
        categories: categorized,
        changes: changes,
        health: analysis,
        timestamp: new Date().toISOString()
      };

      // 캐시 업데이트
      this.lastTopicList = [...topicList];
      this.topicCategories = categorized;

      this.logger.info(`📊 Topics categorized: Control(${categorized.robotControl.length}), Status(${categorized.robotStatus.length}), Nav(${categorized.navigation.length})`);
      
      if (changes.added.length > 0) {
        this.logger.info(`➕ New topics: ${changes.added.join(', ')}`);
      }
      
      if (changes.removed.length > 0) {
        this.logger.warn(`➖ Removed topics: ${changes.removed.join(', ')}`);
      }

      return result;
      
    } catch (error) {
      this.logger.error('❌ Error processing ROS2 topics:', error);
      return null;
    }
  }

  /**
   * 토픽 분류
   */
  categorizeTopics(topics) {
    const categories = {
      robotControl: [],
      robotStatus: [],
      navigation: [],
      diagnostics: [],
      system: [],
      other: []
    };

    topics.forEach(topic => {
      if (this.isRobotControlTopic(topic)) {
        categories.robotControl.push(topic);
      } else if (this.isRobotStatusTopic(topic)) {
        categories.robotStatus.push(topic);
      } else if (this.isNavigationTopic(topic)) {
        categories.navigation.push(topic);
      } else if (this.isDiagnosticTopic(topic)) {
        categories.diagnostics.push(topic);
      } else if (this.isSystemTopic(topic)) {
        categories.system.push(topic);
      } else {
        categories.other.push(topic);
      }
    });

    return categories;
  }

  /**
   * 로봇 제어 토픽 확인
   */
  isRobotControlTopic(topic) {
    const controlPatterns = [
      /\/dsr01\/servoj.*stream$/,
      /\/dsr01\/servol.*stream$/,
      /\/dsr01\/speedj.*stream$/,
      /\/dsr01\/speedl.*stream$/,
      /\/dsr01\/torque.*stream$/,
      /\/dsr01\/alter_motion_stream$/
    ];
    
    return controlPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 로봇 상태 토픽 확인
   */
  isRobotStatusTopic(topic) {
    const statusPatterns = [
      /\/dsr01\/joint_states$/,
      /\/dsr01\/dynamic_joint_states$/,
      /\/dsr01\/robot_description$/
    ];
    
    return statusPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 네비게이션 토픽 확인
   */
  isNavigationTopic(topic) {
    const navPatterns = [
      /^\/clicked_point$/,
      /^\/initialpose$/,
      /^\/move_base_simple\/goal$/,
      /^\/tf$/,
      /^\/tf_static$/
    ];
    
    return navPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 진단 토픽 확인
   */
  isDiagnosticTopic(topic) {
    const diagPatterns = [
      /\/dsr01\/error$/,
      /\/dsr01\/robot_disconnection$/,
      /\/dsr01\/.*transition_event$/
    ];
    
    return diagPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 시스템 토픽 확인
   */
  isSystemTopic(topic) {
    const systemPatterns = [
      /^\/parameter_events$/,
      /^\/rosout$/
    ];
    
    return systemPatterns.some(pattern => pattern.test(topic));
  }

  /**
   * 변경 사항 감지
   */
  detectChanges(newTopicList) {
    const oldSet = new Set(this.lastTopicList);
    const newSet = new Set(newTopicList);
    
    const added = newTopicList.filter(topic => !oldSet.has(topic));
    const removed = this.lastTopicList.filter(topic => !newSet.has(topic));
    
    return { added, removed };
  }

  /**
   * 토픽 상태 분석
   */
  analyzeTopicHealth(categories) {
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
      ...categories.robotControl,
      ...categories.robotStatus,
      ...categories.navigation,
      ...categories.diagnostics,
      ...categories.system,
      ...categories.other
    ];

    requiredTopics.forEach(required => {
      if (!allTopics.includes(required)) {
        analysis.issues.push(`Missing required topic: ${required}`);
        analysis.status = 'warning';
      }
    });

    // 에러 토픽 확인
    const errorTopics = categories.diagnostics.filter(topic => 
      topic.includes('error') || topic.includes('disconnection')
    );
    
    if (errorTopics.length > 0) {
      analysis.issues.push(`Error topics present: ${errorTopics.length}`);
      analysis.recommendations.push('Monitor error topics for issues');
    }

    // 제어 토픽 확인
    if (categories.robotControl.length === 0) {
      analysis.issues.push('No robot control topics found');
      analysis.recommendations.push('Check robot controller status');
      analysis.status = 'warning';
    }

    return analysis;
  }

  /**
   * 통계 정보 반환
   */
  getStats() {
    return {
      total_topics: this.lastTopicList.length,
      categories: Object.keys(this.topicCategories).reduce((acc, key) => {
        acc[key] = this.topicCategories[key].length;
        return acc;
      }, {}),
      last_update: new Date().toISOString()
    };
  }
}

module.exports = ROS2TopicHandler;
