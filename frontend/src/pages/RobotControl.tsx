/**
 * 로봇 제어 페이지
 * 로봇의 움직임을 제어하고 관절 위치를 조정하는 인터페이스
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  Square, 
  RotateCcw, 
  Settings,
  Target,
  Home,
  AlertTriangle 
} from 'lucide-react';

// 컴포넌트
import RobotControlPanel from '../components/controls/RobotControlPanel';
import JointControlPanel from '../components/controls/JointControlPanel';
import PositionControlPanel from '../components/controls/PositionControlPanel';
import EmergencyStopButton from '../components/controls/EmergencyStopButton';
import RobotVisualization from '../components/visualization/RobotVisualization';

// 훅과 스토어
import { useRobotStore } from '../store/robotStore';
import { sendRobotCommand } from '../services/commandSender';
import toast from 'react-hot-toast';

const RobotControl: React.FC = () => {
  const { isConnected, status, jointPositions } = useRobotStore();
  const [activeTab, setActiveTab] = useState<'basic' | 'joint' | 'position'>('basic');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmergencyStop = async () => {
    try {
      await sendRobotCommand('emergency_stop');
      toast.error('비상 정지 실행');
    } catch (error) {
      toast.error('비상 정지 실패');
    }
  };

  const handleHomePosition = async () => {
    if (!isConnected) {
      toast.error('로봇이 연결되지 않았습니다');
      return;
    }

    setIsLoading(true);
    try {
      await sendRobotCommand('home');
      toast.success('홈 위치로 이동 중');
    } catch (error) {
      toast.error('홈 위치 이동 실패');
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'basic', label: '기본 제어', icon: Play },
    { id: 'joint', label: '관절 제어', icon: Settings },
    { id: 'position', label: '위치 제어', icon: Target },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                로봇 제어
              </h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Doosan M0609 로봇암의 움직임과 위치를 제어합니다
              </p>
            </div>

            <div className="flex items-center space-x-3">
              {/* 연결 상태 */}
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                isConnected 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
              }`}>
                {isConnected ? '연결됨' : '연결 끊어짐'}
              </div>

              {/* 홈 위치 버튼 */}
              <button
                onClick={handleHomePosition}
                disabled={!isConnected || isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
              >
                <Home className="w-4 h-4 mr-2" />
                홈 위치
              </button>
            </div>
          </div>
        </div>

        {/* 연결 경고 */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
          >
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
              <span className="text-yellow-800 dark:text-yellow-200">
                로봇이 연결되지 않았습니다. 제어 기능이 제한됩니다.
              </span>
            </div>
          </motion.div>
        )}

        {/* 메인 레이아웃 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 로봇 시각화 */}
          <div className="xl:col-span-2">
            <RobotVisualization />
          </div>

          {/* 비상 정지 */}
          <div className="order-first xl:order-last">
            <EmergencyStopButton onEmergencyStop={handleEmergencyStop} />
          </div>
        </div>

        {/* 제어 패널 탭 */}
        <div className="mt-6">
          {/* 탭 네비게이션 */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* 탭 콘텐츠 */}
          <div className="mt-6">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'basic' && <RobotControlPanel />}
              {activeTab === 'joint' && <JointControlPanel />}
              {activeTab === 'position' && <PositionControlPanel />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RobotControl;