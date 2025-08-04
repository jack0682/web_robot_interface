#!/bin/bash

# Robot Web Dashboard - System Test Script
# 시스템 구성 요소들의 연결 상태를 테스트합니다

echo "🧪 Robot Web Dashboard - System Test"
echo "===================================="
echo ""

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 로그 함수
log_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

# 테스트 결과 카운터
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 테스트 함수
run_test() {
    local test_name=$1
    local test_command=$2
    local expected_result=${3:-0}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Testing: $test_name"
    
    if eval $test_command; then
        if [ $expected_result -eq 0 ]; then
            log_success "$test_name"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            log_error "$test_name (expected failure but passed)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    else
        if [ $expected_result -ne 0 ]; then
            log_success "$test_name (expected failure)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            return 0
        else
            log_error "$test_name"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi
}

# HTTP 응답 테스트
test_http_endpoint() {
    local name=$1
    local url=$2
    local expected_status=${3:-200}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Testing HTTP: $name"
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    
    if [ "$response" = "$expected_status" ]; then
        log_success "$name (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$name (HTTP $response, expected $expected_status)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# JSON 응답 테스트
test_json_endpoint() {
    local name=$1
    local url=$2
    local json_key=$3
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Testing JSON: $name"
    
    local response=$(curl -s "$url" 2>/dev/null)
    local key_value=$(echo "$response" | grep -o "\"$json_key\"[^,}]*" | cut -d'"' -f4)
    
    if [ ! -z "$key_value" ]; then
        log_success "$name ($json_key: $key_value)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$name (JSON key '$json_key' not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# WebSocket 연결 테스트
test_websocket() {
    local name=$1
    local ws_url=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Testing WebSocket: $name"
    
    # Node.js 기반 WebSocket 테스트 (간단한 연결 테스트)
    local test_result=$(node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('$ws_url');
        let success = false;
        
        ws.on('open', () => {
            success = true;
            ws.close();
            process.exit(0);
        });
        
        ws.on('error', () => {
            process.exit(1);
        });
        
        setTimeout(() => {
            if (!success) process.exit(1);
        }, 5000);
    " 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        log_success "$name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_error "$name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# MQTT 토픽 테스트 (모의 데이터)
test_mqtt_topics() {
    log_info "Testing MQTT topic structure..."
    
    # 설정 파일에서 토픽 확인
    if [ -f "mqtt_processor/config/processor.config.json" ]; then
        local topics=$(cat mqtt_processor/config/processor.config.json | grep -o '"name"[^,}]*' | cut -d'"' -f4)
        local topic_count=$(echo "$topics" | wc -l)
        
        if [ $topic_count -gt 0 ]; then
            log_success "MQTT topics configured ($topic_count topics found)"
            echo "         Topics: $(echo $topics | tr '\n' ', ' | sed 's/,$//')"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            log_error "No MQTT topics found in configuration"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        log_error "MQTT configuration file not found"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

# 파일 존재 테스트
test_file_exists() {
    local name=$1
    local file_path=$2
    
    run_test "$name" "[ -f '$file_path' ]"
}

# 디렉토리 존재 테스트  
test_directory_exists() {
    local name=$1
    local dir_path=$2
    
    run_test "$name" "[ -d '$dir_path' ]"
}

# 포트 사용 확인
test_port_available() {
    local name=$1
    local port=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    log_info "Testing port: $name (port $port)"
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_success "$name (port $port is in use)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        log_warning "$name (port $port is not in use - service may be stopped)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# 메인 테스트 실행
main() {
    echo "🔍 Starting system tests..."
    echo ""
    
    # 1. 기본 파일 구조 테스트
    echo "📁 Testing file structure..."
    test_file_exists "MQTT Processor main" "mqtt_processor/index.js"
    test_file_exists "Backend server" "backend/src/server.js"
    test_file_exists "Frontend package" "frontend/package.json"
    test_file_exists "MQTT config" "mqtt_processor/config/processor.config.json"
    echo ""
    
    # 2. 환경 설정 테스트
    echo "🔧 Testing environment configuration..."
    test_file_exists "MQTT Processor .env" "mqtt_processor/.env"
    test_file_exists "Backend .env" "backend/.env"
    test_file_exists "Frontend .env" "frontend/.env"
    echo ""
    
    # 3. 의존성 테스트
    echo "📦 Testing dependencies..."
    test_directory_exists "MQTT Processor modules" "mqtt_processor/node_modules"
    test_directory_exists "Backend modules" "backend/node_modules"
    test_directory_exists "Frontend modules" "frontend/node_modules"
    echo ""
    
    # 4. 포트 테스트 (서비스가 실행 중인 경우)
    echo "🌐 Testing service ports..."
    test_port_available "MQTT Processor WebSocket" "8080"
    test_port_available "Backend API" "5000"
    test_port_available "Frontend Dev Server" "3000"
    echo ""
    
    # 5. HTTP 엔드포인트 테스트 (서비스가 실행 중인 경우)
    echo "🔗 Testing HTTP endpoints..."
    test_http_endpoint "Backend Health Check" "http://localhost:5000/health"
    test_http_endpoint "Backend API Root" "http://localhost:5000/"
    test_http_endpoint "Backend API Docs" "http://localhost:5000/api-docs"
    test_http_endpoint "Frontend" "http://localhost:3000/"
    echo ""
    
    # 6. JSON API 테스트
    echo "📊 Testing API responses..."
    test_json_endpoint "Backend Status" "http://localhost:5000/health" "status"
    test_json_endpoint "Backend Version" "http://localhost:5000/" "version"
    echo ""
    
    # 7. WebSocket 테스트
    echo "🔌 Testing WebSocket connections..."
    if command -v node &> /dev/null; then
        test_websocket "MQTT Processor WebSocket" "ws://localhost:8080"
    else
        log_warning "Node.js not available - skipping WebSocket test"
    fi
    echo ""
    
    # 8. MQTT 설정 테스트
    echo "📡 Testing MQTT configuration..."
    test_mqtt_topics
    echo ""
    
    # 9. 로그 디렉토리 테스트
    echo "📝 Testing log directories..."
    test_directory_exists "MQTT logs directory" "data/logs/mqtt"
    test_directory_exists "Backend logs directory" "data/logs/backend"
    test_directory_exists "System logs directory" "data/logs/system"
    echo ""
    
    # 결과 요약
    echo "📋 Test Results Summary"
    echo "======================"
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        log_success "🎉 All tests passed!"
        echo ""
        echo "✅ System appears to be properly configured"
        echo "   Ready to start with: ./start_system.sh"
        exit 0
    else
        log_error "❌ Some tests failed"
        echo ""
        echo "🔧 Recommendations:"
        
        if [ ! -d "mqtt_processor/node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
            echo "   • Run: npm install in each service directory"
        fi
        
        if [ $FAILED_TESTS -gt $((TOTAL_TESTS / 2)) ]; then
            echo "   • Services may not be running - try: ./start_system.sh"
        fi
        
        echo "   • Check individual service logs"
        echo "   • Verify environment configuration"
        
        exit 1
    fi
}

# 사용법
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quick    Quick test (skip WebSocket and HTTP tests)"
    echo "  -v, --verbose  Verbose output"
    echo ""
}

# 빠른 테스트 (파일 및 설정만)
quick_test() {
    echo "⚡ Running quick tests..."
    echo ""
    
    # 파일 구조만 테스트
    test_file_exists "MQTT Processor" "mqtt_processor/index.js"
    test_file_exists "Backend" "backend/src/server.js"
    test_file_exists "Frontend" "frontend/package.json"
    test_file_exists "Configuration" "mqtt_processor/config/processor.config.json"
    
    echo ""
    echo "Quick test completed: $PASSED_TESTS/$TOTAL_TESTS passed"
}

# 명령행 인수 처리
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    -q|--quick)
        quick_test
        exit 0
        ;;
    -v|--verbose)
        set -x
        main
        ;;
    "")
        main
        ;;
    *)
        log_error "Unknown option: $1"
        show_usage
        exit 1
        ;;
esac
