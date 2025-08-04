#!/bin/bash

# 완전한 시스템 정리 및 재시작 스크립트
echo "🧹 완전한 시스템 정리 및 재시작"
echo "==============================="

# 현재 상황 파악
echo "1. 현재 상황 파악..."
echo "   사용자: $(whoami)"
echo "   디렉토리: $(pwd)"
echo "   시간: $(date)"

echo ""
echo "2. 충돌 포트 확인 (5000, 9001)..."
for port in 5000 9001; do
    if netstat -tuln 2>/dev/null | grep ":$port " || ss -tuln 2>/dev/null | grep ":$port "; then
        echo "   🔴 포트 $port 사용 중"
        PID=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ -n "$PID" ]; then
            PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "Unknown")
            echo "      PID: $PID, Process: $PROCESS"
        fi
    else
        echo "   🟢 포트 $port 사용 가능"
    fi
done

echo ""
echo "3. 강력한 프로세스 정리..."

# 모든 Node.js/npm 프로세스 강제 종료
echo "   모든 Node/npm 프로세스 종료..."
pkill -9 -f "node" 2>/dev/null || true
pkill -9 -f "npm" 2>/dev/null || true

# 특정 포트 사용 프로세스 강제 종료
echo "   포트 5000, 9001 사용 프로세스 강제 종료..."
for port in 5000 9001; do
    PIDS=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "      포트 $port: PID $PIDS 종료"
        kill -9 $PIDS 2>/dev/null || true
    fi
done

# 웹 관련 프로세스 정리
echo "   웹 관련 프로세스 정리..."
pkill -f "express" 2>/dev/null || true
pkill -f "webpack" 2>/dev/null || true
pkill -f "react" 2>/dev/null || true

echo ""
echo "4. 시스템 정리 대기..."
sleep 8

echo ""
echo "5. 포트 재확인..."
for port in 5000 9001; do
    if netstat -tuln 2>/dev/null | grep ":$port " || ss -tuln 2>/dev/null | grep ":$port "; then
        echo "   ⚠️ 포트 $port 여전히 사용 중"
    else
        echo "   ✅ 포트 $port 해제됨"
    fi
done

echo ""
echo "6. 프로젝트 디렉토리로 이동..."
cd "$(dirname "$0")/.."

echo ""
echo "7. 서비스 순차 시작..."

# MQTT Processor 먼저 시작
echo "   MQTT Processor 시작 (포트 9001)..."
cd mqtt_processor
npm start &
MQTT_PID=$!
cd ..
echo "   MQTT Processor PID: $MQTT_PID"

# MQTT Processor 준비 대기 (더 길게)
echo "   MQTT Processor 준비 대기..."
for i in {1..25}; do
    if netstat -tuln 2>/dev/null | grep ":9001 " || ss -tuln 2>/dev/null | grep ":9001 "; then
        echo "   ✅ MQTT Processor 준비 완료 (${i}초)"
        break
    fi
    
    # 프로세스가 죽었는지 확인
    if ! kill -0 $MQTT_PID 2>/dev/null; then
        echo "   ❌ MQTT Processor 프로세스 종료됨"
        break
    fi
    
    sleep 1
    echo "      대기 중... ($i/25)"
done

# 추가 안정화 시간
sleep 5

# Backend 시작
echo "   Backend 시작 (포트 5000)..."
cd backend
npm start &
BACKEND_PID=$!
cd ..
echo "   Backend PID: $BACKEND_PID"

# Backend 준비 대기
echo "   Backend 준비 대기..."
for i in {1..20}; do
    if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
        echo "   ✅ Backend 준비 완료 (${i}초)"
        break
    fi
    
    # 프로세스가 죽었는지 확인
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "   ❌ Backend 프로세스 종료됨"
        break
    fi
    
    sleep 1
    echo "      대기 중... ($i/20)"
done

echo ""
echo "==============================="
echo "🎯 최종 실행 상태"
echo "==============================="

# 프로세스 상태
echo "실행 중인 서비스:"
if [ -n "$MQTT_PID" ] && kill -0 $MQTT_PID 2>/dev/null; then
    echo "✅ MQTT Processor (PID: $MQTT_PID, 포트: 9001)"
else
    echo "❌ MQTT Processor 실행 실패"
fi

if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend (PID: $BACKEND_PID, 포트: 5000)"
else
    echo "❌ Backend 실행 실패"
fi

# 포트 상태
echo ""
echo "포트 상태:"
for port in 9001 5000; do
    if netstat -tuln 2>/dev/null | grep ":$port " || ss -tuln 2>/dev/null | grep ":$port "; then
        echo "✅ 포트 $port 활성"
    else
        echo "❌ 포트 $port 비활성"
    fi
done

# 연결 테스트
echo ""
echo "연결 테스트:"
if curl -s "http://localhost:5000/health" | grep -q "healthy\|degraded"; then
    echo "✅ Backend Health Check 성공"
    echo ""
    echo "Backend 상태 정보:"
    curl -s "http://localhost:5000/health" | head -10
else
    echo "❌ Backend Health Check 실패"
fi

echo ""
echo "==============================="
echo "🌐 서비스 정보"
echo "==============================="
echo "- Backend API: http://localhost:5000"
echo "- Health Check: http://localhost:5000/health" 
echo "- API Docs: http://localhost:5000/api-docs"
echo "- WebSocket: ws://localhost:9001"
echo ""
echo "서비스 중지:"
if [ -n "$MQTT_PID" ] && [ -n "$BACKEND_PID" ]; then
    echo "kill $MQTT_PID $BACKEND_PID"
    # PID 저장
    echo "mqtt_processor:$MQTT_PID" > .service_pids
    echo "backend:$BACKEND_PID" >> .service_pids
    echo "websocket_port:9001" >> .service_pids
    echo "backend_port:5000" >> .service_pids
fi
echo "==============================="

# 문제 해결 팁
echo ""
echo "문제가 지속되는 경우:"
echo "1. WSL 재시작: Windows PowerShell에서 'wsl --shutdown' 후 재시작"
echo "2. 시스템 재부팅"
echo "3. 다른 포트 사용 (예: Backend 5001, WebSocket 9002)"
