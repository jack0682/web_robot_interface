#!/usr/bin/env node

/**
 * 🧪 빠른 오류 진단 스크립트
 */

console.log('🔍 빠른 진단 시작...');

try {
  console.log('1️⃣ 환경 변수 로드 테스트...');
  require('dotenv').config();
  console.log('✅ dotenv 로드 성공');

  console.log('2️⃣ Logger 로드 테스트...');
  const Logger = require('./src/logger');
  const logger = new Logger('Test');
  logger.info('Logger 테스트 성공');
  console.log('✅ Logger 로드 성공');

  console.log('3️⃣ MqttClient 로드 테스트...');
  const MqttClient = require('./src/mqttClient');
  console.log('✅ MqttClient 로드 성공');

  console.log('4️⃣ MqttClient 인스턴스 생성 테스트...');
  const client = new MqttClient();
  console.log('✅ MqttClient 인스턴스 생성 성공');

  console.log('5️⃣ 환경 변수 확인...');
  console.log('  MQTT_HOST:', process.env.MQTT_HOST);
  console.log('  MQTT_PORT:', process.env.MQTT_PORT);
  console.log('  MQTT_USERNAME:', process.env.MQTT_USERNAME ? '✅ 설정됨' : '❌ 없음');
  console.log('  MQTT_PASSWORD:', process.env.MQTT_PASSWORD ? '✅ 설정됨' : '❌ 없음');
  console.log('  WS_PORT:', process.env.WS_PORT);

  console.log('🎉 모든 기본 테스트 통과!');
  
} catch (error) {
  console.error('❌ 오류 발견:', error.message);
  console.error('📋 스택 트레이스:', error.stack);
}
