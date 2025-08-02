const mqtt = require('mqtt');
require('dotenv').config();

console.log('🔍 EMQX Cloud Connection Test');
console.log('================================');

const testConfig = {
  host: process.env.MQTT_HOST || 'p021f2cb.ala.asia-southeast1.emqxsl.com',
  port: parseInt(process.env.MQTT_PORT) || 8883,
  username: process.env.MQTT_USERNAME || '',
  password: process.env.MQTT_PASSWORD || '',
  clientId: `test_client_${Date.now()}`,
  protocol: 'mqtts',
  rejectUnauthorized: true,
  connectTimeout: 30000,
  keepalive: 60
};

console.log('📡 Testing connection to:', `${testConfig.host}:${testConfig.port}`);
console.log('👤 Username:', testConfig.username || '[NOT SET]');
console.log('🔐 Password:', testConfig.password ? '[SET]' : '[NOT SET]');
console.log('🆔 Client ID:', testConfig.clientId);

if (!testConfig.username || !testConfig.password) {
  console.error('❌ Error: MQTT credentials not configured');
  console.log('Please set MQTT_USERNAME and MQTT_PASSWORD in .env file');
  process.exit(1);
}

const client = mqtt.connect(testConfig);

let connected = false;
let messageCount = 0;

// 연결 성공
client.on('connect', () => {
  connected = true;
  console.log('✅ Successfully connected to EMQX Cloud!');
  console.log('🔗 Connection established with TLS/SSL');
  
  // 테스트 토픽들 구독
  const testTopics = [
    'test/connection',
    'ros2_topic_list',
    'topic',
    'web/target_concentration',
    'robot/control/test',
    'system/health'
  ];
  
  console.log('📋 Subscribing to test topics...');
  testTopics.forEach(topic => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`❌ Failed to subscribe to ${topic}:`, err);
      } else {
        console.log(`✅ Subscribed to: ${topic}`);
      }
    });
  });
  
  // 테스트 메시지 발행
  setTimeout(() => {
    console.log('📤 Publishing test messages...');
    
    // 연결 테스트 메시지
    client.publish('test/connection', JSON.stringify({
      message: 'Connection test from robot dashboard',
      timestamp: new Date().toISOString(),
      client_id: testConfig.clientId
    }), { qos: 1 });
    
    // ROS2 토픽 리스트 시뮬레이션
    client.publish('ros2_topic_list', JSON.stringify([
      '/clicked_point',
      '/dsr01/joint_states',
      '/dsr01/dynamic_joint_states',
      '/dsr01/robot_description',
      '/dsr01/error',
      '/tf',
      '/tf_static'
    ]), { qos: 1 });
    
    // 무게센서 데이터 시뮬레이션
    client.publish('topic', JSON.stringify({
      weight: 15.5,
      unit: 'kg',
      timestamp: new Date().toISOString()
    }), { qos: 0 });
    
    // 목표 농도 설정 시뮬레이션
    client.publish('web/target_concentration', JSON.stringify({
      target: 75.0,
      source: 'test_client',
      timestamp: new Date().toISOString()
    }), { qos: 1 });
    
    // 시스템 상태
    client.publish('system/health', JSON.stringify({
      status: 'test',
      message: 'Connection test successful',
      timestamp: new Date().toISOString()
    }), { qos: 1 });
    
    console.log('📤 Test messages published');
  }, 2000);
});

// 메시지 수신
client.on('message', (topic, payload) => {
  messageCount++;
  console.log(`📨 [${messageCount}] Received from ${topic}:`);
  
  try {
    const data = JSON.parse(payload.toString());
    console.log(`   📄 Data:`, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log(`   📄 Raw:`, payload.toString());
  }
  
  console.log(`   ⏰ Time:`, new Date().toLocaleTimeString());
  console.log('');
});

// 연결 에러
client.on('error', (error) => {
  console.error('❌ Connection error:', error.message);
  
  if (error.code === 'ENOTFOUND') {
    console.log('🔍 DNS resolution failed. Check host address.');
  } else if (error.code === 'ECONNREFUSED') {
    console.log('🔍 Connection refused. Check port and firewall.');
  } else if (error.code === 'ECONNRESET') {
    console.log('🔍 Connection reset. Check TLS/SSL settings.');
  } else if (error.message.includes('Not authorized')) {
    console.log('🔍 Authentication failed. Check username/password.');
  }
});

// 연결 종료
client.on('close', () => {
  if (connected) {
    console.log('🔌 Connection closed');
  } else {
    console.log('❌ Failed to establish connection');
  }
});

// 오프라인 상태
client.on('offline', () => {
  console.log('📵 Client went offline');
});

// 재연결 시도
client.on('reconnect', () => {
  console.log('🔄 Attempting to reconnect...');
});

// 테스트 타임아웃 (30초)
setTimeout(() => {
  if (connected) {
    console.log('');
    console.log('🎉 Connection test completed successfully!');
    console.log(`📊 Messages received: ${messageCount}`);
    console.log('✅ EMQX Cloud integration is working');
    
    // 정상 종료
    client.end();
    process.exit(0);
  } else {
    console.log('');
    console.log('❌ Connection test failed');
    console.log('🔍 Please check your EMQX Cloud credentials and network connectivity');
    
    client.end();
    process.exit(1);
  }
}, 30000);

// Ctrl+C 처리
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  client.end();
  process.exit(0);
});

console.log('⏳ Testing connection... (Press Ctrl+C to cancel)');
