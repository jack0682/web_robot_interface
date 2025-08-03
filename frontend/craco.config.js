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
        /Critical dependency: the request of a dependency is an expression/,
        /Can't resolve/
      ];
      
      return webpackConfig;
    },
  },
};