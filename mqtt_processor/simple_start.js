#!/usr/bin/env node

/**
 * 🚀 간단한 MQTT 클라이언트 시작 스크립트
 * 복잡한 설정 없이 바로 시작
 */

console.log('🚀 간단한 MQTT 클라이언트 시작...');

// 환경 변수 로드
require('dotenv').config();

// 간단한 로거
const log = (level, message) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
};

async function simpleStart() {
  try {
    log('info', '🔌 MqttClient 로드 중...');
    const MqttClient = require('./src/mqttClient');
    
    log('info', '⚙️  클라이언트 생성 중...');
    const client = new MqttClient();
    
    // 간단한 로거 설정
    client.setLogger({
      info: (msg) => log('info', msg),
      debug: (msg) => log('debug', msg),
      warn: (msg) => log('warn', msg),
      error: (msg) => log('error', msg)
    });
    
    log('info', '🌐 MQTT 클라이언트 초기화 중...');
    await client.initialize();
    
    log('info', '✅ 시스템 시작 완료!');
    log('info', '📡 구독 중인 토픽들:');
    client.config.mqtt.subscriptions.forEach(sub => {
      log('info', `  • ${sub.topic} (QoS ${sub.qos})`);
    });
    
    log('info', '🎯 웹 명령 테스트 가능:');
    log('info', '  • client.startSystem()');
    log('info', '  • client.setConcentration(75)');
    log('info', '  • client.emergencyStop()');
    
    // 시그널 핸들러
    process.on('SIGINT', async () => {
      log('info', '🛑 종료 중...');
      await client.shutdown();
      process.exit(0);
    });
    
    // 간단한 상태 출력
    setInterval(() => {
      const status = client.getStatus();
      log('info', `💓 상태: MQTT=${status.mqtt_connected ? 'Connected' : 'Disconnected'}, WS클라이언트=${status.websocket_clients}, 메시지=${status.message_count}`);
    }, 30000);
    
  } catch (error) {
    log('error', `❌ 시작 실패: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

simpleStart();
