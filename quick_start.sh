#!/bin/bash

# Quick Start Script for Robot Web Dashboard
# 빠른 시작을 위한 간소화된 스크립트

echo "🚀 Robot Web Dashboard - Quick Start"
echo "==================================="

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m' 
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 기본 체크
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js 18+"
    exit 1
fi

# 의존성 설치 (빠른 체크)
log_info "Installing dependencies..."

for dir in mqtt_processor backend frontend; do
    if [ ! -d "$dir/node_modules" ]; then
        log_info "Installing $dir packages..."
        (cd $dir && npm install --silent) &
    fi
done

wait
log_success "Dependencies ready"

# 로그 디렉토리 생성
mkdir -p data/logs/{mqtt,backend,system}

# 환경 파일 확인
for dir in mqtt_processor backend frontend; do
    if [ ! -f "$dir/.env" ] && [ -f "$dir/.env.example" ]; then
        cp "$dir/.env.example" "$dir/.env"
        log_info "Created $dir/.env from example"
    fi
done

# 서비스 시작
log_info "Starting services..."

# MQTT Processor
cd mqtt_processor
node index.js > ../data/logs/system/mqtt_processor.log 2>&1 &
MQTT_PID=$!
cd ..

sleep 3

# Backend
cd backend  
node src/server.js > ../data/logs/system/backend.log 2>&1 &
BACKEND_PID=$!
cd ..

sleep 3

# Frontend (development mode)
cd frontend
npm start > ../data/logs/system/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# PID 저장
echo "mqtt_processor:$MQTT_PID" > .service_pids
echo "backend:$BACKEND_PID" >> .service_pids  
echo "frontend:$FRONTEND_PID" >> .service_pids

sleep 5

echo ""
log_success "🎉 Services started!"
echo ""
echo "📊 Running Services:"
echo "├── MQTT Processor: PID $MQTT_PID (WebSocket: ws://localhost:8080)"
echo "├── Backend API: PID $BACKEND_PID (HTTP: http://localhost:5000)"
echo "└── Frontend: PID $FRONTEND_PID (Web: http://localhost:3000)"
echo ""
echo "🌐 Open your browser: http://localhost:3000"
echo ""
echo "💡 To stop all services: ./start_system.sh --kill"
echo "📝 Logs: data/logs/system/"

# 간단한 상태 체크
sleep 2
if curl -s http://localhost:5000/health > /dev/null; then
    log_success "✅ Backend is healthy"
else
    log_error "❌ Backend not responding"
fi

echo ""
echo "Press Ctrl+C to stop all services, or let them run in background..."
