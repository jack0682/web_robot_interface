/**
 * 로봇 상태 패널 - 수정된 버전 (문자열 이스케이프 오류 해결)
 */
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, 
  Activity, 
  MapPin, 
  RotateCcw, 
  AlertCircle,
  CheckCircle2,
  Wifi,
  Settings
} from 'lucide-react';

// Hook import 수정
import { useRobotStore } from '../../store/robotStore';
import { useMqttData } from '../../hooks/useMqttData';

interface RobotStatusPanelProps {
  className?: string;
}

const RobotStatusPanel: React.FC<RobotStatusPanelProps> = ({ 
  className = '' 
}) => {
  const [selectedView, setSelectedView] = useState<'joints' | 'pose' | 'topics'>('joints');
  
  // Hook에서 직접 데이터 가져오기
  const robotState = useRobotStore();
  const { ros2Topics } = useMqttData();

  // 상태별 색상과 아이콘
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'idle':
        return { color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/20', icon: CheckCircle2 };
      case 'moving':
        return { color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/20', icon: Activity };
      case 'error':
        return { color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/20', icon: AlertCircle };
      case 'connected':
        return { color: 'text-green-500', bgColor: 'bg-green-100 dark:bg-green-900/20', icon: Wifi };
      case 'disconnected':
        return { color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-900/20', icon: AlertCircle };
      default:
        return { color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-900/20', icon: Settings };
    }
  };

  const statusConfig = getStatusConfig(robotState.status);
  const StatusIcon = statusConfig.icon;

  // 관절 상태 렌더링
  const renderJointStatus = () => (
    <div className="space-y-3">
      {robotState.jointState.joints.map((joint, index) => (
        <motion.div
          key={joint.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                J{joint.id}
              </span>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {joint.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {joint.limits.min}° ~ {joint.limits.max}°
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="font-mono text-lg font-medium text-gray-900 dark:text-white">
              {joint.position.toFixed(1)}°
            </div>
            {joint.velocity && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {joint.velocity.toFixed(1)}°/s
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );

  // 포즈 정보 렌더링
  const renderPoseInfo = () => (
    <div className="space-y-4">
      {/* 카르테지안 좌표 */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <MapPin className="w-4 h-4 mr-2" />
          위치 (mm)
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(robotState.pose.position).map(([axis, value]) => (
            <div key={axis} className="text-center">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                {axis}
              </div>
              <div className="font-mono text-lg font-medium text-gray-900 dark:text-white">
                {typeof value === 'number' ? value.toFixed(1) : '0.0'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 모드 및 설정 */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center">
          <Settings className="w-4 h-4 mr-2" />
          설정
        </h4>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">모드</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {robotState.mode === 'manual' ? '수동' : 
               robotState.mode === 'auto' ? '자동' : robotState.mode}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">속도</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {robotState.speed}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">가속도</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {robotState.acceleration}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ROS2 토픽 정보 렌더링
  const renderROS2Topics = () => (
    <div className="space-y-4">
      {ros2Topics ? (
        <>
          {/* 토픽 요약 */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900 dark:text-white">토픽 요약</h4>
              <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded">
                총 {ros2Topics.total}개
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">제어</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ros2Topics.categories.robotControl.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">상태</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ros2Topics.categories.robotStatus.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">진단</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ros2Topics.categories.diagnostics.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">시스템</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {ros2Topics.categories.system.length}
                </span>
              </div>
            </div>
          </div>

          {/* 토픽 상태 */}
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">상태</h4>
            <div className="flex items-center space-x-2">
              {ros2Topics.health.status === 'healthy' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-sm text-gray-900 dark:text-white">
                {ros2Topics.health.status === 'healthy' ? '정상' : '주의 필요'}
              </span>
            </div>
            
            {ros2Topics.health.issues.length > 0 && (
              <div className="mt-2 space-y-1">
                {ros2Topics.health.issues.slice(0, 3).map((issue, index) => (
                  <div key={index} className="text-xs text-yellow-600 dark:text-yellow-400">
                    • {issue}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 최근 변경사항 */}
          {(ros2Topics.changes.added.length > 0 || ros2Topics.changes.removed.length > 0) && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">최근 변경</h4>
              {ros2Topics.changes.added.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-green-600 dark:text-green-400 mb-1">추가된 토픽:</div>
                  {ros2Topics.changes.added.slice(0, 3).map((topic, index) => (
                    <div key={index} className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                      + {topic}
                    </div>
                  ))}
                </div>
              )}
              {ros2Topics.changes.removed.length > 0 && (
                <div>
                  <div className="text-xs text-red-600 dark:text-red-400 mb-1">제거된 토픽:</div>
                  {ros2Topics.changes.removed.slice(0, 3).map((topic, index) => (
                    <div key={index} className="text-xs text-gray-600 dark:text-gray-400 ml-2">
                      - {topic}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <div className="text-sm">ROS2 토픽 데이터를 기다리는 중...</div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`robot-status-panel bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* 패널 헤더 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${statusConfig.bgColor}`}>
              <StatusIcon className={`w-5 h-5 ${statusConfig.color}`} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">로봇 상태</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {robotState.info.model} • {robotState.info.ipAddress}
              </p>
            </div>
          </div>
          
          {/* 상태 표시 */}
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}>
            {robotState.status === 'idle' ? '대기' :
             robotState.status === 'moving' ? '이동중' :
             robotState.status === 'error' ? '오류' :
             robotState.status === 'disconnected' ? '연결끊김' : robotState.status}
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'joints', label: '관절', icon: RotateCcw },
          { key: 'pose', label: '포즈', icon: MapPin },
          { key: 'topics', label: 'ROS2', icon: Activity }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedView(key as any)}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 text-sm font-medium transition-colors ${
              selectedView === key
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      <div className="p-4 max-h-96 overflow-y-auto">
        <motion.div
          key={selectedView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {selectedView === 'joints' && renderJointStatus()}
          {selectedView === 'pose' && renderPoseInfo()}
          {selectedView === 'topics' && renderROS2Topics()}
        </motion.div>
      </div>

      {/* 마지막 업데이트 시간 */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          마지막 업데이트: {new Date(robotState.lastUpdate).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
};

export default RobotStatusPanel;