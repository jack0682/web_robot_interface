/**
 * 통합 디버깅 및 검증 API 라우터
 * 토픽 매핑 및 데이터 흐름 검증
 */
const express = require('express');
const router = express.Router();

// MQTT Processor 서비스
let mqttService = null;

const setMqttService = (service) => {
  mqttService = service;
};

/**
 * @route GET /api/debug/topic-mapping
 * @desc 토픽 매핑 상태 검증
 */
router.get('/topic-mapping', async (req, res) => {
  try {
    if (!mqttService) {
      return res.status(503).json({
        error: 'MQTT service not available'
      });
    }

    const allData = mqttService.getLatestData();
    
    const mappingStatus = {
      expected_topics: {
        'test': {
          description: 'ROS2 토픽 리스트 (JSON 형식)',
          expected_from: 'ROS2 노드',
          current_data: allData['test'] || null,
          status: allData['test'] ? 'ACTIVE' : 'MISSING'
        },
        'scale/raw': {
          description: '무게센서 데이터',
          expected_from: '아두이노',
          current_data: allData['scale/raw'] || null,
          status: allData['scale/raw'] ? 'ACTIVE' : 'MISSING'
        },
        'web/target_concentration': {
          description: '웹에서 설정한 농도 목표값',
          expected_from: '웹 인터페이스',
          current_data: allData['web/target_concentration'] || null,
          status: allData['web/target_concentration'] ? 'ACTIVE' : 'MISSING'
        }
      },
      all_available_topics: Object.keys(allData),
      mqtt_connection: mqttService.isHealthy(),
      robot_connection_indicator: {
        method: 'test 토픽 존재 여부로 판단',
        connected: !!(allData['test']),
        last_update: allData['test']?.timestamp || null
      },
      arduino_connection_indicator: {
        method: 'scale/raw 토픽 존재 여부로 판단', 
        connected: !!(allData['scale/raw']),
        last_update: allData['scale/raw']?.timestamp || null
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(mappingStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get topic mapping status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/debug/data-flow
 * @desc 데이터 흐름 검증
 */
router.get('/data-flow', async (req, res) => {
  try {
    if (!mqttService || !mqttService.isHealthy()) {
      return res.status(503).json({
        error: 'MQTT service unavailable'
      });
    }

    const testData = mqttService.getROS2Topics();
    const weightData = mqttService.getWeightSensorData();
    const concentrationData = mqttService.getLatestData('web/target_concentration');
    
    const dataFlow = {
      flow_status: 'analyzing',
      data_sources: {
        ros2_topics: {
          source_topic: 'test',
          api_method: 'mqttService.getROS2Topics()',
          data_available: !!testData,
          last_update: testData?.timestamp || null,
          sample_data: testData ? {
            topic_count: Object.keys(testData.data?.topic_data || {}).length,
            sample_topics: Object.keys(testData.data?.topic_data || {}).slice(0, 3)
          } : null
        },
        weight_sensor: {
          source_topic: 'scale/raw',
          api_method: 'mqttService.getWeightSensorData()',
          data_available: !!weightData,
          last_update: weightData?.timestamp || null,
          sample_data: weightData ? {
            weight_value: weightData.data?.weight || weightData.data,
            data_type: typeof weightData.data
          } : null
        },
        concentration: {
          source_topic: 'web/target_concentration',
          api_method: 'mqttService.getLatestData("web/target_concentration")',
          data_available: !!concentrationData,
          last_update: concentrationData?.timestamp || null,
          sample_data: concentrationData ? {
            target_value: concentrationData.data?.target || concentrationData.data
          } : null
        }
      },
      api_endpoints_status: {
        '/api/sensors/all': 'Uses all three data sources',
        '/api/sensors/weight': 'Uses scale/raw topic data',
        '/api/robot/ros2-topics': 'Uses test topic data',
        '/api/robot/status': 'Uses test topic for connection status'
      },
      connection_logic: {
        robot_connected: !!testData,
        arduino_connected: !!weightData,
        web_interface_active: !!concentrationData
      },
      recommendations: generateRecommendations(testData, weightData, concentrationData),
      timestamp: new Date().toISOString()
    };
    
    res.json(dataFlow);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to analyze data flow',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route POST /api/debug/test-publish
 * @desc 테스트 메시지 발행
 */
router.post('/test-publish', async (req, res) => {
  try {
    if (!mqttService || !mqttService.isHealthy()) {
      return res.status(503).json({
        error: 'MQTT service unavailable'
      });
    }

    const { topic, message } = req.body;
    
    if (!topic || !message) {
      return res.status(400).json({
        error: 'topic and message are required'
      });
    }

    const testMessage = {
      ...message,
      test: true,
      source: 'debug_api',
      timestamp: new Date().toISOString()
    };

    await mqttService.publishMessage(topic, testMessage);
    
    res.json({
      success: true,
      message: `Test message published to ${topic}`,
      published_data: testMessage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to publish test message',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @route GET /api/debug/system-health
 * @desc 전체 시스템 상태 검증
 */
router.get('/system-health', async (req, res) => {
  try {
    if (!mqttService) {
      return res.status(503).json({
        error: 'MQTT service not available'
      });
    }

    const allData = mqttService.getLatestData();
    const performance = mqttService.getPerformanceMetrics();
    
    const systemHealth = {
      overall_status: 'checking',
      components: {
        mqtt_processor: {
          status: mqttService.isHealthy() ? 'healthy' : 'unhealthy',
          connected: mqttService.isHealthy(),
          cache_size: Object.keys(allData).length
        },
        robot_connection: {
          status: allData['test'] ? 'connected' : 'disconnected',
          indicator_topic: 'test',
          last_data: allData['test']?.timestamp || null
        },
        arduino_connection: {
          status: allData['scale/raw'] ? 'connected' : 'disconnected',
          indicator_topic: 'scale/raw',
          last_data: allData['scale/raw']?.timestamp || null
        },
        web_interface: {
          status: allData['web/target_concentration'] ? 'active' : 'inactive',
          indicator_topic: 'web/target_concentration',
          last_data: allData['web/target_concentration']?.timestamp || null
        }
      },
      data_freshness: {
        test_topic: getDataFreshness(allData['test']?.timestamp),
        scale_raw_topic: getDataFreshness(allData['scale/raw']?.timestamp),
        concentration_topic: getDataFreshness(allData['web/target_concentration']?.timestamp)
      },
      performance_metrics: {
        uptime: performance.uptime,
        memory_usage: performance.memory,
        data_cache_size: performance.data_cache_size
      },
      issues_detected: [],
      timestamp: new Date().toISOString()
    };

    // 이슈 검출
    if (!mqttService.isHealthy()) {
      systemHealth.issues_detected.push('MQTT processor not connected');
    }
    if (!allData['test']) {
      systemHealth.issues_detected.push('Robot not connected (no test topic data)');
    }
    if (!allData['scale/raw']) {
      systemHealth.issues_detected.push('Arduino not connected (no scale/raw topic data)');
    }

    // 전체 상태 결정
    if (systemHealth.issues_detected.length === 0) {
      systemHealth.overall_status = 'healthy';
    } else if (systemHealth.issues_detected.length <= 2) {
      systemHealth.overall_status = 'degraded';
    } else {
      systemHealth.overall_status = 'unhealthy';
    }
    
    res.json(systemHealth);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system health',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * 권장사항 생성
 */
function generateRecommendations(testData, weightData, concentrationData) {
  const recommendations = [];
  
  if (!testData) {
    recommendations.push({
      issue: 'No ROS2 topic data (test topic)',
      action: 'Check if ROS2 node is running and publishing to test topic',
      priority: 'HIGH'
    });
  }
  
  if (!weightData) {
    recommendations.push({
      issue: 'No weight sensor data (scale/raw topic)',
      action: 'Check Arduino connection and scale/raw topic publishing',
      priority: 'MEDIUM'
    });
  }
  
  if (!concentrationData) {
    recommendations.push({
      issue: 'No concentration data (web/target_concentration topic)',
      action: 'This is normal if no concentration target has been set via web interface',
      priority: 'LOW'
    });
  }
  
  if (testData && weightData && concentrationData) {
    recommendations.push({
      issue: 'All systems operational',
      action: 'System is functioning correctly with all expected data sources active',
      priority: 'INFO'
    });
  }
  
  return recommendations;
}

/**
 * 데이터 신선도 확인
 */
function getDataFreshness(timestamp) {
  if (!timestamp) return 'no_data';
  
  const now = new Date();
  const dataTime = new Date(timestamp);
  const ageMinutes = (now - dataTime) / (1000 * 60);
  
  if (ageMinutes < 1) return 'very_fresh';
  if (ageMinutes < 5) return 'fresh';
  if (ageMinutes < 30) return 'stale';
  return 'very_stale';
}

module.exports = { router, setMqttService };