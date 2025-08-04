#!/bin/bash

# 시스템 차원의 포트 점유 문제 진단
echo "🕵️ 시스템 포트 점유 문제 근본 진단"
echo "===================================="

# 1. 전체 포트 사용 현황 (8080-8090)
echo "1. 포트 8080-8090 완전 스캔:"
for port in {8080..8090}; do
    # netstat과 ss 둘 다 확인
    if netstat -tuln 2>/dev/null | grep ":$port " || ss -tuln 2>/dev/null | grep ":$port "; then
        echo "   🔴 포트 $port: 사용 중"
        
        # 프로세스 정보 수집
        PID=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ -n "$PID" ]; then
            PROCESS=$(ps -p $PID -o comm= 2>/dev/null || echo "Unknown")
            FULL_CMD=$(ps -p $PID -o args= 2>/dev/null || echo "Unknown")
            PPID=$(ps -p $PID -o ppid= 2>/dev/null || echo "Unknown")
            USER=$(ps -p $PID -o user= 2>/dev/null || echo "Unknown")
            
            echo "      PID: $PID, PPID: $PPID, User: $USER"
            echo "      Process: $PROCESS"
            echo "      Command: ${FULL_CMD:0:80}"
            
            # 프로세스 트리 확인
            if command -v pstree &> /dev/null && [ "$PID" != "Unknown" ]; then
                echo "      Tree: $(pstree -p $PID 2>/dev/null | head -1 || echo 'N/A')"
            fi
        else
            echo "      프로세스 정보 없음 (시스템 서비스일 수 있음)"
        fi
        echo ""
    else
        echo "   🟢 포트 $port: 사용 가능"
    fi
done

echo ""
echo "2. 모든 Node.js 관련 프로세스:"
ps aux | grep -E "(node|npm)" | grep -v grep | while IFS= read -r line; do
    echo "   $line"
done

echo ""
echo "3. WebSocket/MQTT 관련 프로세스:"
ps aux | grep -E "(ws|websocket|mqtt|broker)" | grep -v grep | while IFS= read -r line; do
    echo "   $line"
done

echo ""
echo "4. Docker 컨테이너 확인:"
if command -v docker &> /dev/null; then
    echo "   실행 중인 컨테이너:"
    docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}" 2>/dev/null || echo "   Docker 접근 불가 또는 컨테이너 없음"
    echo ""
    echo "   8080-8090 포트 사용 컨테이너:"
    docker ps --format "{{.Names}} {{.Ports}}" 2>/dev/null | grep -E "808[0-9]" || echo "   해당 포트 사용 컨테이너 없음"
else
    echo "   Docker 미설치"
fi

echo ""
echo "5. 시스템 서비스 확인:"
if command -v systemctl &> /dev/null; then
    echo "   활성 서비스 중 웹/네트워크 관련:"
    systemctl list-units --state=active | grep -E "(web|http|mqtt|ws)" | head -5 || echo "   관련 시스템 서비스 없음"
fi

echo ""
echo "6. 방화벽/iptables 확인:"
if command -v iptables &> /dev/null; then
    echo "   iptables 8080-8090 관련 룰:"
    iptables -L -n 2>/dev/null | grep -E "808[0-9]" || echo "   관련 방화벽 룰 없음"
fi

echo ""
echo "7. /etc/services 파일 확인:"
echo "   8080-8090 포트 예약 여부:"
grep -E "808[0-9]" /etc/services 2>/dev/null || echo "   시스템 예약 포트 아님"

echo ""
echo "8. VSCode/IDE 서버 확인:"
ps aux | grep -E "(code-server|vscode|ide)" | grep -v grep | while IFS= read -r line; do
    echo "   IDE: $line"
done

echo ""
echo "9. 웹 개발 서버 확인:"
ps aux | grep -E "(webpack|react|next|vue|angular)" | grep -v grep | while IFS= read -r line; do
    echo "   Dev Server: $line"
done

echo ""
echo "===================================="
echo "🔧 추천 해결 방법:"
echo "===================================="

# 사용 가능한 포트 찾기
AVAILABLE_PORTS=()
for port in {8090..8099}; do
    if ! netstat -tuln 2>/dev/null | grep ":$port " && ! ss -tuln 2>/dev/null | grep ":$port "; then
        AVAILABLE_PORTS+=($port)
    fi
done

if [ ${#AVAILABLE_PORTS[@]} -gt 0 ]; then
    echo "1. 사용 가능한 대체 포트:"
    for port in "${AVAILABLE_PORTS[@]:0:3}"; do
        echo "   ✅ 포트 $port"
    done
    echo ""
    echo "   권장: 포트 ${AVAILABLE_PORTS[0]} 사용"
    echo "   mqtt_processor/.env에서 WS_PORT=${AVAILABLE_PORTS[0]}"
    echo "   backend에서 WebSocket URL 수정"
else
    echo "1. 8080-8099 범위 모두 사용 중 - 다른 범위 확인 필요"
fi

echo ""
echo "2. 강제 정리 명령어:"
echo "   # 모든 Node 프로세스"
echo "   pkill -9 -f node"
echo "   pkill -9 -f npm"
echo ""
echo "   # Docker 컨테이너 (있는 경우)"
echo "   docker stop \$(docker ps -q)"
echo ""
echo "   # 특정 포트 강제 해제"
for port in {8080..8090}; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "   kill -9 $PID  # 포트 $port"
    fi
done

echo ""
echo "3. 시스템 재시작 (최후 수단):"
echo "   sudo systemctl restart networking"
echo "   또는 WSL 재시작: wsl --shutdown"

echo ""
echo "===================================="
echo "🎯 다음 단계:"
echo "===================================="
echo "1. 위 정보를 확인하여 포트를 점유하는 프로세스 식별"
echo "2. 불필요한 프로세스 종료"
echo "3. 사용 가능한 포트로 설정 변경"
echo "4. 서비스 재시작"
