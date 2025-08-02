const WebSocket = require('ws');
const express = require('express');
const router = express.Router();

class WebSocketManager {
  constructor() {
    this.clients = new Map();
    this.server = null;
  }

  initializeServer(server) {
    this.server = new WebSocket.Server({ server });
    
    this.server.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      
      console.log(`Client ${clientId} connected`);
      
      // 클라이언트에게 연결 확인 메시지 전송
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Robot Dashboard',
        clientId: clientId,
        timestamp: new Date().toISOString()
      }));
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });
      
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`Client ${clientId} disconnected`);
      });
    });
  }

  handleMessage(clientId, data) {
    console.log(`Message from ${clientId}:`, data);
    
    // 메시지 타입에 따른 처리
    switch (data.type) {
      case 'subscribe':
        this.subscribeToTopic(clientId, data.topic);
        break;
      case 'command':
        this.handleCommand(clientId, data);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  subscribeToTopic(clientId, topic) {
    // 실제 ROS2 토픽 구독 로직이 들어갈 예정
    console.log(`Client ${clientId} subscribed to ${topic}`);
  }

  handleCommand(clientId, data) {
    // 로봇 제어 명령 처리 로직
    console.log(`Command from ${clientId}:`, data.command);
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    this.clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

const wsManager = new WebSocketManager();

router.wsManager = wsManager;

module.exports = router;
