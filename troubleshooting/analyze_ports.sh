#!/bin/bash

# 포트 사용 현황 완전 분석 스크립트
echo "🔍 포트 사용 현황 완전 분석"
echo "================================="

# 1. 8080-8090 범위 포트 모두 확인
echo "1. 포트 8080-8090 사용 현황:"
for port in {8080..8090}; do
    if netstat -tuln 2>/dev/null | grep ":$port" || ss -tuln 2>/dev/null | grep ":$port"; then
        echo "   ❌ 포트 $port: 사용 중"
        # 해당 포트 사용 프로세스 찾기
        PID=$(lsof -ti:$port 2>/dev/null | head -1)
        if [ -n "$PID" ]; then
            PROCESS=$(ps -p $PID -o comm= 2>/dev/null)
            COMMAND=$(ps -p $PID -o args= 2>/dev/null | cut -c1-50)
            echo "      PID: $PID, Process: $PROCESS"
            echo "      Command: $COMMAND"
        fi
    else
        echo "   ✅ 포트 $port: 사용 가능"
    fi
done

echo ""
echo "2. 모든 Node.js 프로세스:"
ps aux | grep -E "(node|npm)" | grep -v grep | while read line; do
    echo "   $line"
done

echo ""
echo "3. WebSocket 관련 프로세스:"
ps aux | grep -E "(ws|websocket|mqtt)" | grep -v grep | while read line; do
    echo "   $line"
done

echo ""
echo "4. 사용 가능한 포트 찾기:"
AVAILABLE_PORT=""
for port in {8082..8090}; do
    if ! netstat -tuln 2>/dev/null | grep ":$port" && ! ss -tuln 2>/dev/null | grep ":$port"; then
        AVAILABLE_PORT=$port
        echo "   ✅ 권장 포트: $port"
        break
    fi
done

echo ""
echo "================================="
echo "🔧 해결 방법:"
echo "================================="

if [ -n "$AVAILABLE_PORT" ]; then
    echo "1. 사용 가능한 포트 $AVAILABLE_PORT 사용"
    echo "   mqtt_processor/.env에서 WS_PORT=$AVAILABLE_PORT"
    echo "   backend mqttProcessor.js에서 포트 변경"
    echo ""
fi

echo "2. 모든 관련 프로세스 완전 정리:"
echo "   pkill -f node"
echo "   pkill -f npm"
echo "   sleep 5"
echo ""

echo "3. 개별 포트 해제:"
for port in 8080 8081; do
    PID=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "   kill $PID  # 포트 $port"
    fi
done

echo ""
echo "4. Docker 컨테이너 확인 (있는 경우):"
if command -v docker &> /dev/null; then
    echo "   docker ps | grep 808"
    echo "   docker stop [container_id]"
fi
