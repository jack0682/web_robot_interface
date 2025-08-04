# MQTT 연결 문제 해결 가이드

## 🚨 문제 상황
Backend에서 MQTT Processor에 WebSocket 연결(`ws://localhost:8080`)을 시도하지만 `ECONNREFUSED` 에러가 발생합니다.

## 🔍 원인 분석
1. **포트 불일치**: Backend가 8081로 연결 시도했지만, MQTT Processor는 8080에서 실행
2. **서비스 시작 순서**: Backend가 MQTT Processor보다 먼저 시작됨
3. **MQTT Processor 미실행**: 실제로 8080 포트에서 서비스가 실행되지 않음

## ✅ 해결 방법

### 단계 1: 포트 설정 수정 (완료됨)
Backend의 `src/services/mqttProcessor.js`에서 포트를 8080으로 수정했습니다.

### 단계 2: 서비스 올바른 순서로 시작

```bash
# WSL 터미널에서 실행
cd /home/jaeho/web_robot_interface

# 1. 기존 프로세스 정리
pkill -f "node.*mqtt_processor" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true

# 2. 권한 설정
chmod +x troubleshooting/*.sh
chmod +x scripts/*.sh

# 3. 빠른 해결 스크립트 실행
./troubleshooting/quick_fix.sh
```

### 단계 3: 수동 실행 (대안)

```bash
# 터미널 1: MQTT Processor
cd /home/jaeho/web_robot_interface/mqtt_processor
npm start

# 터미널 2: Backend (MQTT Processor 준비 후)
cd /home/jaeho/web_robot_interface/backend
npm start

# 터미널 3: Frontend (선택사항)
cd /home/jaeho/web_robot_interface/frontend
npm start
```

## 🔧 상태 확인 명령어

### 실행 중인 서비스 확인
```bash
# Node.js 프로세스 확인
ps aux | grep node | grep -v grep

# 포트 사용 확인
netstat -tuln | grep -E ":8080|:5000|:3000"
# 또는
ss -tuln | grep -E ":8080|:5000|:3000"
```

### Backend 상태 확인
```bash
# Health check
curl http://localhost:5000/health

# 상세 상태 (jq 설치된 경우)
curl -s http://localhost:5000/health | jq '.'
```

### WebSocket 연결 테스트 (wscat 필요)
```bash
# wscat 설치
npm install -g wscat

# WebSocket 연결 테스트
echo '{"type":"get_status"}' | wscat -c ws://localhost:8080
```

## 🐛 문제가 계속되는 경우

### 로그 확인
```bash
# MQTT Processor 로그
tail -f mqtt_processor/logs/*

# Backend 로그
tail -f backend/logs/*

# 시스템 로그
journalctl -f | grep node
```

### 환경 설정 확인
```bash
# MQTT Processor 환경변수
cat mqtt_processor/.env

# Backend 환경변수
cat backend/.env
```

### 의존성 재설치
```bash
# 전체 재설치
rm -rf */node_modules
npm run install:all

# 개별 재설치
cd mqtt_processor && npm install && cd ..
cd backend && npm install && cd ..
```

## 📋 정상 동작 확인 사항

1. ✅ MQTT Processor가 8080 포트에서 실행
2. ✅ Backend가 8080 포트로 WebSocket 연결 성공
3. ✅ Backend health check 통과 (`http://localhost:5000/health`)
4. ✅ MQTT 연결 로그에 성공 메시지 표시

## 🎯 예상 정상 로그

### MQTT Processor
```
🤖 ROBOT WEB DASHBOARD - MQTT PROCESSOR 🤖
🚀 Starting Robot Web Dashboard MQTT Processor...
🔌 Initializing MQTT Client...
✅ MQTT Client connected successfully
🎯 WebSocket server started on port 8080
```

### Backend
```
🤖 ROBOT WEB DASHBOARD - BACKEND API 🤖
🔌 Connecting to MQTT Processor via WebSocket...
🔗 WebSocket connected to MQTT Processor
✅ MQTT Processor Service connected successfully
🎯 Backend API server running on port 5000
```

이 가이드대로 진행하시면 MQTT 연결 문제가 해결됩니다.
