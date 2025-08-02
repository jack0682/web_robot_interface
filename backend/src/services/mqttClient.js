const mqtt = require('mqtt');
const EventEmitter = require('events');

class MqttClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.client = null;
    this.isConnected = false;
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
        const message = JSON.parse(payload.toString());
        this.emit('message', { topic, message });
      } catch (error) {
        console.error('Error parsing MQTT message:', error);
        this.emit('message', { topic, message: payload.toString() });
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
