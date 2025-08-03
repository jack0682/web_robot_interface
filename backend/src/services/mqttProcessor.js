/**
 * MQTT Processor 통합 서비스 - WebSocket 클라이언트 기반
 * 독립 실행 중인 MQTT 프로세서와 WebSocket으로 통신
 */
const WebSocket = require('ws');
const { EventEmitter } = require('events');

class MqttProcessorService extends EventEmitter {
  constructor(logger) {
    super();
    this.logger = logger;
    this.ws = null;
    this.isConnected = false;
    this.dataCache = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = null;
    this.mqttProcessorUrl = 'ws://localhost:8081';
  }

  /**
   * WebSocket을 통한 MQTT Processor 연결
   */
  async initialize() {
    try {
      this.logger.info('🔌 Connecting to MQTT Processor via WebSocket...');
      
      await this.connectWebSocket();
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      this.logger.info('✅ MQTT Processor Service connected successfully');
      this.emit('connected');
      
      return true;
      
    } catch (error) {
      this.logger.error('❌ Failed to connect to MQTT Processor Service:', error);
      this.handleReconnection();
      return false;
    }
  }

  /**
   * WebSocket 연결
   */
  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.mqttProcessorUrl);

        this.ws.on('open', () => {
          this.logger.info('🔗 WebSocket connected to MQTT Processor');
          this.isConnected = true;
          
          // 초기 상태 요청
          this.sendMessage({
            type: 'get_status'
          });
          
          resolve();
        });

        this.ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleMessage(message);
          } catch (error) {
            this.logger.error('❌ WebSocket message parsing error:', error);
          }
        });

        this.ws.on('error', (error) => {
          this.logger.error('❌ WebSocket error:', error);
          this.isConnected = false;
          this.emit('error', error);
          reject(error);
        });

        this.ws.on('close', () => {
          this.logger.warn('⚠️  WebSocket connection closed');
          this.isConnected = false;
          this.emit('disconnected');
          this.handleReconnection();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * WebSocket 메시지 처리
   */
  handleMessage(message) {
    switch (message.type) {
      case 'mqtt_message':
        this.handleMqttMessage(message.topic, message.data);
        break;
        
      case 'status':
        this.handleStatusUpdate(message.data);
        break;
        
      case 'initial_data':
        this.handleInitialData(message.topic, message.data);
        break;
        
      case 'error':
        this.logger.error('MQTT Processor error:', message.data);
        this.emit('error', message.data);
        break;
        
      default:
        if (this.logger.level === 'debug') {
          this.logger.debug('Received message:', message);
        }
    }
  }

  /**
   * MQTT 메시지 처리
   */
  handleMqttMessage(topic, data) {
    // 데이터 캐시에 저장
    this.dataCache.set(topic, {
      data: data,
      timestamp: new Date().toISOString()
    });
    
    // 백엔드 이벤트 발생
    this.emit('data', { topic, data });
    
    // 특정 토픽별 이벤트
    if (topic === 'ros2_topic_list') {
      this.emit('ros2Topics', data);
    } else if (topic === 'topic') { // 무게센서
      this.emit('weightSensor', data);
    } else if (topic === 'web/target_concentration') {
      this.emit('concentration', data);
    } else if (topic.includes('robot/control/')) {
      this.emit('robotControl', { topic, data });
    }
  }

  /**
   * 상태 업데이트 처리
   */
  handleStatusUpdate(status) {
    this.logger.debug('MQTT Processor status update:', status);
  }

  /**
   * 초기 데이터 처리
   */
  handleInitialData(topic, data) {
    this.handleMqttMessage(topic, data);
  }

  /**
   * WebSocket 메시지 전송
   */
  sendMessage(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * 재연결 처리
   */
  async handleReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('🚨 Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    this.reconnectInterval = setTimeout(() => {
      this.initialize();
    }, 5000 * this.reconnectAttempts); // 지수 백오프
  }

  /**
   * API 메서드들
   */

  // 현재 상태 조회
  getCurrentStatus() {
    this.sendMessage({ type: 'get_status' });
    return {
      connected: this.isConnected,
      cache_size: this.dataCache.size,
      reconnect_attempts: this.reconnectAttempts
    };
  }

  // 핸들러 통계
  getHandlerStats(handlerName = null) {
    this.sendMessage({ 
      type: 'get_handler_stats',
      handler: handlerName
    });
    return { message: 'Stats request sent' };
  }

  // 농도 목표값 설정
  setConcentrationTarget(target, source = 'backend_api') {
    const success = this.sendMessage({
      type: 'publish',
      topic: 'web/target_concentration',
      message: {
        target: target,
        source: source,
        timestamp: new Date().toISOString()
      }
    });
    
    if (!success) {
      throw new Error('WebSocket not connected');
    }
    
    return { target, source, sent: true };
  }

  // 무게센서 캘리브레이션
  calibrateWeightSensor(offset = null) {
    const success = this.sendMessage({
      type: 'publish',
      topic: 'sensor/calibrate',
      message: {
        type: 'weight_calibration',
        offset: offset,
        source: 'backend_api',
        timestamp: new Date().toISOString()
      }
    });
    
    if (!success) {
      throw new Error('WebSocket not connected');
    }
    
    return { calibration: 'initiated', offset };
  }

  // 비상정지
  triggerEmergencyStop(source = 'backend_api') {
    const success = this.sendMessage({
      type: 'publish',
      topic: 'robot/control/emergency_stop',
      message: {
        command: 'emergency_stop',
        source: source,
        timestamp: new Date().toISOString()
      }
    });
    
    if (!success) {
      throw new Error('WebSocket not connected');
    }
    
    return { emergency_stop: 'triggered', source };
  }

  // 데이터 히스토리 조회
  getDataHistory(topic, count = 10) {
    this.sendMessage({
      type: 'get_history',
      topic: topic,
      count: count
    });
    
    // 캐시된 데이터 반환 (실시간)
    return Array.from(this.dataCache.entries())
      .filter(([key]) => !topic || key === topic)
      .slice(-count)
      .map(([key, value]) => ({ topic: key, ...value }));
  }

  // 캐시된 최신 데이터 조회
  getLatestData(topic = null) {
    if (topic) {
      return this.dataCache.get(topic) || null;
    }
    
    // 모든 토픽의 최신 데이터
    const result = {};
    for (const [topicName, data] of this.dataCache.entries()) {
      result[topicName] = data;
    }
    return result;
  }

  // ROS2 토픽 현황
  getROS2Topics() {
    return this.getLatestData('ros2_topic_list');
  }

  // 무게센서 최신 데이터
  getWeightSensorData() {
    return this.getLatestData('topic');
  }

  // 로봇 제어 명령 발행
  async publishRobotCommand(commandType, data) {
    const topic = `robot/control/${commandType}`;
    const success = this.sendMessage({
      type: 'publish',
      topic: topic,
      message: data
    });
    
    if (!success) {
      throw new Error('WebSocket not connected');
    }

    return {
      topic,
      command: commandType,
      data,
      timestamp: new Date().toISOString()
    };
  }

  // 메시지 발행 (범용)
  async publishMessage(topic, message, options = {}) {
    const success = this.sendMessage({
      type: 'publish',
      topic: topic,
      message: message,
      options: options
    });
    
    if (!success) {
      throw new Error('WebSocket not connected');
    }

    return { published: true, topic, timestamp: new Date().toISOString() };
  }

  // WebSocket 브로드캐스트 (MQTT 프로세서에게 요청)
  broadcastToWebSocket(data) {
    this.sendMessage({
      type: 'broadcast',
      data: data
    });
  }

  // 연결 상태 확인
  isHealthy() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  // 성능 메트릭
  getPerformanceMetrics() {
    return {
      websocket_connected: this.isConnected,
      data_cache_size: this.dataCache.size,
      reconnect_attempts: this.reconnectAttempts,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  // 우아한 종료
  async shutdown() {
    this.logger.info('🛑 Shutting down MQTT Processor Service...');
    
    try {
      // 재연결 타이머 정리
      if (this.reconnectInterval) {
        clearTimeout(this.reconnectInterval);
      }
      
      // WebSocket 연결 종료
      if (this.ws) {
        this.ws.close();
      }
      
      this.dataCache.clear();
      this.isConnected = false;
      this.emit('shutdown');
      
      this.logger.info('✅ MQTT Processor Service shutdown complete');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

module.exports = MqttProcessorService;