/**
 * 로봇 조인트 제어 컴포넌트 - 개별 조인트 위치 제어
 */
import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Lock, Unlock, AlertTriangle } from 'lucide-react';
import { useRobotState } from '../../contexts/RobotStateContext';
import { sendRobotCommand } from '../../services/commandSender';
import toast from 'react-hot-toast';

interface JointControlProps {
  jointIndex: number;
  currentPosition: number;
  minPosition: number;
  maxPosition: number;
  velocity?: number;
  torque?: number;
  isEnabled?: boolean;
  onPositionChange?: (jointIndex: number, position: number) => void;
}

// 개별 조인트 제어 컴포넌트
export const JointControl: React.FC<JointControlProps> = ({
  jointIndex,
  currentPosition,
  minPosition = -180,
  maxPosition = 180,
  velocity = 0,
  torque = 0,
  isEnabled = true,
  onPositionChange
}) => {
  const [targetPosition, setTargetPosition] = useState(currentPosition);
  const [isLocked, setIsLocked] = useState(false);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    setTargetPosition(currentPosition);
  }, [currentPosition]);

  // 위치 변경 핸들러
  const handlePositionChange = (newPosition: number) => {
    const clampedPosition = Math.max(minPosition, Math.min(maxPosition, newPosition));
    setTargetPosition(clampedPosition);
    onPositionChange?.(jointIndex, clampedPosition);
  };

  // 조인트 이동 명령
  const moveJoint = async () => {
    if (isLocked || !isEnabled) return;

    try {
      setIsMoving(true);
      await sendRobotCommand('moveJoint', {
        jointIndex,
        position: targetPosition,
        velocity: 30 // 기본 속도
      });
      toast.success(`Joint ${jointIndex + 1} 이동 완료`);
    } catch (error) {
      toast.error(`Joint ${jointIndex + 1} 이동 실패: ${error}`);
    } finally {
      setIsMoving(false);
    }
  };

  // 조인트 정지
  const stopJoint = async () => {
    try {
      await sendRobotCommand('stopJoint', { jointIndex });
      setIsMoving(false);
      toast.success(`Joint ${jointIndex + 1} 정지`);
    } catch (error) {
      toast.error(`Joint ${jointIndex + 1} 정지 실패: ${error}`);
    }
  };

  // 위치 초기화
  const resetPosition = () => {
    handlePositionChange(0);
  };

  // 상태에 따른 색상 결정
  const getStatusColor = () => {
    if (!isEnabled) return 'text-gray-400';
    if (isMoving) return 'text-blue-500';
    if (Math.abs(velocity) > 0.1) return 'text-green-500';
    return 'text-gray-600';
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 border ${
      isEnabled ? 'border-gray-200 dark:border-gray-700' : 'border-gray-300 dark:border-gray-600 opacity-50'
    }`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Joint {jointIndex + 1}
        </h4>
        <div className="flex gap-2">
          {/* 잠금 토글 */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            className={`p-2 rounded ${
              isLocked 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
          </button>
          
          {/* 경고 표시 */}
          {Math.abs(torque) > 5 && (
            <div className="p-2 bg-yellow-100 text-yellow-600 rounded">
              <AlertTriangle size={16} />
            </div>
          )}
        </div>
      </div>

      {/* 현재 상태 표시 */}
      <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">현재위치</div>
          <div className={`font-mono font-bold ${getStatusColor()}`}>
            {currentPosition.toFixed(1)}°
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">속도</div>
          <div className="font-mono font-bold text-blue-600">
            {velocity.toFixed(2)} rad/s
          </div>
        </div>
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">토크</div>
          <div className="font-mono font-bold text-orange-600">
            {torque.toFixed(2)} Nm
          </div>
        </div>
      </div>

      {/* 위치 제어 슬라이더 */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>{minPosition}°</span>
          <span>목표위치: {targetPosition.toFixed(1)}°</span>
          <span>{maxPosition}°</span>
        </div>
        <input
          type="range"
          min={minPosition}
          max={maxPosition}
          step={0.1}
          value={targetPosition}
          onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
          disabled={isLocked || !isEnabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* 수치 입력 */}
      <div className="mb-4">
        <input
          type="number"
          min={minPosition}
          max={maxPosition}
          step={0.1}
          value={targetPosition}
          onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
          disabled={isLocked || !isEnabled}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white disabled:opacity-50"
          placeholder="목표 위치 (도)"
        />
      </div>

      {/* 제어 버튼 */}
      <div className="flex gap-2">
        <button
          onClick={isMoving ? stopJoint : moveJoint}
          disabled={isLocked || !isEnabled}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${
            isMoving
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:text-gray-500'
          }`}
        >
          {isMoving ? <Pause size={16} /> : <Play size={16} />}
          {isMoving ? '정지' : '이동'}
        </button>
        
        <button
          onClick={resetPosition}
          disabled={isLocked || !isEnabled}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* 진행 표시 */}
      {isMoving && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300 animate-pulse"
              style={{ width: '100%' }}
            />
          </div>
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
            이동 중...
          </div>
        </div>
      )}
    </div>
  );
};

// 전체 조인트 제어 패널
export const JointControlPanel: React.FC = () => {
  const { robotState } = useRobotState();
  const [allTargetPositions, setAllTargetPositions] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [isGroupMoving, setIsGroupMoving] = useState(false);

  // 조인트 제한값 (Doosan M0609 기준)
  const jointLimits = [
    { min: -360, max: 360 },  // J1
    { min: -95, max: 95 },    // J2
    { min: -180, max: 180 },  // J3
    { min: -360, max: 360 },  // J4
    { min: -180, max: 180 },  // J5
    { min: -360, max: 360 }   // J6
  ];

  // 개별 조인트 위치 변경 핸들러
  const handleJointPositionChange = (jointIndex: number, position: number) => {
    const newPositions = [...allTargetPositions];
    newPositions[jointIndex] = position;
    setAllTargetPositions(newPositions);
  };

  // 모든 조인트 동시 이동
  const moveAllJoints = async () => {
    try {
      setIsGroupMoving(true);
      await sendRobotCommand('moveJ', {
        targetPositions: allTargetPositions,
        velocity: 30,
        acceleration: 30
      });
      toast.success('모든 조인트 이동 완료');
    } catch (error) {
      toast.error(`조인트 이동 실패: ${error}`);
    } finally {
      setIsGroupMoving(false);
    }
  };

  // 모든 조인트 정지
  const stopAllJoints = async () => {
    try {
      await sendRobotCommand('stopAll');
      setIsGroupMoving(false);
      toast.success('모든 조인트 정지');
    } catch (error) {
      toast.error(`정지 실패: ${error}`);
    }
  };

  // 홈 포지션으로 이동
  const moveToHome = async () => {
    const homePositions = [0, 0, 0, 0, 0, 0];
    setAllTargetPositions(homePositions);
    
    try {
      setIsGroupMoving(true);
      await sendRobotCommand('moveJ', {
        targetPositions: homePositions,
        velocity: 20,
        acceleration: 20
      });
      toast.success('홈 포지션 이동 완료');
    } catch (error) {
      toast.error(`홈 포지션 이동 실패: ${error}`);
    } finally {
      setIsGroupMoving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 전체 제어 헤더 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            조인트 제어 패널
          </h2>
          <div className="flex gap-2">
            <button
              onClick={moveToHome}
              disabled={isGroupMoving}
              className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
            >
              홈 포지션
            </button>
            <button
              onClick={isGroupMoving ? stopAllJoints : moveAllJoints}
              className={`px-4 py-2 rounded-md font-medium transition-colors ${
                isGroupMoving
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isGroupMoving ? '전체 정지' : '전체 이동'}
            </button>
          </div>
        </div>

        {/* 전체 진행 상태 */}
        {isGroupMoving && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
              <div className="bg-blue-600 h-3 rounded-full animate-pulse" style={{ width: '100%' }} />
            </div>
            <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
              전체 조인트 이동 중...
            </div>
          </div>
        )}
      </div>

      {/* 개별 조인트 제어 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {robotState.jointPositions.map((position, index) => (
          <JointControl
            key={index}
            jointIndex={index}
            currentPosition={position}
            minPosition={jointLimits[index].min}
            maxPosition={jointLimits[index].max}
            velocity={robotState.jointVelocities?.[index] || 0}
            torque={robotState.jointTorques?.[index] || 0}
            isEnabled={robotState.isConnected && robotState.robotMode === 'manual'}
            onPositionChange={handleJointPositionChange}
          />
        ))}
      </div>

      {/* 빠른 포지션 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          빠른 포지션
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: '홈', positions: [0, 0, 0, 0, 0, 0] },
            { name: '수직', positions: [0, -90, 90, 0, 0, 0] },
            { name: '대기', positions: [0, -45, 45, 0, -90, 0] },
            { name: '접기', positions: [0, -90, 135, 0, -45, 0] }
          ].map((preset, index) => (
            <button
              key={index}
              onClick={() => setAllTargetPositions(preset.positions)}
              disabled={isGroupMoving}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md transition-colors disabled:opacity-50"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default JointControlPanel;