#!/bin/bash

# Robot Web Dashboard Setup Script
# 로봇 웹 대시보드 전체 환경 설정 스크립트

set -e

echo "🤖 Robot Web Dashboard Setup Started"
echo "=================================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# 시스템 정보 확인
log_info "Checking system information..."
echo "OS: $(lsb_release -d | cut -f2)"
echo "Kernel: $(uname -r)"
echo "Architecture: $(uname -m)"

# Node.js 및 npm 확인
log_info "Checking Node.js and npm..."
if command -v node &> /dev/null; then
    echo "Node.js version: $(node --version)"
else
    log_error "Node.js is not installed"
    exit 1
fi

if command -v npm &> /dev/null; then
    echo "npm version: $(npm --version)"
else
    log_error "npm is not installed"
    exit 1
fi

# ROS2 환경 확인
log_info "Checking ROS2 environment..."
if [ -f "/opt/ros/humble/setup.bash" ]; then
    source /opt/ros/humble/setup.bash
    log_success "ROS2 Humble found"
else
    log_warning "ROS2 Humble not found. Some features may not work."
fi

# 프로젝트 디렉토리 설정
PROJECT_DIR="$(pwd)"
log_info "Project directory: $PROJECT_DIR"

# 의존성 설치
log_info "Installing dependencies..."

# Frontend 의존성 설치
if [ -d "frontend" ]; then
    log_info "Installing frontend dependencies..."
    cd frontend
    npm install
    cd ..
    log_success "Frontend dependencies installed"
else
    log_warning "Frontend directory not found"
fi

# Backend 의존성 설치
if [ -d "backend" ]; then
    log_info "Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    log_success "Backend dependencies installed"
else
    log_warning "Backend directory not found"
fi

# MQTT Processor 의존성 설치
if [ -d "mqtt_processor" ]; then
    log_info "Installing MQTT processor dependencies..."
    cd mqtt_processor
    npm install
    cd ..
    log_success "MQTT processor dependencies installed"
else
    log_warning "MQTT processor directory not found"
fi

# 환경 변수 파일 생성
log_info "Setting up environment files..."

# Frontend .env 파일
if [ ! -f "frontend/.env" ] && [ -f "frontend/.env.example" ]; then
    cp frontend/.env.example frontend/.env
    log_success "Frontend .env file created"
fi

# Backend .env 파일
if [ ! -f "backend/.env" ] && [ -f "backend/.env.example" ]; then
    cp backend/.env.example backend/.env
    log_success "Backend .env file created"
fi

# MQTT Processor .env 파일
if [ ! -f "mqtt_processor/.env" ] && [ -f "mqtt_processor/.env.example" ]; then
    cp mqtt_processor/.env.example mqtt_processor/.env
    log_success "MQTT processor .env file created"
fi

# 권한 설정
log_info "Setting up permissions..."
chmod +x scripts/*.sh
log_success "Script permissions set"

# 로그 디렉토리 생성
log_info "Creating log directories..."
mkdir -p data/logs/{mqtt,frontend,backend,system}
mkdir -p data/cache/{sensor_data,robot_states}
mkdir -p data/history/{daily,monthly,exports}
mkdir -p data/backups/{configs,databases}
log_success "Data directories created"

# Docker 확인 (선택사항)
if command -v docker &> /dev/null; then
    log_info "Docker found: $(docker --version)"
    if [ -f "docker-compose.yml" ]; then
        log_info "Docker Compose configuration found"
    fi
else
    log_warning "Docker not found. Manual deployment required."
fi

# MQTT 브로커 확인
log_info "Checking MQTT broker availability..."
if command -v mosquitto &> /dev/null; then
    log_success "Mosquitto MQTT broker found"
else
    log_warning "MQTT broker not found. Please install mosquitto or configure external broker."
fi

# 최종 검증
log_info "Running final verification..."

# 설정 파일 검증
config_files=(
    "configs/mqtt/emqx_connection.json"
    "configs/mqtt/topic_mapping.json"
    "configs/robot/m0609_specs.json"
    "configs/sensors/weight_sensor_config.json"
)

for config_file in "${config_files[@]}"; do
    if [ -f "$config_file" ]; then
        log_success "✓ $config_file"
    else
        log_error "✗ $config_file missing"
    fi
done

echo ""
echo "=================================================="
log_success "🎉 Robot Web Dashboard Setup Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Configure environment variables in .env files"
echo "2. Start MQTT broker: mosquitto -d"
echo "3. Run services: ./scripts/start_services.sh"
echo "4. Open browser: http://localhost:3000"
echo ""
echo "For development:"
echo "- Frontend dev server: cd frontend && npm start"
echo "- Backend dev server: cd backend && npm run dev"
echo "- MQTT processor: cd mqtt_processor && npm start"
echo ""
