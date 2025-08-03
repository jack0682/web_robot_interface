/**
 * ROS2 토픽 핸들러
 * ROS2 토픽 목록을 분석하고 분류
 */
class ROS2TopicHandler {
  constructor(logger, dataBuffer) {
    this.logger = logger;
    this.dataBuffer = dataBuffer;
    this.stats = {
      totalProcessed: 0,
      categories: {},
      lastUpdate: null
    };
  }

  handle(data) {
    try {
      this.stats.totalProcessed++;
      this.stats.lastUpdate = new Date().toISOString();

      // ROS2 토픽 리스트 분석
      if (Array.isArray(data)) {
        const categories = this.categorizeTopics(data);
        this.stats.categories = categories;
        
        this.logger.debug(`📋 Processed ${data.length} ROS2 topics`);
        
        return {
          success: true,
          topics: data,
          categories: categories,
          count: data.length
        };
      }

      return {
        success: false,
        error: 'Invalid ROS2 topic data format'
      };
    } catch (error) {
      this.logger.error('❌ ROS2 topic handler error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  categorizeTopics(topics) {
    const categories = {
      robot: [],
      sensor: [],
      control: [],
      status: [],
      other: []
    };

    topics.forEach(topic => {
      if (topic.includes('/robot') || topic.includes('/joint')) {
        categories.robot.push(topic);
      } else if (topic.includes('/sensor') || topic.includes('/camera')) {
        categories.sensor.push(topic);
      } else if (topic.includes('/control') || topic.includes('/cmd')) {
        categories.control.push(topic);
      } else if (topic.includes('/status') || topic.includes('/state')) {
        categories.status.push(topic);
      } else {
        categories.other.push(topic);
      }
    });

    return categories;
  }

  getStats() {
    return this.stats;
  }

  reset() {
    this.stats = {
      totalProcessed: 0,
      categories: {},
      lastUpdate: null
    };
  }
}

module.exports = ROS2TopicHandler;