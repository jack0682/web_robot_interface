/**
 * 🎯 Scale Sensor + Robot Event Integration MQTT Client
 * 저울 센서 7개 필터 + 로봇 시나리오 이벤트 + 웹 대시보드 명령 통합 처리
 * Updated: 2025-08-04 by Lyra for Jack's Robot Dashboard
 */
const mqtt = require('mqtt');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class MqttClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = this.loadConfiguration(config);
    this.client = null;
    this.wss = null;
    this.wsClients = new Set();
    this.isConnected = false;
    this.dataBuffer = new Map();
    this.connectionAttempts = 0;
    this.logger = null;
    
    // Performance metrics
    this.startTime = Date.now();
    this.messageCount = 0;
    this.lastHealthCheck = Date.now();
    
    // 🎯 저울 센서 데이터 추적 (7개 필터)
    this.currentWeightData = {
      raw: 0,
      moving_average: 0,
      exponential_average: 0,
      kalman_simple: 0,
      kalman_pv: 0,
      ekf: 0,
      ukf: 0,
      best_filter: 'raw',
      last_update: null
    };
    
    // 🎯 로봇 상태 추적
    this.robotState = {
      current_event: null,
      last_event_time: null,
      scenario_step: 0,
      is_pouring: false,
      sugar_dispensed: false,
      cup_placed: false
    };
    
    // 🎯 시스템 상태
    this.systemState = {
      is_running: false,
      target_concentration: 50,
      current_weight: 0,
      system_mode: 'idle'
    };
  }

  getDefaultConfig() {
    return {
      mqtt: {
        connection: {
          host: 'p021f2cb.ala.asia-southeast1.emqxsl.com',
          port: 8883,
          protocol: 'mqtts',
          username: process.env.MQTT_USERNAME || 'Rokey',
          password: process.env.MQTT_PASSWORD || '1234567',
          reconnectPeriod: 5000,
          connectTimeout: 30000,
          keepalive: 60,
          clean: true,
          rejectUnauthorized: false
        },
        subscriptions: [
          { topic: 'scale/raw', qos: 0 },
          { topic: 'scale/moving_average', qos: 0 },
          { topic: 'scale/exponential_average', qos: 0 },
          { topic: 'scale/kalman_simple', qos: 0 },
          { topic: 'scale/kalman_pv', qos: 0 },
          { topic: 'scale/ekf', qos: 0 },
          { topic: 'scale/ukf', qos: 0 },
          { topic: 'test', qos: 1 },
          { topic: 'system/health', qos: 1 },
          { topic: 'robot/status', qos: 1 }
        ]
      },
      websocket: {
        port: 8080,
        ping_interval: 30000,
        max_clients: 100
      },
      data_processing: {
        buffer_size: 1000,
        retention_minutes: 60
      }
    };
  }

  loadConfiguration(config) {
    let mergedConfig;
    
    if (typeof config === 'string') {
      try {
        const configPath = path.resolve(config);
        const configData = fs.readFileSync(configPath, 'utf8');
        mergedConfig = { ...this.getDefaultConfig(), ...JSON.parse(configData) };
      } catch (error) {
        console.error('Failed to load config file:', error);
        mergedConfig = this.getDefaultConfig();
      }
    } else {
      mergedConfig = { ...this.getDefaultConfig(), ...config };
    }
    
    // 설정 파일의 topics 객체를 subscriptions 배열로 변환
    if (mergedConfig.mqtt.topics && !mergedConfig.mqtt.subscriptions) {
      mergedConfig.mqtt.subscriptions = Object.values(mergedConfig.mqtt.topics).map(topic => ({
        topic: topic.name,
        qos: topic.qos || 0
      }));
      
      // 디버그: 변환된 구독 정보 출력
      console.log('🔄 Converted topics to subscriptions:', mergedConfig.mqtt.subscriptions);
    }
    
    return mergedConfig;
  }

  setLogger(logger) {
    this.logger = logger;
  }

  log(level, message, meta = {}) {
    if (this.logger) {
      this.logger[level](message, meta);
    } else {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta);
    }
  }

  async initialize() {
    try {
      this.log('info', '🔌 Initializing Scale + Robot MQTT Client...');
      
      await this.setupWebSocketServer();
      await this.connectMqtt();
      this.setupDataProcessing();
      this.setupHealthMonitoring();
      
      this.log('info', '✅ MQTT Client initialized successfully');
      return true;
      
    } catch (error) {
      this.log('error', '❌ Failed to initialize MQTT Client:', { error: error.message });
      throw error;
    }
  }

  async connectMqtt() {
    return new Promise((resolve, reject) => {
      const { connection } = this.config.mqtt;
      
      const options = {
        host: connection.host,
        port: connection.port,
        protocol: connection.protocol,
        username: connection.username,
        password: connection.password,
        connectTimeout: connection.connectTimeout,
        reconnectPeriod: connection.reconnectPeriod,
        keepalive: connection.keepalive,
        clean: connection.clean,
        rejectUnauthorized: connection.rejectUnauthorized
      };

      this.log('info', `🌐 Connecting to MQTT: ${connection.protocol}://${connection.host}:${connection.port}`);
      
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
    });
  }

  subscribeToTopics() {
    const subscriptions = this.config.mqtt.subscriptions;
    
    for (const sub of subscriptions) {
      this.client.subscribe(sub.topic, { qos: sub.qos }, (err) => {
        if (err) {
          this.log('error', `❌ Failed to subscribe to ${sub.topic}:`, { error: err.message });
        } else {
          this.log('info', `📡 Subscribed to: ${sub.topic} (QoS ${sub.qos})`);
        }
      });
    }
  }

  handleMqttMessage(topic, message) {
    try {
      this.messageCount++;
      const timestamp = new Date().toISOString();
      let parsedMessage;
      
      if (topic.startsWith('scale/')) {
        parsedMessage = this.parseScaleSensorData(topic, message);
        this.updateWeightData(topic, parsedMessage);
        this.log('debug', `⚖️  Scale ${topic.replace('scale/', '')}: ${parsedMessage.weight}g`);
        
      } else if (topic === 'test') {
        parsedMessage = this.parseRobotEventData(message);
        this.updateRobotState(parsedMessage);
        this.log('info', `🤖 Robot event: ${parsedMessage.event_description} (${parsedMessage.event_code})`);
        
      } else if (topic === 'system/health' || topic === 'robot/status') {
        parsedMessage = this.parseSystemStatusData(topic, message);
        this.log('debug', `💓 System status: ${topic}`);
        
      } else {
        try {
          parsedMessage = JSON.parse(message.toString());
        } catch {
          parsedMessage = { raw: message.toString(), type: 'unknown' };
        }
        this.log('debug', `📨 Unknown topic: ${topic}`);
      }

      this.addToBuffer(topic, parsedMessage, timestamp);
      
      this.broadcastToWebSocket({
        type: 'mqtt_message',
        topic: topic,
        data: parsedMessage,
        timestamp: timestamp,
        system_snapshot: this.getSystemSnapshot()
      });
      
    } catch (error) {
      this.log('error', '❌ Error handling MQTT message:', { 
        topic: topic, 
        error: error.message,
        message_preview: message.toString().substring(0, 100)
      });
    }
  }

  parseScaleSensorData(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      const filterType = topic.replace('scale/', '');
      
      return {
        type: 'scale_sensor',
        filter_type: filterType,
        weight: parseFloat(data.weight || data.value || data),
        unit: data.unit || 'g',
        timestamp: data.timestamp || new Date().toISOString(),
        device_id: data.device_id || 'ros2_scale_pub',
        sensor_type: data.sensor_type || filterType
      };
    } catch {
      const weight = parseFloat(message.toString().trim());
      if (!isNaN(weight)) {
        return {
          type: 'scale_sensor',
          filter_type: topic.replace('scale/', ''),
          weight: weight,
          unit: 'g',
          timestamp: new Date().toISOString(),
          device_id: 'scale_sensor'
        };
      }
      throw new Error('Invalid scale data format');
    }
  }

  parseRobotEventData(message) {
    try {
      const data = JSON.parse(message.toString());
      
      const eventMapping = {
        '1': {
          name: 'sugar_dispensed',
          description: 'Sugar dispensed into cup',
          step: 1
        },
        '2': {
          name: 'cup_placed',
          description: 'Cup placed on scale',
          step: 2
        }
      };
      
      const eventInfo = eventMapping[data.event] || {
        name: `unknown_event_${data.event}`,
        description: `Unknown robot event: ${data.event}`,
        step: 0
      };
      
      return {
        type: 'robot_event',
        event_code: data.event,
        event_name: eventInfo.name,
        event_description: eventInfo.description,
        scenario_step: eventInfo.step,
        timestamp: data.timestamp || new Date().toISOString(),
        device_id: data.device_id || 'robot_dsr01'
      };
    } catch {
      return {
        type: 'robot_event',
        event_code: 'unknown',
        event_name: 'parse_error',
        event_description: 'Failed to parse robot event',
        scenario_step: 0,
        timestamp: new Date().toISOString(),
        error: 'Failed to parse robot event',
        raw: message.toString()
      };
    }
  }

  parseSystemStatusData(topic, message) {
    try {
      const data = JSON.parse(message.toString());
      return {
        type: 'system_status',
        status_type: topic.replace('system/', '').replace('robot/', ''),
        status: data.status || 'unknown',
        data: data,
        timestamp: data.timestamp || new Date().toISOString()
      };
    } catch {
      return {
        type: 'system_status',
        status_type: topic.replace('system/', '').replace('robot/', ''),
        status: 'unknown',
        data: { raw: message.toString() },
        timestamp: new Date().toISOString()
      };
    }
  }

  updateWeightData(topic, data) {
    const filterType = topic.replace('scale/', '');
    if (this.currentWeightData.hasOwnProperty(filterType)) {
      this.currentWeightData[filterType] = data.weight;
      this.currentWeightData.last_update = data.timestamp;
      
      if (filterType === 'raw') {
        this.systemState.current_weight = data.weight;
      }
    }
  }

  updateRobotState(data) {
    this.robotState.current_event = data.event_name;
    this.robotState.last_event_time = data.timestamp;
    this.robotState.scenario_step = data.scenario_step;
    
    if (data.event_name === 'sugar_dispensed') {
      this.robotState.sugar_dispensed = true;
    } else if (data.event_name === 'cup_placed') {
      this.robotState.cup_placed = true;
    }
    
    if (this.robotState.sugar_dispensed && this.robotState.cup_placed) {
      this.systemState.system_mode = 'ready_for_pouring';
    }
  }

  async startSystem() {
    const topic = 'web/commands/start';
    const payload = {
      command: 'start',
      value: 1,
      timestamp: new Date().toISOString(),
      source: 'web_dashboard'
    };
    
    return await this.publishMessage(topic, payload, { qos: 1, retain: false });
  }
  
  async setConcentration(concentration) {
    const value = Math.max(0, Math.min(100, parseFloat(concentration) || 50));
    this.systemState.target_concentration = value;
    
    const topic = 'web/commands/concentration';
    const payload = {
      command: 'set_concentration',
      value: value,
      timestamp: new Date().toISOString(),
      source: 'web_dashboard'
    };
    
    return await this.publishMessage(topic, payload, { qos: 1, retain: true });
  }
  
  async emergencyStop() {
    this.systemState.is_running = false;
    this.systemState.system_mode = 'emergency_stop';
    
    const topic = 'web/commands/emergency_stop';
    const payload = {
      command: 'emergency_stop',
      value: 999,
      timestamp: new Date().toISOString(),
      source: 'web_dashboard'
    };
    
    return await this.publishMessage(topic, payload, { qos: 2, retain: false });
  }

  getSystemSnapshot() {
    return {
      weight_data: { ...this.currentWeightData },
      robot_state: { ...this.robotState },
      system_state: { ...this.systemState },
      timestamp: new Date().toISOString(),
      connection_status: {
        mqtt_connected: this.isConnected,
        websocket_clients: this.wsClients.size,
        uptime: Date.now() - this.startTime
      }
    };
  }

  addToBuffer(topic, data, timestamp) {
    if (!this.dataBuffer.has(topic)) {
      this.dataBuffer.set(topic, []);
    }
    
    const buffer = this.dataBuffer.get(topic);
    buffer.push({ data, timestamp });
    
    const maxSize = this.config.data_processing.buffer_size;
    if (buffer.length > maxSize) {
      buffer.shift();
    }
  }

  async setupWebSocketServer() {
    return new Promise((resolve, reject) => {
      try {
        const wsConfig = this.config.websocket;
        this.wss = new WebSocket.Server({ port: wsConfig.port });

        this.wss.on('connection', (ws) => {
          this.wsClients.add(ws);
          this.log('info', `🔗 WebSocket client connected (${this.wsClients.size} total)`);

          ws.send(JSON.stringify({
            type: 'connection_established',
            timestamp: new Date().toISOString(),
            system_snapshot: this.getSystemSnapshot()
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

  handleWebSocketMessage(ws, data) {
    try {
      switch (data.type) {
        case 'get_system_status':
          ws.send(JSON.stringify({
            type: 'system_status',
            data: this.getSystemSnapshot(),
            timestamp: new Date().toISOString()
          }));
          break;

        case 'get_weight_history':
          const weightHistory = {};
          for (const filterType of Object.keys(this.currentWeightData)) {
            if (filterType !== 'best_filter' && filterType !== 'last_update') {
              const topic = `scale/${filterType}`;
              const buffer = this.dataBuffer.get(topic) || [];
              weightHistory[filterType] = buffer.slice(-50);
            }
          }
          ws.send(JSON.stringify({
            type: 'weight_history',
            data: weightHistory,
            timestamp: new Date().toISOString()
          }));
          break;

        case 'start_system':
          this.startSystem().then(success => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'start_system',
              success: success,
              timestamp: new Date().toISOString()
            }));
          }).catch(error => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'start_system',
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }));
          });
          break;

        case 'set_concentration':
          const concentration = data.value || 50;
          this.setConcentration(concentration).then(success => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'set_concentration',
              value: concentration,
              success: success,
              timestamp: new Date().toISOString()
            }));
          }).catch(error => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'set_concentration',
              value: concentration,
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }));
          });
          break;

        case 'emergency_stop':
          this.emergencyStop().then(success => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'emergency_stop',
              success: success,
              timestamp: new Date().toISOString()
            }));
          }).catch(error => {
            ws.send(JSON.stringify({
              type: 'command_response',
              command: 'emergency_stop',
              success: false,
              error: error.message,
              timestamp: new Date().toISOString()
            }));
          });
          break;

        case 'ping':
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: new Date().toISOString()
          }));
          break;

        default:
          this.log('warn', `⚠️  Unknown WebSocket message type: ${data.type}`);
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

    for (const client of deadClients) {
      this.wsClients.delete(client);
    }
  }

  async publishMessage(topic, message, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        this.log('error', '❌ Cannot publish: MQTT not connected');
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
          this.log('info', `📤 Published to ${topic}: ${JSON.stringify(message)}`);
          resolve(true);
        }
      });
    });
  }

  setupDataProcessing() {
    const retentionMinutes = this.config.data_processing.retention_minutes;
    setInterval(() => {
      const cutoffTime = Date.now() - (retentionMinutes * 60 * 1000);
      
      for (const [topic, messages] of this.dataBuffer.entries()) {
        const filteredMessages = messages.filter(msg => 
          new Date(msg.timestamp).getTime() > cutoffTime
        );
        this.dataBuffer.set(topic, filteredMessages);
      }
      
      this.log('debug', '🧹 Data retention cleanup completed');
    }, 60 * 1000);
  }

  setupHealthMonitoring() {
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
        current_weight: this.systemState.current_weight,
        robot_event: this.robotState.current_event,
        system_mode: this.systemState.system_mode
      };

      if (this.isConnected) {
        this.log('debug', '💓 System healthy', { 
          weight: this.systemState.current_weight,
          robot_event: this.robotState.current_event,
          clients: this.wsClients.size
        });
      } else {
        this.log('warn', '⚠️  System unhealthy - MQTT disconnected');
      }

      if (this.isConnected) {
        this.publishMessage('system/health', healthData, { qos: 0, retain: true })
          .catch(error => this.log('error', 'Failed to publish health data:', error));
      }

      this.lastHealthCheck = Date.now();
    }, 60000);
  }

  getStatus() {
    // 안전하게 구독된 토픽 목록 생성
    let subscribedTopics = [];
    if (this.config.mqtt.subscriptions) {
      subscribedTopics = this.config.mqtt.subscriptions.map(s => s.topic);
    } else if (this.config.mqtt.topics) {
      // topics 객체에서 토픽 이름들 추출
      subscribedTopics = Object.values(this.config.mqtt.topics).map(t => t.name);
    }
    
    return {
      mqtt_connected: this.isConnected,
      websocket_server: this.wss ? 'running' : 'stopped',
      websocket_clients: this.wsClients.size,
      uptime: Date.now() - this.startTime,
      message_count: this.messageCount,
      current_weights: this.currentWeightData,
      robot_state: this.robotState,
      system_state: this.systemState,
      last_health_check: this.lastHealthCheck,
      configuration: {
        mqtt_host: this.config.mqtt.connection.host,
        websocket_port: this.config.websocket.port,
        subscribed_topics: subscribedTopics
      }
    };
  }

  async shutdown() {
    this.log('info', '🛑 Shutting down MQTT Client...');
    
    try {
      if (this.wss) {
        this.wss.close();
        this.log('info', '🔌 WebSocket server closed');
      }

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
