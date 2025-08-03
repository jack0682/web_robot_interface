#!/bin/bash

# Improved Health Check Script
# 개선된 시스템 상태 확인 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

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

log_check() {
    echo -e "${PURPLE}[CHECK]${NC} $1"
}

# 헬스체크 시작
echo "🏥 Robot Web Dashboard Health Check"
echo "=================================================="

# 현재 디렉토리 확인
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [[ "$SCRIPT_DIR" == *"/scripts" ]]; then
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_DIR"
else
    PROJECT_DIR="$(pwd)"
fi

log_info "Project directory: $PROJECT_DIR"

# 시스템 리소스 확인
log_check "Checking system resources..."

# CPU 사용률 (더 정확한 방법)
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1"%"}')
echo "CPU Usage: ${CPU_USAGE:-"N/A"}"

# 메모리 사용률
if command -v free &> /dev/null; then
    MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')
    echo "Memory Usage: $MEMORY_USAGE"
else
    echo "Memory Usage: N/A (free command not found)"
fi

# 디스크 사용률
DISK_USAGE=$(df / | awk 'NR==2 {print $5}')
echo "Disk Usage: $DISK_USAGE"

# 네트워크 포트 확인 함수
check_port() {
    local port=$1
    local service_name=$2
    
    # 여러 방법으로 포트 확인
    if command -v netstat &> /dev/null; then
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            log_success "✓ $service_name is running on port $port"
            return 0
        fi
    elif command -v ss &> /dev/null; then
        if ss -tuln 2>/dev/null | grep -q ":$port "; then
            log_success "✓ $service_name is running on port $port"
            return 0
        fi
    elif command -v lsof &> /dev/null; then
        if lsof -i :$port 2>/dev/null | grep -q LISTEN; then
            log_success "✓ $service_name is running on port $port"
            return 0
        fi
    else
        # curl/nc를 사용한 연결 테스트
        if curl -s --connect-timeout 1 http://localhost:$port >/dev/null 2>&1; then
            log_success "✓ $service_name is responding on port $port"
            return 0
        elif nc -z localhost $port 2>/dev/null; then
            log_success "✓ $service_name is listening on port $port"
            return 0
        fi
    fi
    
    log_error "✗ $service_name is not running on port $port"
    return 1
}

# 프로세스 확인 함수
check_process() {
    local process_name=$1
    local search_pattern=$2
    
    if pgrep -f "$search_pattern" > /dev/null 2>&1; then
        local pid=$(pgrep -f "$search_pattern" | head -1)
        log_success "✓ $process_name is running (PID: $pid)"
        return 0
    else
        log_error "✗ $process_name: no processes found"
        return 1
    fi
}

# HTTP 엔드포인트 테스트
test_http_endpoint() {
    local url=$1
    local service_name=$2
    
    if curl -s --connect-timeout 3 --max-time 5 "$url" >/dev/null 2>&1; then
        log_success "✓ $service_name HTTP endpoint responding"
        return 0
    else
        log_warning "⚠ $service_name HTTP endpoint not responding"
        return 1
    fi
}

# WebSocket 테스트 (간단한 연결 테스트)
test_websocket() {
    local host=$1
    local port=$2
    local service_name=$3
    
    # nc를 사용한 간단한 연결 테스트
    if command -v nc &> /dev/null; then
        if timeout 2 nc -z "$host" "$port" 2>/dev/null; then
            log_success "✓ $service_name WebSocket port is open"
            return 0
        fi
    fi
    
    log_warning "⚠ $service_name WebSocket connection test failed"
    return 1
}

# 서비스 포트 확인
log_check "Checking service ports..."
SERVICES_RUNNING=0
TOTAL_SERVICES=4

if check_port 3000 "Frontend"; then ((SERVICES_RUNNING++)); fi
if check_port 5000 "Backend API"; then ((SERVICES_RUNNING++)); fi
if check_port 8080 "MQTT WebSocket"; then ((SERVICES_RUNNING++)); fi
if check_port 1883 "MQTT Broker"; then ((SERVICES_RUNNING++)); fi

# HTTP 엔드포인트 확인
log_check "Checking HTTP endpoints..."
test_http_endpoint "http://localhost:3000" "Frontend"
test_http_endpoint "http://localhost:5000" "Backend API"
test_http_endpoint "http://localhost:8080/status" "MQTT Processor"

# WebSocket 연결 확인
log_check "Checking WebSocket connections..."
test_websocket "localhost" 8080 "MQTT Processor"

# 프로세스 확인
log_check "Checking running processes..."
check_process "frontend" "npm.*start.*frontend"
check_process "backend" "node.*server.js"
check_process "mqtt_processor" "node.*index.js"

# Node.js 프로세스 전체 확인
NODE_PROCESSES=$(pgrep -f "node" | wc -l)
if [ "$NODE_PROCESSES" -gt 0 ]; then
    log_info "Found $NODE_PROCESSES Node.js processes running"
    echo "Node.js processes:"
    ps aux | grep -E "(node|npm)" | grep -v grep | awk '{print "  PID:", $2, "CMD:", $11, $12, $13, $14, $15}'
else
    log_warning "No Node.js processes found"
fi

# 로그 파일 확인
log_check "Checking log files..."
LOG_DIRS=("data/logs/backend" "data/logs/mqtt" "data/logs/system")
for log_dir in "${LOG_DIRS[@]}"; do
    if [ -d "$log_dir" ]; then
        log_files=$(find "$log_dir" -name "*.log" 2>/dev/null)
        if [ -n "$log_files" ]; then
            log_success "✓ Log files found in $log_dir"
        else
            log_warning "⚠ No log files in $log_dir"
        fi
    else
        log_warning "⚠ Log directory not found: $log_dir"
    fi
done

# PID 파일 확인
if [ -f ".service_pids" ]; then
    log_info "Service PID file found:"
    while IFS=':' read -r service pid; do
        if kill -0 "$pid" 2>/dev/null; then
            log_success "  ✓ $service: PID $pid (running)"
        else
            log_error "  ✗ $service: PID $pid (not running)"
        fi
    done < .service_pids
else
    log_warning "No service PID file found"
fi

# 리소스 상태 확인
log_check "Checking system resources..."

# 디스크 공간
DISK_USAGE_NUM=$(echo $DISK_USAGE | sed 's/%//')
if [ "$DISK_USAGE_NUM" -lt 80 ]; then
    log_success "✓ Disk usage is normal: $DISK_USAGE"
else
    log_warning "⚠ Disk usage is high: $DISK_USAGE"
fi

# 메모리 사용량
if [ -n "$MEMORY_USAGE" ]; then
    MEMORY_USAGE_NUM=$(echo $MEMORY_USAGE | sed 's/%//')
    if [ "$MEMORY_USAGE_NUM" -lt 80 ]; then
        log_success "✓ Memory usage is normal: $MEMORY_USAGE"
    else
        log_warning "⚠ Memory usage is high: $MEMORY_USAGE"
    fi
fi

# 네트워크 연결성 테스트
log_check "Testing network connectivity..."
if ping -c 1 google.com >/dev/null 2>&1; then
    log_success "✓ Internet connectivity is working"
else
    log_warning "⚠ Internet connectivity issues detected"
fi

# 최종 상태 평가
echo ""
echo "=================================================="

if [ "$SERVICES_RUNNING" -eq "$TOTAL_SERVICES" ]; then
    log_success "🎉 System health is excellent ($SERVICES_RUNNING/$TOTAL_SERVICES services running)"
    HEALTH_STATUS="excellent"
elif [ "$SERVICES_RUNNING" -ge 2 ]; then
    log_warning "⚠ System health is partial ($SERVICES_RUNNING/$TOTAL_SERVICES services running)"
    HEALTH_STATUS="partial"
else
    log_error "❌ System health is poor ($SERVICES_RUNNING/$TOTAL_SERVICES services running)"
    HEALTH_STATUS="poor"
fi

echo "=================================================="

# 추천 액션
echo ""
echo "📋 Recommended Actions:"

if [ "$HEALTH_STATUS" = "poor" ]; then
    echo "- Install missing tools: ./scripts/install_tools.sh"
    echo "- Start all services: ./scripts/start_services.sh"
    echo "- Check service logs for errors"
elif [ "$HEALTH_STATUS" = "partial" ]; then
    echo "- Check which services failed to start"
    echo "- Review service logs: tail -f data/logs/*/*.log"
    echo "- Restart failed services individually"
else
    echo "- System is running well!"
    echo "- Monitor with: watch -n 5 ./scripts/health_check.sh"
fi

echo ""
echo "🔧 Quick Commands:"
echo "- Start services: ./scripts/start_services.sh"
echo "- Stop services: ./scripts/stop_services.sh" 
echo "- View frontend: http://localhost:3000"
echo "- View backend API: http://localhost:5000"
echo "- View MQTT status: http://localhost:8080/status"
echo "- Install tools: ./scripts/install_tools.sh"
echo ""

# 상세 진단 정보 (옵션)
if [ "$1" = "--detailed" ] || [ "$1" = "-d" ]; then
    echo "🔍 Detailed Diagnostic Information:"
    echo "=================================="
    
    echo "Environment Variables:"
    echo "NODE_ENV: ${NODE_ENV:-"not set"}"
    echo "PATH: $PATH"
    echo ""
    
    echo "Node.js Information:"
    if command -v node &> /dev/null; then
        echo "Node.js version: $(node -v)"
        echo "npm version: $(npm -v)"
    else
        echo "Node.js not found"
    fi
    echo ""
    
    echo "System Information:"
    echo "OS: $(uname -a)"
    echo "User: $(whoami)"
    echo "Working Directory: $(pwd)"
    echo ""
fi