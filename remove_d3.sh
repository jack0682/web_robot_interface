#!/bin/bash

# d3 라이브러리 제거 스크립트
echo "🧹 사용되지 않는 d3 라이브러리 제거 중..."

cd ~/web_robot_interface/frontend

# d3 관련 패키지 제거
echo "📦 d3 패키지 제거..."
npm uninstall d3 @types/d3

# 패키지 락 파일 정리
echo "🔄 package-lock.json 갱신..."
rm -f package-lock.json

# 의존성 재설치
echo "⚡ 의존성 재설치..."
npm install

echo "✅ d3 제거 완료!"
echo ""
echo "🔍 이제 빌드 테스트를 다시 실행해보세요:"
echo "   ./test_build.sh"