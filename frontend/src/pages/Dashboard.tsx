/**
 * 메인 대시보드 페이지
 * 로봇 상태, 센서 데이터, 실시간 차트를 한눈에 볼 수 있는 통합 대시보드
 */
import React from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Cpu, 
  Thermometer, 
  Weight, 
  Gauge, 
  AlertTriangle,
  CheckCircle,
  XCircle 
} from 'lucide-react';

// 컴포넌트
import RobotStatusPanel from '../components/dashboard/RobotStatusPanel';
import MainDashboard from '../components/dashboard/MainDashboard';
import RealtimeChart from '../components/visualization/RealtimeChart';
import SensorDataGrid from '../components/visualization/SensorDataGrid';
import QuickControlPanel from '../components/controls/QuickControlPanel';

// 훅
import { useRobotStore } from '../store/robotStore';
import { useMqttData } from '../hooks/useMqttData';

const Dashboard: React.FC = () => {
  const { isConnected, status, errorMessage } = useRobotStore();
  const { sensorData, connectionStatus } = useMqttData();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* 상단 상태 표시줄 */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              {/* 로봇 연결 상태 */}
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  로봇: {isConnected ? '연결됨' : '연결 끊어짐'}
                </span>
              </div>

              {/* MQTT 연결 상태 */}
              <div className="flex items-center space-x-2">
                {connectionStatus === 'connected' ? (
                  <Activity className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  MQTT: {connectionStatus}
                </span>
              </div>

              {/* 로봇 상태 */}
              <div className="flex items-center space-x-2">
                <Cpu className="w-5 h-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  상태: {status || 'Unknown'}
                </span>
              </div>
            </div>

            {/* 현재 시간 */}
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {new Date().toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 에러 메시지 */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-lg p-4"
          >
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
              <span className="text-red-800 dark:text-red-200">{errorMessage}</span>
            </div>
          </motion.div>
        )}

        {/* 대시보드 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* 로봇 상태 패널 */}
          <div className="lg:col-span-2">
            <RobotStatusPanel />
          </div>

          {/* 빠른 제어 패널 */}
          <div>
            <QuickControlPanel />
          </div>
        </div>

        {/* 센서 데이터와 차트 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
          {/* 센서 데이터 그리드 */}
          <SensorDataGrid />
          
          {/* 실시간 차트 */}
          <RealtimeChart />
        </div>

        {/* 메인 대시보드 */}
        <MainDashboard />
      </div>
    </div>
  );
};

export default Dashboard;