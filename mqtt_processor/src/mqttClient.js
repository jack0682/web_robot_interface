      ));

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

      // 핸들러 통계
      const handlerStats = this.handlerManager.getAllStats();
      ws.send(JSON.stringify({
        type: 'initial_data',
        topic: 'handler_stats',
        data: handlerStats,
        timestamp: new Date().toISOString()
      }));
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
        handlers: this.handlerManager.getPerformanceMetrics(),
        timestamp: this.lastHeartbeat
      };

      this.publishMessage(this.config.topics.system_health, systemHealth);

      this.logger.debug(`💓 Heartbeat sent - MQTT: ${this.isConnected}, WS Clients: ${this.wsClients.size}`);
      
      // 핸들러 상태 체크
      const healthCheck = this.handlerManager.healthCheck();
      if (healthCheck.status !== 'healthy') {
        this.logger.warn(`⚠️  Handler health issues: ${healthCheck.issues.join(', ')}`);
      }
    }, 30000); // 30초마다
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
      this.handlerManager.emergencyStop('auto_safety_system');
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
      handlers: this.handlerManager.getAllStats(),
      uptime: process.uptime(),
      last_heartbeat: this.lastHeartbeat,
      timestamp: new Date().toISOString()
    };
  }

  getHandlerStats(handlerName = null) {
    if (handlerName) {
      return this.handlerManager.getHandlerStats(handlerName);
    }
    return this.handlerManager.getAllStats();
  }

  setConcentrationTarget(target, source = 'api') {
    return this.handlerManager.setConcentrationTarget(target, source);
  }

  calibrateWeightSensor(offset = null) {
    return this.handlerManager.calibrateWeightSensor(offset);
  }

  triggerEmergencyStop(source = 'api') {
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
            handlers: this.handlerManager.getPerformanceMetrics()
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
      
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      this.logger.info('✅ MQTT Processor shutdown complete');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }
}

module.exports = MqttClient;
