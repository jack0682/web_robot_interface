#!/bin/bash

# 간단한 MQTT 빌드 문제 해결
echo "🔧 CRACO를 사용한 간단한 MQTT 빌드 문제 해결..."

cd ~/web_robot_interface/frontend

# 1. CRACO 설치 (Create React App Configuration Override)
echo "📦 CRACO 설치..."
npm install @craco/craco --save-dev

# 2. 필요한 polyfill 설치
echo "🌐 필요한 polyfill 설치..."
npm install url util buffer process --save

# 3. craco.config.js 생성
cat > craco.config.js << 'EOF'
const webpack = require('webpack');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Node.js polyfills 설정
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "url": require.resolve("url/"),
        "util": require.resolve("util/"),
        "buffer": require.resolve("buffer/"),
        "process": require.resolve("process/browser"),
        "stream": require.resolve("stream-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "path": require.resolve("path-browserify"),
        "fs": false,
        "net": false,
        "tls": false
      };
      
      // 글로벌 polyfill 제공
      webpackConfig.plugins = [
        ...webpackConfig.plugins,
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        }),
      ];
      
      return webpackConfig;
    },
  },
};
EOF

# 4. package.json 스크립트 수정
echo "📝 package.json 스크립트 업데이트..."
sed -i 's/"start": "react-scripts start"/"start": "craco start"/g' package.json
sed -i 's/"build": "react-scripts build"/"build": "craco build"/g' package.json
sed -i 's/"test": "react-scripts test"/"test": "craco test"/g' package.json

# 5. 추가 polyfill 설치
npm install stream-browserify crypto-browserify path-browserify --save

echo "✅ CRACO 기반 MQTT 브라우저 호환성 설정 완료!"
echo ""
echo "🚀 이제 다시 빌드를 시도해보세요:"
echo "   npm run build"
echo ""
echo "📋 만약 여전히 문제가 있다면 대안 방법을 시도해보세요:"
echo "   1. WebSocket 기반 MQTT 클라이언트로 교체"
echo "   2. 서버사이드에서 MQTT 처리하고 WebSocket으로 데이터 전달"