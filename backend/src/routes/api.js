const express = require('express');
const router = express.Router();

// API 기본 라우터
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Robot Web Dashboard API'
  });
});

// API 버전 정보
router.get('/version', (req, res) => {
  res.json({ 
    version: '1.0.0',
    api_version: 'v1',
    description: 'Doosan M0609 Robot Web Dashboard API'
  });
});

module.exports = router;
