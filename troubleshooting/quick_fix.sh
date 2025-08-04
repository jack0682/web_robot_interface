#!/bin/bash

# 간단한 MQTT 연결 문제 해결 스크립트
echo "🔧 MQTT 연결 문제 빠른 해결"
echo "=========================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 1. 기존 프로세스 정리
echo "1. 기존 프로세스 정리..."
pkill -f "node.*mqtt_processor" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
sleep 2

# 2. MQTT Processor 먼저 시작
echo "2. MQTT Processor 시작..."
cd mqtt_processor
npm start &
MQTT_PID=$!
cd ..

# 3. 8080 포트 대기
echo "3. MQTT Processor 준비 대기 (최대 15초)..."
for i in {1..15}; do
    if netstat -tuln 2>/dev/null | grep ":8080" || ss -tuln 2>/dev/null | grep ":8080"; then
        echo "✓ MQTT Processor 준비 완료"
        break
    fi
    sleep 1
    echo "   대기 중... ($i/15)"
done

# 4. Backend 시작
echo "4. Backend 시작..."
cd backend
npm start &
BACKEND_PID=$!
cd ..

# 5. 연결 확인
echo "5. 연결 확인 (최대 10초)..."
for i in {1..10}; do
    if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
        echo "✓ Backend 연결 성공"
        break
    fi
    sleep 1
    echo "   Backend 시작 중... ($i/10)"
done

echo ""
echo "=== 최종 결과 ==="
echo "MQTT Processor PID: $MQTT_PID"
echo "Backend PID: $BACKEND_PID"
echo ""
echo "확인 URL:"
echo "- http://localhost:5000/health"
echo "- ws://localhost:8080"
echo ""
echo "중지: kill $MQTT_PID $BACKEND_PID"
