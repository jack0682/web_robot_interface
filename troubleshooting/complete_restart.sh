#!/bin/bash

# 완전한 초기화 및 재시작 스크립트
echo "🔄 전체 서비스 초기화 및 재시작"
echo "=============================="

cd "$(dirname "$0")/.."

# 1. 모든 관련 프로세스 강제 종료
echo "1. 모든 관련 프로세스 종료 중..."
pkill -f "node.*mqtt_processor" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "node.*frontend" 2>/dev/null || true

# 2. 포트 8080 사용 프로세스 종료
echo "2. 8080 포트 사용 프로세스 종료 중..."
PORT_PIDS=$(lsof -ti:8080 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
    echo "   종료할 PID: $PORT_PIDS"
    kill $PORT_PIDS 2>/dev/null || true
    sleep 2
    
    # 여전히 실행 중이면 강제 종료
    REMAINING_PIDS=$(lsof -ti:8080 2>/dev/null)
    if [ -n "$REMAINING_PIDS" ]; then
        echo "   강제 종료: $REMAINING_PIDS"
        kill -9 $REMAINING_PIDS 2>/dev/null || true
    fi
fi

# 3. 잠시 대기
echo "3. 포트 해제 대기 중..."
sleep 3

# 4. 포트 확인
echo "4. 포트 상태 확인:"
if netstat -tuln | grep ":8080" || ss -tuln | grep ":8080"; then
    echo "   ⚠️ 8080 포트가 여전히 사용 중입니다"
    echo "   수동으로 해결이 필요할 수 있습니다"
else
    echo "   ✅ 8080 포트 사용 가능"
fi

# 5. MQTT Processor 시작
echo "5. MQTT Processor 시작..."
cd mqtt_processor
npm start &
MQTT_PID=$!
echo "   MQTT Processor PID: $MQTT_PID"
cd ..

# 6. 8080 포트 준비 대기
echo "6. MQTT Processor 준비 대기..."
for i in {1..20}; do
    if netstat -tuln 2>/dev/null | grep ":8080" || ss -tuln 2>/dev/null | grep ":8080"; then
        echo "   ✅ MQTT Processor 준비 완료 ($i초)"
        break
    fi
    
    if ! kill -0 $MQTT_PID 2>/dev/null; then
        echo "   ❌ MQTT Processor 프로세스가 종료되었습니다"
        echo "   로그를 확인하세요: mqtt_processor/logs/"
        exit 1
    fi
    
    sleep 1
    echo "   대기 중... ($i/20)"
done

# 7. Backend 시작
echo "7. Backend 시작..."
sleep 2
cd backend
npm start &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"
cd ..

# 8. Backend 준비 대기
echo "8. Backend 준비 대기..."
for i in {1..15}; do
    if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
        echo "   ✅ Backend 준비 완료 ($i초)"
        break
    fi
    sleep 1
    echo "   대기 중... ($i/15)"
done

# 9. 최종 상태 확인
echo ""
echo "=============================="
echo "🎯 최종 상태 확인"
echo "=============================="

echo "실행 중인 서비스:"
if kill -0 $MQTT_PID 2>/dev/null; then
    echo "✅ MQTT Processor (PID: $MQTT_PID)"
else
    echo "❌ MQTT Processor 실행 실패"
fi

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo "✅ Backend (PID: $BACKEND_PID)"
else
    echo "❌ Backend 실행 실패"
fi

echo ""
echo "포트 상태:"
for port in 8080 5000; do
    if netstat -tuln 2>/dev/null | grep ":$port" || ss -tuln 2>/dev/null | grep ":$port"; then
        echo "✅ 포트 $port 사용 중"
    else
        echo "❌ 포트 $port 사용되지 않음"
    fi
done

echo ""
echo "Health Check:"
if curl -s "http://localhost:5000/health" | grep -q "healthy\|degraded"; then
    echo "✅ Backend Health Check 통과"
else
    echo "❌ Backend Health Check 실패"
fi

echo ""
echo "=============================="
echo "서비스 중지: kill $MQTT_PID $BACKEND_PID"
echo "=============================="

# PID 저장
echo "mqtt_processor:$MQTT_PID" > .service_pids
echo "backend:$BACKEND_PID" >> .service_pids
