#!/bin/bash

# Quick Fix for Proxy Port Issues
# 프록시 포트 문제 빠른 수정 스크립트

echo "🔧 Robot Web Dashboard - Port Fix Script"
echo "========================================"

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
    echo -e "${GREEN}[FIXED]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

echo ""
log_info "🔍 Checking current port configurations..."

# Frontend package.json 프록시 설정 확인
if grep -q '"proxy": "http://localhost:8081"' frontend/package.json; then
    log_warning "Found incorrect proxy port in frontend/package.json"
    sed -i 's/"proxy": "http:\/\/localhost:8081"/"proxy": "http:\/\/localhost:5000"/g' frontend/package.json
    log_success "Fixed proxy port: 8081 → 5000"
fi

# Frontend .env 파일 확인
if [ -f "frontend/.env" ]; then
    if grep -q "REACT_APP_WS_URL=ws://localhost:5000" frontend/.env; then
        log_warning "Found incorrect WebSocket URL in frontend/.env"
        sed -i 's/REACT_APP_WS_URL=ws:\/\/localhost:5000/REACT_APP_WS_URL=ws:\/\/localhost:8080/g' frontend/.env
        log_success "Fixed WebSocket URL: 5000 → 8080"
    fi
    
    if grep -q "REACT_APP_MQTT_BROKER_URL=ws://localhost:9001" frontend/.env; then
        log_warning "Found incorrect MQTT broker URL in frontend/.env"
        sed -i 's/REACT_APP_MQTT_BROKER_URL=ws:\/\/localhost:9001/REACT_APP_MQTT_BROKER_URL=ws:\/\/localhost:8080/g' frontend/.env
        log_success "Fixed MQTT broker URL: 9001 → 8080"
    fi
fi

# Backend 포트 확인
if [ -f "backend/.env" ]; then
    if ! grep -q "PORT=5000" backend/.env; then
        echo "PORT=5000" >> backend/.env
        log_success "Ensured Backend port is set to 5000"
    fi
fi

# MQTT Processor 포트 확인
if [ -f "mqtt_processor/.env" ]; then
    if grep -q "WS_PORT=9001" mqtt_processor/.env; then
        log_warning "Found incorrect WebSocket port in mqtt_processor/.env"
        sed -i 's/WS_PORT=9001/WS_PORT=8080/g' mqtt_processor/.env
        log_success "Fixed MQTT Processor WebSocket port: 9001 → 8080"
    fi
fi

echo ""
log_info "📋 Current Port Configuration:"
echo "  ├── Frontend (React): 3000"
echo "  ├── Backend (API): 5000"
echo "  └── MQTT Processor (WebSocket): 8080"

echo ""
log_info "🔄 Port Mapping:"
echo "  ├── Frontend → Backend API: localhost:3000 → localhost:5000 (proxy)"
echo "  ├── Frontend → WebSocket: ws://localhost:8080"
echo "  └── Backend → MQTT Processor: ws://localhost:8080"

echo ""
log_success "✅ Port configuration fixed!"

echo ""
log_info "🚀 Next steps:"
echo "  1. Stop all running services (Ctrl+C if running)"
echo "  2. Restart services: ./start_system.sh"
echo "  3. Or restart frontend only: cd frontend && npm start"

echo ""
log_info "🔍 Verify connections:"
echo "  • Backend Health: curl http://localhost:5000/health"
echo "  • WebSocket Test: ./test_system.sh"
echo "  • Web Dashboard: http://localhost:3000"

echo ""
log_warning "⚠️  Remember to restart the services for changes to take effect!"
