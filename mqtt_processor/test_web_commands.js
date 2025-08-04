#!/usr/bin/env node

/**
 * 🎯 Web Dashboard Command Test Script
 * 웹 대시보드에서 시작/농도설정/긴급정지 명령을 테스트하는 스크립트
 */

const MqttClient = require('./src/mqttClient');
require('dotenv').config();

async function testWebCommands() {
  console.log('🧪 Testing Web Dashboard Commands...');
  
  const client = new MqttClient();
  
  try {
    await client.initialize();
    console.log('✅ MQTT Client connected');
    
    // 🎯 시스템 시작 명령 테스트
    console.log('\n🚀 Testing START command...');
    const startResult = await client.startSystem();
    console.log(`   Result: ${startResult ? '✅ Success' : '❌ Failed'}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 🎯 농도 설정 명령 테스트 
    console.log('\n🎯 Testing CONCENTRATION command (75%)...');
    const concentrationResult = await client.setConcentration(75);
    console.log(`   Result: ${concentrationResult ? '✅ Success' : '❌ Failed'}`);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 🎯 긴급 정지 명령 테스트
    console.log('\n🛑 Testing EMERGENCY STOP command...');
    const emergencyResult = await client.emergencyStop();
    console.log(`   Result: ${emergencyResult ? '✅ Success' : '❌ Failed'}`);
    
    console.log('\n📊 System Status:');
    console.log(JSON.stringify(client.getSystemSnapshot(), null, 2));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.shutdown();
    console.log('\n✅ Test completed');
    process.exit(0);
  }
}

if (require.main === module) {
  testWebCommands();
}

module.exports = { testWebCommands };
