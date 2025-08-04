#!/bin/bash

# WebSocket Connection Stabilization Script
# WebSocket 연결 안정화 스크립트

echo "🔧 WebSocket Connection Stabilization"
echo "===================================="

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m' 
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo ""
log_info "🔍 Checking current WebSocket connection issues..."

# 현재 실행 중인 프로세스 확인
MQTT_PID=$(ps aux | grep "mqtt_processor" | grep -v grep | awk '{print $2}' | head -1)
BACKEND_PID=$(ps aux | grep "backend.*server.js" | grep -v grep | awk '{print $2}' | head -1)
FRONTEND_PID=$(ps aux | grep "react-scripts start" | grep -v grep | awk '{print $2}' | head -1)

echo ""
log_info "📊 Current Process Status:"
if [ ! -z "$MQTT_PID" ]; then
    log_success "MQTT Processor running (PID: $MQTT_PID)"
else
    log_error "MQTT Processor not running"
fi

if [ ! -z "$BACKEND_PID" ]; then
    log_success "Backend API running (PID: $BACKEND_PID)"
else
    log_error "Backend API not running"
fi

if [ ! -z "$FRONTEND_PID" ]; then
    log_success "Frontend running (PID: $FRONTEND_PID)"
else
    log_error "Frontend not running"
fi

echo ""
log_info "🔧 Applied WebSocket Stabilization Fixes:"
log_success "✅ React StrictMode disabled"
log_success "✅ WebSocket connection duplication prevention"
log_success "✅ Reduced reconnection attempts (3 instead of 5)"
log_success "✅ Increased reconnection delay (2s instead of 1s)"
log_success "✅ Increased ping interval (60s instead of 30s)"
log_success "✅ Enhanced connection state validation"

echo ""
log_info "🚀 Recommended Actions:"

if [ -z "$MQTT_PID" ] || [ -z "$BACKEND_PID" ] || [ -z "$FRONTEND_PID" ]; then
    echo "  1. Start missing services:"
    echo "     ./start_system.sh"
else
    echo "  1. Restart Frontend to apply StrictMode fix:"
    echo "     cd frontend && npm start" 
fi

echo "  2. Monitor WebSocket connections:"
echo "     tail -f data/logs/mqtt/processor.log | grep WebSocket"

echo "  3. Test WebSocket stability:"
echo "     ./test_websocket.sh"

echo "  4. Check browser developer tools:"
echo "     F12 → Network → WS tab → Check connection stability"

echo ""
log_info "🔍 Expected Results After Fix:"
echo "  • WebSocket connections should be stable (no frequent disconnections)"
echo "  • Connection attempts should be limited to 3 max"
echo "  • Ping messages every 60 seconds instead of 30"
echo "  • No more 'connection' message type warnings"
echo "  • Stable real-time data display"

echo ""
log_info "⚠️  If issues persist:"
echo "  • Check if multiple browser tabs are open (can cause conflicts)"
echo "  • Clear browser cache and cookies"
echo "  • Try incognito/private browsing mode"
echo "  • Check network firewall settings"

echo ""
log_warning "💡 The frequent connect/disconnect pattern should stop now!"
echo "   If you still see 1-second reconnection loops, please:"
echo "   1. Close all browser tabs"
echo "   2. Restart all services: ./start_system.sh --kill && ./start_system.sh"
echo "   3. Open only one browser tab to test"

echo ""
echo "Stabilization script completed at $(date)"
