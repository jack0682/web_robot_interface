#!/bin/bash

# Setup Robot Web Dashboard
# 전체 프로젝트 초기 설정 및 의존성 설치

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

echo "🚀 Robot Web Dashboard Setup"
echo "=================================================="

# 현재 디렉토리 확인 및 이동
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
if [[ "$SCRIPT_DIR" == *"/scripts" ]]; then
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_DIR"
else
    PROJECT_DIR="$(pwd)"
fi

log_info "Project directory: $PROJECT_DIR"

# Node.js 버전 확인
log_step "Checking Node.js version..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js version: $NODE_VERSION"
    
    # Node.js 버전이 18 이상인지 확인
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_warning "Node.js version 18+ recommended. Current: $NODE_VERSION"
    fi
else
    log_error "Node.js not found. Please install Node.js 18+ first."
    echo "Installation guide: https://nodejs.org/"
    exit 1
fi

# npm 확인
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    log_success "npm version: $NPM_VERSION"
else
    log_error "npm not found. Please install npm first."
    exit 1
fi

# 프로젝트 구조 확인
log_step "Checking project structure..."
for dir in "frontend" "backend" "mqtt_processor"; do
    if [ -d "$dir" ]; then
        log_success "✓ Found $dir"
    else
        log_error "✗ Missing $dir directory"
        echo "Please ensure you're in the correct project directory."
        exit 1
    fi
done

# 루트 의존성 설치
log_step "Installing root dependencies..."
if [ -f "package.json" ]; then
    npm install
    log_success "Root dependencies installed"
else
    log_warning "No root package.json found"
fi

# Frontend 설정
log_step "Setting up Frontend..."
cd frontend
if [ ! -f "package.json" ]; then
    log_error "Frontend package.json not found"
    cd "$PROJECT_DIR"
    exit 1
fi

log_info "Installing Frontend dependencies..."
npm install
log_success "Frontend dependencies installed"

# 환경 변수 파일 설정
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    log_info "Creating Frontend .env file..."
    cp .env.example .env
    log_success "Frontend .env created from example"
fi

cd "$PROJECT_DIR"

# Backend 설정
log_step "Setting up Backend..."
cd backend
if [ ! -f "package.json" ]; then
    log_error "Backend package.json not found"
    cd "$PROJECT_DIR"
    exit 1
fi

log_info "Installing Backend dependencies..."
npm install
log_success "Backend dependencies installed"

# 환경 변수 파일 설정
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    log_info "Creating Backend .env file..."
    cp .env.example .env
    log_success "Backend .env created from example"
fi

cd "$PROJECT_DIR"

# MQTT Processor 설정
log_step "Setting up MQTT Processor..."
cd mqtt_processor
if [ ! -f "package.json" ]; then
    log_error "MQTT Processor package.json not found"
    cd "$PROJECT_DIR"
    exit 1
fi

log_info "Installing MQTT Processor dependencies..."
npm install
log_success "MQTT Processor dependencies installed"

# 환경 변수 파일 설정
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    log_info "Creating MQTT Processor .env file..."
    cp .env.example .env
    log_success "MQTT Processor .env created from example"
fi

cd "$PROJECT_DIR"

# 로그 디렉토리 생성
log_step "Creating log directories..."
mkdir -p data/logs/{system,backend,mqtt,frontend}
log_success "Log directories created"

# 권한 설정
log_step "Setting up permissions..."
chmod +x scripts/*.sh
log_success "Script permissions set"

# MQTT 브로커 설치 확인
log_step "Checking MQTT broker..."
if command -v mosquitto &> /dev/null; then
    log_success "Mosquitto MQTT broker found"
else
    log_warning "Mosquitto MQTT broker not found"
    echo ""
    echo "To install Mosquitto:"
    echo "  sudo apt update"
    echo "  sudo apt install mosquitto mosquitto-clients"
    echo ""
    echo "Or use external MQTT broker (configured in .env files)"
fi

# Docker 확인 (선택사항)
log_step "Checking Docker (optional)..."
if command -v docker &> /dev/null; then
    log_success "Docker found"
    if command -v docker-compose &> /dev/null; then
        log_success "Docker Compose found"
    else
        log_warning "Docker Compose not found"
    fi
else
    log_warning "Docker not found (optional for containerized deployment)"
fi

# 빌드 테스트
log_step "Testing builds..."

# Frontend 빌드 테스트
cd frontend
log_info "Testing Frontend build..."
if npm run build > /dev/null 2>&1; then
    log_success "Frontend builds successfully"
    # 빌드 결과물 정리 (개발용)
    rm -rf build 2>/dev/null || true
else
    log_warning "Frontend build test failed (may need configuration)"
fi

cd "$PROJECT_DIR"

echo ""
echo "=================================================="
log_success "🎉 Setup completed successfully!"
echo "=================================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Configure environment variables:"
echo "   - frontend/.env (React app settings)"
echo "   - backend/.env (API server settings)" 
echo "   - mqtt_processor/.env (MQTT settings)"
echo ""
echo "2. Start all services:"
echo "   ./scripts/start_services.sh"
echo ""
echo "3. Access the dashboard:"
echo "   http://localhost:3000"
echo ""
echo "4. Optional: Start with Docker:"
echo "   docker-compose up -d"
echo ""
echo "Useful commands:"
echo "- npm run install:all     # Reinstall all dependencies"
echo "- npm run build:all       # Build all projects"
echo "- npm run dev:frontend    # Start frontend only"
echo "- npm run dev:backend     # Start backend only"
echo "- npm run dev:mqtt        # Start MQTT processor only"
echo ""

# 최종 상태 확인
log_info "Final status check:"
for dir in "frontend" "backend" "mqtt_processor"; do
    if [ -d "$dir/node_modules" ]; then
        log_success "✓ $dir dependencies ready"
    else
        log_warning "✗ $dir dependencies missing"
    fi
done

echo ""
echo "📚 Documentation:"
echo "- Project README: ./README.md"
echo "- Frontend README: ./frontend/README.md" 
echo "- API Documentation: ./backend/API.md (if available)"
echo ""
echo "🐛 Troubleshooting:"
echo "- Check logs: tail -f data/logs/system/*.log"
echo "- Verify ports: netstat -tuln | grep -E '3000|5000|8080|1883'"
echo "- Health check: ./scripts/health_check.sh"
echo ""

log_success "Ready to launch! 🚀"