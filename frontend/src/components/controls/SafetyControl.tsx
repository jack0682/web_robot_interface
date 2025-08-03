/**
 * 로봇 안전 제어 컴포넌트 - 비상정지, 안전 모드 관리
 */
import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  ShieldOff, 
  StopCircle, 
  Power, 
  Lock, 
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
import { useRobotState } from '../../contexts/RobotStateContext';
import { sendRobotCommand } from '../../services/commandSender';
import toast from 'react-hot-toast';

interface SafetyStatus {
  emergencyStop: boolean;
  safetyMode: boolean;
  powerOn: boolean;
  motorEnabled: boolean;
  protectiveStop: boolean;
  safeguardStop: boolean;
}

export const SafetyControl: React.FC = () => {
  const { robotState } = useRobotState();
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus>({
    emergencyStop: false,
    safetyMode: true,
    powerOn: false,
    motorEnabled: false,
    protectiveStop: false,
    safeguardStop: false
  });
  const [isConfirming, setIsConfirming] = useState<string | null>(null);
  const [emergencyPressed, setEmergencyPressed] = useState(false);

  // 로봇 상태에서 안전 정보 업데이트
  useEffect(() => {
    if (robotState.safetyStatus) {
      setSafetyStatus(robotState.safetyStatus as any);
    }
  }, [robotState.safetyStatus]);

  // 비상정지 실행
  const handleEmergencyStop = async () => {
    if (emergencyPressed) return;
    
    try {
      setEmergencyPressed(true);
      await sendRobotCommand('emergencyStop');
      toast.error('비상정지 실행됨');
    } catch (error) {
      toast.error(`비상정지 실패: ${error}`);
    }
  };

  // 비상정지 해제
  const releaseEmergencyStop = async () => {
    if (!isConfirming) {
      setIsConfirming('emergency');
      setTimeout(() => setIsConfirming(null), 5000); // 5초 후 자동 취소
      return;
    }

    try {
      await sendRobotCommand('releaseEmergencyStop');
      setEmergencyPressed(false);
      setIsConfirming(null);
      toast.success('비상정지 해제됨');
    } catch (error) {
      toast.error(`비상정지 해제 실패: ${error}`);
    }
  };

  // 안전 모드 토글
  const toggleSafetyMode = async () => {
    try {
      const newMode = !safetyStatus.safetyMode;
      await sendRobotCommand('setSafetyMode', { enabled: newMode });
      toast.success(`안전 모드 ${newMode ? '활성화' : '비활성화'}`);
    } catch (error) {
      toast.error(`안전 모드 변경 실패: ${error}`);
    }
  };

  // 로봇 전원 토글
  const togglePower = async () => {
    if (!isConfirming) {
      setIsConfirming('power');
      setTimeout(() => setIsConfirming(null), 5000);
      return;
    }

    try {
      const newPowerState = !safetyStatus.powerOn;
      await sendRobotCommand('setPower', { enabled: newPowerState });
      setIsConfirming(null);
      toast.success(`로봇 전원 ${newPowerState ? '켜짐' : '꺼짐'}`);
    } catch (error) {
      toast.error(`전원 제어 실패: ${error}`);
    }
  };

  // 모터 활성화/비활성화
  const toggleMotor = async () => {
    try {
      const newMotorState = !safetyStatus.motorEnabled;
      await sendRobotCommand('setMotorEnabled', { enabled: newMotorState });
      toast.success(`모터 ${newMotorState ? '활성화' : '비활성화'}`);
    } catch (error) {
      toast.error(`모터 제어 실패: ${error}`);
    }
  };

  // 보호 정지 해제
  const releaseProtectiveStop = async () => {
    try {
      await sendRobotCommand('releaseProtectiveStop');
      toast.success('보호 정지 해제됨');
    } catch (error) {
      toast.error(`보호 정지 해제 실패: ${error}`);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        안전 제어
      </h2>

      {/* 전체 안전 상태 */}
      <div className="mb-6 p-4 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-4 h-4 rounded-full ${
              safetyStatus.emergencyStop ? 'bg-red-500' :
              safetyStatus.protectiveStop || safetyStatus.safeguardStop ? 'bg-yellow-500' :
              safetyStatus.safetyMode ? 'bg-green-500' : 'bg-gray-500'
            }`} />
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              전체 시스템 상태
            </span>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            safetyStatus.emergencyStop ? 'bg-red-100 text-red-800' :
            safetyStatus.protectiveStop || safetyStatus.safeguardStop ? 'bg-yellow-100 text-yellow-800' :
            safetyStatus.safetyMode ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {safetyStatus.emergencyStop ? '비상정지' :
             safetyStatus.protectiveStop ? '보호정지' :
             safetyStatus.safeguardStop ? '안전장치정지' :
             safetyStatus.safetyMode ? '안전모드' : '비안전모드'}
          </span>
        </div>
      </div>

      {/* 비상정지 버튼 */}
      <div className="mb-6">
        <div className="flex gap-4">
          <button
            onClick={handleEmergencyStop}
            disabled={emergencyPressed}
            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-bold text-lg transition-all transform ${
              emergencyPressed 
                ? 'bg-red-700 text-white scale-95' 
                : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105 active:scale-95'
            } disabled:cursor-not-allowed`}
          >
            <StopCircle size={24} />
            비상정지
          </button>
          
          {emergencyPressed && (
            <button
              onClick={releaseEmergencyStop}
              className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-lg font-bold text-lg transition-all ${
                isConfirming === 'emergency'
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-gray-500 hover:bg-gray-600 text-white'
              }`}
            >
              <Unlock size={24} />
              {isConfirming === 'emergency' ? '다시 클릭하여 해제' : '비상정지 해제'}
            </button>
          )}
        </div>
        
        {isConfirming === 'emergency' && (
          <div className="mt-2 text-sm text-yellow-600 dark:text-yellow-400 text-center">
            5초 내에 다시 클릭하여 비상정지를 해제하세요
          </div>
        )}
      </div>

      {/* 안전 상태 그리드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* 안전 모드 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {safetyStatus.safetyMode ? <Shield className="text-green-600" size={20} /> : <ShieldOff className="text-red-600" size={20} />}
              <span className="font-medium text-gray-900 dark:text-gray-100">안전 모드</span>
            </div>
            <button
              onClick={toggleSafetyMode}
              disabled={safetyStatus.emergencyStop}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                safetyStatus.safetyMode ? 'bg-green-500' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                safetyStatus.safetyMode ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {safetyStatus.safetyMode ? '안전 기능 활성화됨' : '안전 기능 비활성화됨'}
          </div>
        </div>

        {/* 전원 상태 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Power className={safetyStatus.powerOn ? 'text-blue-600' : 'text-gray-400'} size={20} />
              <span className="font-medium text-gray-900 dark:text-gray-100">로봇 전원</span>
            </div>
            <button
              onClick={togglePower}
              disabled={safetyStatus.emergencyStop}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                isConfirming === 'power'
                  ? 'bg-yellow-500 text-white'
                  : safetyStatus.powerOn 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:bg-gray-300 disabled:text-gray-500`}
            >
              {isConfirming === 'power' 
                ? '확인' 
                : safetyStatus.powerOn ? '끄기' : '켜기'
              }
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {safetyStatus.powerOn ? '전원 켜짐' : '전원 꺼짐'}
          </div>
        </div>

        {/* 모터 상태 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {safetyStatus.motorEnabled ? <Eye className="text-green-600" size={20} /> : <EyeOff className="text-gray-400" size={20} />}
              <span className="font-medium text-gray-900 dark:text-gray-100">모터</span>
            </div>
            <button
              onClick={toggleMotor}
              disabled={safetyStatus.emergencyStop || !safetyStatus.powerOn}
              className={`w-12 h-6 rounded-full relative transition-colors ${
                safetyStatus.motorEnabled ? 'bg-green-500' : 'bg-gray-300'
              } disabled:opacity-50`}
            >
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                safetyStatus.motorEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {safetyStatus.motorEnabled ? '모터 활성화됨' : '모터 비활성화됨'}
          </div>
        </div>

        {/* 보호 정지 상태 */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className={safetyStatus.protectiveStop ? 'text-yellow-600' : 'text-gray-400'} size={20} />
              <span className="font-medium text-gray-900 dark:text-gray-100">보호 정지</span>
            </div>
            {safetyStatus.protectiveStop && (
              <button
                onClick={releaseProtectiveStop}
                className="px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-sm font-medium transition-colors"
              >
                해제
              </button>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {safetyStatus.protectiveStop ? '보호 정지 활성' : '정상 운행'}
          </div>
        </div>
      </div>

      {/* 경고 메시지 */}
      {(safetyStatus.emergencyStop || safetyStatus.protectiveStop || safetyStatus.safeguardStop) && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="text-red-600" size={20} />
            <span className="font-medium text-red-800">안전 경고</span>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {safetyStatus.emergencyStop && <li>• 비상정지가 활성화되었습니다</li>}
            {safetyStatus.protectiveStop && <li>• 보호 정지가 활성화되었습니다</li>}
            {safetyStatus.safeguardStop && <li>• 안전장치 정지가 활성화되었습니다</li>}
          </ul>
        </div>
      )}

      {/* 안전 체크리스트 */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-3">안전 운영 체크리스트</h3>
        <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={safetyStatus.safetyMode} readOnly className="rounded" />
            <span>안전 모드 활성화</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!safetyStatus.emergencyStop} readOnly className="rounded" />
            <span>비상정지 해제</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={safetyStatus.powerOn} readOnly className="rounded" />
            <span>로봇 전원 공급</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={safetyStatus.motorEnabled} readOnly className="rounded" />
            <span>모터 활성화</span>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!safetyStatus.protectiveStop && !safetyStatus.safeguardStop} readOnly className="rounded" />
            <span>보호 시스템 정상</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SafetyControl;