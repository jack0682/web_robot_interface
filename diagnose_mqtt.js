#!/usr/bin/env node
/**
 * MQTT Connection Diagnostic Tool
 * Helps identify and fix MQTT connection issues
 */

const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                 🔍 MQTT DIAGNOSTIC TOOL 🔍                      ║
║               Robot Web Dashboard - Connection Test              ║
╚══════════════════════════════════════════════════════════════════╝
`);

async function diagnoseConnection() {
  console.log('📋 Step 1: Loading configuration...');
  
  // Load config
  let config = {};
  try {
    const configPath = path.join(__dirname, 'configs/mqtt/emqx_connection.json');
    const processorConfigPath = path.join(__dirname, 'mqtt_processor/config/processor.config.json');
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log('✅ Found emqx_connection.json');
    } else if (fs.existsSync(processorConfigPath)) {
      const processorConfig = JSON.parse(fs.readFileSync(processorConfigPath, 'utf8'));
      config = {
        connection: processorConfig.mqtt.connection
      };
      console.log('✅ Found processor.config.json');
    } else {
      console.error('❌ No configuration file found!');
      return;
    }
  } catch (error) {
    console.error('❌ Failed to load configuration:', error.message);
    return;
  }

  console.log('📋 Step 2: Checking configuration...');
  const conn = config.connection;
  
  console.log(`🌐 Host: ${conn.host}`);
  console.log(`🔌 Port: ${conn.port}`);
  console.log(`🔒 Protocol: ${conn.protocol}`);
  console.log(`👤 Username: ${conn.username ? '***SET***' : '❌ NOT SET'}`);
  console.log(`🔑 Password: ${conn.password ? '***SET***' : '❌ NOT SET'}`);
  
  if (!conn.username || !conn.password) {
    console.log(`
⚠️  AUTHENTICATION MISSING!
    The EMQX Cloud broker requires authentication.
    Please set username and password in your configuration file.
    
🔧 Fix:
    1. Edit configs/mqtt/emqx_connection.json
    2. Add your MQTT credentials:
       "username": "your_username",
       "password": "your_password"
`);
    return;
  }

  console.log('📋 Step 3: Testing connection...');
  
  return new Promise((resolve) => {
    const options = {
      host: conn.host,
      port: conn.port,
      protocol: conn.protocol,
      username: conn.username,
      password: conn.password,
      connectTimeout: 10000,
      keepalive: 60,
      clean: true,
      rejectUnauthorized: false
    };

    console.log('🔄 Attempting connection...');
    const client = mqtt.connect(`${conn.protocol}://${conn.host}:${conn.port}`, options);

    const timeout = setTimeout(() => {
      console.log('⏰ Connection timeout after 10 seconds');
      client.end();
      resolve(false);
    }, 10000);

    client.on('connect', () => {
      clearTimeout(timeout);
      console.log('✅ MQTT connection successful!');
      console.log('📡 Testing topic subscription...');
      
      client.subscribe('test/diagnostic', { qos: 0 }, (err) => {
        if (err) {
          console.log('❌ Failed to subscribe to test topic:', err.message);
        } else {
          console.log('✅ Successfully subscribed to test topic');
        }
        
        client.end();
        resolve(true);
      });
    });

    client.on('error', (error) => {
      clearTimeout(timeout);
      console.log('❌ MQTT connection failed:', error.message);
      
      if (error.message.includes('Not authorized')) {
        console.log(`
🔑 AUTHENTICATION ERROR!
    Your username/password combination is incorrect.
    Please check your EMQX Cloud dashboard for the correct credentials.
`);
      } else if (error.message.includes('getaddrinfo ENOTFOUND')) {
        console.log(`
🌐 DNS RESOLUTION ERROR!
    Cannot resolve hostname: ${conn.host}
    Please check your internet connection and hostname.
`);
      } else if (error.message.includes('connect ECONNREFUSED')) {
        console.log(`
🔌 CONNECTION REFUSED!
    The server refused the connection on port ${conn.port}.
    Please check if the port is correct.
`);
      }
      
      resolve(false);
    });

    client.on('close', () => {
      console.log('🔌 Connection closed');
    });
  });
}

// Run diagnostic
diagnoseConnection().then((success) => {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                      DIAGNOSTIC COMPLETE                        ║
║                                                                  ║
║ Result: ${success ? '✅ SUCCESS - MQTT is working correctly' : '❌ FAILED - Please fix the issues above'}      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
`);
  
  if (!success) {
    console.log(`
🛠️  NEXT STEPS:
    1. Fix MQTT credentials in configuration files
    2. Run this diagnostic again: node diagnose_mqtt.js  
    3. Start the system: npm start
    4. Check the logs for any remaining issues
`);
  }
  
  process.exit(success ? 0 : 1);
});