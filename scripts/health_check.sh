#!/bin/bash

# Health Check Script
# 모든 서비스의 상태를 확인하는 스크립트

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

echo "🏥 Robot Web Dashboard Health Check"
echo "=================================================="

# 시스템 리소스 확인
log_info "Checking system resources..."
echo "CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "Memory Usage: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Disk Usage: $(df -h / | awk 'NR==2{print $5}')"

# 네트워크 포트 확인
log_info "Checking service ports..."

check_port() {
    local port=$1
    local service=$2
    
    if netstat -tuln | grep -q ":$port "; then
        log_success "✓ $service is running on port $port"
        return 0
    else
        log_error "✗ $service is not running on port $port"
        return 1
    fi
}

# 각 서비스 포트 확인
frontend_ok=false
backend_ok=false
mqtt_ws_ok=false
mqtt_broker_ok=false

if check_port 3000 "Frontend"; then
    frontend_ok=true
fi

if check_port 5000 "Backend API"; then
    backend_ok=true
fi

if check_port 8080 "MQTT WebSocket"; then
    mqtt_ws_ok=true
fi

if check_port 1883 "MQTT Broker"; then
    mqtt_broker_ok=true
fi

# HTTP 엔드포인트 확인
log_info "Checking HTTP endpoints..."

check_http() {
    local url=$1
    local service=$2
    local timeout=5
    
    if curl -s --max-time $timeout "$url" > /dev/null 2>&1; then
        log_success "✓ $service is responding"
        return 0
    else
        log_error "✗ $service is not responding"
        return 1
    fi
}

if $backend_ok; then
    check_http "http://localhost:5000/health" "Backend Health Check"
    check_http "http://localhost:5000/api" "Backend API"
fi

if $frontend_ok; then
    check_http "http://localhost:3000" "Frontend"
fi

# WebSocket 연결 확인
log_info "Checking WebSocket connections..."
if $mqtt_ws_ok; then
    if timeout 5 bash -c "</dev/tcp/localhost/8080" 2>/dev/null; then
        log_success "✓ WebSocket server is accepting connections"
    else
        log_warning "WebSocket server may not be accepting connections"
    fi
fi

# 프로세스 상태 확인
log_info "Checking running processes..."

check_process() {
    local process_name=$1
    local count=$(pgrep -f "$process_name" | wc -l)
    
    if [ $count -gt 0 ]; then
        log_success "✓ $process_name: $count process(es) running"
        return 0
    else
        log_error "✗ $process_name: no processes found"
        return 1
    fi
}

check_process "frontend"
check_process "backend"
check_process "mqtt_processor"

# MQTT 브로커 확인
if command -v mosquitto_pub &> /dev/null && $mqtt_broker_ok; then
    log_info "Testing MQTT connectivity..."
    if timeout 5 mosquitto_pub -h localhost -p 1883 -t "test/health" -m "ping" 2>/dev/null; then
        log_success "✓ MQTT broker is accepting connections"
    else
        log_warning "MQTT broker may not be accepting connections"
    fi
fi

# 로그 파일 확인
log_info "Checking log files..."

check_log_file() {
    local log_path=$1
    local service=$2
    
    if [ -f "$log_path" ]; then
        local size=$(stat -f%z "$log_path" 2>/dev/null || stat -c%s "$log_path" 2>/dev/null)
        local age=$(find "$log_path" -mmin -5 2>/dev/null)
        
        if [ -n "$age" ]; then
            log_success "✓ $service log is active (${size} bytes)"
        else
            log_warning "⚠ $service log exists but may be stale"
        fi
    else
        log_warning "⚠ $service log file not found: $log_path"
    fi
}

if [ -d "data/logs" ]; then
    check_log_file "data/logs/backend/app.log" "Backend"
    check_log_file "data/logs/mqtt/processor.log" "MQTT Processor"
    check_log_file "data/logs/system/health.log" "System"
fi

# 디스크 공간 확인
log_info "Checking disk space..."
disk_usage=$(df -h . | awk 'NR==2{print +$5}')
if [ $disk_usage -gt 90 ]; then
    log_error "✗ Disk usage is critical: ${disk_usage}%"
elif [ $disk_usage -gt 80 ]; then
    log_warning "⚠ Disk usage is high: ${disk_usage}%"
else
    log_success "✓ Disk usage is normal: ${disk_usage}%"
fi

# 메모리 사용량 확인
log_info "Checking memory usage..."
memory_usage=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $memory_usage -gt 90 ]; then
    log_error "✗ Memory usage is critical: ${memory_usage}%"
elif [ $memory_usage -gt 80 ]; then
    log_warning "⚠ Memory usage is high: ${memory_usage}%"
else
    log_success "✓ Memory usage is normal: ${memory_usage}%"
fi

# 종합 상태 평가
echo ""
echo "=================================================="

total_checks=0
passed_checks=0

services=(frontend backend mqtt_ws mqtt_broker)
for service in "${services[@]}"; do
    total_checks=$((total_checks + 1))
    eval "status=\$${service}_ok"
    if $status; then
        passed_checks=$((passed_checks + 1))
    fi
done

success_rate=$((passed_checks * 100 / total_checks))

if [ $success_rate -eq 100 ]; then
    log_success "🎉 All systems are healthy! ($passed_checks/$total_checks services running)"
elif [ $success_rate -ge 75 ]; then
    log_warning "⚠️  Most systems are healthy ($passed_checks/$total_checks services running)"
else
    log_error "❌ System health is poor ($passed_checks/$total_checks services running)"
fi

echo "=================================================="
echo ""
echo "Quick actions:"
echo "- Start all services: ./scripts/start_services.sh"
echo "- Stop all services: ./scripts/stop_services.sh"
echo "- View logs: tail -f data/logs/system/*.log"
echo "- Monitor continuously: watch -n 5 ./scripts/health_check.sh"
echo ""

exit $((100 - success_rate))
