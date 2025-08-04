const WebSocket = require('ws');

class WebSocketManager {
  constructor(logger = console) {
    this.clients = new Map(); // Map<clientId, WebSocket>
    this.subscriptions = new Map(); // Map<clientId, Set<topics>>
    this.logger = logger;
    this.server = null;
  }

  initializeServer(server) {
    this.server = new WebSocket.Server({ server });

    this.server.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);
      this.logger.info(`🔌 WebSocket client connected: ${clientId}`);

      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to Robot Dashboard',
        clientId,
        timestamp: new Date().toISOString()
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleMessage(clientId, data);
        } catch (err) {
          this.logger.warn(`⚠️ WebSocket message parse error from ${clientId}:`, err.message);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.subscriptions.delete(clientId);
        this.logger.info(`❌ WebSocket client disconnected: ${clientId}`);
      });
    });
  }

  handleMessage(clientId, data) {
    this.logger.debug(`📩 Message from ${clientId}:`, data);

    switch (data.type) {
      case 'subscribe':
        this.subscribeToTopic(clientId, data.topic);
        break;
      case 'command':
        this.handleCommand(clientId, data);
        break;
      default:
        this.logger.warn(`❓ Unknown message type from ${clientId}: ${data.type}`);
    }
  }

  subscribeToTopic(clientId, topic) {
    if (!this.subscriptions.has(clientId)) {
      this.subscriptions.set(clientId, new Set());
    }
    this.subscriptions.get(clientId).add(topic);
    this.logger.info(`📡 Client ${clientId} subscribed to topic: ${topic}`);
  }

  handleCommand(clientId, data) {
    // 커맨드 로직 구현 예정
    this.logger.info(`🎮 Command received from ${clientId}:`, data.command);
  }

  broadcast(data) {
    const message = JSON.stringify(data);

    for (const [clientId, ws] of this.clients.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message);
        } catch (err) {
          this.logger.warn(`⚠️ Failed to send to ${clientId}: ${err.message}`);
        }
      } else {
        this.logger.warn(`⚠️ WebSocket not open. Removing client: ${clientId}`);
        this.clients.delete(clientId);
      }
    }
  }

  getClientCount() {
    return this.clients.size;
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
}

module.exports = WebSocketManager;
