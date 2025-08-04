/**
 * WebSocket 라우터
 * - WebSocketManager를 초기화하고 router에 바인딩
 * - 서버 진입점(server.js)에서 wsManager.initializeServer(server) 호출 필요
 */

const express = require('express');
const router = express.Router();
const WebSocketManager = require('../services/websocketmanager');

// winston logger는 server.js에서 사용 - 여기서는 console을 기본으로 사용
const logger = console;

// WebSocketManager 인스턴스 생성
const wsManager = new WebSocketManager(logger);

// router에 wsManager를 바인딩해서 외부에서 사용할 수 있도록 함
router.wsManager = wsManager;

module.exports = router;