/**
 * 로봇 좌표계 제어 컴포넌트 - 카르테시안 좌표 기반 로봇 제어
 */
import React, { useState, useEffect } from 'react';
import { Move, RotateCw, Target, Crosshair, Home, AlertCircle } from 'lucide-react';
import { useRobotState } from '../../contexts/RobotStateContext';
import { sendRobotCommand } from '../../services/commandSender';
import toast from 'react-hot-toast';

interface CartesianPosition {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
}

interface CartesianControlProps {
  className?: string;
}

export const CartesianControl: React.FC<CartesianControlProps> = ({ className = "" }) => {
  const { robotState } = useRobotState();
  const [targetPosition, setTargetPosition] = useState<CartesianPosition>({
    x: 400, y: 0, z: 400, rx: 0, ry: 0, rz: 0
  });
  const [currentPosition, setCurrentPosition] = useState<CartesianPosition>({
    x: 400, y: 0, z: 400, rx: 0, ry: 0, rz: 0
  });
  const [moveMode, setMoveMode] = useState<'linear' | 'joint'>('linear');
  const [stepSize, setStepSize] = useState(10); // mm 또는 도
  const [isMoving, setIsMoving] = useState(false);
  const [coordinateFrame, setCoordinateFrame] = useState<'world' | 'tool'>('world');

  // 현재 위치 업데이트 (로봇 상태에서)
  useEffect(() => {
    if (robotState.cartesianPosition) {
      setCurrentPosition(robotState.cartesianPosition);
    }
  }, [robotState.cartesianPosition]);

  // 위치 입력 핸들러
  const handlePositionChange = (axis: keyof CartesianPosition, value: number) => {
    setTargetPosition(prev => ({
      ...prev,
      [axis]: value
    }));
  };

  // 스텝 이동 함수
  const stepMove = async (axis: keyof CartesianPosition, direction: 1 | -1) => {
    const newPosition = { ...targetPosition };
    newPosition[axis] += direction * stepSize;
    
    // 안전 범위 체크
    const limits = {
      x: { min: -1000, max: 1000 },
      y: { min: -1000, max: 1000 },
      z: { min: 0, max: 1000 },
      rx: { min: -180, max: 180 },
      ry: { min: -180, max: 180 },
      rz: { min: -180, max: 180 }
    };

    if (newPosition[axis] < limits[axis].min || newPosition[axis] > limits[axis].max) {
      toast.error(`${axis.toUpperCase()} 축 이동 한계 초과`);
      return;
    }

    setTargetPosition(newPosition);
    await executeMove(newPosition);
  };

  // 이동 실행
  const executeMove = async (position: CartesianPosition) => {
    if (!robotState.isConnected) {
      toast.error('로봇이 연결되지 않았습니다');
      return;
    }

    try {
      setIsMoving(true);
      
      const command = moveMode === 'linear' ? 'moveL' : 'moveC';
      await sendRobotCommand(command, {
        position: [position.x, position.y, position.z, position.rx, position.ry, position.rz],
        velocity: 100, // mm/s
        acceleration: 100,
        coordinateFrame
      });
      
      toast.success('이동 완료');
    } catch (error) {
      toast.error(`이동 실패: ${error}`);
    } finally {
      setIsMoving(false);
    }
  };

  // 직접 이동
  const moveToTarget = () => {
    executeMove(targetPosition);
  };

  // 현재 위치를 목표로 설정
  const useCurrentAsTarget = () => {
    setTargetPosition(currentPosition);
  };

  // 홈 포지션으로 이동
  const moveToHome = async () => {
    const homePosition = { x: 400, y: 0, z: 400, rx: 0, ry: 0, rz: 0 };
    setTargetPosition(homePosition);
    await executeMove(homePosition);
  };

  // 안전 체크
  const isSafePosition = (pos: CartesianPosition) => {
    return pos.x > -1000 && pos.x < 1000 &&
           pos.y > -1000 && pos.y < 1000 &&
           pos.z > 0 && pos.z < 1000;
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 ${className}`}>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          카르테시안 좌표 제어
        </h2>
        <div className="flex gap-2">
          {/* 좌표계 선택 */}
          <select
            value={coordinateFrame}
            onChange={(e) => setCoordinateFrame(e.target.value as 'world' | 'tool')}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="world">월드 좌표계</option>
            <option value="tool">툴 좌표계</option>
          </select>
          
          {/* 이동 모드 선택 */}
          <select
            value={moveMode}
            onChange={(e) => setMoveMode(e.target.value as 'linear' | 'joint')}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
          >
            <option value="linear">직선 이동</option>
            <option value="joint">관절 이동</option>
          </select>
        </div>
      </div>

      {/* 안전 경고 */}
      {!isSafePosition(targetPosition) && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 rounded-md flex items-center gap-2 text-red-700">
          <AlertCircle size={20} />
          <span>목표 위치가 안전 범위를 벗어났습니다!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 현재 위치 표시 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            현재 위치
          </h3>
          <div className="space-y-3">
            {/* 위치 */}
            <div className="grid grid-cols-3 gap-3">
              {(['x', 'y', 'z'] as const).map(axis => (
                <div key={axis} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 uppercase">{axis}</div>
                  <div className="text-lg font-mono font-bold text-blue-600">
                    {currentPosition[axis].toFixed(1)} mm
                  </div>
                </div>
              ))}
            </div>
            
            {/* 회전 */}
            <div className="grid grid-cols-3 gap-3">
              {(['rx', 'ry', 'rz'] as const).map(axis => (
                <div key={axis} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                  <div className="text-sm text-gray-500 dark:text-gray-400 uppercase">{axis}</div>
                  <div className="text-lg font-mono font-bold text-orange-600">
                    {currentPosition[axis].toFixed(1)}°
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 목표 위치 설정 */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            목표 위치
          </h3>
          <div className="space-y-3">
            {/* 위치 입력 */}
            <div className="grid grid-cols-3 gap-3">
              {(['x', 'y', 'z'] as const).map(axis => (
                <div key={axis}>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {axis} (mm)
                  </label>
                  <input
                    type="number"
                    value={targetPosition[axis]}
                    onChange={(e) => handlePositionChange(axis, parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    step="0.1"
                  />
                </div>
              ))}
            </div>
            
            {/* 회전 입력 */}
            <div className="grid grid-cols-3 gap-3">
              {(['rx', 'ry', 'rz'] as const).map(axis => (
                <div key={axis}>
                  <label className="block text-sm text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {axis} (°)
                  </label>
                  <input
                    type="number"
                    value={targetPosition[axis]}
                    onChange={(e) => handlePositionChange(axis, parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    step="0.1"
                    min="-180"
                    max="180"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 스텝 이동 제어 */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            스텝 이동
          </h3>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">스텝 크기:</label>
            <select
              value={stepSize}
              onChange={(e) => setStepSize(parseFloat(e.target.value))}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
            >
              <option value={1}>1 mm/°</option>
              <option value={5}>5 mm/°</option>
              <option value={10}>10 mm/°</option>
              <option value={25}>25 mm/°</option>
              <option value={50}>50 mm/°</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* 위치 스텝 이동 */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">위치 (mm)</h4>
            <div className="space-y-2">
              {(['x', 'y', 'z'] as const).map(axis => (
                <div key={axis} className="flex items-center gap-2">
                  <span className="w-6 text-sm font-medium uppercase">{axis}:</span>
                  <button
                    onClick={() => stepMove(axis, -1)}
                    disabled={isMoving}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    -{stepSize}
                  </button>
                  <button
                    onClick={() => stepMove(axis, 1)}
                    disabled={isMoving}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    +{stepSize}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* 회전 스텝 이동 */}
          <div>
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">회전 (°)</h4>
            <div className="space-y-2">
              {(['rx', 'ry', 'rz'] as const).map(axis => (
                <div key={axis} className="flex items-center gap-2">
                  <span className="w-8 text-sm font-medium uppercase">{axis}:</span>
                  <button
                    onClick={() => stepMove(axis, -1)}
                    disabled={isMoving}
                    className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    -{stepSize}
                  </button>
                  <button
                    onClick={() => stepMove(axis, 1)}
                    disabled={isMoving}
                    className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    +{stepSize}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 제어 버튼 */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={moveToTarget}
          disabled={isMoving || !isSafePosition(targetPosition)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Move size={20} />
          목표로 이동
        </button>
        
        <button
          onClick={useCurrentAsTarget}
          disabled={isMoving}
          className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Target size={20} />
          현재 위치 사용
        </button>
        
        <button
          onClick={moveToHome}
          disabled={isMoving}
          className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Home size={20} />
          홈 포지션
        </button>
      </div>

      {/* 이동 진행 상태 */}
      {isMoving && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700">
            <div className="bg-blue-600 h-3 rounded-full animate-pulse" style={{ width: '100%' }} />
          </div>
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-2">
            {moveMode === 'linear' ? '직선 이동' : '관절 이동'} 중...
          </div>
        </div>
      )}
    </div>
  );
};

export default CartesianControl;