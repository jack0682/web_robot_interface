#!/bin/bash

# Install missing system tools
# 누락된 시스템 도구 설치

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

echo "🔧 Installing Missing System Tools"
echo "=================================="

# netstat 설치 (net-tools 패키지)
if ! command -v netstat &> /dev/null; then
    log_info "Installing net-tools (netstat)..."
    sudo apt update
    sudo apt install -y net-tools
    log_success "net-tools installed"
else
    log_success "netstat already available"
fi

# ss 확인 (이미 설치되어 있어야 함)
if command -v ss &> /dev/null; then
    log_success "ss command available"
else
    log_warning "ss command not found (should be in iproute2)"
fi

# lsof 설치
if ! command -v lsof &> /dev/null; then
    log_info "Installing lsof..."
    sudo apt install -y lsof
    log_success "lsof installed"
else
    log_success "lsof already available"
fi

# htop 설치 (시스템 모니터링용)
if ! command -v htop &> /dev/null; then
    log_info "Installing htop..."
    sudo apt install -y htop
    log_success "htop installed"
else
    log_success "htop already available"
fi

echo ""
echo "✅ System tools installation completed!"
echo ""
echo "Available commands:"
echo "- netstat -tuln    # Show listening ports"
echo "- ss -tuln         # Show listening ports (modern)"
echo "- lsof -i :PORT    # Show process using specific port"
echo "- htop             # Interactive process viewer"