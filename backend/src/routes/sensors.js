const express = require('express');
const router = express.Router();

// 센서 데이터 API
router.get('/weight', (req, res) => {
  // 무게 센서 데이터 시뮬레이션
  res.json({
    weight: Math.random() * 10 + 15, // 15-25kg 범위
    unit: 'kg',
    calibrated: true,
    sensor_id: 'weight_sensor_01',
    timestamp: new Date().toISOString()
  });
});

router.get('/concentration', (req, res) => {
  // 농도 센서 데이터 시뮬레이션
  res.json({
    concentration: Math.random() * 100,
    unit: '%',
    target_concentration: 75.0,
    sensor_id: 'concentration_sensor_01',
    timestamp: new Date().toISOString()
  });
});

// 모든 센서 데이터 통합
router.get('/all', (req, res) => {
  res.json({
    weight: {
      value: Math.random() * 10 + 15,
      unit: 'kg',
      sensor_id: 'weight_sensor_01'
    },
    concentration: {
      value: Math.random() * 100,
      unit: '%',
      sensor_id: 'concentration_sensor_01'
    },
    temperature: {
      value: Math.random() * 10 + 20,
      unit: '°C',
      sensor_id: 'temp_sensor_01'
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
