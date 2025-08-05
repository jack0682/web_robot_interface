#!/usr/bin/env node
/**
 * Simple WebSocket Client Test
 * Tests WebSocket communication with the backend
 */

const WebSocket = require('ws');

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                🔗 WebSocket Connection Test 🔗                  ║
║                  Frontend-Backend Communication                  ║
╚══════════════════════════════════════════════════════════════════╝
`);

const WEBSOCKET_URL = 'ws://localhost:5000';

console.log(`🔄 Connecting to: ${WEBSOCKET_URL}`);

const ws = new WebSocket(WEBSOCKET_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  
  // Send connection message (like frontend does)
  const connectionMessage = {
    type: 'connection',
    clientId: `test_client_${Date.now()}`,
    timestamp: new Date().toISOString(),
    userAgent: 'Node.js Test Client'
  };
  
  console.log('📤 Sending connection message:', connectionMessage);
  ws.send(JSON.stringify(connectionMessage));
  
  // Test subscription
  setTimeout(() => {
    const subscribeMessage = {
      type: 'subscribe',
      topic: 'test/diagnostic',
      qos: 0
    };
    
    console.log('📤 Sending subscription message:', subscribeMessage);
    ws.send(JSON.stringify(subscribeMessage));
  }, 1000);
  
  // Close after 5 seconds
  setTimeout(() => {
    console.log('🔌 Closing connection...');
    ws.close();
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📥 Received message:', message);
  } catch (error) {
    console.log('📥 Received raw data:', data.toString());
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', (code, reason) => {
  console.log(`🔌 WebSocket closed. Code: ${code}, Reason: ${reason || 'None'}`);
  
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                      TEST COMPLETE                              ║
║                                                                  ║
║ If you saw "connection_acknowledged" message, WebSocket is OK!   ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
  
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  ws.close();
});