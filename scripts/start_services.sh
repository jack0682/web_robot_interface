#!/bin/bash

# Start All Services Script
# 모든 서비스를 시작하는 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 함수 정의
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

echo "🚀 Starting Robot Web Dashboard Services"
echo "=================================================="

PROJECT_DIR="$(pwd)"
PIDS_FILE="$PROJECT_DIR/.service_pids"

# 기존 PID 파일 정리
if [ -f "$PIDS_FILE" ]; then
    rm "$PIDS_FILE"
fi

# MQTT 브로커 시작 (필요한 경우)
log_info "Checking MQTT broker..."
if ! pgrep -f "mosquitto" > /dev/null; then
    if command -v mosquitto &> /dev/null; then
        log_info "Starting Mosquitto MQTT broker..."
        mosquitto -d
        sleep 2
        log_success "MQTT broker started"
    else
        log_warning "MQTT broker not found. Please start manually or use external broker."
    fi
else
    log_info "MQTT broker already running"
fi

# MQTT Processor 시작
if [ -d "mqtt_processor" ]; then
    log_info "Starting MQTT Processor..."
    cd mqtt_processor
    npm start &
    MQTT_PID=$!
    echo "mqtt_processor:$MQTT_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "MQTT Processor started (PID: $MQTT_PID)"
    sleep 2
else
    log_warning "MQTT Processor directory not found"
fi

# Backend 시작
if [ -d "backend" ]; then
    log_info "Starting Backend server..."
    cd backend
    npm start &
    BACKEND_PID=$!
    echo "backend:$BACKEND_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "Backend server started (PID: $BACKEND_PID)"
    sleep 2
else
    log_warning "Backend directory not found"
fi

# Frontend 시작 (개발 모드)
if [ -d "frontend" ]; then
    log_info "Starting Frontend development server..."
    cd frontend
    npm start &
    FRONTEND_PID=$!
    echo "frontend:$FRONTEND_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "Frontend server started (PID: $FRONTEND_PID)"
    sleep 3
else
    log_warning "Frontend directory not found"
fi

# 서비스 상태 확인
log_info "Verifying services..."

check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1; then
            log_success "✓ $service_name is responding on port $port"
            return 0
        fi
        
        log_info "Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "✗ $service_name failed to start on port $port"
    return 1
}

# 각 서비스 상태 확인
if [ -d "backend" ]; then
    check_service "Backend API" 5000
fi

if [ -d "frontend" ]; then
    check_service "Frontend" 3000
fi

# WebSocket 서버 확인 (MQTT Processor)
if [ -d "mqtt_processor" ]; then
    log_info "Checking WebSocket server..."
    sleep 2
    if netstat -tuln | grep -q ":8080"; then
        log_success "✓ WebSocket server is listening on port 8080"
    else
        log_warning "WebSocket server may not be ready yet"
    fi
fi

echo ""
echo "=================================================="
log_success "🎉 All services started successfully!"
echo "=================================================="
echo ""
echo "Service URLs:"
echo "- Frontend Dashboard: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
echo "- WebSocket: ws://localhost:8080"
echo "- MQTT Broker: mqtt://localhost:1883"
echo ""
echo "Service management:"
echo "- Stop all services: ./scripts/stop_services.sh"
echo "- Restart services: ./scripts/restart_services.sh"
echo "- Check status: ./scripts/health_check.sh"
echo ""
echo "Logs:"
echo "- View real-time logs: tail -f data/logs/system/*.log"
echo "- Frontend logs: Check browser console"
echo "- Backend logs: Check terminal or data/logs/backend/"
echo ""

# PID 파일 정보 출력
if [ -f "$PIDS_FILE" ]; then
    echo "Running processes (saved in $PIDS_FILE):"
    while IFS=':' read -r service pid; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "- $service: PID $pid ✓"
        else
            echo "- $service: PID $pid ✗ (not running)"
        fi
    done < "$PIDS_FILE"
fi

echo ""
echo "Press Ctrl+C to monitor logs, or run in background."
echo "Use './scripts/stop_services.sh' to stop all services."
