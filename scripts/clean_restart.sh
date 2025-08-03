#!/bin/bash

# Clean and Restart Services
# 서비스 정리 및 재시작

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🧹 Clean and Restart Services"
echo "=============================="

# 1. 기존 프로세스 종료
log_info "Cleaning up existing processes..."

# Node.js 프로세스 중 우리 서비스만 종료
MQTT_PIDS=$(pgrep -f "node.*index.js" 2>/dev/null || true)
if [ -n "$MQTT_PIDS" ]; then
    log_info "Stopping MQTT Processor processes: $MQTT_PIDS"
    for pid in $MQTT_PIDS; do
        # VSCode 관련 프로세스는 제외
        if ! ps -p $pid -o cmd --no-headers | grep -q vscode; then
            kill $pid 2>/dev/null || true
            log_success "Stopped process $pid"
        fi
    done
fi

BACKEND_PIDS=$(pgrep -f "node.*server" 2>/dev/null || true)
if [ -n "$BACKEND_PIDS" ]; then
    log_info "Stopping Backend processes: $BACKEND_PIDS"
    kill $BACKEND_PIDS 2>/dev/null || true
fi

FRONTEND_PIDS=$(pgrep -f "react-scripts\|webpack.*dev" 2>/dev/null || true)
if [ -n "$FRONTEND_PIDS" ]; then
    log_info "Stopping Frontend processes: $FRONTEND_PIDS"
    kill $FRONTEND_PIDS 2>/dev/null || true
fi

# 2. 포트 해제 대기
log_info "Waiting for ports to be released..."
sleep 3

# 3. 포트 상태 확인
log_info "Checking port availability..."
for port in 3000 5000 8080; do
    if netstat -tuln 2>/dev/null | grep -q ":$port "; then
        log_warning "Port $port is still in use"
        # 포트를 사용하는 프로세스 찾기
        PROCESS=$(lsof -t -i:$port 2>/dev/null || true)
        if [ -n "$PROCESS" ]; then
            log_info "Process using port $port: $PROCESS"
            # VSCode가 아닌 경우에만 종료
            if ! ps -p $PROCESS -o cmd --no-headers | grep -q vscode; then
                log_info "Force killing process $PROCESS"
                kill -9 $PROCESS 2>/dev/null || true
            fi
        fi
    else
        log_success "Port $port is available"
    fi
done

# 4. 최종 대기
sleep 2

# 5. 서비스 재시작
log_info "Starting services in correct order..."

# 프로젝트 루트로 이동
cd ~/web_robot_interface

# MQTT Processor 시작
log_info "Starting MQTT Processor..."
cd mqtt_processor
npm start &
MQTT_PID=$!
cd ..
log_success "MQTT Processor started (PID: $MQTT_PID)"

# 잠시 대기 (MQTT 연결 안정화)
sleep 5

# Backend 시작
if [ -d "backend" ]; then
    log_info "Starting Backend..."
    cd backend
    npm start &
    BACKEND_PID=$!
    cd ..
    log_success "Backend started (PID: $BACKEND_PID)"
    sleep 3
fi

# Frontend 시작
if [ -d "frontend" ]; then
    log_info "Starting Frontend..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    cd ..
    log_success "Frontend started (PID: $FRONTEND_PID)"
fi

# 6. 서비스 상태 확인
log_info "Verifying services..."
sleep 5

for port in 8080 5000 3000; do
    if curl -s --connect-timeout 2 http://localhost:$port >/dev/null 2>&1; then
        log_success "✓ Service on port $port is responding"
    else
        log_warning "⚠ Service on port $port may need more time"
    fi
done

echo ""
echo "🎉 Service restart completed!"
echo ""
echo "Service URLs:"
echo "- MQTT Processor: http://localhost:8080/status"
echo "- Backend API: http://localhost:5000"
echo "- Frontend: http://localhost:3000"
echo ""
echo "Monitor with: watch -n 2 'netstat -tuln | grep -E \"3000|5000|8080\"'"