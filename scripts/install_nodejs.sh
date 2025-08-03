#!/bin/bash

# Node.js 자동 설치 스크립트
# Ubuntu/Debian용 Node.js 20 LTS 설치

set -e

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

echo "🚀 Installing Node.js 20 LTS"
echo "=================================="

# 시스템 확인
if ! grep -qi ubuntu /etc/os-release && ! grep -qi debian /etc/os-release; then
    log_warning "This script is designed for Ubuntu/Debian systems"
fi

# 기존 Node.js 확인
if command -v node &> /dev/null; then
    CURRENT_VERSION=$(node -v)
    log_info "Current Node.js version: $CURRENT_VERSION"
    
    # 버전 18+ 체크
    NODE_MAJOR=$(echo $CURRENT_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        log_success "Node.js $CURRENT_VERSION is already suitable (18+)"
        exit 0
    else
        log_warning "Node.js $CURRENT_VERSION is too old. Upgrading..."
    fi
fi

# 시스템 업데이트
log_info "Updating package list..."
sudo apt update

# 필요한 패키지 설치
log_info "Installing required packages..."
sudo apt install -y curl gnupg2 software-properties-common

# NodeSource 저장소 추가
log_info "Adding NodeSource repository..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Node.js 설치
log_info "Installing Node.js 20 LTS..."
sudo apt install -y nodejs

# 설치 확인
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VERSION=$(node -v)
    NPM_VERSION=$(npm -v)
    
    log_success "✅ Node.js installed successfully!"
    echo "Node.js version: $NODE_VERSION"
    echo "npm version: $NPM_VERSION"
    
    # 버전 재확인
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
    if [ "$NODE_MAJOR" -ge 18 ]; then
        log_success "Version check passed (18+)"
    else
        log_error "Installed version is still too old"
        exit 1
    fi
else
    log_error "Installation failed"
    exit 1
fi

# npm 글로벌 패키지 권한 설정 (선택사항)
log_info "Setting up npm global directory..."
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'

# .bashrc에 PATH 추가 (이미 있는지 확인)
if ! grep -q "npm-global/bin" ~/.bashrc; then
    echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
    log_info "Added npm global path to ~/.bashrc"
    log_warning "Please run 'source ~/.bashrc' or restart terminal"
fi

echo ""
echo "🎉 Node.js installation completed!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. source ~/.bashrc  (or restart terminal)"
echo "2. cd ~/web_robot_interface"
echo "3. ./scripts/setup.sh"
echo ""
echo "Useful npm commands:"
echo "- npm install         # Install dependencies"
echo "- npm start          # Start application"
echo "- npm run build      # Build for production"
echo "- npm test           # Run tests"