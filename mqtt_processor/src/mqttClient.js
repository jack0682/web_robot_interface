/**
 * Updated MQTT Client with proper topic mapping and configuration support
 * EMQX Cloud SSL/TLS Connection + Real Topic Structure
 */
const mqtt = require('mqtt');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class DataBuffer extends EventEmitter {
  constructor(maxSize = 2000) {
    super();
    this.maxSize = maxSize;
    this.data = new Map();
    this.topicStats = new Map();
  }

  add(topic, message, timestamp = new Date().toISOString()) {
    if (!this.data.has(topic)) {
      this.data.set(topic, []);
      this.topicStats.set(topic, { count: 0, lastUpdate: timestamp });
    }

    const topicData = this.data.get(topic);
    topicData.push({ message, timestamp });

    // 버퍼 크기 제한
    if (topicData.length > this.maxSize) {
      topicData.shift();
    }

    // 통계 업데이트
    const stats = this.topicStats.get(topic);
    stats.count++;
    stats.lastUpdate = timestamp;

    this.emit('data', topic, message, timestamp);
  }

  get(topic, count = 10) {
    const topicData = this.data.get(topic);
    if (!topicData) return [];
    return topicData.slice(-count);
  }

  getAllTopics() {
    return Array.from(this.data.keys());
  }

  getStats() {
    const stats = {};
    for (const [topic, data] of this.topicStats.entries()) {
      stats[topic] = {
        ...data,
        current_buffer_size: this.data.get(topic)?.length || 0
      };
    }
    return stats;
  }

  clear(topic = null) {
    if (topic) {
      this.data.delete(topic);
      this.topicStats.delete(topic);
    } else {
      this.data.clear();
      this.topicStats.clear();
    }
  }
}

class MqttClient {
  constructor(config) {
    this.config = this.loadConfiguration(config);
    this.client = null;
    this.wss = null;
    this.wsClients = new Set();
    this.isConnected = false;
    this.dataBuffer = new DataBuffer(this.config.data_processing.buffer_size);
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.logger = null;
    
    // Performance metrics
    this.startTime = Date.now();
    this.messageCount = 0;
    this.lastHealthCheck = Date.now();
  }

  /**
   * Load configuration from file or use defaults
   */
  loadConfiguration(config) {
    if (typeof config === 'string') {
      // Load from file path
      try {
        const configPath = path.resolve(config);
        const configData = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
      } catch (error) {
        console.error('Failed to load config file:', error);
        return this.getDefaultConfig();
      }
    } else if (typeof config === 'object' && config !== null) {
      // Use provided config object
      return { ...this.getDefaultConfig(), ...config };
    } else {
      // Use default config
      return this.getDefaultConfig();
    }
  }

  /**
   * Default configuration
   */
  getDefaultConfig() {
    return {
      mqtt: {
        connection: {
          host: 'p021f2cb.ala.asia-southeast1.emqxsl.com',
          port: 8883,
          protocol: 'mqtts',
          reconnectPeriod: 5000,
          connectTimeout: 30000,
          keepalive: 60,
          clean: true,
          rejectUnauthorized: true
        },
        topics: {
          weight_sensor: { name: 'test', qos: 1, retain: false },  // 무게 센서 데이터
          ros2_topic_list: { name: 'ros2_topic_list', qos: 1, retain: true },
          target_concentration: { name: 'web/target_concentration', qos: 1, retain: true },
          robot_control: { name: 'robot/control/+', qos: 2, retain: false },
          system_health: { name: 'system/health', qos: 0, retain: true }
        }
      },
      websocket: {
        port: 8080,
        ping_interval: 30000,
        pong_timeout: 5000,
        max_clients: 100
      },
      data_processing: {
        buffer_size: 2000,
        retention_hours: 48
      }
    };
  }

  /**
   * Set logger instance
   */
  setLogger(logger) {
    this.logger = logger;
  }

  /**
   * Log message with fallback to console
   */
  log(level, message, meta = {}) {
    if (this.logger) {
      this.logger[level](message, meta);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`, meta);
    }
  }

  /**
   * Initialize MQTT connection and WebSocket server
   */
  async initialize() {
    try {
      this.log('info', '🔌 Initializing MQTT Client...');
      
      // Setup WebSocket server first
      await this.setupWebSocketServer();
      
      // Connect to MQTT broker
      await this.connectMqtt();
      
      // Setup data processing
      this.setupDataProcessing();
      
      // Setup health monitoring
      this.setupHealthMonitoring();
      
      this.log('info', '✅ MQTT Client initialized successfully');
      return true;
      
    } catch (error) {
      this.log('error', '❌ Failed to initialize MQTT Client:', { error: error.message });
      throw error;
    }
  }

  /**
   * Connect to MQTT broker with SSL/TLS
   */
  async connectMqtt() {
    return new Promise((resolve, reject) => {
      const { connection } = this.config.mqtt;
      
      // MQTT connection options
      const options = {
        host: connection.host,
        port: connection.port,
        protocol: connection.protocol,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        connectTimeout: connection.connectTimeout,
        reconnectPeriod: connection.reconnectPeriod,
        keepalive: connection.keepalive,
        clean: connection.clean,
        rejectUnauthorized: connection.rejectUnauthorized
      };

      this.log('info', `🌐 Connecting to MQTT broker: ${connection.protocol}://${connection.host}:${connection.port}`);
      
      this.client = mqtt.connect(`${connection.protocol}://${connection.host}:${connection.port}`, options);

      this.client.on('connect', () => {
        this.log('info', '🟢 MQTT connected successfully');
        this.isConnected = true;
        this.connectionAttempts = 0;
        this.subscribeToTopics();
        resolve();
      });

      this.client.on('message', (topic, message) => {
        this.handleMqttMessage(topic, message);
      });

      this.client.on('error', (error) => {
        this.log('error', '❌ MQTT connection error:', { error: error.message });
        this.isConnected = false;
        reject(error);
      });

      this.client.on('close', () => {
        this.log('warn', '⚠️  MQTT connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnect', () => {
        this.connectionAttempts++;
        this.log('info', `🔄 MQTT reconnecting... (attempt ${this.connectionAttempts})`);
      });

      this.client.on('offline', () => {
        this.log('warn', '📴 MQTT client offline');
        this.isConnected = false;
      });
    });
  }

  /**
   * Subscribe to configured topics
   */
  subscribeToTopics() {
    const topics = this.config.mqtt.topics;
    
    for (const [key, topicConfig] of Object.entries(topics)) {
      this.client.subscribe(topicConfig.name, { qos: topicConfig.qos }, (err) => {
        if (err) {
          this.log('error', `❌ Failed to subscribe to ${topicConfig.name}:`, { error: err.message });
        } else {
          this.log('info', `📡 Subscribed to topic: ${topicConfig.name} (${key})`);
        }
      });
    }
  }

  /**
   * Handle incoming MQTT messages
   */
  handleMqttMessage(topic, message) {
    try {
      this.messageCount++;
      const timestamp = new Date().toISOString();
      
      // Parse message based on topic
      let parsedMessage;
      
      if (topic === 'test') {
        // 🎯 무게 센서 데이터 - 실제 무게 센서
        parsedMessage = this.parseWeightSensorData(message);
        this.log('debug', '⚖️  Weight sensor data received', { value: parsedMessage.weight });
        
      } else if (topic === 'ros2_topic_list') {
        // 🎯 ROS2 topic list - 모든 토픽이 묶여서 전송
        parsedMessage = this.parseROS2TopicList(message);
        this.log('debug', '📋 ROS2 topic list received', { topic_count: Object.keys(parsedMessage.topic_data || {}).length });
        
      } else if (topic === 'scale/raw') {
        // 기존 무게센서 토픽 (호환성 유지)
        parsedMessage = this.parseWeightSensorData(message);
        this.log('debug', '⚖️  Legacy weight sensor data received', { value: parsedMessage.weight });
        
      } else if (topic === 'web/target_concentration') {
        // Target concentration - expect JSON
        parsedMessage = this.parseConcentrationData(message);
        this.log('debug', '🎯 Target concentration received', { target: parsedMessage.target });
        
      } else if (topic.startsWith('robot/control/')) {
        // Robot control commands
        parsedMessage = this.parseRobotControlData(message);
        this.log('info', '🤖 Robot control command received', { command: topic });
        
      } else if (topic === 'system/health') {
        // System health data
        parsedMessage = this.parseSystemHealthData(message);
        this.log('debug', '💓 System health update received');
        
      } else {
        // Unknown topic - try to parse as JSON, fallback to string
        try {
          parsedMessage = JSON.parse(message.toString());
        } catch {
          parsedMessage = { raw: message.toString(), type: 'unknown' };
        }
        this.log('debug', `📨 Unknown topic message: ${topic}`);
      }

      // Add to data buffer
      this.dataBuffer.add(topic, parsedMessage, timestamp);
      
      // Broadcast to WebSocket clients
      this.broadcastToWebSocket({
        type: 'mqtt_message',
        topic: topic,
        data: parsedMessage,
        timestamp: timestamp
      });
      
    } catch (error) {
      this.log('error', '❌ Error handling MQTT message:', { 
        topic: topic, 
        error: error.message,
        message_preview: message.toString().substring(0, 100)
      });
    }
  }

  /**
   * Parse ROS2 topic list data
   */
  parseROS2TopicList(message) {
    try {
      const data = JSON.parse(message.toString());
      return {
        type: 'ros2_topics',
        timestamp: data.timestamp || new Date().toISOString(),
        topic_data: data.topic_data || data,
        topic_count: Object.keys(data.topic_data || data).length
      };
    } catch {
      return {
        type: 'ros2_topics',
        timestamp: new Date().toISOString(),
        topic_data: {},
        error: 'Failed to parse JSON',
        raw: message.toString()
      };
    }
  }

  /**
   * Parse weight sensor data
   */
  parseWeightSensorData(message) {
    try {
      const messageStr = message.toString().trim();
      
      // Try parsing as JSON first
      try {
        const data = JSON.parse(messageStr);
        return {
          type: 'weight_sensor',
          weight: parseFloat(data.weight || data.value || data),
          unit: data.unit || 'kg',
          timestamp: data.timestamp || new Date().toISOString(),
          raw: data
        };
      } catch {
        // Try parsing as plain number
        const weight = parseFloat(messageStr);
        if (!isNaN(weight)) {
          return {
            type: 'weight_sensor',
            weight: weight,
            unit: 'kg',
            timestamp: new Date().toISOString()
          };
        } else {
          throw new Error('Not a valid number');
        }
      }
    } catch {
      return {
        type: 'weight_sensor',
        weight: 0,
        unit: 'kg',
        timestamp: new Date().toISOString(),
        error: 'Failed to parse weight data',
        raw: message.toString()
      };
    }
  }

  /**
   * Parse concentration data
   */
  parseConcentrationData(message) {
    try {
      const data = JSON.parse(message.toString());
      return {
        type: 'concentration',
        target: parseFloat(data.target || data.value || data),
        unit: data.unit || '%',
        source: data.source || 'unknown',
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch {
      return {
        type: 'concentration',
        target: 0,
        unit: '%',
        source: 'unknown',
        timestamp: new Date().toISOString(),
        error: 'Failed to parse concentration data',
        raw: message.toString()
      };
    }
  }

  /**
   * Parse robot control data
   */
  parseRobotControlData(message) {
    try {
      const data = JSON.parse(message.toString());
      return {
        type: 'robot_control',
        command: data.command || 'unknown',
        parameters: data.parameters || data,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch {
      return {
        type: 'robot_control',
        command: 'unknown',
        parameters: {},
        timestamp: new Date().toISOString(),
        error: 'Failed to parse robot control data',
        raw: message.toString()
      };
    }
  }

  /**
   * Parse system health data
   */
  parseSystemHealthData(message) {
    try {
      const data = JSON.parse(message.toString());
      return {
        type: 'system_health',
        status: data.status || 'unknown',
        metrics: data.metrics || {},
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch {
      return {
        type: 'system_health',
        status: 'unknown',
        metrics: {},
        timestamp: new Date().toISOString(),
        error: 'Failed to parse health data',
        raw: message.toString()
      };
    }
  }

  /**
   * Setup WebSocket server for real-time communication
   */
  async setupWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        const wsConfig = this.config.websocket;
        this.wss = new WebSocket.Server({ 
          port: wsConfig.port,
          perMessageDeflate: wsConfig.compression || false
        });

        this.wss.on('connection', (ws) => {
          this.wsClients.add(ws);
          this.log('info', `🔗 WebSocket client connected (${this.wsClients.size} total)`);

          // Send initial data
          ws.send(JSON.stringify({
            type: 'connection_established',
            timestamp: new Date().toISOString(),
            available_topics: Object.keys(this.config.mqtt.topics),
            server_info: {
              uptime: Date.now() - this.startTime,
              message_count: this.messageCount,
              buffer_stats: this.dataBuffer.getStats()
            }
          }));

          ws.on('message', (message) => {
            try {
              const data = JSON.parse(message.toString());
              this.handleWebSocketMessage(ws, data);
            } catch (error) {
              this.log('error', '❌ WebSocket message parse error:', { error: error.message });
            }
          });

          ws.on('close', () => {
            this.wsClients.delete(ws);
            this.log('info', `🔌 WebSocket client disconnected (${this.wsClients.size} remaining)`);
          });

          ws.on('error', (error) => {
            this.log('error', '❌ WebSocket client error:', { error: error.message });
            this.wsClients.delete(ws);
          });
        });

        this.wss.on('listening', () => {
          this.log('info', `🌐 WebSocket server listening on port ${wsConfig.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          this.log('error', '❌ WebSocket server error:', { error: error.message });
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle WebSocket messages from clients
   */
  handleWebSocketMessage(ws, data) {
    try {
      switch (data.type) {
        case 'connection':
          // 클라이언트 연결 확인 메시지
          ws.send(JSON.stringify({
            type: 'connection_acknowledged',
            status: 'connected',
            server_time: new Date().toISOString(),
            available_topics: Object.keys(this.config.mqtt?.topics || {})
          }));
          this.log('debug', 'Connection acknowledged for client');
          break;
          
        case 'get_status':
          ws.send(JSON.stringify({
            type: 'status',
            data: {
              mqtt_connected: this.isConnected,
              uptime: Date.now() - this.startTime,
              message_count: this.messageCount,
              websocket_clients: this.wsClients.size,
              buffer_stats: this.dataBuffer.getStats()
            },
            timestamp: new Date().toISOString()
          }));
          break;

        case 'get_history':
          const history = this.dataBuffer.get(data.topic, data.count || 10);
          ws.send(JSON.stringify({
            type: 'history',
            topic: data.topic,
            data: history,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'publish':
          if (this.isConnected && data.topic && data.message) {
            const options = { qos: data.options?.qos || 0, retain: data.options?.retain || false };
            this.client.publish(data.topic, JSON.stringify(data.message), options);
            this.log('info', `📤 Published message to ${data.topic}`);
            
            // 발행 확인 응답
            ws.send(JSON.stringify({
              type: 'publish_ack',
              topic: data.topic,
              success: true,
              timestamp: new Date().toISOString()
            }));
          } else {
            ws.send(JSON.stringify({
              type: 'publish_ack',
              topic: data.topic,
              success: false,
              error: 'MQTT not connected or invalid data',
              timestamp: new Date().toISOString()
            }));
          }
          break;

        case 'subscribe':
          // 클라이언트가 특정 토픽 구독 요청
          ws.send(JSON.stringify({
            type: 'subscribe_ack',
            topics: Object.keys(this.config.mqtt?.topics || {}),
            timestamp: new Date().toISOString()
          }));
          break;

        case 'ping':
          // 연결 상태 확인
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        case 'broadcast':
          this.broadcastToWebSocket(data.data);
          break;

        default:
          this.log('warn', `⚠️  Unknown WebSocket message type: ${data.type}`, { data });
          // 알 수 없는 메시지에 대한 응답
          ws.send(JSON.stringify({
            type: 'error',
            message: `Unknown message type: ${data.type}`,
            timestamp: new Date().toISOString()
          }));
      }
    } catch (error) {
      this.log('error', '❌ Error handling WebSocket message:', { error: error.message });
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Message processing failed',
        error: error.message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * Broadcast data to all connected WebSocket clients
   */
  broadcastToWebSocket(data) {
    if (this.wsClients.size === 0) return;

    const message = JSON.stringify(data);
    const deadClients = new Set();

    for (const client of this.wsClients) {
      try {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        } else {
          deadClients.add(client);
        }
      } catch (error) {
        this.log('error', '❌ WebSocket broadcast error:', { error: error.message });
        deadClients.add(client);
      }
    }

    // Clean up dead clients
    for (const client of deadClients) {
      this.wsClients.delete(client);
    }
  }

  /**
   * Setup data processing and cleanup
   */
  setupDataProcessing() {
    // Data retention cleanup
    const retentionHours = this.config.data_processing.retention_hours;
    setInterval(() => {
      const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000);
      
      for (const [topic, messages] of this.dataBuffer.data.entries()) {
        const filteredMessages = messages.filter(msg => 
          new Date(msg.timestamp).getTime() > cutoffTime
        );
        this.dataBuffer.data.set(topic, filteredMessages);
      }
      
      this.log('debug', '🧹 Data retention cleanup completed');
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Setup health monitoring
   */
  setupHealthMonitoring() {
    const healthInterval = this.config.performance?.health_check_interval || 60000;
    
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      
      const healthData = {
        timestamp: new Date().toISOString(),
        service: 'mqtt_processor',
        status: this.isConnected ? 'healthy' : 'unhealthy',
        uptime: Date.now() - this.startTime,
        memory_mb: memUsedMB,
        message_count: this.messageCount,
        websocket_clients: this.wsClients.size,
        buffer_size: this.dataBuffer.getAllTopics().length
      };

      // Log health status
      if (this.isConnected) {
        this.log('debug', '💓 Health check: System healthy', healthData);
      } else {
        this.log('warn', '⚠️  Health check: System unhealthy', healthData);
      }

      // Publish health status to MQTT
      if (this.isConnected) {
        this.publishMessage('system/health', healthData);
      }

      this.lastHealthCheck = Date.now();
    }, healthInterval);
  }

  /**
   * Publish message to MQTT broker
   */
  async publishMessage(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      const publishOptions = {
        qos: options.qos || 0,
        retain: options.retain || false
      };

      this.client.publish(topic, messageStr, publishOptions, (error) => {
        if (error) {
          this.log('error', `❌ Failed to publish to ${topic}:`, { error: error.message });
          reject(error);
        } else {
          this.log('debug', `📤 Published to ${topic}`);
          resolve();
        }
      });
    });
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      mqtt_connected: this.isConnected,
      websocket_server: this.wss ? 'running' : 'stopped',
      websocket_clients: this.wsClients.size,
      uptime: Date.now() - this.startTime,
      message_count: this.messageCount,
      buffer_stats: this.dataBuffer.getStats(),
      last_health_check: this.lastHealthCheck,
      configuration: {
        mqtt_host: this.config.mqtt.connection.host,
        websocket_port: this.config.websocket.port,
        subscribed_topics: Object.keys(this.config.mqtt.topics)
      }
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.log('info', '🛑 Shutting down MQTT Client...');
    
    try {
      // Close WebSocket server
      if (this.wss) {
        this.wss.close();
        this.log('info', '🔌 WebSocket server closed');
      }

      // Disconnect MQTT client
      if (this.client && this.isConnected) {
        await this.publishMessage('system/health', {
          status: 'shutting_down',
          timestamp: new Date().toISOString(),
          final_stats: this.getStatus()
        });
        
        this.client.end(true);
        this.log('info', '📡 MQTT client disconnected');
      }

      this.log('info', '✅ MQTT Client shutdown complete');
    } catch (error) {
      this.log('error', '❌ Error during shutdown:', { error: error.message });
    }
  }
}

module.exports = MqttClient;