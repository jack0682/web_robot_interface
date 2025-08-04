#!/bin/bash

# Robot Web Dashboard - Complete System Startup Script
# 전체 시스템을 올바른 순서로 시작합니다

echo "🤖 Robot Web Dashboard - System Startup"
echo "========================================"
echo ""

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
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

# PID 파일 정리 함수
cleanup_pids() {
    if [ -f .service_pids ]; then
        log_info "Cleaning up previous service PIDs..."
        while read -r line; do
            if [ ! -z "$line" ]; then
                SERVICE=$(echo $line | cut -d: -f1)
                PID=$(echo $line | cut -d: -f2)
                if kill -0 $PID 2>/dev/null; then
                    log_warning "Stopping previous $SERVICE (PID: $PID)"
                    kill $PID 2>/dev/null
                fi
            fi
        done < .service_pids
        rm .service_pids
    fi
}

# 종료 시그널 핸들러
cleanup_on_exit() {
    echo ""
    log_info "🛑 Shutting down all services..."
    
    if [ -f .service_pids ]; then
        while read -r line; do
            if [ ! -z "$line" ]; then
                SERVICE=$(echo $line | cut -d: -f1)
                PID=$(echo $line | cut -d: -f2)
                if kill -0 $PID 2>/dev/null; then
                    log_info "Stopping $SERVICE (PID: $PID)"
                    kill -TERM $PID 2>/dev/null
                    
                    # 3초 대기 후 강제 종료
                    sleep 3
                    if kill -0 $PID 2>/dev/null; then
                        log_warning "Force stopping $SERVICE"
                        kill -KILL $PID 2>/dev/null
                    fi
                fi
            fi
        done < .service_pids
        rm .service_pids
    fi
    
    log_success "✅ All services stopped"
    exit 0
}

# 트랩 설정
trap cleanup_on_exit SIGINT SIGTERM

# 포트 사용 여부 확인 함수
check_port() {
    local port=$1
    local service=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
        log_warning "Port $port is already in use (required for $service)"
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        log_info "Process using port $port: PID $pid"
        
        read -p "Kill process and continue? (y/N): " -r
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill $pid 2>/dev/null
            sleep 2
            if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null; then
                log_error "Failed to free port $port"
                return 1
            fi
            log_success "Port $port freed"
        else
            log_error "Cannot start $service - port $port in use"
            return 1
        fi
    fi
    return 0
}

# 의존성 확인 함수
check_dependencies() {
    log_info "🔍 Checking dependencies..."
    
    # Node.js 확인
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found. Please install Node.js 18.x or higher"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 18 ]; then
        log_error "Node.js version 18.x or higher required. Current: $(node --version)"
        exit 1
    fi
    
    # npm 확인
    if ! command -v npm &> /dev/null; then
        log_error "npm not found. Please install npm"
        exit 1
    fi
    
    log_success "✅ Dependencies check passed"
}

# 로그 디렉토리 생성
setup_directories() {
    log_info "📁 Setting up directories..."
    
    mkdir -p data/logs/mqtt
    mkdir -p data/logs/backend
    mkdir -p data/logs/system
    
    log_success "✅ Directories created"
}

# 패키지 설치 확인
check_packages() {
    log_info "📦 Checking package installations..."
    
    # MQTT Processor 패키지
    if [ ! -d "mqtt_processor/node_modules" ]; then
        log_info "Installing MQTT Processor packages..."
        cd mqtt_processor && npm install
        if [ $? -ne 0 ]; then
            log_error "Failed to install MQTT Processor packages"
            exit 1
        fi
        cd ..
    fi
    
    # Backend 패키지
    if [ ! -d "backend/node_modules" ]; then
        log_info "Installing Backend packages..."
        cd backend && npm install
        if [ $? -ne 0 ]; then
            log_error "Failed to install Backend packages"
            exit 1
        fi
        cd ..
    fi
    
    # Frontend 패키지
    if [ ! -d "frontend/node_modules" ]; then
        log_info "Installing Frontend packages..."
        cd frontend && npm install
        if [ $? -ne 0 ]; then
            log_error "Failed to install Frontend packages"
            exit 1
        fi
        cd ..
    fi
    
    log_success "✅ All packages installed"
}

# 환경 설정 확인
check_environment() {
    log_info "🔧 Checking environment configuration..."
    
    # MQTT Processor .env 확인
    if [ ! -f "mqtt_processor/.env" ]; then
        if [ -f "mqtt_processor/.env.example" ]; then
            log_info "Creating MQTT Processor .env from example"
            cp mqtt_processor/.env.example mqtt_processor/.env
        else
            log_error "MQTT Processor .env file missing"
            exit 1
        fi
    fi
    
    # Backend .env 확인
    if [ ! -f "backend/.env" ]; then
        if [ -f "backend/.env.example" ]; then
            log_info "Creating Backend .env from example"
            cp backend/.env.example backend/.env
        else
            log_error "Backend .env file missing"
            exit 1
        fi
    fi
    
    # Frontend .env 확인
    if [ ! -f "frontend/.env" ]; then
        if [ -f "frontend/.env.example" ]; then
            log_info "Creating Frontend .env from example"
            cp frontend/.env.example frontend/.env
        else
            log_error "Frontend .env file missing"
            exit 1
        fi
    fi
    
    log_success "✅ Environment configuration ready"
}

# 서비스 시작 함수
start_service() {
    local service_name=$1
    local service_dir=$2
    local start_command=$3
    local port=$4
    local wait_time=${5:-5}
    
    log_info "🚀 Starting $service_name..."
    
    # 포트 확인
    if [ ! -z "$port" ]; then
        check_port $port "$service_name" || return 1
    fi
    
    # 서비스 시작
    cd $service_dir
    $start_command > "../data/logs/system/${service_name,,}.log" 2>&1 &
    local pid=$!
    cd ..
    
    # PID 기록
    echo "${service_name}:${pid}" >> .service_pids
    
    # 서비스 시작 대기
    log_info "Waiting for $service_name to start (PID: $pid)..."
    sleep $wait_time
    
    # 프로세스 확인
    if kill -0 $pid 2>/dev/null; then
        log_success "✅ $service_name started successfully (PID: $pid)"
        if [ ! -z "$port" ]; then
            log_info "   🌐 Available at: http://localhost:$port"
        fi
        return 0
    else
        log_error "❌ $service_name failed to start"
        log_info "Check logs: data/logs/system/${service_name,,}.log"
        return 1
    fi
}

# 서비스 상태 확인
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=${3:-10}
    
    log_info "🔍 Checking $service_name health..."
    
    for i in $(seq 1 $max_attempts); do
        if curl -s -f "$health_url" > /dev/null 2>&1; then
            log_success "✅ $service_name is healthy"
            return 0
        fi
        
        if [ $i -lt $max_attempts ]; then
            log_info "Attempt $i/$max_attempts failed, retrying in 2 seconds..."
            sleep 2
        fi
    done
    
    log_warning "⚠️  $service_name health check failed after $max_attempts attempts"
    return 1
}

# 메인 시작 함수
main() {
    log_info "🎯 Starting Robot Web Dashboard System..."
    echo ""
    
    # 이전 PID 정리
    cleanup_pids
    
    # 기본 체크
    check_dependencies
    setup_directories
    check_packages
    check_environment
    
    echo ""
    log_info "🚀 Starting services in order..."
    echo ""
    
    # 1. MQTT Processor 시작 (WebSocket 서버 포함)
    if start_service "MQTT_Processor" "mqtt_processor" "node index.js" "8080" 8; then
        log_info "MQTT Processor WebSocket bridge ready"
    else
        log_error "Failed to start MQTT Processor - aborting"
        cleanup_on_exit
    fi
    
    echo ""
    
    # 2. Backend API 시작
    if start_service "Backend_API" "backend" "node src/server.js" "5000" 6; then
        # Backend 헬스체크
        check_service_health "Backend API" "http://localhost:5000/health" 5
    else
        log_error "Failed to start Backend API - aborting"
        cleanup_on_exit
    fi
    
    echo ""
    
    # 3. Frontend 시작
    if start_service "Frontend" "frontend" "npm start" "3000" 15; then
        log_info "Frontend development server ready"
    else
        log_error "Failed to start Frontend - aborting"
        cleanup_on_exit
    fi
    
    echo ""
    echo "🎉 All services started successfully!"
    echo ""
    echo "📊 Service Status:"
    echo "├── MQTT Processor: WebSocket on port 8080"
    echo "├── Backend API: REST API on port 5000"
    echo "└── Frontend: Web app on port 3000"
    echo ""
    echo "🌐 Access URLs:"
    echo "├── 🎮 Web Dashboard: http://localhost:3000"
    echo "├── 📡 API Documentation: http://localhost:5000/api-docs"
    echo "├── 💓 System Health: http://localhost:5000/health"
    echo "└── 🔌 WebSocket: ws://localhost:8080"
    echo ""
    echo "📋 Real-time Topics:"
    echo "├── test (무게 센서 데이터)"
    echo "├── ros2_topic_list (ROS2 토픽 목록)"
    echo "├── web/target_concentration (목표농도 설정)"
    echo "├── robot/control/+ (로봇 제어 명령)"
    echo "└── system/health (시스템 상태)"
    echo ""
    echo "💡 Tips:"
    echo "├── Logs: data/logs/system/*.log"
    echo "├── Stop all: Ctrl+C"
    echo "└── Individual logs: tail -f data/logs/system/SERVICE.log"
    echo ""
    log_success "🤖 Robot Web Dashboard is ready!"
    echo ""
    log_info "Press Ctrl+C to stop all services..."
    
    # 무한 대기 (서비스들이 백그라운드에서 실행)
    while true; do
        sleep 30
        
        # 서비스 상태 모니터링
        if [ -f .service_pids ]; then
            local failed_services=""
            while read -r line; do
                if [ ! -z "$line" ]; then
                    SERVICE=$(echo $line | cut -d: -f1)
                    PID=$(echo $line | cut -d: -f2)
                    if ! kill -0 $PID 2>/dev/null; then
                        failed_services="$failed_services $SERVICE"
                    fi
                fi
            done < .service_pids
            
            if [ ! -z "$failed_services" ]; then
                log_warning "⚠️  Some services have stopped:$failed_services"
                log_info "Check logs in data/logs/system/"
            fi
        fi
    done
}

# 사용법 표시
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -c, --check    Check dependencies only"
    echo "  -k, --kill     Kill all running services"
    echo ""
    echo "Examples:"
    echo "  $0              Start all services"
    echo "  $0 --check     Check system requirements"
    echo "  $0 --kill      Stop all services"
}

# 서비스 종료 함수
kill_services() {
    log_info "🛑 Stopping all Robot Web Dashboard services..."
    
    # PID 파일 기반 종료
    cleanup_pids
    
    # 포트 기반 강제 종료
    local ports=(3000 5000 8080)
    for port in "${ports[@]}"; do
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null)
        if [ ! -z "$pid" ]; then
            log_info "Killing process on port $port (PID: $pid)"
            kill -TERM $pid 2>/dev/null
            sleep 2
            if kill -0 $pid 2>/dev/null; then
                kill -KILL $pid 2>/dev/null
            fi
        fi
    done
    
    log_success "✅ All services stopped"
}

# 명령행 인수 처리
case "${1:-}" in
    -h|--help)
        show_usage
        exit 0
        ;;
    -c|--check)
        check_dependencies
        exit 0
        ;;
    -k|--kill)
        kill_services
        exit 0
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
