/**
 * 로봇 상태 컨텍스트 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { 
  RobotState, 
  RobotAction, 
  DEFAULT_ROBOT_STATE,
  Timestamp,
  RobotStatus,
  RobotMode,
  SafetyStatus,
  OperationMode,
  RobotPose 
} from '../types/robotTypes';

interface RobotStateContextType {
  robotState: RobotState;
  state: RobotState;
  dispatch: React.Dispatch<RobotAction>;
  
  // 편의 메서드들
  setConnectionStatus: (connected: boolean) => void;
  setRobotStatus: (status: RobotStatus) => void;
  updateJointPositions: (positions: number[]) => void;
  updateEndEffectorPosition: (position: RobotPose) => void;
  setMovingStatus: (isMoving: boolean) => void;
  setSpeed: (speed: number) => void;
  setErrorMessage: (message: string | null) => void;
  setOperationMode: (mode: OperationMode) => void;
  setSafetyStatus: (status: SafetyStatus) => void;
  updateSystemInfo: (info: { batteryLevel?: number; temperature?: number }) => void;
  resetState: () => void;
}

const RobotStateContext = createContext<RobotStateContextType | undefined>(undefined);

function robotStateReducer(state: RobotState, action: RobotAction): RobotState {
  const now: Timestamp = new Date().toISOString();
  
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        isConnected: action.payload,
        status: action.payload ? 'connected' : 'disconnected',
        connectionQuality: action.payload ? 'good' : 'disconnected',
        errorMessage: action.payload ? null : state.errorMessage,
        lastUpdate: now,
      };

    case 'SET_ROBOT_STATUS':
      return {
        ...state,
        status: action.payload,
        lastUpdate: now,
      };

    case 'SET_JOINT_POSITIONS':
      // 조인트 상태와 관련 데이터 동기화
      const newJoints = state.jointState.joints.map((joint, index) => ({
        ...joint,
        position: action.payload[index] || joint.position
      })) as [any, any, any, any, any, any];
      
      return {
        ...state,
        jointState: {
          ...state.jointState,
          joints: newJoints,
          positions: action.payload,
          timestamp: now,
        },
        jointPositions: action.payload,
        pose: {
          ...state.pose,
          jointsAngle: action.payload,
          timestamp: now,
        },
        lastUpdate: now,
      };

    case 'SET_END_EFFECTOR_POSITION':
      return {
        ...state,
        endEffectorPosition: action.payload,
        pose: {
          ...state.pose,
          position: action.payload,
          timestamp: now,
        },
        lastUpdate: now,
      };

    case 'SET_MOVING_STATUS':
      return {
        ...state,
        isMoving: action.payload,
        status: action.payload ? 'moving' : 'idle',
        lastUpdate: now,
      };

    case 'SET_SPEED':
      return {
        ...state,
        speed: Math.max(0, Math.min(100, action.payload)), // 0-100% 제한
        lastUpdate: now,
      };

    case 'SET_ERROR_MESSAGE':
      return {
        ...state,
        errorMessage: action.payload,
        status: action.payload ? 'error' : state.status,
        lastUpdate: now,
      };

    case 'SET_OPERATION_MODE':
      return {
        ...state,
        operationMode: action.payload,
        mode: action.payload as RobotMode, // 호환성
        lastUpdate: now,
      };

    case 'SET_SAFETY_STATUS':
      return {
        ...state,
        safetyStatus: action.payload,
        status: action.payload === 'emergency' ? 'emergency' : state.status,
        lastUpdate: now,
      };

    case 'SET_SYSTEM_INFO':
      return {
        ...state,
        batteryLevel: action.payload.batteryLevel ?? state.batteryLevel,
        temperature: action.payload.temperature ?? state.temperature,
        lastUpdate: now,
      };

    case 'UPDATE_ROBOT_STATE':
      return {
        ...state,
        ...action.payload,
        lastUpdate: now,
      };

    default:
      console.warn(`Unknown action type: ${action.type}`);
      return state;
  }
}

export const RobotStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(robotStateReducer, DEFAULT_ROBOT_STATE);

  // 편의 메서드들
  const setConnectionStatus = useCallback((connected: boolean) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected, timestamp: new Date().toISOString() });
  }, []);

  const setRobotStatus = useCallback((status: RobotStatus) => {
    dispatch({ type: 'SET_ROBOT_STATUS', payload: status, timestamp: new Date().toISOString() });
  }, []);

  const updateJointPositions = useCallback((positions: number[]) => {
    if (positions.length === 6) {
      dispatch({ type: 'SET_JOINT_POSITIONS', payload: positions, timestamp: new Date().toISOString() });
    } else {
      console.warn('Joint positions must be an array of 6 values');
    }
  }, []);

  const updateEndEffectorPosition = useCallback((position: RobotPose) => {
    dispatch({ type: 'SET_END_EFFECTOR_POSITION', payload: position, timestamp: new Date().toISOString() });
  }, []);

  const setMovingStatus = useCallback((isMoving: boolean) => {
    dispatch({ type: 'SET_MOVING_STATUS', payload: isMoving, timestamp: new Date().toISOString() });
  }, []);

  const setSpeed = useCallback((speed: number) => {
    dispatch({ type: 'SET_SPEED', payload: speed, timestamp: new Date().toISOString() });
  }, []);

  const setErrorMessage = useCallback((message: string | null) => {
    dispatch({ type: 'SET_ERROR_MESSAGE', payload: message, timestamp: new Date().toISOString() });
  }, []);

  const setOperationMode = useCallback((mode: OperationMode) => {
    dispatch({ type: 'SET_OPERATION_MODE', payload: mode, timestamp: new Date().toISOString() });
  }, []);

  const setSafetyStatus = useCallback((status: SafetyStatus) => {
    dispatch({ type: 'SET_SAFETY_STATUS', payload: status, timestamp: new Date().toISOString() });
  }, []);

  const updateSystemInfo = useCallback((info: { batteryLevel?: number; temperature?: number }) => {
    dispatch({ type: 'SET_SYSTEM_INFO', payload: info, timestamp: new Date().toISOString() });
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'UPDATE_ROBOT_STATE', payload: DEFAULT_ROBOT_STATE, timestamp: new Date().toISOString() });
  }, []);

  // 백엔드 상태 동기화
  useEffect(() => {
    const checkRobotStatus = async () => {
      try {
        const response = await fetch('/api/robot/status');
        if (response.ok) {
          const data = await response.json();
          
          // 연결 상태 업데이트
          setConnectionStatus(data.connected || false);
          
          if (data.connected) {
            // 로봇 상태 정보 업데이트
            if (data.status) setRobotStatus(data.status);
            if (data.jointPositions) updateJointPositions(data.jointPositions);
            if (data.endEffectorPosition) updateEndEffectorPosition(data.endEffectorPosition);
            if (data.speed !== undefined) setSpeed(data.speed);
            if (data.isMoving !== undefined) setMovingStatus(data.isMoving);
            if (data.safetyStatus) setSafetyStatus(data.safetyStatus);
            if (data.operationMode) setOperationMode(data.operationMode);
            
            // 시스템 정보 업데이트
            updateSystemInfo({
              batteryLevel: data.batteryLevel,
              temperature: data.temperature
            });
          }
        } else {
          setConnectionStatus(false);
          setErrorMessage('로봇 서버와의 통신 실패');
        }
      } catch (error) {
        console.error('Failed to check robot status:', error);
        setConnectionStatus(false);
        setErrorMessage(`연결 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      }
    };

    // 초기 상태 확인
    checkRobotStatus();

    // 주기적 상태 확인 (3초마다)
    const statusInterval = setInterval(checkRobotStatus, 3000);

    // 연결 상태 확인 (10초마다)
    const connectionInterval = setInterval(() => {
      if (!state.isConnected) {
        checkRobotStatus();
      }
    }, 10000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(connectionInterval);
    };
  }, [
    setConnectionStatus, 
    setRobotStatus, 
    updateJointPositions, 
    updateEndEffectorPosition,
    setSpeed,
    setMovingStatus,
    setSafetyStatus,
    setOperationMode,
    updateSystemInfo,
    setErrorMessage,
    state.isConnected
  ]);

  // 페이지 가시성 변경 시 상태 갱신
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && state.isConnected) {
        // 페이지가 다시 보일 때 상태 갱신
        dispatch({ type: 'UPDATE_ROBOT_STATE', payload: { lastUpdate: new Date().toISOString() } });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isConnected]);

  const contextValue: RobotStateContextType = {
    robotState: state,
    state,
    dispatch,
    setConnectionStatus,
    setRobotStatus,
    updateJointPositions,
    updateEndEffectorPosition,
    setMovingStatus,
    setSpeed,
    setErrorMessage,
    setOperationMode,
    setSafetyStatus,
    updateSystemInfo,
    resetState,
  };

  return (
    <RobotStateContext.Provider value={contextValue}>
      {children}
    </RobotStateContext.Provider>
  );
};

export const useRobotState = (): RobotStateContextType => {
  const context = useContext(RobotStateContext);
  if (context === undefined) {
    throw new Error('useRobotState must be used within a RobotStateProvider');
  }
  return context;
};

export default RobotStateProvider;
