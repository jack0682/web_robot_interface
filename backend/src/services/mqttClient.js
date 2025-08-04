const mqtt = require('mqtt');
const EventEmitter = require('events');
const DataProcessor = require('./dataProcessor');
const dataProcessor = new DataProcessor();

class MqttClient extends EventEmitter {
  constructor(options = {},broadcast = null) {
    super();
    this.client = null;
    this.isConnected = false;
    this.broadcast = broadcast;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    
    this.options = {
      host: options.host || 'localhost',
      port: options.port || 1883,
      username: options.username || '',
      password: options.password || '',
      clientId: options.clientId || `robot_dashboard_${Date.now()}`,
      ...options
    };
    
    this.subscribedTopics = new Set();
  }

  detectSensorType(topic, message) {
    if (topic.includes('weight') || topic === 'test' || topic === 'topic') return 'weight';
    if (topic.includes('temperature')) return 'temperature';
    if (topic.includes('concentration')) return 'concentration';
    return 'generic';
  }


  connect() {
    const connectUrl = `mqtt://${this.options.host}:${this.options.port}`;
    
    this.client = mqtt.connect(connectUrl, {
      clientId: this.options.clientId,
      username: this.options.username,
      password: this.options.password,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      console.log('MQTT Client connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
      
      // 기존 구독 토픽들 재구독
      this.resubscribeToTopics();
    });

    this.client.on('message', (topic, payload) => {
      try {
        const rawMessage = JSON.parse(payload.toString());

        // 1️⃣ 데이터 전처리
        const sensorType = this.detectSensorType(topic, rawMessage);  // 후술
        const processed = dataProcessor.processSensorData(sensorType, rawMessage);

        // 2️⃣ WebSocket 브로드캐스트 요청
        if (typeof this.broadcast === 'function') {
          this.broadcast({
            type: 'mqtt_message',
            topic: topic,
            data: processed
          });
        }

        // 3️⃣ 내부 이벤트로도 전달 (선택)
        this.emit('message', { topic, message: processed });

      } catch (error) {
        console.error('Error parsing MQTT message:', error);
      }
    });

    this.client.on('error', (error) => {
      console.error('MQTT Client error:', error);
      this.emit('error', error);
    });

    this.client.on('disconnect', () => {
      console.log('MQTT Client disconnected');
      this.isConnected = false;
      this.emit('disconnected');
    });

    this.client.on('close', () => {
      console.log('MQTT Client connection closed');
      this.isConnected = false;
    });
  }

  subscribe(topic, qos = 0) {
    if (!this.isConnected) {
      console.warn('MQTT Client not connected. Topic will be subscribed when connected.');
      this.subscribedTopics.add(topic);
      return;
    }

    this.client.subscribe(topic, { qos }, (error) => {
      if (error) {
        console.error(`Failed to subscribe to ${topic}:`, error);
      } else {
        console.log(`Subscribed to ${topic}`);
        this.subscribedTopics.add(topic);
      }
    });
  }

  unsubscribe(topic) {
    if (!this.isConnected) {
      this.subscribedTopics.delete(topic);
      return;
    }

    this.client.unsubscribe(topic, (error) => {
      if (error) {
        console.error(`Failed to unsubscribe from ${topic}:`, error);
      } else {
        console.log(`Unsubscribed from ${topic}`);
        this.subscribedTopics.delete(topic);
      }
    });
  }

  publish(topic, message, qos = 0) {
    if (!this.isConnected) {
      console.warn('MQTT Client not connected. Cannot publish message.');
      return false;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.client.publish(topic, payload, { qos }, (error) => {
      if (error) {
        console.error(`Failed to publish to ${topic}:`, error);
      } else {
        console.log(`Message published to ${topic}`);
      }
    });
    
    return true;
  }

  resubscribeToTopics() {
    this.subscribedTopics.forEach(topic => {
      this.subscribe(topic);
    });
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      this.isConnected = false;
    }
  }
}

module.exports = MqttClient;
