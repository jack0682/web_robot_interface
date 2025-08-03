#!/bin/bash

# MQTT 빌드 문제 해결 스크립트
echo "🔧 MQTT 브라우저 호환성 문제 해결 중..."

cd ~/web_robot_interface/frontend

# 1. 기존 MQTT 제거하고 브라우저 호환 버전 설치
echo "📦 브라우저 호환 MQTT 라이브러리 설치..."
npm uninstall mqtt
npm install mqtt@4.3.7 --save

# 2. WebSocket polyfill 추가
echo "🌐 WebSocket polyfill 설치..."
npm install --save url util buffer process

# 3. 간단한 webpack 설정 오버라이드 (eject 없이)
echo "⚙️ React App Rewired 설정..."
npm install --save-dev react-app-rewired

# 4. config-overrides.js 생성
cat > config-overrides.js << 'EOF'
const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "url": require.resolve("url/"),
    "util": require.resolve("util/"),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser")
  };
  
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];
  
  return config;
};
EOF

# 5. package.json 스크립트 수정
echo "📝 package.json 스크립트 업데이트..."
node -e "
const pkg = require('./package.json');
pkg.scripts.start = 'react-app-rewired start';
pkg.scripts.build = 'react-app-rewired build';
pkg.scripts.test = 'react-app-rewired test';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

echo "✅ MQTT 브라우저 호환성 설정 완료!"
echo ""
echo "🚀 이제 다시 빌드를 시도해보세요:"
echo "   npm run build"