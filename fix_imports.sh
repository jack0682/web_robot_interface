#!/bin/bash

# 일괄 import 수정 스크립트
echo "🔧 Import 구문 일괄 수정 중..."

cd ~/web_robot_interface/frontend/src

# Settings.tsx Robot import 수정
sed -i 's/Robot,/Bot,/g' pages/Settings.tsx

# 나머지 import 구문들 수정 (named export → default export)
echo "📦 Import 구문 수정..."

# DataVisualization.tsx
sed -i 's/import { AdvancedChart }/import AdvancedChart/g' pages/DataVisualization.tsx
sed -i 's/import { DataAnalytics }/import DataAnalytics/g' pages/DataVisualization.tsx  
sed -i 's/import { CustomChartBuilder }/import CustomChartBuilder/g' pages/DataVisualization.tsx

# RobotControl.tsx
sed -i 's/import { RobotControlPanel }/import RobotControlPanel/g' pages/RobotControl.tsx
sed -i 's/import { JointControlPanel }/import JointControlPanel/g' pages/RobotControl.tsx
sed -i 's/import { PositionControlPanel }/import PositionControlPanel/g' pages/RobotControl.tsx
sed -i 's/import { EmergencyStopButton }/import EmergencyStopButton/g' pages/RobotControl.tsx
sed -i 's/import { RobotVisualization }/import RobotVisualization/g' pages/RobotControl.tsx

# SensorMonitoring.tsx  
sed -i 's/import { SensorDataGrid }/import SensorDataGrid/g' pages/SensorMonitoring.tsx
sed -i 's/import { RealtimeChart }/import RealtimeChart/g' pages/SensorMonitoring.tsx
sed -i 's/import { SensorHistoryChart }/import SensorHistoryChart/g' pages/SensorMonitoring.tsx
sed -i 's/import { SensorAlerts }/import SensorAlerts/g' pages/SensorMonitoring.tsx
sed -i 's/import { DataExportPanel }/import DataExportPanel/g' pages/SensorMonitoring.tsx

# Settings.tsx
sed -i 's/import { ConnectionSettings }/import ConnectionSettings/g' pages/Settings.tsx
sed -i 's/import { RobotSettings }/import RobotSettings/g' pages/Settings.tsx
sed -i 's/import { NotificationSettings }/import NotificationSettings/g' pages/Settings.tsx
sed -i 's/import { ThemeSettings }/import ThemeSettings/g' pages/Settings.tsx
sed -i 's/import { SecuritySettings }/import SecuritySettings/g' pages/Settings.tsx
sed -i 's/import { DataSettings }/import DataSettings/g' pages/Settings.tsx

echo "✅ Import 구문 수정 완료!"