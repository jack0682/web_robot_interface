#!/bin/bash

# Start All Services Script - Fixed Version
# 상위 디렉토리로 이동 후 서비스 시작

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

# 스크립트가 scripts 폴더에서 실행되는 경우 상위 디렉토리로 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [[ "$SCRIPT_DIR" == *"/scripts" ]]; then
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    log_info "Moving to project directory: $PROJECT_DIR"
    cd "$PROJECT_DIR"
else
    PROJECT_DIR="$(pwd)"
fi

log_info "Working directory: $(pwd)"

PIDS_FILE="$PROJECT_DIR/.service_pids"

# 기존 PID 파일 정리
if [ -f "$PIDS_FILE" ]; then
    rm "$PIDS_FILE"
fi

# 디렉토리 존재 확인
log_info "Checking service directories..."
for dir in "frontend" "backend" "mqtt_processor"; do
    if [ -d "$dir" ]; then
        log_success "✓ Found $dir directory"
    else
        log_warning "✗ Missing $dir directory"
    fi
done

# MQTT 브로커 시작 (필요한 경우)
log_info "Checking MQTT broker..."
if ! pgrep -f "mosquitto" > /dev/null; then
    if command -v mosquitto &> /dev/null; then
        log_info "Starting Mosquitto MQTT broker..."
        mosquitto -d
        sleep 2
        log_success "MQTT broker started"
    else
        log_warning "MQTT broker not found. Starting services without local broker."
        log_info "You can use external MQTT broker or install mosquitto:"
        log_info "  sudo apt update && sudo apt install mosquitto mosquitto-clients"
    fi
else
    log_info "MQTT broker already running"
fi

# MQTT Processor 시작
if [ -d "mqtt_processor" ]; then
    log_info "Starting MQTT Processor..."
    cd mqtt_processor
    
    # 의존성 확인
    if [ ! -d "node_modules" ]; then
        log_info "Installing MQTT Processor dependencies..."
        npm install
    fi
    
    npm start &
    MQTT_PID=$!
    echo "mqtt_processor:$MQTT_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "MQTT Processor started (PID: $MQTT_PID)"
    sleep 2
else
    log_warning "MQTT Processor directory not found in $(pwd)"
fi

# Backend 시작
if [ -d "backend" ]; then
    log_info "Starting Backend server..."
    cd backend
    
    # 의존성 확인
    if [ ! -d "node_modules" ]; then
        log_info "Installing Backend dependencies..."
        npm install
    fi
    
    npm start &
    BACKEND_PID=$!
    echo "backend:$BACKEND_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "Backend server started (PID: $BACKEND_PID)"
    sleep 2
else
    log_warning "Backend directory not found in $(pwd)"
fi

# Frontend 시작 (개발 모드)
if [ -d "frontend" ]; then
    log_info "Starting Frontend development server..."
    cd frontend
    
    # 의존성 확인
    if [ ! -d "node_modules" ]; then
        log_info "Installing Frontend dependencies..."
        npm install
    fi
    
    npm start &
    FRONTEND_PID=$!
    echo "frontend:$FRONTEND_PID" >> "$PROJECT_DIR/$PIDS_FILE"
    cd "$PROJECT_DIR"
    log_success "Frontend server started (PID: $FRONTEND_PID)"
    sleep 3
else
    log_warning "Frontend directory not found in $(pwd)"
fi

# 서비스 상태 확인
log_info "Verifying services..."

check_service() {
    local service_name=$1
    local port=$2
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s "http://localhost:$port" > /dev/null 2>&1 || nc -z localhost $port 2>/dev/null; then
            log_success "✓ $service_name is responding on port $port"
            return 0
        fi
        
        log_info "Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_warning "! $service_name may need more time to start on port $port"
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
    if netstat -tuln 2>/dev/null | grep -q ":8080" || ss -tuln 2>/dev/null | grep -q ":8080"; then
        log_success "✓ WebSocket server is listening on port 8080"
    else
        log_warning "WebSocket server may need more time to start"
    fi
fi

echo ""
echo "=================================================="
log_success "🎉 Services startup completed!"
echo "=================================================="
echo ""
echo "Service URLs:"
echo "- Frontend Dashboard: http://localhost:3000"
echo "- Backend API: http://localhost:5000"
echo "- WebSocket: ws://localhost:8080"
echo "- MQTT Broker: mqtt://localhost:1883"
echo ""

# 실제 실행된 서비스 확인
if [ -f "$PIDS_FILE" ]; then
    echo "Running services:"
    while IFS=':' read -r service pid; do
        if kill -0 "$pid" 2>/dev/null; then
            echo "- $service: PID $pid ✓"
        else
            echo "- $service: PID $pid ✗ (may have failed to start)"
        fi
    done < "$PIDS_FILE"
    echo ""
fi

echo "Service management:"
echo "- Stop all services: ./scripts/stop_services.sh"
echo "- Restart services: ./scripts/restart_services.sh"
echo "- Check status: ./scripts/health_check.sh"
echo ""
echo "Troubleshooting:"
echo "- Check individual service logs in their directories"
echo "- Ensure all dependencies are installed: npm run install:all"
echo "- Verify ports are not in use: netstat -tuln | grep -E '3000|5000|8080'"
echo ""

# 의존성이 설치되지 않은 경우 안내
missing_deps=false
for dir in "frontend" "backend" "mqtt_processor"; do
    if [ -d "$dir" ] && [ ! -d "$dir/node_modules" ]; then
        if [ "$missing_deps" = false ]; then
            echo "⚠️  Some services may need dependency installation:"
            missing_deps=true
        fi
        echo "- cd $dir && npm install"
    fi
done

if [ "$missing_deps" = true ]; then
    echo ""
    echo "Or run: npm run install:all"
    echo ""
fi

echo "Press Ctrl+C to monitor logs, or run in background."
echo "Use './scripts/stop_services.sh' to stop all services."