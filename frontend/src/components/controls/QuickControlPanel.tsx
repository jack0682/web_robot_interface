/**
 * 빠른 제어 패널 컴포넌트 - Hook 연동 버전
 */
import React from 'react';
import { Play, Pause, Square, RotateCcw, Zap } from 'lucide-react';
import { useRobotStore } from '../../store/robotStore';
import toast from 'react-hot-toast';

interface QuickControlPanelProps {
  className?: string;
}

const QuickControlPanel: React.FC<QuickControlPanelProps> = ({
  className = ""
}) => {
  // Store에서 상태와 액션 가져오기
  const { 
    isConnected, 
    isMoving, 
    status,
    sendStopCommand,
    sendEmergencyStop,
    sendHomeCommand,
    canSendCommand
  } = useRobotStore();

  const buttonBaseClasses = "flex items-center justify-center p-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

  // 제어 함수들
  const handleStart = async () => {
    if (!canSendCommand()) {
      toast.error('로봇이 준비되지 않았습니다');
      return;
    }
    
    // 홈 위치로 이동 (시작 명령으로 대체)
    const success = await sendHomeCommand(30);
    if (success) {
      toast.success('로봇 시작');
    } else {
      toast.error('시작 명령 실패');
    }
  };

  const handlePause = async () => {
    if (!canSendCommand()) {
      toast.error('로봇이 준비되지 않았습니다');
      return;
    }
    
    const success = await sendStopCommand();
    if (success) {
      toast.success('일시정지');
    } else {
      toast.error('일시정지 명령 실패');
    }
  };

  const handleStop = async () => {
    if (!isConnected) {
      toast.error('로봇이 연결되지 않았습니다');
      return;
    }
    
    const success = await sendStopCommand();
    if (success) {
      toast.success('정지');
    } else {
      toast.error('정지 명령 실패');
    }
  };

  const handleReset = async () => {
    if (!canSendCommand()) {
      toast.error('로봇이 준비되지 않았습니다');
      return;
    }
    
    const success = await sendHomeCommand(20);
    if (success) {
      toast.success('홈 위치로 리셋');
    } else {
      toast.error('리셋 명령 실패');
    }
  };

  const handleEmergencyStop = async () => {
    const success = await sendEmergencyStop();
    if (success) {
      toast.error('비상정지 활성화', { icon: '🚨' });
    } else {
      toast.error('비상정지 명령 실패');
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        빠른 제어
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleStart}
          disabled={!canSendCommand() || isMoving}
          className={`${buttonBaseClasses} bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30`}
        >
          <Play className="w-5 h-5 mr-2" />
          시작
        </button>

        <button
          onClick={handlePause}
          disabled={!canSendCommand() || !isMoving}
          className={`${buttonBaseClasses} bg-yellow-100 text-yellow-700 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30`}
        >
          <Pause className="w-5 h-5 mr-2" />
          일시정지
        </button>

        <button
          onClick={handleStop}
          disabled={!isConnected}
          className={`${buttonBaseClasses} bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600`}
        >
          <Square className="w-5 h-5 mr-2" />
          정지
        </button>

        <button
          onClick={handleReset}
          disabled={!canSendCommand()}
          className={`${buttonBaseClasses} bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30`}
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          홈으로
        </button>
      </div>

      {/* 비상정지 버튼 */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleEmergencyStop}
          className={`w-full ${buttonBaseClasses} bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 shadow-lg`}
        >
          <Zap className="w-5 h-5 mr-2" />
          비상정지
        </button>
      </div>

      {/* 상태 정보 */}
      <div className="mt-4 space-y-2">
        {/* 연결 상태 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">연결 상태:</span>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`font-medium ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isConnected ? '연결됨' : '연결 끊김'}
            </span>
          </div>
        </div>

        {/* 로봇 상태 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">로봇 상태:</span>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              status === 'idle' ? 'bg-blue-500' :
              status === 'moving' ? 'bg-green-500' :
              status === 'error' ? 'bg-red-500' : 'bg-gray-500'
            }`} />
            <span className="font-medium text-gray-900 dark:text-white">
              {status === 'idle' ? '대기' :
               status === 'moving' ? '이동중' :
               status === 'error' ? '오류' :
               status === 'emergency' ? '비상정지' :
               status === 'disconnected' ? '연결끊김' : status}
            </span>
          </div>
        </div>

        {/* 제어 가능 여부 */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">제어 가능:</span>
          <span className={`font-medium ${canSendCommand() ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {canSendCommand() ? '예' : '아니오'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default QuickControlPanel;