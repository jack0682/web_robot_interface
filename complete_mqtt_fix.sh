#!/bin/bash

# 완전한 MQTT 빌드 문제 해결 스크립트
echo "🔧 완전한 브라우저 호환 MQTT 설정..."

cd ~/web_robot_interface/frontend

# 1. 기존 Node.js MQTT 패키지 완전 제거
echo "🗑️ 기존 Node.js MQTT 패키지 제거..."
npm uninstall mqtt

# 2. 브라우저 전용 MQTT 클라이언트 설치 
echo "📦 브라우저 호환 MQTT 클라이언트 설치..."
npm install paho-mqtt --save

# 3. Settings.tsx의 confirm 문제 해결
echo "🔧 Settings.tsx confirm 문제 해결..."
sed -i 's/confirm(/window.confirm(/g' src/pages/Settings.tsx

# 4. 간단한 webpack 설정 추가 (eject 없이)
echo "⚙️ CRACO 설치 및 설정..."
npm install @craco/craco --save-dev

# 5. craco.config.js 생성 (Node.js 의존성 완전 차단)
cat > craco.config.js << 'EOF'
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Node.js 모듈들을 완전히 비활성화
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "fs": false,
        "net": false,
        "tls": false,
        "crypto": false,
        "stream": false,
        "url": false,
        "zlib": false,
        "http": false,
        "https": false,
        "assert": false,
        "os": false,
        "path": false,
        "querystring": false,
        "util": false,
        "buffer": false,
        "events": false,
        "child_process": false,
        "cluster": false,
        "dgram": false,
        "dns": false,
        "domain": false,
        "module": false,
        "punycode": false,
        "readline": false,
        "repl": false,
        "string_decoder": false,
        "sys": false,
        "timers": false,
        "tty": false,
        "vm": false,
        "worker_threads": false
      };
      
      // 경고 무시
      webpackConfig.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/
      ];
      
      return webpackConfig;
    },
  },
};
EOF

# 6. package.json 스크립트 수정
echo "📝 package.json 빌드 스크립트 업데이트..."
node -e "
const pkg = require('./package.json');
pkg.scripts.start = 'craco start';
pkg.scripts.build = 'craco build';
pkg.scripts.test = 'craco test';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# 7. 캐시 정리
echo "🧹 빌드 캐시 정리..."
rm -rf node_modules/.cache
rm -rf build

echo "✅ 완전한 브라우저 호환 MQTT 설정 완료!"
echo ""
echo "🎯 주요 변경사항:"
echo "   - 기존 Node.js mqtt 패키지 완전 제거"
echo "   - paho-mqtt 브라우저 전용 클라이언트 사용"
echo "   - 모든 Node.js 모듈 의존성 차단"
echo "   - Settings.tsx confirm 문제 해결"
echo "   - CRACO 기반 webpack 설정"
echo ""
echo "🚀 이제 다시 빌드를 시도해보세요:"
echo "   npm run build"