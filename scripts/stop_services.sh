#!/bin/bash

# Stop All Services Script
# 모든 서비스를 정지하는 스크립트

# 색상 정의
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

echo "🛑 Stopping Robot Web Dashboard Services"
echo "=================================================="

PROJECT_DIR="$(pwd)"
PIDS_FILE="$PROJECT_DIR/.service_pids"

# PID 파일에서 서비스 정지
if [ -f "$PIDS_FILE" ]; then
    log_info "Stopping services from PID file..."
    
    while IFS=':' read -r service pid; do
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping $service (PID: $pid)..."
            kill "$pid"
            
            # 프로세스가 정상적으로 종료될 때까지 대기
            local wait_count=0
            while kill -0 "$pid" 2>/dev/null && [ $wait_count -lt 10 ]; do
                sleep 1
                ((wait_count++))
            done
            
            # 강제 종료가 필요한 경우
            if kill -0 "$pid" 2>/dev/null; then
                log_warning "Force killing $service (PID: $pid)..."
                kill -9 "$pid"
            fi
            
            log_success "$service stopped"
        else
            log_info "$service (PID: $pid) was already stopped"
        fi
    done < "$PIDS_FILE"
    
    rm "$PIDS_FILE"
    log_success "PID file removed"
else
    log_warning "No PID file found. Attempting to stop services by name..."
fi

# 프로세스 이름으로 정지 (fallback)
log_info "Checking for remaining processes..."

# Node.js 기반 서비스들 정지
for service in "frontend" "backend" "mqtt_processor"; do
    pids=$(pgrep -f "$service" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        log_info "Found remaining $service processes: $pids"
        echo "$pids" | xargs kill 2>/dev/null || true
        sleep 1
        
        # 강제 종료가 필요한 경우
        remaining_pids=$(pgrep -f "$service" 2>/dev/null || true)
        if [ -n "$remaining_pids" ]; then
            log_warning "Force killing remaining $service processes..."
            echo "$remaining_pids" | xargs kill -9 2>/dev/null || true
        fi
        log_success "$service processes stopped"
    fi
done

# 특정 포트에서 실행 중인 프로세스 정지
log_info "Checking for processes on service ports..."

ports=(3000 5000 8080)
for port in "${ports[@]}"; do
    pid=$(lsof -ti:$port 2>/dev/null || true)
    if [ -n "$pid" ]; then
        log_info "Stopping process on port $port (PID: $pid)..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        
        # 여전히 실행 중이면 강제 종료
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
        log_success "Process on port $port stopped"
    fi
done

# MQTT 브로커 정지 (선택사항)
read -p "Stop MQTT broker (mosquitto)? [y/N]: " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if pgrep -f "mosquitto" > /dev/null; then
        log_info "Stopping MQTT broker..."
        pkill mosquitto
        log_success "MQTT broker stopped"
    else
        log_info "MQTT broker was not running"
    fi
fi

# 정리 작업
log_info "Cleaning up temporary files..."

# 임시 파일들 정리
temp_files=(
    "frontend/.next"
    "frontend/node_modules/.cache"
    "backend/node_modules/.cache"
    "mqtt_processor/node_modules/.cache"
)

for temp_file in "${temp_files[@]}"; do
    if [ -d "$temp_file" ]; then
        rm -rf "$temp_file"
        log_info "Cleaned: $temp_file"
    fi
done

# 로그 로테이션 (로그 파일이 너무 큰 경우)
if [ -d "data/logs" ]; then
    find data/logs -name "*.log" -size +10M -exec gzip {} \;
    log_info "Large log files compressed"
fi

echo ""
echo "=================================================="
log_success "🛑 All services stopped successfully!"
echo "=================================================="
echo ""
echo "To start services again:"
echo "  ./scripts/start_services.sh"
echo ""
echo "To check if all processes are stopped:"
echo "  ./scripts/health_check.sh"
echo ""
