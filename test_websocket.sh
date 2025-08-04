#!/bin/bash

# WebSocket Connection Test Script
# WebSocket 연결 테스트 및 디버깅 스크립트

echo "🔌 WebSocket Connection Test"
echo "============================"

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m' 
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo ""
log_info "🔍 Testing WebSocket connection to MQTT Processor..."

# WebSocket 연결 테스트 (Node.js 사용)
if command -v node &> /dev/null; then
    log_info "Using Node.js WebSocket test"
    
    # WebSocket 테스트 스크립트 생성
    cat << 'EOF' > /tmp/ws_test.js
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');
let messageCount = 0;

ws.on('open', function open() {
    console.log('✅ WebSocket connection opened');
    
    // 연결 확인 메시지 전송
    const connectionMessage = {
        type: 'connection',
        clientId: 'test_client',
        timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(connectionMessage));
    console.log('📤 Connection message sent');
    
    // 상태 조회 메시지 전송
    setTimeout(() => {
        ws.send(JSON.stringify({
            type: 'get_status',
            timestamp: new Date().toISOString()
        }));
        console.log('📤 Status request sent');
    }, 100);
    
    // 3초 후 연결 종료
    setTimeout(() => {
        console.log('🔌 Closing connection...');
        ws.close(1000);
    }, 3000);
});

ws.on('message', function message(data) {
    messageCount++;
    try {
        const parsed = JSON.parse(data.toString());
        console.log(`📨 Message ${messageCount} received:`, {
            type: parsed.type,
            timestamp: parsed.timestamp,
            data_keys: Object.keys(parsed).join(', ')
        });
    } catch (error) {
        console.log(`📨 Raw message ${messageCount}:`, data.toString().substring(0, 100));
    }
});

ws.on('error', function error(err) {
    console.error('❌ WebSocket error:', err.message);
    process.exit(1);
});

ws.on('close', function close(code, reason) {
    console.log(`🔌 WebSocket closed: ${code} ${reason}`);
    console.log(`📊 Total messages received: ${messageCount}`);
    
    if (messageCount > 0) {
        console.log('✅ WebSocket test completed successfully');
        process.exit(0);
    } else {
        console.log('❌ No messages received');
        process.exit(1);
    }
});

// 타임아웃 설정 (10초)
setTimeout(() => {
    console.log('⏰ Test timeout');
    process.exit(1);
}, 10000);
EOF

    # WebSocket 테스트 실행
    if node /tmp/ws_test.js; then
        log_success "WebSocket connection test passed"
    else
        log_error "WebSocket connection test failed"
        echo ""
        log_info "💡 Troubleshooting steps:"
        echo "  1. Check if MQTT Processor is running: ps aux | grep node"
        echo "  2. Check port 8080: netstat -tulpn | grep 8080"
        echo "  3. Check MQTT Processor logs: tail -f data/logs/mqtt/processor.log"
        echo "  4. Restart MQTT Processor: cd mqtt_processor && npm start"
    fi
    
    # 임시 파일 정리
    rm -f /tmp/ws_test.js
else
    log_warning "Node.js not available - skipping WebSocket test"
fi

echo ""
log_info "🌐 Testing service ports..."

# 포트 상태 확인
check_port() {
    local port=$1
    local service=$2
    
    if netstat -tulpn 2>/dev/null | grep -q ":$port "; then
        log_success "$service is listening on port $port"
        
        # 프로세스 정보 출력
        local pid=$(netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' | cut -d'/' -f1 | head -1)
        if [ ! -z "$pid" ]; then
            local cmd=$(ps -p $pid -o comm= 2>/dev/null)
            echo "         Process: $cmd (PID: $pid)"
        fi
    else
        log_error "$service is NOT listening on port $port"
    fi
}

check_port 8080 "MQTT Processor (WebSocket)"
check_port 5000 "Backend API"
check_port 3000 "Frontend Dev Server"

echo ""
log_info "🔗 Testing HTTP endpoints..."

# HTTP 엔드포인트 테스트
test_http() {
    local url=$1
    local name=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        log_success "$name is responding"
    else
        log_error "$name is not responding"
        echo "         URL: $url"
    fi
}

test_http "http://localhost:5000/health" "Backend Health Check"
test_http "http://localhost:5000/" "Backend Root"
test_http "http://localhost:3000/" "Frontend"

echo ""
log_info "📋 System Information:"
echo "  • Node.js: $(node --version 2>/dev/null || echo 'Not available')"
echo "  • npm: $(npm --version 2>/dev/null || echo 'Not available')"
echo "  • WebSocket URL: ws://localhost:8080"
echo "  • Backend API: http://localhost:5000"
echo "  • Frontend: http://localhost:3000"

echo ""
log_info "📝 Log files to check:"
echo "  • MQTT Processor: data/logs/mqtt/processor.log"
echo "  • Backend: data/logs/backend/app.log"
echo "  • System logs: data/logs/system/*.log"

echo ""
log_info "🚀 Quick fixes:"
echo "  • Restart services: ./start_system.sh"
echo "  • Fix ports: ./fix_ports.sh"
echo "  • Kill all services: ./start_system.sh --kill"

echo ""
echo "Test completed at $(date)"
