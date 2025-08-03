/**
 * 메인 대시보드 컴포넌트 - Hook 연동 간소화 버전
 */
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Cpu,
  Gauge,
  Weight,
  BarChart3
} from 'lucide-react';

// 커스텀 훅과 스토어
import { useMqttData } from '../../hooks/useMqttData';
import { useRealtimeChart } from '../../hooks/useRealtimeChart';
import { useRobotStore } from '../../store/robotStore';

// 기존 컴포넌트 재사용
import RealtimeChart from '../visualization/RealtimeChart';

interface MainDashboardProps {
  className?: string;
}

const MainDashboard: React.FC<MainDashboardProps> = ({ className = '' }) => {
  // 훅과 상태
  const { 
    isConnected, 
    ros2Topics, 
    weightSensor, 
    concentration, 
    messageCount,
    error 
  } = useMqttData();
  
  const { 
    weightData, 
    concentrationData, 
    weightStats, 
    concentrationStats 
  } = useRealtimeChart();
  
  const robotState = useRobotStore();
  
  // 로컬 상태
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'error'>('healthy');
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // 시스템 헬스 계산
  useEffect(() => {
    let health: 'healthy' | 'warning' | 'error' = 'healthy';
    
    if (error || !isConnected) {
      health = 'error';
    } else if (robotState.status === 'error' || robotState.errorCodes.length > 0) {
      health = 'error';
    } else if (robotState.status === 'disconnected' || robotState.connectionQuality === 'poor') {
      health = 'warning';
    }
    
    setSystemHealth(health);
    setLastUpdate(new Date().toLocaleTimeString());
  }, [error, isConnected, robotState.status, robotState.errorCodes, robotState.connectionQuality]);

  // 상태별 색상 및 아이콘
  const getHealthConfig = (health: string) => {
    switch (health) {
      case 'healthy':
        return { 
          color: 'text-green-500', 
          bgColor: 'bg-green-100 dark:bg-green-900/20', 
          icon: CheckCircle 
        };
      case 'warning':
        return { 
          color: 'text-yellow-500', 
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20', 
          icon: AlertTriangle 
        };
      case 'error':
        return { 
          color: 'text-red-500', 
          bgColor: 'bg-red-100 dark:bg-red-900/20', 
          icon: AlertTriangle 
        };
      default:
        return { 
          color: 'text-gray-500', 
          bgColor: 'bg-gray-100 dark:bg-gray-900/20', 
          icon: Clock 
        };
    }
  };

  const healthConfig = getHealthConfig(systemHealth);
  const HealthIcon = healthConfig.icon;

  return (
    <div className={`main-dashboard space-y-6 ${className}`}>
      {/* 헤더 - 시스템 상태 요약 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="dashboard-header"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              로봇 제어 대시보드
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Doosan M0609 실시간 모니터링 및 제어
            </p>
          </div>
          
          {/* 시스템 상태 표시기 */}
          <div className={`flex items-center space-x-3 px-4 py-2 rounded-lg ${healthConfig.bgColor}`}>
            <HealthIcon className={`w-5 h-5 ${healthConfig.color}`} />
            <div>
              <div className={`font-medium ${healthConfig.color}`}>
                {systemHealth === 'healthy' ? '시스템 정상' : 
                 systemHealth === 'warning' ? '주의 필요' : '오류 발생'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                마지막 업데이트: {lastUpdate}
              </div>
            </div>
          </div>
        </div>

        {/* 실시간 통계 카드들 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* MQTT 연결 상태 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">MQTT 연결</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {isConnected ? '연결됨' : '끊어짐'}
                </p>
              </div>
              {isConnected ? (
                <Wifi className="w-8 h-8 text-green-500" />
              ) : (
                <WifiOff className="w-8 h-8 text-red-500" />
              )}
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                메시지: {messageCount}개
              </span>
            </div>
          </motion.div>

          {/* 로봇 상태 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">로봇 상태</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {robotState.status === 'idle' ? '대기' :
                   robotState.status === 'moving' ? '이동중' :
                   robotState.status === 'error' ? '오류' : 
                   robotState.status === 'disconnected' ? '연결끊김' : robotState.status}
                </p>
              </div>
              <Activity className={`w-8 h-8 ${
                robotState.status === 'idle' ? 'text-blue-500' :
                robotState.status === 'moving' ? 'text-green-500' :
                robotState.status === 'error' ? 'text-red-500' : 'text-gray-500'
              }`} />
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                속도: {robotState.speed}%
              </span>
            </div>
          </motion.div>

          {/* 무게센서 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">무게센서</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {weightStats?.current?.toFixed(2) || '0.00'} kg
                </p>
              </div>
              <Weight className={`w-8 h-8 ${
                weightSensor?.quality === 'good' ? 'text-green-500' :
                weightSensor?.quality === 'poor' ? 'text-yellow-500' : 'text-gray-500'
              }`} />
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                품질: {weightSensor?.quality || 'N/A'}
              </span>
            </div>
          </motion.div>

          {/* 농도 제어 */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">목표 농도</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {concentrationStats?.current?.toFixed(1) || '75.0'}%
                </p>
              </div>
              <Gauge className="w-8 h-8 text-blue-500" />
            </div>
            <div className="mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                평균: {concentrationStats?.avg?.toFixed(1) || '0.0'}%
              </span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* 실시간 차트 섹션 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* 무게센서 차트 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-2 mb-4">
            <Weight className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              무게센서 추이
            </h3>
          </div>
          <RealtimeChart 
            data={weightData} 
            title=""
          />
          {weightStats && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">최소</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {weightStats.min.toFixed(2)}kg
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">평균</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {weightStats.avg.toFixed(2)}kg
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">최대</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {weightStats.max.toFixed(2)}kg
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 농도 차트 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="w-5 h-5 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              농도 제어 추이
            </h3>
          </div>
          <RealtimeChart 
            data={concentrationData} 
            title=""
          />
          {concentrationStats && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">최소</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {concentrationStats.min.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">평균</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {concentrationStats.avg.toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 dark:text-gray-400">최대</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {concentrationStats.max.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ROS2 시스템 정보 */}
      {ros2Topics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
        >
          <div className="flex items-center space-x-2 mb-4">
            <Cpu className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              ROS2 시스템 상태
            </h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {ros2Topics.total}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">총 토픽</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {ros2Topics.categories.robotControl.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">제어</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {ros2Topics.categories.robotStatus.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">상태</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {ros2Topics.categories.diagnostics.length}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">진단</div>
            </div>
          </div>
          
          {/* 헬스 상태 */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">시스템 헬스:</span>
              <div className="flex items-center space-x-2">
                {ros2Topics.health.status === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
                <span className={`text-sm font-medium ${
                  ros2Topics.health.status === 'healthy' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                }`}>
                  {ros2Topics.health.status === 'healthy' ? '정상' : '주의'}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* 에러 알림 (에러가 있을 때만 표시) */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50"
        >
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MainDashboard;