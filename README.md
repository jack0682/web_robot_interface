# 🤖 Robot Web Dashboard

## 프로젝트 개요

Doosan M0609 로봇팔을 위한 실시간 웹 대시보드 시스템입니다. 이 프로젝트는 ROS2 생태계와 MQTT 프로토콜을 활용하여 로봇의 상태 모니터링, 센서 데이터 시각화, 그리고 원격 제어 기능을 제공합니다.

## 🌟 주요 기능

### 🎯 실시간 모니터링
- **로봇 상태 추적**: 관절 위치, 속도, TCP 좌표 실시간 모니터링
- **센서 데이터 시각화**: 무게센서, 농도센서, 온도센서 데이터 차트
- **시스템 진단**: 연결 상태, 에러 로그, 성능 지표

### 🎮 제어 인터페이스
- **원격 제어**: 웹 인터페이스를 통한 로봇 제어
- **비상 정지**: 즉시 응답 가능한 안전 시스템
- **매개변수 조정**: 실시간 설정 변경

### 📊 데이터 분석
- **히스토리 추적**: 장기간 데이터 저장 및 분석
- **성능 분석**: 작업 효율성 및 시스템 성능 지표
- **보고서 생성**: 자동화된 데이터 리포트

## 🏗️ 시스템 아키텍처

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  MQTT Processor │
│   (React TS)    │◄──►│   (Node.js)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       ▲
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   REST API      │    │  MQTT Broker    │
│   (Real-time)   │    │   (HTTP)        │    │   (EMQX)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       ▲
                                                       │
                                                       ▼
                                            ┌─────────────────┐
                                            │   ROS2 Bridge   │
                                            │   & Robot       │
                                            └─────────────────┘
```

## 📁 프로젝트 구조

```
webpro_ws/
├── frontend/                 # React TypeScript 웹 애플리케이션
├── backend/                  # Node.js 백엔드 서버
├── mqtt_processor/           # MQTT 메시지 처리 서비스
├── configs/                  # 시스템 설정 파일들
├── scripts/                  # 자동화 스크립트
├── data/                     # 데이터 및 로그
├── docs/                     # 문서
└── tools/                    # 개발 도구
```

## 🚀 빠른 시작

### 전제 조건
- Node.js 18.x 이상
- npm 또는 yarn
- ROS2 Humble (선택사항)
- MQTT 브로커 (mosquitto 권장)

### 설치 및 실행

1. **전체 환경 설정**
   ```bash
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

2. **서비스 시작**
   ```bash
   ./scripts/start_services.sh
   ```

3. **웹 대시보드 접속**
   ```
   http://localhost:3000
   ```

### 개별 서비스 실행

```bash
# Frontend 개발 서버
cd frontend && npm start

# Backend 서버
cd backend && npm start

# MQTT 프로세서
cd mqtt_processor && npm start
```

## 🔧 설정

### 환경 변수

각 서비스의 `.env` 파일에서 설정을 변경할 수 있습니다:

**Frontend (.env)**
```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:8080
REACT_APP_MQTT_URL=ws://localhost:8083/mqtt
REACT_APP_ROBOT_IP=192.168.137.100
```

**Backend (.env)**
```env
PORT=5000
MQTT_HOST=localhost
MQTT_PORT=1883
LOG_LEVEL=info
```

**MQTT Processor (.env)**
```env
MQTT_HOST=localhost
MQTT_PORT=1883
WS_PORT=8080
LOG_LEVEL=debug
```

### 로봇 설정

`configs/robot/m0609_specs.json`에서 로봇 사양을 설정합니다:

```json
{
  "robot_model": "M0609",
  "specifications": {
    "dof": 6,
    "max_payload": 6.0,
    "max_reach": 900
  }
}
```

## 📊 사용법

### 대시보드 레이아웃

대시보드는 4개의 주요 패널로 구성됩니다:

1. **로봇 상태 패널**: 실시간 로봇 상태 및 3D 시각화
2. **센서 패널**: 무게, 농도, 온도 센서 데이터
3. **차트 패널**: 시계열 데이터 시각화
4. **제어 패널**: 로봇 제어 및 매개변수 조정

### API 엔드포인트

```bash
# 로봇 상태 조회
GET /api/robot/status

# 센서 데이터 조회
GET /api/sensors/all

# 로봇 제어 명령
POST /api/control/move_joint
POST /api/control/move_linear
POST /api/control/stop
```

### MQTT 토픽

```bash
# 구독 토픽
robot/status              # 로봇 상태
sensors/weight            # 무게 센서
sensors/concentration     # 농도 센서
ros2_topic_list          # ROS2 토픽 목록

# 발행 토픽
robot/control/move_joint  # 관절 이동 명령
robot/control/stop        # 비상 정지
```

## 🛠️ 개발

### 개발 환경 설정

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev

# 타입 체크
npm run type-check

# 코드 스타일 검사
npm run lint

# 테스트 실행
npm test
```

### 새로운 컴포넌트 추가

1. **센서 컴포넌트 예시**
   ```typescript
   // src/components/sensors/NewSensor.tsx
   import React from 'react';
   import { useSensorData } from '@/hooks/useSensorData';

   const NewSensor: React.FC = () => {
     const { sensorData } = useSensorData();
     return <div>{/* 센서 UI */}</div>;
   };
   ```

2. **새로운 차트 추가**
   ```typescript
   // src/components/visualization/charts/NewChart.tsx
   import { LineChart, Line, XAxis, YAxis } from 'recharts';
   ```

### 커스텀 훅 사용

```typescript
// 실시간 데이터 사용
const { robotStatus, isConnected } = useRobotData();

// MQTT 연결 관리
const { publish, subscribe } = useMqttConnection();

// 센서 데이터 처리
const { sensorData, history } = useSensorData();
```

## 🔒 보안

### 인증 및 권한

- JWT 기반 인증 시스템
- 역할 기반 접근 제어 (RBAC)
- API 요청 제한 (Rate Limiting)

### 네트워크 보안

- HTTPS/WSS 프로토콜 사용
- MQTT over TLS 지원
- 방화벽 설정 권장

## 📈 모니터링

### 로그 관리

```bash
# 실시간 로그 모니터링
tail -f data/logs/system/app.log

# 로그 레벨별 필터링
grep "ERROR" data/logs/backend/*.log

# 로그 분석 도구
python tools/log_analyzer.py
```

### 성능 모니터링

```bash
# 시스템 상태 확인
./scripts/health_check.sh

# 성능 지표 모니터링
node tools/performance_monitor.js
```

## 🐛 문제 해결

### 일반적인 문제들

1. **연결 실패**
   - MQTT 브로커 상태 확인
   - 네트워크 연결 점검
   - 방화벽 설정 확인

2. **데이터가 표시되지 않음**
   - 토픽 구독 상태 확인
   - 센서 연결 상태 점검
   - 로그 파일 확인

3. **성능 문제**
   - 데이터 수집 빈도 조정
   - 브라우저 캐시 정리
   - 서버 리소스 모니터링

### 디버깅 도구

```bash
# MQTT 메시지 테스트
node tools/mqtt_test_client.js

# 가상 데이터 생성
node tools/data_generator.js

# 성능 프로파일링
npm run profile
```

## 📝 API 문서

자세한 API 문서는 [API.md](./API.md)를 참조하세요.

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 [LICENSE](./LICENSE) 파일을 참조하세요.

## 🙏 감사의 말

- Doosan Robotics for M0609 robot specifications
- ROS2 community for the robotic ecosystem
- React and Node.js communities for excellent tooling

## 📞 지원

문제가 발생하거나 질문이 있으시면:

- Issue 생성: [GitHub Issues](https://github.com/your-repo/issues)
- 문서: [Documentation](./docs/)
- 커뮤니티: [Discussions](https://github.com/your-repo/discussions)

---

**Robot Web Dashboard** - 로봇 자동화의 미래를 여는 웹 플랫폼
