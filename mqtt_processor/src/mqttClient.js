/**
 * MQTT Client for Robot Web Dashboard
 * EMQX Cloud Integration with WebSocket Bridge + HTTP Status Server
 */

const mqtt = require('mqtt');
const WebSocket = require('ws');
const http = require('http');
const Logger = require('./logger');
const DataBuffer = require('./dataBuffer');
const HandlerManager = require('../handlers');
const fs = require('fs');
const path = require('path');

class MqttClient {
  constructor(config) {
    this.config = {
      mqtt: {
        host: config.mqttHost || 'localhost',
        port: config.mqttPort || 1883,
        username: config.mqttUsername || '',
        password: config.mqttPassword || '',
        protocol: config.mqttPort === 8883 ? 'mqtts' : 'mqtt',
        keepalive: 60,
        reconnectPeriod: config.reconnectInterval || 5000,
        connectTimeout: 30000,
        clean: true,
        clientId: `robot_dashboard_processor_${Date.now()}`
      },
      websocket: {
        port: config.wsPort || 8080
      },
      topics: {
        ros2_topic_list: 'ros2_topic_list',
        weight_sensor: 'topic',
        concentration_target: 'web/target_concentration',
        robot_control: 'robot/control/+',
        system_health: 'system/health',
        sensor_data: 'sensors/+',
        error_messages: 'errors/+'
      },
      buffer: {
        maxSize: config.maxBufferSize || 2000,
        retentionHours: config.dataRetentionHours || 48
      },
      performance: {
        heartbeatInterval: config.heartbeatInterval || 30000,
        maxReconnectAttempts: config.maxReconnectAttempts || 10
      },
      debug: config.debugMode || false,
      verbose: config.enableVerboseLogging || false
    };

    this.logger = new Logger('MqttClient');
    this.mqttClient = null;
    this.wsServer = null;
    this.httpServer = null;
    this.wsClients = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = null;

    // 데이터 버퍼 초기화
    this.dataBuffer = new DataBuffer(this.config.buffer.maxSize);
    
    // 핸들러 매니저는 initialize에서 생성
    this.handlerManager = null;
    
    // ROS2 토픽 캐시
    this.ros2TopicCache = [];
    
    // 통계 정보
    this.stats = {
      messagesReceived: 0,
      messagesPublished: 0,
      errorsCount: 0,
      startTime: new Date(),
      lastMessageTime: null
    };
  }

  async initialize() {
    this.logger.info('🔌 Initializing MQTT Client...');
    
    try {
      // MQTT 클라이언트 생성 및 연결
      await this.connectMqtt();
      
      // WebSocket 서버 시작 (HTTP 서버 포함)
      await this.startWebSocketServer();
      
      // 핸들러 매니저 초기화 (MQTT 연결 후)
      this.handlerManager = new HandlerManager(this.logger, this.dataBuffer);
      
      // 토픽 핸들러 설정
      this.setupTopicHandlers();
      
      // 하트비트 시작
      this.startHeartbeat();
      
      this.logger.info('✅ MQTT Client initialized successfully');
      return true;
      
    } catch (error) {
      this.logger.error('❌ Failed to initialize MQTT Client:', error);
      throw error;
    }
  }

  async connectMqtt() {
    return new Promise((resolve, reject) => {
      const connectionOptions = {
        ...this.config.mqtt,
        will: {
          topic: this.config.topics.system_health,
          payload: JSON.stringify({
            status: 'disconnected',
            message: 'MQTT Processor disconnected unexpectedly',
            timestamp: new Date().toISOString()
          }),
          qos: 1,
          retain: false
        }
      };

      // SSL/TLS 설정 (EMQX Cloud용)
      if (this.config.mqtt.protocol === 'mqtts') {
        connectionOptions.rejectUnauthorized = false; // 개발용 설정
      }

      this.logger.info(`🔗 Connecting to MQTT broker: ${this.config.mqtt.protocol}://${this.config.mqtt.host}:${this.config.mqtt.port}`);

      this.mqttClient = mqtt.connect(connectionOptions);

      this.mqttClient.on('connect', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('✅ MQTT connected successfully');
        
        // 토픽 구독
        this.subscribeToTopics();
        resolve();
      });

      this.mqttClient.on('error', (error) => {
        this.logger.error('❌ MQTT connection error:', error);
        this.isConnected = false;
        this.stats.errorsCount++;
        
        if (this.reconnectAttempts === 0) {
          reject(error);
        }
      });

      this.mqttClient.on('close', () => {
        this.isConnected = false;
        this.logger.warn('⚠️  MQTT connection closed');
      });

      this.mqttClient.on('reconnect', () => {
        this.reconnectAttempts++;
        this.logger.info(`🔄 MQTT reconnecting... (attempt ${this.reconnectAttempts})`);
        
        if (this.reconnectAttempts > this.config.performance.maxReconnectAttempts) {
          this.logger.error('❌ Max reconnection attempts reached');
          this.mqttClient.end();
        }
      });

      this.mqttClient.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message);
      });
    });
  }

  subscribeToTopics() {
    const topics = Object.values(this.config.topics);
    
    topics.forEach(topic => {
      this.mqttClient.subscribe(topic, { qos: 1 }, (error) => {
        if (error) {
          this.logger.error(`❌ Failed to subscribe to ${topic}:`, error);
        } else {
          this.logger.info(`📡 Subscribed to ${topic}`);
        }
      });
    });
  }

  handleMqttMessage(topic, message) {
    try {
      this.stats.messagesReceived++;
      this.stats.lastMessageTime = new Date();
      
      let data;
      try {
        data = JSON.parse(message.toString());
      } catch (parseError) {
        // JSON이 아닌 경우 문자열로 처리
        data = message.toString();
      }

      if (this.config.verbose) {
        this.logger.debug(`📨 Message received from ${topic}:`, data);
      }

      // 데이터 버퍼에 저장
      this.dataBuffer.addData(topic, data);

      // 핸들러에게 메시지 전달 (핸들러 매니저가 초기화된 경우에만)
      let handlerResult = null;
      if (this.handlerManager) {
        handlerResult = this.handlerManager.routeMessage(topic, data);
      }
      
      // 처리 결과를 WebSocket으로 브로드캐스트
      const broadcastData = {
        type: 'mqtt_message',
        topic,
        data,
        handler_result: handlerResult,
        timestamp: new Date().toISOString()
      };

      this.broadcastToWebSocket(broadcastData);

      // 특별한 토픽 처리
      this.handleSpecialTopics(topic, data, handlerResult);

    } catch (error) {
      this.logger.error(`❌ Error handling message from ${topic}:`, error);
      this.stats.errorsCount++;
    }
  }

  handleSpecialTopics(topic, data, handlerResult) {
    // ROS2 토픽 리스트 업데이트
    if (topic === this.config.topics.ros2_topic_list && handlerResult && handlerResult.result) {
      this.ros2TopicCache = handlerResult.result.topics || [];
      this.logger.info(`📋 ROS2 topic cache updated: ${this.ros2TopicCache.length} topics`);
    }

    // 에러 메시지 특별 처리
    if (topic.startsWith('errors/')) {
      this.handleErrorMessage(topic, data);
    }

    // 로봇 제어 명령 로깅
    if (topic.startsWith('robot/control/')) {
      this.logger.info(`🎮 Robot control command: ${topic}`, data);
    }
  }

  async startWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        // HTTP 서버 생성
        this.httpServer = http.createServer((req, res) => {
          this.handleHttpRequest(req, res);
        });

        // WebSocket 서버를 HTTP 서버에 연결
        this.wsServer = new WebSocket.Server({ 
          server: this.httpServer,
          perMessageDeflate: false
        });

        this.wsServer.on('connection', (ws, request) => {
          this.wsClients.add(ws);
          const clientIP = request.socket.remoteAddress;
          
          this.logger.info(`🔌 WebSocket client connected from ${clientIP} (total: ${this.wsClients.size})`);

          // 클라이언트 구독 관리
          ws.subscriptions = new Set(['*']); // 기본적으로 모든 토픽 구독

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message);
              this.handleWebSocketMessage(ws, data);
            } catch (error) {
              this.logger.error('❌ WebSocket message parsing error:', error);
            }
          });

          ws.on('close', () => {
            this.wsClients.delete(ws);
            this.logger.info(`🔌 WebSocket client disconnected (total: ${this.wsClients.size})`);
          });

          ws.on('error', (error) => {
            this.logger.error('❌ WebSocket client error:', error);
            this.wsClients.delete(ws);
          });

          // 초기 데이터 전송
          this.sendInitialDataToClient(ws);
        });

        // HTTP 서버 시작
        this.httpServer.listen(this.config.websocket.port, () => {
          this.logger.info(`🌐 WebSocket + HTTP server started on port ${this.config.websocket.port}`);
          resolve();
        });

        this.httpServer.on('error', (error) => {
          this.logger.error('❌ HTTP/WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  handleHttpRequest(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // URL 라우팅
    if (req.url === '/' || req.url === '/status') {
      this.handleStatusRequest(req, res);
    } else if (req.url === '/health') {
      this.handleHealthRequest(req, res);
    } else if (req.url === '/stats') {
      this.handleStatsRequest(req, res);
    } else if (req.url === '/favicon.ico') {
      this.handleFaviconRequest(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Not Found',
        message: 'This is a WebSocket server. Connect via ws:// protocol.',
        websocket_url: `ws://localhost:${this.config.websocket.port}`,
        available_endpoints: ['/', '/status', '/health', '/stats']
      }));
    }
  }

  handleStatusRequest(req, res) {
    const status = {
      service: 'Robot Web Dashboard MQTT Processor',
      version: '1.0.0',
      status: 'running',
      mqtt: {
        connected: this.isConnected,
        host: this.config.mqtt.host,
        port: this.config.mqtt.port
      },
      websocket: {
        port: this.config.websocket.port,
        clients: this.wsClients.size,
        url: `ws://localhost:${this.config.websocket.port}`
      },
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status, null, 2));
  }

  handleHealthRequest(req, res) {
    const health = {
      status: this.isConnected ? 'healthy' : 'unhealthy',
      checks: {
        mqtt_connection: this.isConnected,
        websocket_server: this.wsServer ? true : false,
        handler_manager: this.handlerManager ? true : false,
        uptime_seconds: process.uptime()
      },
      timestamp: new Date().toISOString()
    };

    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health, null, 2));
  }

  handleStatsRequest(req, res) {
    const stats = this.getCurrentStatus();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(stats, null, 2));
  }

  handleFaviconRequest(req, res) {
    // 간단한 favicon 응답 (빈 응답으로 처리)
    res.writeHead(204);
    res.end();
  }

  handleWebSocketMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        if (data.topics && Array.isArray(data.topics)) {
          ws.subscriptions = new Set(data.topics);
          this.logger.debug(`📡 Client subscribed to: ${data.topics.join(', ')}`);
        }
        break;

      case 'publish':
        if (data.topic && data.message) {
          this.publishMessage(data.topic, data.message);
        }
        break;

      case 'get_status':
        ws.send(JSON.stringify({
          type: 'status',
          data: this.getCurrentStatus(),
          timestamp: new Date().toISOString()
        }));
        break;

      case 'get_history':
        const history = this.dataBuffer.getData(data.topic || 'all', data.count || 10);
        ws.send(JSON.stringify({
          type: 'history',
          data: history,
          timestamp: new Date().toISOString()
        }));
        break;

      default:
        this.logger.warn(`⚠️  Unknown WebSocket message type: ${data.type}`);
    }
  }

  sendInitialDataToClient(ws) {
    // 시스템 상태 전송
    setTimeout(() => {
      ws.send(JSON.stringify({
        type: 'initial_data',
        topic: 'system_status',
        data: this.getCurrentStatus(),
        timestamp: new Date().toISOString()
      }));

      // 최근 센서 데이터
      const recentWeight = this.dataBuffer.getLatestData(this.config.topics.weight_sensor);
      if (recentWeight) {
        ws.send(JSON.stringify({
          type: 'initial_data',
          topic: 'weight_sensor',
          data: recentWeight,
          timestamp: new Date().toISOString()
        }));
      }

      // 핸들러 통계 (핸들러 매니저가 있는 경우에만)
      if (this.handlerManager) {
        const handlerStats = this.handlerManager.getAllStats();
        ws.send(JSON.stringify({
          type: 'initial_data',
          topic: 'handler_stats',
          data: handlerStats,
          timestamp: new Date().toISOString()
        }));
      }
    }, 1000);
  }

  broadcastToWebSocket(data) {
    const message = JSON.stringify(data);
    
    this.wsClients.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        // 구독 필터링 (선택사항)
        if (!ws.subscriptions || ws.subscriptions.has(data.topic) || ws.subscriptions.has('*')) {
          ws.send(message);
        }
      }
    });
  }

  publishMessage(topic, message, options = {}) {
    if (!this.isConnected) {
      this.logger.warn('⚠️  MQTT not connected. Cannot publish message.');
      return false;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    const publishOptions = {
      qos: options.qos || 0,
      retain: options.retain || false,
      ...options
    };
    
    this.mqttClient.publish(topic, payload, publishOptions, (error) => {
      if (error) {
        this.logger.error(`❌ Failed to publish to ${topic}:`, error);
      } else {
        this.logger.debug(`📤 Message published to ${topic}`);
        this.stats.messagesPublished++;
      }
    });

    return true;
  }

  startHeartbeat() {
    setInterval(() => {
      this.lastHeartbeat = new Date().toISOString();
      
      // 시스템 상태 발행
      const systemHealth = {
        status: 'healthy',
        mqtt_connected: this.isConnected,
        ws_clients: this.wsClients.size,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        handlers: this.handlerManager ? this.handlerManager.getPerformanceMetrics() : null,
        timestamp: this.lastHeartbeat
      };

      this.publishMessage(this.config.topics.system_health, systemHealth);

      this.logger.debug(`💓 Heartbeat sent - MQTT: ${this.isConnected}, WS Clients: ${this.wsClients.size}`);
      
      // 핸들러 상태 체크 (핸들러 매니저가 있는 경우에만)
      if (this.handlerManager) {
        const healthCheck = this.handlerManager.healthCheck();
        if (healthCheck.status !== 'healthy') {
          this.logger.warn(`⚠️  Handler health issues: ${healthCheck.issues.join(', ')}`);
        }
      }
    }, this.config.performance.heartbeatInterval);
  }

  setupTopicHandlers() {
    this.logger.info('🔧 Setting up topic handlers...');
    
    // ROS2 토픽 리스트 업데이트 시 캐시 갱신
    this.dataBuffer.on('data', (topic, data) => {
      if (topic === 'ros2_topic_list' && data.handler_result) {
        this.ros2TopicCache = data.data;
        this.logger.info(`📋 ROS2 topic cache updated: ${this.ros2TopicCache.length} topics`);
      }
      
      // 에러 메시지 특별 처리
      if (topic.includes('error')) {
        this.handleErrorMessage(topic, data);
      }
    });
  }

  handleErrorMessage(topic, data) {
    this.logger.error(`🚨 Error message received from ${topic}:`, data);
    
    // 에러 메시지를 WebSocket으로 즉시 전송
    this.broadcastToWebSocket({
      type: 'error',
      topic,
      data,
      severity: 'high',
      timestamp: new Date().toISOString()
    });
    
    // 비상정지가 필요한 심각한 에러인지 확인
    if (this.isEmergencyError(topic, data)) {
      this.logger.error('🚨 Emergency error detected - triggering safety response');
      if (this.handlerManager) {
        this.handlerManager.emergencyStop('auto_safety_system');
      }
    }
  }

  isEmergencyError(topic, data) {
    // 비상정지가 필요한 에러 패턴 확인
    const emergencyPatterns = [
      'emergency',
      'safety',
      'collision',
      'overload',
      'temperature',
      'power_failure'
    ];
    
    const topicLower = topic.toLowerCase();
    const dataStr = JSON.stringify(data).toLowerCase();
    
    return emergencyPatterns.some(pattern => 
      topicLower.includes(pattern) || dataStr.includes(pattern)
    );
  }

  // API 메서드들
  getCurrentStatus() {
    return {
      mqtt: {
        connected: this.isConnected,
        host: this.config.mqtt.host,
        port: this.config.mqtt.port,
        client_id: this.config.mqtt.clientId
      },
      websocket: {
        port: this.config.websocket.port,
        clients: this.wsClients.size
      },
      handlers: this.handlerManager ? this.handlerManager.getAllStats() : null,
      stats: this.stats,
      uptime: process.uptime(),
      last_heartbeat: this.lastHeartbeat,
      timestamp: new Date().toISOString()
    };
  }

  getHandlerStats(handlerName = null) {
    if (!this.handlerManager) return null;
    
    if (handlerName) {
      return this.handlerManager.getHandlerStats(handlerName);
    }
    return this.handlerManager.getAllStats();
  }

  setConcentrationTarget(target, source = 'api') {
    if (!this.handlerManager) return false;
    return this.handlerManager.setConcentrationTarget(target, source);
  }

  calibrateWeightSensor(offset = null) {
    if (!this.handlerManager) return false;
    return this.handlerManager.calibrateWeightSensor(offset);
  }

  triggerEmergencyStop(source = 'api') {
    if (!this.handlerManager) return false;
    return this.handlerManager.emergencyStop(source);
  }

  getDataHistory(topic, count = 10) {
    return this.dataBuffer.getData(topic, count);
  }

  async shutdown() {
    this.logger.info('🛑 Shutting down MQTT Processor...');
    
    try {
      // 종료 메시지 발행
      if (this.isConnected) {
        const shutdownMessage = {
          status: 'shutting_down',
          message: 'MQTT Processor is shutting down',
          final_stats: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            handlers: this.handlerManager ? this.handlerManager.getPerformanceMetrics() : null
          },
          timestamp: new Date().toISOString()
        };
        
        await this.publishMessage(this.config.topics.system_health, shutdownMessage);
      }

      // WebSocket 클라이언트들에게 종료 알림
      this.wsClients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'shutdown',
            message: 'MQTT Processor is shutting down',
            timestamp: new Date().toISOString()
          }));
        }
      });

      // 잠시 대기 후 연결 종료
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 연결 종료
      if (this.mqttClient) {
        this.mqttClient.end(true);
      }
      
      if (this.httpServer) {
        this.httpServer.close();
      }
      
      this.logger.info('✅ MQTT Processor shutdown complete');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

module.exports = MqttClient;