#!/bin/bash

# MQTT 연결 문제 해결 스크립트
set -e

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

echo "🔧 MQTT 연결 문제 해결 중..."
echo "================================="

# 1. 기존 프로세스 정리
log_info "기존 프로세스 정리 중..."
pkill -f "node.*mqtt_processor" 2>/dev/null || true
pkill -f "node.*backend" 2>/dev/null || true
pkill -f "node.*frontend" 2>/dev/null || true
sleep 2

# 2. 프로젝트 디렉토리로 이동
cd "$(dirname "$0")/.."
PROJECT_DIR="$(pwd)"
log_info "프로젝트 디렉토리: $PROJECT_DIR"

# 3. 의존성 설치 확인
log_info "의존성 설치 확인 및 업데이트..."
for dir in "mqtt_processor" "backend" "frontend"; do
    if [ -d "$dir" ]; then
        log_info "Checking $dir dependencies..."
        cd "$dir"
        if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
            log_info "Installing dependencies for $dir..."
            npm install
        fi
        cd "$PROJECT_DIR"
    fi
done

# 4. MQTT Processor 시작 (첫 번째)
log_info "MQTT Processor 시작 중..."
cd mqtt_processor
npm start &
MQTT_PID=$!
cd "$PROJECT_DIR"
log_success "MQTT Processor 시작됨 (PID: $MQTT_PID)"

# 5. MQTT Processor가 준비될 때까지 대기
log_info "MQTT Processor 준비 대기 중..."
for i in {1..30}; do
    if netstat -tuln 2>/dev/null | grep -q ":8080" || ss -tuln 2>/dev/null | grep -q ":8080"; then
        log_success "✓ MQTT Processor가 8080 포트에서 실행 중"
        break
    fi
    
    if [ $i -eq 30 ]; then
        log_warning "MQTT Processor 시작에 시간이 오래 걸리고 있습니다."
        break
    fi
    
    sleep 1
done

# 6. Backend 시작 (두 번째)
log_info "Backend 시작 중..."
sleep 3  # 추가 대기 시간
cd backend
npm start &
BACKEND_PID=$!
cd "$PROJECT_DIR"
log_success "Backend 시작됨 (PID: $BACKEND_PID)"

# 7. Backend 준비 대기
log_info "Backend 준비 대기 중..."
for i in {1..20}; do
    if curl -s "http://localhost:5000/health" > /dev/null 2>&1; then
        log_success "✓ Backend가 5000 포트에서 실행 중"
        break
    fi
    sleep 1
done

# 8. 연결 상태 확인
log_info "서비스 연결 상태 확인 중..."

# WebSocket 연결 테스트
check_websocket() {
    if command -v wscat &> /dev/null; then
        echo '{"type":"get_status"}' | timeout 5 wscat -c ws://localhost:8080 2>/dev/null && return 0
    fi
    return 1
}

if check_websocket; then
    log_success "✓ WebSocket 연결 성공"
else
    log_warning "WebSocket 연결 테스트 실패 (wscat가 없거나 연결 불가)"
fi

# 9. 상태 점검
echo ""
echo "================================="
log_info "최종 상태 점검"
echo "================================="

# 프로세스 확인
if kill -0 "$MQTT_PID" 2>/dev/null; then
    log_success "✓ MQTT Processor 실행 중 (PID: $MQTT_PID)"
else
    log_warning "✗ MQTT Processor 문제 발생"
fi

if kill -0 "$BACKEND_PID" 2>/dev/null; then
    log_success "✓ Backend 실행 중 (PID: $BACKEND_PID)"
else
    log_warning "✗ Backend 문제 발생"
fi

# 포트 확인
for port in 8080 5000; do
    if netstat -tuln 2>/dev/null | grep -q ":$port" || ss -tuln 2>/dev/null | grep -q ":$port"; then
        log_success "✓ 포트 $port 사용 중"
    else
        log_warning "✗ 포트 $port 사용되지 않음"
    fi
done

# Backend health check
if curl -s "http://localhost:5000/health" | grep -q "healthy\|degraded"; then
    log_success "✓ Backend health check 통과"
    echo ""
    echo "Backend 상태:"
    curl -s "http://localhost:5000/health" | jq '.' 2>/dev/null || curl -s "http://localhost:5000/health"
else
    log_warning "✗ Backend health check 실패"
fi

echo ""
echo "================================="
log_success "해결 시도 완료!"
echo "================================="
echo ""
echo "서비스 URL:"
echo "- Backend API: http://localhost:5000"
echo "- Backend Health: http://localhost:5000/health"
echo "- WebSocket: ws://localhost:8080"
echo ""
echo "문제가 지속되면 다음을 확인하세요:"
echo "1. 로그 확인: tail -f mqtt_processor/logs/* backend/logs/*"
echo "2. 포트 충돌: netstat -tuln | grep -E '8080|5000'"
echo "3. 방화벽 설정"
echo ""

# PID 저장
echo "mqtt_processor:$MQTT_PID" > .service_pids
echo "backend:$BACKEND_PID" >> .service_pids

echo "서비스 중지: kill $MQTT_PID $BACKEND_PID"
echo "또는: ./scripts/stop_services.sh"
