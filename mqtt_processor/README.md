# MQTT Processor README

## 🤖 Robot Web Dashboard MQTT Processor

Doosan M0609 로봇을 위한 실시간 MQTT 데이터 처리 시스템입니다. EMQX Cloud와 SSL/TLS 연결을 통해 안전하고 안정적인 통신을 제공합니다.

## ✨ 주요 기능

### 🔄 데이터 처리
- **ROS2 토픽 리스트**: `ros2_topic_list` 토픽으로 받은 ROS2 토픽들을 분석 및 분류
- **무게센서 데이터**: 아두이노 `topic` 토픽에서 무게 데이터 실시간 처리
- **농도 제어**: 웹에서 `web/target_concentration` 토픽으로 목표 농도 설정
- **로봇 제어**: 로봇 제어 명령 검증 및 안전성 체크

### 🌐 통신
- **EMQX Cloud**: SSL/TLS 보안 연결 (포트 8883)
- **WebSocket**: 웹 대시보드와 실시간 데이터 브릿지 (포트 8080)
- **실시간 브로드캐스트**: 모든 MQTT 메시지를 WebSocket으로 전달

### 🛡️ 안전성
- **명령 검증**: 로봇 제어 명령의 안전성 검사
- **데이터 필터링**: 센서 데이터 노이즈 제거 및 검증
- **에러 처리**: 포괄적인 에러 감지 및 로깅

## 🚀 빠른 시작

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 설정
```bash
# .env 파일 생성 (예시에서 복사)
cp .env.example .env

# EMQX Cloud 인증 정보 설정
nano .env
```

필수 설정:
```env
MQTT_USERNAME=your_emqx_username
MQTT_PASSWORD=your_emqx_password
```

### 3. 연결 테스트
```bash
./start.sh --test
```

### 4. 실행
```bash
# 일반 실행
./start.sh

# 개발 모드 (nodemon)
./start.sh --dev

# 디버그 모드
./start.sh --debug

# 백그라운드 실행
./start.sh --daemon
```

## 📋 지원 토픽

### 📥 구독 토픽 (Subscribed)

| 토픽 | 설명 | QoS |
|------|------|-----|
| `ros2_topic_list` | ROS2 토픽 목록 | 1 |
| `topic` | 아두이노 무게센서 | 0 |
| `web/target_concentration` | 웹 목표농도 설정 | 1 |
| `robot/control/+` | 로봇 제어 명령 | 1 |
| `system/health` | 시스템 상태 | 0 |

### 📤 발행 토픽 (Published)

| 토픽 | 설명 | QoS |
|------|------|-----|
| `sensors/weight/processed` | 처리된 무게 데이터 | 0 |
| `system/concentration/command` | 농도 제어 명령 | 1 |
| `system/concentration/response` | 농도 설정 응답 | 1 |
| `robot/response` | 로봇 명령 응답 | 1 |
| `system/health` | 시스템 상태 (하트비트) | 0 |

## 🔧 설정 옵션

### 환경 변수

```env
# EMQX Cloud 연결
MQTT_HOST=p021f2cb.ala.asia-southeast1.emqxsl.com
MQTT_PORT=8883
MQTT_USERNAME=your_username
MQTT_PASSWORD=your_password

# 로컬 서비스
WS_PORT=8080

# 성능 설정
MAX_BUFFER_SIZE=2000
RECONNECT_INTERVAL=5000
HEARTBEAT_INTERVAL=30000

# 로깅
LOG_LEVEL=info
DEBUG_MODE=false
```

### 토픽 설정

`configs/mqtt/topic_mapping.json`에서 토픽 매핑을 수정할 수 있습니다.

## 📊 모니터링

### 실시간 상태
디버그 모드에서 실시간 모니터링 대시보드가 표시됩니다:

```bash
./start.sh --debug
```

### 로그 확인
```bash
# 실시간 로그
tail -f ../data/logs/mqtt/processor.log

# 백그라운드 실행 로그
tail -f ../data/logs/mqtt/processor.out
```

### WebSocket 연결 테스트
```javascript
const ws = new WebSocket('ws://localhost:8080');
ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## 🔍 문제 해결

### 연결 실패
1. **인증 오류**: MQTT_USERNAME, MQTT_PASSWORD 확인
2. **네트워크 오류**: 방화벽 및 SSL/TLS 포트 8883 확인
3. **인증서 오류**: `REJECT_UNAUTHORIZED=false`로 임시 테스트

### 포트 충돌
```bash
# 포트 사용 확인
lsof -i :8080
lsof -i :8883

# 프로세스 종료
kill -9 <PID>
```

### 메모리 사용량 높음
```bash
# 버퍼 크기 조정
MAX_BUFFER_SIZE=1000
DATA_RETENTION_HOURS=24
```

## 🛠️ 개발

### 디렉토리 구조
```
mqtt_processor/
├── src/
│   ├── mqttClient.js      # 메인 MQTT 클라이언트
│   ├── topicHandler.js    # 토픽별 처리 로직
│   ├── dataBuffer.js      # 데이터 버퍼 관리
│   └── logger.js          # 로깅 시스템
├── test/
│   └── test-connection.js # 연결 테스트
├── index.js               # 진입점
├── start.sh              # 실행 스크립트
└── package.json          # 의존성 설정
```

### 새로운 토픽 추가
1. `topicHandler.js`에 처리 로직 추가
2. `mqttClient.js`에 구독 설정 추가
3. `topic_mapping.json`에 토픽 정의 추가

### 테스트
```bash
# 단위 테스트
npm test

# 연결 테스트
npm run test:connection

# 린팅
npm run lint
```

## 📱 WebSocket API

### 메시지 형식

**연결 확인**
```json
{
  "type": "connection",
  "status": "connected",
  "clientId": "ws_123456789",
  "mqttStatus": true,
  "timestamp": "2025-01-XX..."
}
```

**토픽 데이터**
```json
{
  "topic": "ros2_topic_list",
  "data": [...],
  "timestamp": "2025-01-XX..."
}
```

**클라이언트 요청**
```json
{
  "type": "subscribe",
  "topic": "sensors/weight"
}
```

## 🔗 통합

### Frontend 연결
```typescript
const ws = new WebSocket('ws://localhost:8080');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    topic: 'ros2_topic_list'
  }));
};
```

### ROS2 Publisher 예시
```bash
# ROS2 토픽 목록 발행
ros2 topic list | jq -R . | jq -s . | mosquitto_pub -h <host> -p 8883 -u <user> -P <pass> --cafile ca.crt -t ros2_topic_list -s

# 아두이노 무게센서 시뮬레이션
echo '{"weight": 15.5}' | mosquitto_pub -h <host> -p 8883 -u <user> -P <pass> --cafile ca.crt -t topic -s
```

## 📞 지원

문제 발생 시:
1. 로그 파일 확인: `data/logs/mqtt/processor.log`
2. 연결 테스트 실행: `./start.sh --test`
3. 디버그 모드 실행: `./start.sh --debug`

---

**Robot Web Dashboard MQTT Processor** - 로봇과 웹의 실시간 데이터 브릿지 🤖🌐
