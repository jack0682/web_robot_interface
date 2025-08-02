#!/bin/bash

# MQTT Processor 실행 스크립트

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

echo "🤖 Starting MQTT Processor for Robot Web Dashboard"
echo "=================================================="

# 현재 디렉토리 확인
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run from mqtt_processor directory."
    exit 1
fi

# Node.js 확인
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed"
    exit 1
fi

log_info "Node.js version: $(node --version)"

# 의존성 설치 확인
if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        log_error "Failed to install dependencies"
        exit 1
    fi
    log_success "Dependencies installed"
fi

# 환경 변수 파일 확인
if [ ! -f ".env" ]; then
    log_warning ".env file not found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        log_info "Please edit .env file with your EMQX Cloud credentials"
        log_info "Required: MQTT_USERNAME and MQTT_PASSWORD"
    else
        log_error ".env.example file not found"
        exit 1
    fi
fi

# 로그 디렉토리 생성
log_info "Creating log directories..."
mkdir -p ../data/logs/mqtt
mkdir -p ../data/cache
mkdir -p ../data/history

# 환경 변수 로드 및 검증
source .env 2>/dev/null || true

if [ -z "$MQTT_USERNAME" ] || [ "$MQTT_USERNAME" = "your_username_here" ]; then
    log_error "MQTT_USERNAME not configured in .env file"
    log_info "Please edit .env file and set your EMQX Cloud credentials"
    exit 1
fi

if [ -z "$MQTT_PASSWORD" ] || [ "$MQTT_PASSWORD" = "your_password_here" ]; then
    log_error "MQTT_PASSWORD not configured in .env file"
    log_info "Please edit .env file and set your EMQX Cloud credentials"
    exit 1
fi

# 연결 테스트 옵션
if [ "$1" = "--test" ]; then
    log_info "Running connection test..."
    node test/test-connection.js
    exit $?
fi

# 개발 모드 확인
if [ "$1" = "--dev" ] || [ "$1" = "-d" ]; then
    log_info "Starting in development mode with nodemon..."
    if command -v nodemon &> /dev/null; then
        exec nodemon index.js
    else
        log_warning "nodemon not found, installing..."
        npm install -g nodemon
        exec nodemon index.js
    fi
fi

# 디버그 모드 확인
if [ "$1" = "--debug" ]; then
    log_info "Starting in debug mode..."
    DEBUG_MODE=true ENABLE_VERBOSE_LOGGING=true node index.js
    exit $?
fi

# 백그라운드 실행 옵션
if [ "$1" = "--daemon" ] || [ "$1" = "-b" ]; then
    log_info "Starting as background daemon..."
    nohup node index.js > ../data/logs/mqtt/processor.out 2>&1 &
    PID=$!
    echo $PID > ../data/logs/mqtt/processor.pid
    log_success "MQTT Processor started as daemon (PID: $PID)"
    log_info "Logs: tail -f ../data/logs/mqtt/processor.out"
    log_info "Stop: kill $PID"
    exit 0
fi

# 도움말
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --test, -t      Run connection test only"
    echo "  --dev, -d       Start in development mode with nodemon"
    echo "  --debug         Start with debug logging enabled"
    echo "  --daemon, -b    Start as background daemon"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  MQTT_USERNAME   EMQX Cloud username (required)"
    echo "  MQTT_PASSWORD   EMQX Cloud password (required)"
    echo "  MQTT_HOST       EMQX Cloud host (default: p021f2cb.ala.asia-southeast1.emqxsl.com)"
    echo "  MQTT_PORT       EMQX Cloud port (default: 8883)"
    echo "  WS_PORT         WebSocket server port (default: 8080)"
    echo "  LOG_LEVEL       Logging level (default: info)"
    echo ""
    echo "Examples:"
    echo "  $0              Start normally"
    echo "  $0 --test       Test EMQX Cloud connection"
    echo "  $0 --dev        Start in development mode"
    echo "  $0 --daemon     Start as background service"
    echo ""
    exit 0
fi

# 네트워크 연결 확인
log_info "Checking network connectivity..."
if ! ping -c 1 -W 5 8.8.8.8 >/dev/null 2>&1; then
    log_warning "Network connectivity check failed"
    log_info "Proceeding anyway, connection test will verify EMQX Cloud access"
fi

# 포트 사용 중인지 확인
WS_PORT=${WS_PORT:-8080}
if lsof -Pi :$WS_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    log_warning "Port $WS_PORT is already in use"
    log_info "WebSocket server may not start properly"
fi

# 시작 정보 출력
log_info "Configuration:"
log_info "  MQTT Host: ${MQTT_HOST:-p021f2cb.ala.asia-southeast1.emqxsl.com}"
log_info "  MQTT Port: ${MQTT_PORT:-8883}"
log_info "  WebSocket Port: ${WS_PORT}"
log_info "  Username: ${MQTT_USERNAME}"
log_info "  Debug Mode: ${DEBUG_MODE:-false}"

# 프로세스 시작
log_success "Starting MQTT Processor..."
log_info "Press Ctrl+C to stop"
echo ""

# Node.js 애플리케이션 실행
exec node index.js
