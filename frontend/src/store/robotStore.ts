/**
 * 로봇 상태 관리 스토어 (Zustand) - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { 
  RobotState, 
  RobotCommand, 
  CommandResult, 
  RobotPose,
  RobotStatus,
  RobotMode,
  RobotStore,
  DEFAULT_ROBOT_STATE,
  JointMoveCommand,
  LinearMoveCommand,
  ConnectionStatus,
  Timestamp
} from '../types/robotTypes';
import CommandSenderService from '../services/commandSender';

export const useRobotStore = create<RobotStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // 기본 로봇 상태 (DEFAULT_ROBOT_STATE 사용)
      ...DEFAULT_ROBOT_STATE,
      
      // 추가 스토어 상태
      commandQueue: [],
      commandHistory: [],
      isCommandInProgress: false,
      selectedJoint: null,
      
      // 서비스 초기화
      commandService: new CommandSenderService(),
      
      // 상태 업데이트 메서드
      updateRobotState: (newState: Partial<RobotState>) => {
        const now: Timestamp = new Date().toISOString();
        set((state) => ({
          ...state,
          ...newState,
          lastUpdate: now
        }), false, 'updateRobotState');
      },

      updateJointPosition: (jointIndex: number, position: number) => {
        if (jointIndex < 0 || jointIndex >= 6) {
          console.warn(`Invalid joint index: ${jointIndex}`);
          return;
        }
        
        set((state) => {
          const newJoints = [...state.jointState.joints];
          const joint = newJoints[jointIndex];
          
          if (joint) {
            const limits = joint.limits;
            const clampedPosition = Math.max(limits.min, Math.min(limits.max, position));
            
            if (clampedPosition !== position) {
              console.warn(`Joint ${jointIndex} position ${position} clamped to ${clampedPosition}`);
            }
            
            newJoints[jointIndex] = {
              ...joint,
              position: clampedPosition
            };
            
            const newPositions = [...state.jointPositions];
            const newJointsAngle = [...state.pose.jointsAngle];
            const newJointStatePositions = [...state.jointState.positions];
            
            newPositions[jointIndex] = clampedPosition;
            newJointsAngle[jointIndex] = clampedPosition;
            newJointStatePositions[jointIndex] = clampedPosition;
            
            const now: Timestamp = new Date().toISOString();
            
            return {
              ...state,
              jointState: {
                ...state.jointState,
                joints: newJoints as [any, any, any, any, any, any],
                positions: newJointStatePositions,
                timestamp: now
              },
              pose: {
                ...state.pose,
                jointsAngle: newJointsAngle,
                timestamp: now
              },
              jointPositions: newPositions,
              lastUpdate: now
            };
          }
          return state;
        }, false, 'updateJointPosition');
      },

      updateCartesianPosition: (position: Partial<RobotPose>) => {
        const now: Timestamp = new Date().toISOString();
        set((state) => ({
          ...state,
          pose: {
            ...state.pose,
            position: {
              ...state.pose.position,
              ...position
            },
            timestamp: now
          },
          endEffectorPosition: {
            ...state.endEffectorPosition,
            ...position
          } as RobotPose,
          lastUpdate: now
        }), false, 'updateCartesianPosition');
      },

      setRobotStatus: (status: RobotStatus) => {
        const now: Timestamp = new Date().toISOString();
        set((state) => ({
          ...state,
          status,
          isConnected: status !== 'disconnected' && status !== 'error',
          connectionQuality: status === 'disconnected' ? 'disconnected' : 'good',
          lastUpdate: now
        }), false, 'setRobotStatus');
      },

      setRobotMode: (mode: RobotMode) => {
        const now: Timestamp = new Date().toISOString();
        set((state) => ({
          ...state,
          mode,
          operationMode: mode as any,
          lastUpdate: now
        }), false, 'setRobotMode');
      },

      // 명령 전송 메서드들
      sendJointMoveCommand: async (positions: number[], speed = 50, acceleration = 50): Promise<boolean> => {
        const { commandService, addCommandResult, canSendCommand } = get();
        
        if (!canSendCommand()) {
          console.warn('⚠️ Cannot send joint move command: Robot not ready');
          addCommandResult({
            commandId: `joint_move_${Date.now()}`,
            status: 'failed',
            error: 'Robot not ready for commands',
            timestamp: new Date().toISOString()
          });
          return false;
        }

        if (positions.length !== 6) {
          console.warn('⚠️ Joint positions must be an array of 6 values');
          return false;
        }

        set({ isCommandInProgress: true });
        
        try {
          const result = await commandService.sendJointMoveCommand(positions, speed, acceleration);
          
          addCommandResult({
            commandId: `joint_move_${Date.now()}`,
            status: 'completed',
            message: result.message || 'Joint move command completed',
            executionTime: result.executionTime || 0,
            timestamp: new Date().toISOString()
          });
          
          console.log('✅ Joint move command sent successfully');
          return true;
        } catch (error: any) {
          console.error('❌ Joint move command failed:', error);
          addCommandResult({
            commandId: `joint_move_${Date.now()}`,
            status: 'failed',
            error: error.message || 'Unknown error',
            timestamp: new Date().toISOString()
          });
          return false;
        } finally {
          set({ isCommandInProgress: false });
        }
      },

      sendLinearMoveCommand: async (position: RobotPose, speed = 50, acceleration = 50): Promise<boolean> => {
        const { commandService, addCommandResult, canSendCommand } = get();
        
        if (!canSendCommand()) {
          console.warn('⚠️ Cannot send linear move command: Robot not ready');
          return false;
        }

        set({ isCommandInProgress: true });
        
        try {
          const result = await commandService.sendLinearMoveCommand(position, speed, acceleration);
          
          addCommandResult({
            commandId: `linear_move_${Date.now()}`,
            status: 'completed',
            message: result.message || 'Linear move command completed',
            timestamp: new Date().toISOString()
          });
          
          console.log('✅ Linear move command sent successfully');
          return true;
        } catch (error: any) {
          console.error('❌ Linear move command failed:', error);
          return false;
        } finally {
          set({ isCommandInProgress: false });
        }
      },

      sendStopCommand: async (): Promise<boolean> => {
        const { commandService, addCommandResult } = get();
        
        set({ isCommandInProgress: true });
        
        try {
          const result = await commandService.sendStopCommand();
          
          addCommandResult({
            commandId: `stop_${Date.now()}`,
            status: 'completed',
            message: result.message || 'Stop command completed',
            timestamp: new Date().toISOString()
          });
          
          console.log('✅ Stop command sent successfully');
          return true;
        } catch (error: any) {
          console.error('❌ Stop command failed:', error);
          return false;
        } finally {
          set({ isCommandInProgress: false });
        }
      },

      sendEmergencyStop: async (): Promise<boolean> => {
        const { commandService, addCommandResult } = get();
        
        try {
          const result = await commandService.sendEmergencyStopCommand();
          
          addCommandResult({
            commandId: `emergency_stop_${Date.now()}`,
            status: 'completed',
            message: result.message || 'Emergency stop activated',
            timestamp: new Date().toISOString()
          });
          
          console.log('🚨 Emergency stop activated');
          return true;
        } catch (error: any) {
          console.error('❌ Emergency stop failed:', error);
          return false;
        }
      },

      sendHomeCommand: async (speed = 30): Promise<boolean> => {
        const { commandService, addCommandResult, canSendCommand } = get();
        
        if (!canSendCommand()) {
          console.warn('⚠️ Cannot send home command: Robot not ready');
          return false;
        }

        set({ isCommandInProgress: true });
        
        try {
          const result = await commandService.sendHomeCommand(speed);
          
          addCommandResult({
            commandId: `home_${Date.now()}`,
            status: 'completed',
            message: result.message || 'Home command completed',
            timestamp: new Date().toISOString()
          });
          
          console.log('🏠 Home command sent successfully');
          return true;
        } catch (error: any) {
          console.error('❌ Home command failed:', error);
          return false;
        } finally {
          set({ isCommandInProgress: false });
        }
      },

      setRobotSpeed: async (speed: number): Promise<boolean> => {
        const { commandService, addCommandResult } = get();
        
        const clampedSpeed = Math.max(1, Math.min(100, speed));
        
        try {
          const result = await commandService.setRobotSpeed(clampedSpeed);
          
          addCommandResult({
            commandId: `set_speed_${Date.now()}`,
            status: 'completed',
            message: result.message || `Speed set to ${clampedSpeed}%`,
            timestamp: new Date().toISOString()
          });
          
          const now: Timestamp = new Date().toISOString();
          set((state) => ({
            ...state,
            speed: clampedSpeed,
            lastUpdate: now
          }));
          
          console.log(`⚡ Robot speed set to ${clampedSpeed}%`);
          return true;
        } catch (error: any) {
          console.error('❌ Set speed command failed:', error);
          return false;
        }
      },

      // 큐 관리 메서드들
      addCommandToQueue: (command: RobotCommand) => {
        set((state) => ({
          ...state,
          commandQueue: [...state.commandQueue, command]
        }), false, 'addCommandToQueue');
        console.log('📋 Command added to queue:', command.type);
      },

      removeCommandFromQueue: (commandId: string) => {
        set((state) => ({
          ...state,
          commandQueue: state.commandQueue.filter(cmd => cmd.id !== commandId)
        }), false, 'removeCommandFromQueue');
        console.log('🗑️ Command removed from queue:', commandId);
      },

      clearCommandQueue: () => {
        set({ commandQueue: [] }, false, 'clearCommandQueue');
        console.log('🧹 Command queue cleared');
      },

      executeNextCommand: async () => {
        const { commandQueue, removeCommandFromQueue } = get();
        if (commandQueue.length === 0) {
          console.log('📋 No commands in queue to execute');
          return;
        }
        
        const nextCommand = commandQueue[0];
        console.log('▶️ Executing next command:', nextCommand.type);
        
        try {
          let success = false;
          switch (nextCommand.type) {
            case 'move_joint':
              const jointCmd = nextCommand as JointMoveCommand;
              success = await get().sendJointMoveCommand(
                jointCmd.payload.positions,
                jointCmd.payload.speed,
                jointCmd.payload.acceleration
              );
              break;
            case 'move_linear':
              const linearCmd = nextCommand as LinearMoveCommand;
              success = await get().sendLinearMoveCommand(
                linearCmd.payload.target,
                linearCmd.payload.speed,
                linearCmd.payload.acceleration
              );
              break;
            case 'emergency_stop':
              success = await get().sendEmergencyStop();
              break;
            default:
              console.warn('❓ Unknown command type:', nextCommand.type);
          }
          
          if (success) {
            removeCommandFromQueue(nextCommand.id);
            console.log('✅ Command executed successfully:', nextCommand.id);
          }
        } catch (error) {
          console.error('❌ Error executing command:', error);
          removeCommandFromQueue(nextCommand.id);
        }
      },

      // 히스토리 관리
      addCommandResult: (result: CommandResult) => {
        set((state) => ({
          ...state,
          commandHistory: [...state.commandHistory, result].slice(-100)
        }), false, 'addCommandResult');
      },

      clearCommandHistory: () => {
        set({ commandHistory: [] }, false, 'clearCommandHistory');
        console.log('🧹 Command history cleared');
      },

      // 선택 관리
      selectJoint: (jointIndex: number | null) => {
        if (jointIndex !== null && (jointIndex < 0 || jointIndex >= 6)) {
          console.warn('❌ Invalid joint index:', jointIndex);
          return;
        }
        set({ selectedJoint: jointIndex }, false, 'selectJoint');
        console.log('👆 Joint selected:', jointIndex);
      },

      // 유틸리티 함수들
      getCurrentPose: () => {
        const state = get();
        return {
          joints: [...state.pose.jointsAngle],
          cartesian: { ...state.pose.position }
        };
      },

      isRobotReady: () => {
        const state = get();
        return state.isConnected && 
               (state.status === 'idle' || state.status === 'connected') &&
               state.safetyStatus === 'normal' &&
               !state.isCommandInProgress;
      },

      canSendCommand: () => {
        const state = get();
        return state.isConnected &&
               !state.isCommandInProgress && 
               state.status !== 'emergency' && 
               state.status !== 'error' && 
               state.status !== 'disconnected' &&
               state.safetyStatus !== 'emergency';
      },

      getConnectionStatus: (): ConnectionStatus => {
        const state = get();
        if (!state.isConnected || state.status === 'disconnected') return 'disconnected';
        if (state.status === 'error') return 'disconnected';
        if (state.isCommandInProgress) return 'connecting';
        return 'connected';
      }
    })),
    {
      name: 'robot-store',
      partialize: (state: any) => ({
        speed: state.speed,
        acceleration: state.acceleration,
        selectedJoint: state.selectedJoint,
        mode: state.mode,
        operationMode: state.operationMode
      })
    }
  )
);

export default useRobotStore;