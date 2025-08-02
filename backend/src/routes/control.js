const express = require('express');
const router = express.Router();

// 제어 명령 API
router.post('/move_joint', (req, res) => {
  const { joint_positions } = req.body;
  
  // 관절 이동 명령 처리 로직
  res.json({
    success: true,
    command: 'move_joint',
    target_positions: joint_positions,
    estimated_time: 5.0,
    timestamp: new Date().toISOString()
  });
});

router.post('/move_linear', (req, res) => {
  const { target_position } = req.body;
  
  // 직선 이동 명령 처리 로직
  res.json({
    success: true,
    command: 'move_linear',
    target_position: target_position,
    estimated_time: 3.0,
    timestamp: new Date().toISOString()
  });
});

router.post('/stop', (req, res) => {
  // 비상 정지 명령
  res.json({
    success: true,
    command: 'emergency_stop',
    timestamp: new Date().toISOString()
  });
});

router.post('/concentration_control', (req, res) => {
  const { target_concentration } = req.body;
  
  // 농도 제어 로직
  res.json({
    success: true,
    command: 'set_concentration',
    target_value: target_concentration,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
