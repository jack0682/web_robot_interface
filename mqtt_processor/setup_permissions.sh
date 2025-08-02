#!/bin/bash

# 실행 권한 부여
chmod +x start.sh

echo "✅ Execute permission granted to start.sh"
echo "🚀 MQTT Processor is ready to run!"
echo ""
echo "📋 Available commands:"
echo "  ./start.sh          - Start normally"
echo "  ./start.sh --test   - Test EMQX Cloud connection"
echo "  ./start.sh --debug  - Start with debug mode"
echo "  ./start.sh --help   - Show help"
echo ""
echo "⚠️  Don't forget to configure your EMQX Cloud credentials in .env file:"
echo "  MQTT_USERNAME=your_username"
echo "  MQTT_PASSWORD=your_password"
