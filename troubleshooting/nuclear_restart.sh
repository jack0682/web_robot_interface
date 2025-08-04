#!/bin/bash

# 강제 정리 후 안전한 포트로 재시작
echo "💥 강력한 프로세스 정리 및 안전한 재시작"
echo "========================================="

cd "$(dirname "$0")/.."

# 1. 모든 Node.js/npm 프로세스 강제 종료
echo "1. 모든 Node.js 프로세스 강제 종료..."
pkill -f "node" || true
pkill -f "npm" || true
sleep 3

echo "2. 특정 포트 프로세스 강제 종료..."
for port in 8080 8081 8082 8083 5000 3000; do
    PIDS=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "   포트 $port 프로세스 종료: $PIDS"
        kill -9 $PIDS 2>/dev/null || true
    fi
done

# 3. 잠시 대기
echo "3. 시스템 정리 대기..."
sleep 5

# 4. 사용 가능한 포트 찾기
echo "4. 사용 가능한 WebSocket 포트 찾기..."
WS_PORT=""
for port in {8082..8090}; do
    if ! netstat -tuln 2>/dev/null | grep ":$port" && ! ss -tuln 2>/dev/null | grep ":$port"; then
        WS_PORT=$port
        echo "   ✅ 사용 가능한 포트 발견: $port"
        break
    fi
done

if [ -z "$WS_PORT" ]; then
    WS_PORT=8082
    echo "   ⚠️ 기본 포트 $WS_PORT 사용 (강제)"
fi

# 5. 환경 설정 업데이트
echo "5. 포트 설정 업데이트 ($WS_PORT)..."

# MQTT Processor .env 업데이트
if [ -f "mqtt_processor/.env" ]; then
    sed -i "s/WS_PORT=.*/WS_PORT=$WS_PORT/" mqtt_processor/.env
    echo "   ✅ mqtt_processor/.env 업데이트됨"
fi

# Backend WebSocket URL 업데이트
if [ -f "backend/src/services/mqttProcessor.js" ]; then
    sed -i "s|ws://localhost:[0-9]*|ws://localhost:$WS_PORT|g" backend/src/services/mqttProcessor.js
    echo "   ✅ backend mqttProcessor.js 업데이트됨"
fi

# 6. 설정 확인
echo "6. 업데이트된 설정 확인:"
echo "   MQTT Processor 포트: $(grep WS_PORT mqtt_processor/.env 2>/dev/null || echo 'N/A')"
echo "   Backend WebSocket URL: $(grep 'ws://localhost' backend/src/services/mqttProcessor.js 2>/dev/null || echo 'N/A')"

# 7. 서비스 시작
echo ""
echo "7. 서비스 시작..."

# MQTT Processor 시작
echo "   MQTT Processor 시작 중..."
cd mqtt_processor
npm start &
MQTT_PID=$!
cd ..
echo "   MQTT Processor PID: $MQTT_PID"

# WebSocket 포트 준비 대기
echo "   WebSocket 서버 준비 대기..."
for i in {1..20}; do
    if netstat -tuln 2>/dev/null | grep ":$WS_PORT" || ss -tuln 2>/dev/null | grep ":$WS_PORT"; then
        echo "   ✅ WebSocket 서버 준비 완료 (포트 $WS_PORT, ${i}초)"
        break
    fi
    
    if ! kill -0 $MQTT_PID 2>/dev/null; then
        echo "   ❌ MQTT Processor 실행 실패"
        echo "   로그 확인: mqtt_processor/logs/ 또는 npm 출력"
        exit 1
    fi
    
    sleep 1
    echo "   대기 중... ($i/20)"
done

# Backend 시작
echo "   Backend 시작 중..."
sleep 2
cd backend
npm start &
BACKEND_PID=$!
cd ..
echo "   Backend PID: $BACKEND_PID"

# Backend 준비 대기
echo "   Backend API 준비 대기..."
for i in {1..15}; do
    if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
        echo "   ✅ Backend API 준비 완료 (${i}초)"
        break
    fi
    
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "   ❌ Backend 실행 실패"
        break
    fi
    
    sleep 1
    echo "   API 시작 대기... ($i/15)"
done

# 8. 최종 상태 확인
echo ""
echo "========================================"
echo "🎯 최종 실행 상태"
echo "========================================"

echo "실행 중인 서비스:"
if kill -0 $MQTT_PID 2>/dev/null; then
    echo "✅ MQTT Processor (PID: $MQTT_PID, 포트: $WS_PORT)"
else
    echo "❌ MQTT Processor 실행 실패"
fi

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend API (PID: $BACKEND_PID, 포트: 5000)"
else
    echo "❌ Backend API 실행 실패"
fi

echo ""
echo "포트 상태:"
for port in $WS_PORT 5000; do
    if netstat -tuln 2>/dev/null | grep ":$port" || ss -tuln 2>/dev/null | grep ":$port"; then
        echo "✅ 포트 $port 활성"
    else
        echo "❌ 포트 $port 비활성"
    fi
done

echo ""
echo "연결 테스트:"
if curl -s "http://localhost:5000/health" | grep -q "healthy\|degraded"; then
    echo "✅ Backend Health Check 성공"
    echo "Backend 상태:"
    curl -s "http://localhost:5000/health" | head -3
else
    echo "❌ Backend Health Check 실패"
fi

echo ""
echo "========================================"
echo "🌐 서비스 URL:"
echo "========================================"
echo "- Backend API: http://localhost:5000"
echo "- Health Check: http://localhost:5000/health"
echo "- WebSocket: ws://localhost:$WS_PORT"
echo ""
echo "서비스 중지: kill $MQTT_PID $BACKEND_PID"
echo "========================================"

# PID 저장
echo "mqtt_processor:$MQTT_PID" > .service_pids
echo "backend:$BACKEND_PID" >> .service_pids
echo "websocket_port:$WS_PORT" >> .service_pids
