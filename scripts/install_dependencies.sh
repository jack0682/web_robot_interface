#!/bin/bash

# Install Dependencies Script
# 모든 서비스의 의존성을 설치하는 스크립트

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "📦 Installing Robot Web Dashboard Dependencies"
echo "=================================================="

# Node.js 및 npm 버전 확인
log_info "Checking Node.js and npm versions..."
node_version=$(node --version)
npm_version=$(npm --version)

log_info "Node.js: $node_version"
log_info "npm: $npm_version"

# 최소 버전 확인
required_node_major=18
current_node_major=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')

if [ $current_node_major -lt $required_node_major ]; then
    log_error "Node.js $required_node_major.x or higher is required. Current: $node_version"
    exit 1
fi

# 루트 디렉토리 의존성 설치
log_info "Installing root dependencies..."
npm install
log_success "Root dependencies installed"

# Frontend 의존성 설치
if [ -d "frontend" ]; then
    log_info "Installing frontend dependencies..."
    cd frontend
    
    # 캐시 정리 (선택사항)
    if [ "$1" = "--clean" ]; then
        log_info "Cleaning frontend cache..."
        rm -rf node_modules package-lock.json
    fi
    
    npm install
    
    # TypeScript 타입 체크
    log_info "Checking TypeScript types..."
    npm run type-check
    
    cd ..
    log_success "Frontend dependencies installed"
else
    log_warning "Frontend directory not found"
fi

# Backend 의존성 설치
if [ -d "backend" ]; then
    log_info "Installing backend dependencies..."
    cd backend
    
    # 캐시 정리 (선택사항)
    if [ "$1" = "--clean" ]; then
        log_info "Cleaning backend cache..."
        rm -rf node_modules package-lock.json
    fi
    
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
    
    # 캐시 정리 (선택사항)
    if [ "$1" = "--clean" ]; then
        log_info "Cleaning MQTT processor cache..."
        rm -rf node_modules package-lock.json
    fi
    
    npm install
    
    cd ..
    log_success "MQTT processor dependencies installed"
else
    log_warning "MQTT processor directory not found"
fi

# 글로벌 도구 설치 (선택사항)
log_info "Installing global development tools..."

# PM2 (프로세스 관리자)
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2..."
    npm install -g pm2
    log_success "PM2 installed"
else
    log_info "PM2 already installed: $(pm2 --version)"
fi

# Concurrently (동시 실행)
if ! npm list -g concurrently &> /dev/null; then
    log_info "Installing Concurrently..."
    npm install -g concurrently
    log_success "Concurrently installed"
else
    log_info "Concurrently already installed"
fi

# 시스템 의존성 확인
log_info "Checking system dependencies..."

# MQTT 브로커 확인
if ! command -v mosquitto &> /dev/null; then
    log_warning "Mosquitto MQTT broker not found"
    echo "To install mosquitto:"
    echo "  Ubuntu/Debian: sudo apt-get install mosquitto mosquitto-clients"
    echo "  macOS: brew install mosquitto"
    echo "  Or use Docker: docker run -it -p 1883:1883 eclipse-mosquitto"
else
    log_success "Mosquitto MQTT broker found: $(mosquitto --help 2>&1 | head -1)"
fi

# Git 확인
if command -v git &> /dev/null; then
    log_success "Git found: $(git --version)"
else
    log_warning "Git not found. Recommended for version control."
fi

# Docker 확인 (선택사항)
if command -v docker &> /dev/null; then
    log_success "Docker found: $(docker --version)"
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose found: $(docker-compose --version)"
    else
        log_warning "Docker Compose not found"
    fi
else
    log_warning "Docker not found. Required for containerized deployment."
fi

# 보안 의존성 감사
log_info "Running security audit..."

# Frontend 보안 검사
if [ -d "frontend" ]; then
    cd frontend
    if npm audit --audit-level=high; then
        log_success "Frontend security audit passed"
    else
        log_warning "Frontend has security vulnerabilities. Run 'npm audit fix'"
    fi
    cd ..
fi

# Backend 보안 검사
if [ -d "backend" ]; then
    cd backend
    if npm audit --audit-level=high; then
        log_success "Backend security audit passed"
    else
        log_warning "Backend has security vulnerabilities. Run 'npm audit fix'"
    fi
    cd ..
fi

# 환경 설정 파일 확인
log_info "Checking environment configuration..."

env_files=(
    "frontend/.env.example"
    "backend/.env.example"
    "mqtt_processor/.env.example"
)

for env_file in "${env_files[@]}"; do
    if [ -f "$env_file" ]; then
        log_success "✓ $env_file found"
        
        # 실제 .env 파일이 없으면 복사
        actual_env="${env_file%.example}"
        if [ ! -f "$actual_env" ]; then
            cp "$env_file" "$actual_env"
            log_info "Created $actual_env from example"
        fi
    else
        log_error "✗ $env_file missing"
    fi
done

# 디렉토리 권한 설정
log_info "Setting up directory permissions..."
chmod +x scripts/*.sh
chmod 755 data/logs data/cache data/history 2>/dev/null || mkdir -p data/logs data/cache data/history

# 의존성 요약 출력
echo ""
echo "=================================================="
log_success "🎉 Dependency installation complete!"
echo "=================================================="
echo ""
echo "Installed packages summary:"
echo "- Frontend: React, TypeScript, Tailwind CSS, Recharts"
echo "- Backend: Express, MQTT, WebSocket, Winston"
echo "- MQTT Processor: MQTT client, WebSocket server"
echo ""
echo "Next steps:"
echo "1. Configure environment variables in .env files"
echo "2. Start MQTT broker: mosquitto -d"
echo "3. Start all services: ./scripts/start_services.sh"
echo "4. Open browser: http://localhost:3000"
echo ""
echo "For development:"
echo "- Frontend: cd frontend && npm start"
echo "- Backend: cd backend && npm run dev"
echo "- MQTT Processor: cd mqtt_processor && npm run dev"
echo ""

log_success "Ready to start Robot Web Dashboard! 🤖"
