# 🤖 Doosan M0609 Robot Web Dashboard

두산 M0609 협동 로봇을 위한 실시간 웹 대시보드입니다. React + TypeScript로 구축되었으며, ROS2 백엔드와 실시간 통신하여 로봇을 제어하고 모니터링할 수 있습니다.

## ✨ 주요 기능

### 🎯 로봇 제어
- **조인트 제어**: 개별 조인트 위치 제어 및 실시간 모니터링
- **카르테시안 제어**: 3D 공간에서의 직관적인 로봇 제어
- **프로그램 실행**: 로봇 프로그램 업로드, 실행, 모니터링
- **안전 시스템**: 비상정지, 보호정지, 안전모드 관리

### 📊 실시간 시각화
- **3D 로봇 모델**: Three.js 기반 실시간 3D 로봇 시각화
- **실시간 차트**: 조인트 위치, 속도, 토크 실시간 모니터링
- **히트맵**: 작업공간 분석 및 조인트 상관관계 시각화
- **게이지 차트**: 시스템 성능 및 상태 모니터링

### 🔄 실시간 통신
- **WebSocket**: 실시간 로봇 상태 업데이트
- **MQTT**: 센서 데이터 및 이벤트 스트리밍
- **HTTP API**: RESTful API를 통한 명령 전송

### 🎨 사용자 인터페이스
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 지원
- **다크/라이트 테마**: 자동 테마 전환 지원
- **대시보드 커스터마이징**: 드래그 앤 드롭으로 레이아웃 조정
- **다국어 지원**: 한국어/영어 인터페이스

## 🚀 빠른 시작

### 전제 조건
- Node.js 16.x 이상
- npm 또는 yarn
- ROS2 백엔드 서버 실행 중

### 설치 및 실행

1. **프로젝트 클론**
```bash
git clone <repository-url>
cd web_robot_interface/frontend
```

2. **의존성 설치**
```bash
npm install
# 또는
yarn install
```

3. **환경 설정**
```bash
cp .env.example .env
# .env 파일을 편집하여 로봇 IP 및 설정 변경
```

4. **개발 서버 실행**
```bash
npm start
# 또는
yarn start
```

5. **브라우저에서 접속**
```
http://localhost:3000
```

## 📁 프로젝트 구조

```
src/
├── components/           # 재사용 가능한 컴포넌트
│   ├── common/          # 공통 컴포넌트
│   ├── controls/        # 로봇 제어 컴포넌트
│   ├── dashboard/       # 대시보드 컴포넌트
│   ├── layout/          # 레이아웃 컴포넌트
│   └── visualization/   # 시각화 컴포넌트
├── contexts/            # React Context API
├── hooks/               # 커스텀 훅
├── pages/               # 페이지 컴포넌트
├── services/            # API 및 서비스
├── store/               # 상태 관리 (Zustand)
├── styles/              # 스타일 파일
├── types/               # TypeScript 타입 정의
└── utils/               # 유틸리티 함수
```

## 🔧 설정

### 환경 변수

주요 환경 변수들:

```bash
# 로봇 연결 설정
REACT_APP_ROBOT_IP=192.168.137.100
REACT_APP_ROBOT_PORT=12345

# API 서버 설정
REACT_APP_API_BASE_URL=http://localhost:5000
REACT_APP_WS_URL=ws://localhost:5000

# MQTT 설정
REACT_APP_MQTT_BROKER_URL=ws://localhost:9001
```

### 로봇 설정

`src/config.ts`에서 로봇별 설정을 조정할 수 있습니다:
- 조인트 제한값
- 안전 설정
- 업데이트 주기
- 작업공간 제한

## 🎮 사용법

### 1. 로봇 연결
1. 대시보드 상단의 연결 상태를 확인
2. 설정에서 로봇 IP 주소 입력
3. "연결" 버튼 클릭

### 2. 수동 제어
1. "로봇 제어" 페이지로 이동
2. 조인트 또는 카르테시안 제어 선택
3. 목표 위치 설정 후 "이동" 버튼 클릭

### 3. 프로그램 실행
1. "로봇 제어" 페이지의 "프로그램 제어" 섹션
2. 프로그램 파일 업로드 또는 기존 프로그램 선택
3. 실행 속도 및 옵션 설정
4. "실행" 버튼 클릭

### 4. 모니터링
1. "센서 모니터링" 페이지에서 실시간 데이터 확인
2. "데이터 시각화" 페이지에서 차트 및 분석 결과 확인

## 🔒 안전 기능

### 비상정지
- 큰 빨간 버튼으로 즉시 로봇 정지
- 이중 확인 절차로 안전 해제

### 안전 범위
- 조인트 제한값 자동 검사
- 작업공간 경계 확인
- 속도 및 가속도 제한

### 보호 시스템
- 충돌 감지 시 자동 정지
- 안전 센서 연동
- 실시간 상태 모니터링

## 🛠️ 개발

### 빌드 명령어

```bash
# 개발 서버 실행
npm start

# 프로덕션 빌드
npm run build

# 타입 체크
npm run type-check

# 코드 린팅
npm run lint

# 코드 포맷팅
npm run format

# 번들 분석
npm run analyze
```

### 코드 스타일

이 프로젝트는 다음을 사용합니다:
- ESLint: 코드 품질 검사
- Prettier: 코드 포맷팅
- TypeScript: 타입 안전성
- Tailwind CSS: 스타일링

### 커밋 컨벤션

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 변경
style: 코드 포맷팅
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드 관련 변경
```

## 🐛 문제 해결

### 자주 발생하는 문제들

**1. 로봇 연결 실패**
- 네트워크 연결 확인
- 로봇 IP 주소 정확성 확인
- 방화벽 설정 확인

**2. 실시간 데이터 안 옴**
- WebSocket 연결 상태 확인
- MQTT 브로커 연결 확인
- 백엔드 서버 상태 확인

**3. 3D 모델 렌더링 문제**
- 브라우저 WebGL 지원 확인
- GPU 가속 활성화 확인
- 브라우저 업데이트

### 디버깅

개발 모드에서 사용 가능한 디버깅 도구:
- Redux DevTools
- React Developer Tools
- Three.js Inspector
- Network Tab (WebSocket/HTTP 요청)

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

## 🤝 기여

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 질문이 있으시면:
- Issues 탭에서 새 이슈 생성
- 프로젝트 문서 확인
- 개발팀 연락

---

**Doosan M0609 Robot Web Dashboard** - 미래를 향한 로봇 제어의 새로운 패러다임 🚀