# 🤖 Robot Web Dashboard - MQTT Bridge System

## 프로젝트 개요

Doosan M0609 로봇 시스템에서 발행되는 MQTT 메시지를 실시간으로 수신하여 웹 대시보드로 시각화하는 **MQTT 브릿지 시스템**입니다. 

ROS2 시스템이 별도로 실행되면서 MQTT 브로커를 통해 퍼블리시하는 데이터를 받아 웹 인터페이스로 표시합니다.

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROS2 Robot System                           │
│              (별도 실행 중 - Doosan M0609)                      │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MQTT Messages
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  EMQX Cloud MQTT Broker                        │
│             (p021f2cb.ala.asia-southeast1.emqxsl.com)          │
└─────────────────────┬───────────────────────────────────────────┘
                      │ SSL/TLS (Port 8883)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MQTT Processor Service                        │
│               (WebSocket Bridge - Port 8080)                   │
└─────────────────────┬───────────────────────────────────────────┘
                      │ WebSocket Messages
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Backend API Service                         │
│                  (REST API - Port 5000)                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP/WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Frontend Web Dashboard                       │
│              (React TypeScript - Port 3000)                    │
└─────────────────────────────────────────────────────────────────┘
```

## 📡 MQTT 토픽 구조

### 구독하는 토픽들:

| 토픽 이름 | 설명 | QoS | 데이터 형식 |
|-----------|------|-----|-------------|
| `test` | ROS2 모든 토픽들이 JSON으로 묶여서 전송 | 1 | JSON |
| `scale/raw` | 무게 센서 데이터 | 0 | Number/JSON |
| `web/target_concentration` | 웹에서 설정하는 목표 농도 | 1 | JSON |
| `robot/control/+` | 로봇 제어 명령 (와일드카드) | 2 | JSON |
| `system/health` | 시스템 상태 하트비트 | 0 | JSON |

### 예상 데이터 구조:

```json
// test 토픽 (ROS2 토픽 목록)
{
  "timestamp": "2025-01-08T10:30:00.000Z",
  "topic_data": {
    "/dsr01/joint_states": [1.2, 0.5, -0.8, 0.3, 1.1, -0.2],
    "/dsr01/dynamic_joint_states": {...},
    "/dsr01/error": "no_error",
    "/clicked_point": {...}
  }
}

// scale/raw 토픽 (무게센서)
{
  "weight": 15.67,
  "unit": "kg",
  "timestamp": "2025-01-08T10:30:00.000Z"
}

// web/target_concentration 토픽
{
  "target": 75.0,
  "unit": "%",
  "source": "web_dashboard",
  "timestamp": "2025-01-08T10:30:00.000Z"
}
```

## 🚀 빠른 시작

### 1. 전체 시스템 시작

```bash
# 실행 권한 부여 (최초 1회)
chmod +x start_system.sh test_system.sh

# 전체 시스템 시작
./start_system.sh
```

### 2. 시스템 테스트

```bash
# 전체 테스트 실행
./test_system.sh

# 빠른 테스트 (파일 구조만)
./test_system.sh --quick
```

### 3. 개별 서비스 시작

```bash
# MQTT Processor (포트 8080)
cd mqtt_processor && npm start

# Backend API (포트 5000) 
cd backend && npm start

# Frontend (포트 3000)
cd frontend && npm start
```

## 🔧 환경 설정

### MQTT 연결 설정

각 `.env` 파일에서 MQTT 브로커 연결 정보를 설정합니다:

```bash
# mqtt_processor/.env
MQTT_HOST=p021f2cb.ala.asia-southeast1.emqxsl.com
MQTT_PORT=8883
MQTT_USERNAME=Rokey
MQTT_PASSWORD=1234567
WS_PORT=8080
```

### 토픽 매핑 설정

`mqtt_processor/config/processor.config.json`에서 상세 설정:

```json
{
  "mqtt": {
    "connection": {
      "host": "p021f2cb.ala.asia-southeast1.emqxsl.com",
      "port": 8883,
      "protocol": "mqtts"
    },
    "topics": {
      "ros2_topic_list": {
        "name": "test",
        "qos": 1,
        "retain": true
      }
    }
  }
}
```

## 📊 대시보드 기능

### 실시간 모니터링

- **로봇 상태**: 관절 위치, 속도, TCP 좌표
- **센서 데이터**: 무게센서 실시간 값
- **시스템 상태**: 연결 상태, 에러 로그

### 제어 인터페이스

- **농도 설정**: 웹에서 목표 농도 조정
- **시스템 모니터링**: 실시간 토픽 현황
- **데이터 시각화**: 시계열 차트

## 🔗 서비스 엔드포인트

### Web Dashboard
- **URL**: http://localhost:3000
- **기능**: 실시간 데이터 시각화 및 제어

### Backend API
- **Base URL**: http://localhost:5000
- **Health Check**: `/health`
- **API Docs**: `/api-docs`
- **Robot Status**: `/api/robot/status`
- **Sensor Data**: `/api/sensors/all`

### WebSocket Bridge
- **URL**: ws://localhost:8080
- **프로토콜**: WebSocket을 통한 실시간 MQTT 메시지 브릿지

## 📝 로그 및 모니터링

### 로그 파일 위치

```
data/logs/
├── mqtt/
│   └── processor.log          # MQTT 프로세서 로그
├── backend/
│   └── app.log                # 백엔드 API 로그
└── system/
    ├── mqtt_processor.log     # 시스템 시작 로그
    ├── backend_api.log        # 백엔드 시작 로그
    └── frontend.log          # 프론트엔드 시작 로그
```

### 실시간 로그 모니터링

```bash
# 전체 시스템 로그
tail -f data/logs/system/*.log

# MQTT 프로세서 로그
tail -f data/logs/mqtt/processor.log

# 백엔드 API 로그
tail -f data/logs/backend/app.log
```

## 🐛 문제 해결

### 일반적인 문제들

1. **연결 실패**
   ```bash
   # MQTT 브로커 연결 확인
   curl -f http://localhost:5000/health
   
   # 환경 변수 확인
   cat mqtt_processor/.env
   ```

2. **포트 충돌**
   ```bash
   # 포트 사용 현황 확인
   netstat -tulpn | grep -E ':(3000|5000|8080)'
   
   # 강제 종료
   ./start_system.sh --kill
   ```

3. **데이터가 표시되지 않음**
   ```bash
   # WebSocket 연결 테스트
   ./test_system.sh
   
   # MQTT 메시지 확인
   tail -f data/logs/mqtt/processor.log | grep "message received"
   ```

### 디버깅 모드 실행

```bash
# MQTT 프로세서 디버그 모드
cd mqtt_processor
DEBUG_MODE=true ENABLE_VERBOSE_LOGGING=true npm start

# 백엔드 개발 모드
cd backend
NODE_ENV=development npm run dev
```

## 🔒 보안 설정

### MQTT TLS/SSL 연결

- **프로토콜**: MQTTS (SSL/TLS)
- **포트**: 8883
- **인증서 검증**: 활성화
- **TLS 버전**: 1.2+

### 환경 변수 보안

```bash
# 프로덕션 환경에서는 안전한 자격 증명 사용
export MQTT_USERNAME="your_secure_username"
export MQTT_PASSWORD="your_secure_password"
```

## 📈 성능 모니터링

### 메트릭

- **메시지 처리량**: MQTT 메시지/초
- **WebSocket 클라이언트 수**: 동시 연결 수
- **메모리 사용량**: 각 서비스별 메모리 사용
- **버퍼 크기**: 데이터 버퍼링 상태

### 성능 최적화

```json
// processor.config.json
{
  "data_processing": {
    "buffer_size": 2000,
    "retention_hours": 48
  },
  "websocket": {
    "max_clients": 100,
    "ping_interval": 30000
  }
}
```

## 🤝 시스템 통합

### ROS2 시스템과의 연동

ROS2 시스템에서 다음 토픽들을 MQTT로 퍼블리시해야 합니다:

```python
# ROS2에서 MQTT 퍼블리시 예시 (참고용)
import paho.mqtt.client as mqtt

# MQTT 클라이언트 설정
client = mqtt.Client()
client.username_pw_set("Rokey", "1234567")
client.tls_set()
client.connect("p021f2cb.ala.asia-southeast1.emqxsl.com", 8883, 60)

# ROS2 토픽 데이터를 MQTT로 전송
topic_data = {
    "timestamp": datetime.now().isoformat(),
    "topic_data": {
        "/dsr01/joint_states": joint_positions,
        "/dsr01/dynamic_joint_states": dynamic_data,
        # ... 기타 토픽 데이터
    }
}

client.publish("test", json.dumps(topic_data), qos=1)
```

## 📋 개발 가이드

### 새로운 토픽 추가

1. **설정 파일 업데이트**
   ```json
   // mqtt_processor/config/processor.config.json
   {
     "mqtt": {
       "topics": {
         "new_sensor": {
           "name": "sensors/new_sensor",
           "qos": 0,
           "retain": false,
           "description": "새로운 센서 데이터"
         }
       }
     }
   }
   ```

2. **파서 함수 추가**
   ```javascript
   // mqtt_processor/src/mqttClient.js
   parseNewSensorData(message) {
     try {
       const data = JSON.parse(message.toString());
       return {
         type: 'new_sensor',
         value: data.value,
         timestamp: new Date().toISOString()
       };
     } catch {
       return { type: 'new_sensor', error: 'Parse failed' };
     }
   }
   ```

3. **프론트엔드 컴포넌트 추가**
   ```tsx
   // frontend/src/components/sensors/NewSensor.tsx
   const NewSensor: React.FC = () => {
     const { sensorData } = useMqttData();
     
     return (
       <div className="sensor-panel">
         <h3>New Sensor</h3>
         <div>{sensorData.new_sensor?.value}</div>
       </div>
     );
   };
   ```

## 🚀 배포

### Docker를 사용한 배포

```bash
# 모든 서비스 빌드 및 실행
docker-compose up -d

# 특정 서비스만 실행
docker-compose up mqtt_processor backend
```

### 프로덕션 환경 설정

```bash
# 환경 변수 설정
export NODE_ENV=production
export LOG_LEVEL=warn
export DEBUG_MODE=false

# 프로덕션 빌드
cd frontend && npm run build
cd backend && npm run build
```

## 📞 지원 및 문의

### 시스템 상태 확인

- **Health Check**: http://localhost:5000/health
- **시스템 테스트**: `./test_system.sh`
- **로그 분석**: `data/logs/` 디렉토리 확인

### 문제 보고

1. 시스템 테스트 실행: `./test_system.sh`
2. 로그 파일 확인
3. 환경 설정 검증
4. 네트워크 연결 상태 확인

---

**Robot Web Dashboard MQTT Bridge** - 실시간 로봇 데이터 시각화의 완성

🔗 **시스템 구성**: ROS2 Robot → MQTT Broker → WebSocket Bridge → Web Dashboard

⚡ **실시간 처리**: SSL/TLS 보안 연결을 통한 안정적인 데이터 스트리밍

🎯 **확장성**: 모듈형 구조로 새로운 센서 및 토픽 쉽게 추가 가능
