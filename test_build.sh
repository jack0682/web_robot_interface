#!/bin/bash

# 프론트엔드 빌드 테스트 스크립트

echo "🚀 TypeScript 에러 수정 후 빌드 테스트 시작..."

cd "$(dirname "$0")/frontend"

echo ""
echo "📦 1. 의존성 설치 확인..."
if [ ! -d "node_modules" ]; then
    echo "   - node_modules가 없습니다. npm install 실행 중..."
    npm install
else
    echo "   ✅ node_modules 존재"
fi

echo ""
echo "🔍 2. TypeScript 컴파일 검사..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    echo "   ✅ TypeScript 컴파일 성공!"
else
    echo "   ❌ TypeScript 컴파일 실패"
    echo "   📋 남은 에러들을 확인하세요."
    exit 1
fi

echo ""
echo "🔧 3. Lint 검사..."
npm run lint --if-present
if [ $? -eq 0 ]; then
    echo "   ✅ Lint 검사 통과!"
else
    echo "   ⚠️ Lint 경고가 있을 수 있습니다."
fi

echo ""
echo "🏗️ 4. 프로덕션 빌드 테스트..."
npm run build
if [ $? -eq 0 ]; then
    echo "   ✅ 프로덕션 빌드 성공!"
    echo "   📁 build/ 폴더가 생성되었습니다."
else
    echo "   ❌ 프로덕션 빌드 실패"
    exit 1
fi

echo ""
echo "🎉 모든 테스트 통과!"
echo ""
echo "📋 다음 단계:"
echo "   1. npm start - 개발 서버 시작"
echo "   2. 백엔드 서버 실행 확인"
echo "   3. MQTT 브로커 실행 확인"
echo "   4. 로봇 연결 테스트"
echo ""
echo "🔗 유용한 명령어:"
echo "   - npm start        : 개발 서버 시작"
echo "   - npm run build    : 프로덕션 빌드"
echo "   - npm run test     : 단위 테스트 실행"
echo "   - npx tsc --noEmit : 타입 체크만 실행"
