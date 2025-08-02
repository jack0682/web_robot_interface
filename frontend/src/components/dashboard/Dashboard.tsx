import React from 'react';
import GridLayout from './GridLayout';
import { useMqttConnection } from '@/hooks/useMqttConnection';
import { useRobotData } from '@/hooks/useROS2Data';
import { useSensorData } from '@/hooks/useSensorData';

const Dashboard: React.FC = () => {
  const { isConnected } = useMqttConnection();
  const { robotStatus, jointStates } = useRobotData();
  const { sensorData } = useSensorData();

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            연결 중...
          </h2>
          <p className="text-gray-600 dark:text-gray-300">
            로봇 시스템에 연결을 시도하고 있습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          로봇 제어 대시보드
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Doosan M0609 실시간 모니터링 및 제어
        </p>
      </div>
      
      <GridLayout 
        robotStatus={robotStatus}
        jointStates={jointStates}
        sensorData={sensorData}
      />
    </div>
  );
};

export default Dashboard;
