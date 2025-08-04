#!/bin/bash

# 극한 해결 방법 - 모든 것을 정리하고 높은 포트 번호 사용
echo "💣 극한 해결: 완전 정리 후 높은 포트 사용"
echo "============================================="

cd "$(dirname "$0")/.."

echo "1. 시스템 상태 확인..."
echo "   현재 사용자: $(whoami)"
echo "   현재 디렉토리: $(pwd)"
echo "   메모리 사용량: $(free -h | grep Mem | awk '{print $3}')"

echo ""
echo "2. 극한 프로세스 정리..."

# 모든 Node.js 프로세스 강제 종료
echo "   Node.js 프로세스 강제 종료..."
pkill -9 -f "node" 2>/dev/null || true
pkill -9 -f "npm" 2>/dev/null || true

# Docker 컨테이너 정지 (있는 경우)
if command -v docker &> /dev/null; then
    echo "   Docker 컨테이너 정지..."
    docker stop $(docker ps -q) 2>/dev/null || true
fi

# 8080-8090 포트 강제 해제
echo "   8080-8090 포트 강제 해제..."
for port in {8080..8090}; do
    PIDS=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "      포트 $port: $PIDS 종료"
        kill -9 $PIDS 2>/dev/null || true
    fi
done

echo ""
echo "3. 시스템 정리 대기..."
sleep 5

echo ""
echo "4. 높은 포트 번호 찾기 (9000~9099)..."
WS_PORT=""
for port in {9001..9020}; do
    if ! netstat -tuln 2>/dev/null | grep ":$port " && ! ss -tuln 2>/dev/null | grep ":$port "; then
        WS_PORT=$port
        echo "   ✅ 사용 가능한 포트 발견: $port"
        break
    fi
done

if [ -z "$WS_PORT" ]; then
    # 더 높은 포트 사용
    WS_PORT=9001
    echo "   ⚠️ 강제로 포트 $WS_PORT 사용"
fi

echo ""
echo "5. 설정 파일 업데이트 (포트 $WS_PORT)..."

# .env 파일 백업 및 업데이트
if [ -f "mqtt_processor/.env" ]; then
    cp "mqtt_processor/.env" "mqtt_processor/.env.backup.$(date +%s)"
    sed -i "s/WS_PORT=.*/WS_PORT=$WS_PORT/" mqtt_processor/.env
    echo "   ✅ mqtt_processor/.env 업데이트 (백업됨)"
else
    echo "   ❌ mqtt_processor/.env 파일 없음"
fi

# Backend 설정 업데이트
if [ -f "backend/src/services/mqttProcessor.js" ]; then
    cp "backend/src/services/mqttProcessor.js" "backend/src/services/mqttProcessor.js.backup.$(date +%s)"
    sed -i "s|ws://localhost:[0-9]*|ws://localhost:$WS_PORT|g" backend/src/services/mqttProcessor.js
    echo "   ✅ backend mqttProcessor.js 업데이트 (백업됨)"
else
    echo "   ❌ backend mqttProcessor.js 파일 없음"
fi

echo ""
echo "6. Node modules 정리 (필요시)..."
if [ -d "mqtt_processor/node_modules" ] && [ -d "backend/node_modules" ]; then
    echo "   Node modules 이미 설치됨"
else
    echo "   Node modules 설치 필요 - 설치 중..."
    cd mqtt_processor && npm install --silent && cd ..
    cd backend && npm install --silent && cd ..
fi

echo ""
echo "7. 서비스 시작 시도..."

# 임시 로그 파일 생성
mkdir -p logs
MQTT_LOG="logs/mqtt_start_$(date +%s).log"
BACKEND_LOG="logs/backend_start_$(date +%s).log"

echo "   MQTT Processor 시작..."
cd mqtt_processor
timeout 30 npm start > "../$MQTT_LOG" 2>&1 &
MQTT_PID=$!
cd ..
echo "   MQTT Processor PID: $MQTT_PID (로그: $MQTT_LOG)"

# 더 긴 대기 시간
echo "   서비스 안정화 대기..."
sleep 10

# 포트 체크
if netstat -tuln 2>/dev/null | grep ":$WS_PORT " || ss -tuln 2>/dev/null | grep ":$WS_PORT "; then
    echo "   ✅ MQTT Processor 포트 $WS_PORT 활성화"
    
    echo "   Backend 시작..."
    cd backend
    timeout 30 npm start > "../$BACKEND_LOG" 2>&1 &
    BACKEND_PID=$!
    cd ..
    echo "   Backend PID: $BACKEND_PID (로그: $BACKEND_LOG)"
    
    # Backend 준비 대기
    echo "   Backend API 준비 대기..."
    for i in {1..20}; do
        if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
            echo "   ✅ Backend 준비 완료 (${i}초)"
            break
        fi
        sleep 1
    done
    
else
    echo "   ❌ MQTT Processor 포트 활성화 실패"
    echo "   로그 확인: tail $MQTT_LOG"
fi

echo ""
echo "============================================="
echo "🎯 최종 결과"
echo "============================================="

# 프로세스 상태 확인
echo "실행 중인 서비스:"
if [ -n "$MQTT_PID" ] && kill -0 $MQTT_PID 2>/dev/null; then
    echo "✅ MQTT Processor (PID: $MQTT_PID, 포트: $WS_PORT)"
else
    echo "❌ MQTT Processor 실행 실패"
    if [ -f "$MQTT_LOG" ]; then
        echo "   에러 로그 (마지막 5줄):"
        tail -5 "$MQTT_LOG" | sed 's/^/      /'
    fi
fi

if [ -n "$BACKEND_PID" ] && kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend (PID: $BACKEND_PID, 포트: 5000)"
else
    echo "❌ Backend 실행 실패"
    if [ -f "$BACKEND_LOG" ]; then
        echo "   에러 로그 (마지막 5줄):"
        tail -5 "$BACKEND_LOG" | sed 's/^/      /'
    fi
fi

echo ""
echo "포트 상태:"
for port in $WS_PORT 5000; do
    if netstat -tuln 2>/dev/null | grep ":$port " || ss -tuln 2>/dev/null | grep ":$port "; then
        echo "✅ 포트 $port 활성"
    else
        echo "❌ 포트 $port 비활성"
    fi
done

echo ""
echo "============================================="
echo "🌐 서비스 정보:"
echo "============================================="
echo "- Backend API: http://localhost:5000"
echo "- Health Check: http://localhost:5000/health"
echo "- WebSocket: ws://localhost:$WS_PORT"
echo ""
echo "서비스 중지:"
if [ -n "$MQTT_PID" ] && [ -n "$BACKEND_PID" ]; then
    echo "kill $MQTT_PID $BACKEND_PID"
    # PID 저장
    echo "mqtt_processor:$MQTT_PID" > .service_pids
    echo "backend:$BACKEND_PID" >> .service_pids
fi
echo ""
echo "로그 파일:"
echo "- MQTT: $MQTT_LOG"
echo "- Backend: $BACKEND_LOG"
echo "============================================="
