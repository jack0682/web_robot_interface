#!/bin/bash

# 포트 충돌 문제 해결 스크립트
echo "🔍 포트 8080 충돌 문제 해결 중..."
echo "================================="

# 1. 8080 포트를 사용하는 프로세스 찾기
echo "1. 8080 포트 사용 프로세스 확인:"
echo "   netstat/ss 결과:"
netstat -tuln | grep ":8080" || ss -tuln | grep ":8080" || echo "   포트 정보 조회 실패"

echo ""
echo "   프로세스 상세 정보:"
lsof -ti:8080 | head -5 | while read pid; do
    if [ -n "$pid" ]; then
        echo "   PID $pid: $(ps -p $pid -o comm= 2>/dev/null || echo 'Unknown')"
        echo "   Command: $(ps -p $pid -o args= 2>/dev/null || echo 'Unknown')"
    fi
done

# 2. Node.js 프로세스 확인
echo ""
echo "2. 실행 중인 Node.js 프로세스:"
ps aux | grep node | grep -v grep | head -10

# 3. 포트 해제 옵션 제시
echo ""
echo "================================="
echo "🔧 해결 방법 옵션:"
echo "================================="
echo ""
echo "옵션 1: 기존 8080 포트 프로세스 종료"
echo "--------"
PORT_PIDS=$(lsof -ti:8080 2>/dev/null)
if [ -n "$PORT_PIDS" ]; then
    echo "다음 명령어로 8080 포트 프로세스 종료:"
    echo "kill $PORT_PIDS"
    echo ""
    echo "강제 종료 (필요시):"
    echo "kill -9 $PORT_PIDS"
else
    echo "8080 포트 사용 프로세스를 찾을 수 없습니다."
fi

echo ""
echo "옵션 2: MQTT Processor 포트 변경"
echo "--------"
echo "mqtt_processor/.env 파일에서 WS_PORT를 다른 포트로 변경:"
echo "예: WS_PORT=8081"
echo "그리고 backend/src/services/mqttProcessor.js에서 포트 매칭"

echo ""
echo "옵션 3: 모든 관련 프로세스 정리 후 재시작"
echo "--------"
echo "pkill -f 'node.*mqtt_processor'"
echo "pkill -f 'node.*backend'"
echo "pkill -f 'node.*frontend'"
echo "sleep 2"
echo "# 그 후 다시 시작"

echo ""
echo "================================="
echo "🎯 권장 해결 순서:"
echo "================================="
echo "1. kill $PORT_PIDS  # (위에 PID가 표시된 경우)"
echo "2. ./mqtt_processor를 다시 시작"
echo "3. ./backend를 다시 시작"
echo ""
echo "또는 포트를 8081로 변경 후 재시작"
