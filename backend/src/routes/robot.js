const express = require('express');
const router = express.Router();

// 로봇 상태 정보 API
router.get('/status', (req, res) => {
  // ROS2 토픽에서 실제 데이터를 가져오는 로직이 들어갈 예정
  res.json({
    robot_id: 'M0609_001',
    connection_status: 'connected',
    robot_mode: 'auto',
    safety_status: 'normal',
    joint_positions: [0.0, -1.57, 1.57, 0.0, 1.57, 0.0],
    joint_velocities: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    tcp_position: {
      x: 0.4,
      y: 0.0,
      z: 0.6,
      rx: 0.0,
      ry: 0.0,
      rz: 0.0
    },
    timestamp: new Date().toISOString()
  });
});

// 로봇 연결 상태
router.get('/connection', (req, res) => {
  res.json({
    connected: true,
    ip_address: '192.168.137.100',
    port: 12345,
    last_heartbeat: new Date().toISOString()
  });
});

// 로봇 제어 명령
router.post('/command', (req, res) => {
  const { command, parameters } = req.body;
  
  // 실제 로봇 제어 로직이 들어갈 예정
  res.json({
    success: true,
    command: command,
    parameters: parameters,
    execution_time: new Date().toISOString()
  });
});

module.exports = router;
