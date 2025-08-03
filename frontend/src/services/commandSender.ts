/**
 * 명령 전송 서비스 - 완전 재구축
 * 새로운 통합 타입 시스템과 완벽하게 호환
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  RobotPose, 
  CommandResult,
  Timestamp 
} from '../types/robotTypes';
import config from '../config';

interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  timestamp: Timestamp;
  executionTime?: number;
}

class CommandSenderService {
  private api: AxiosInstance;
  private baseURL: string;
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || config.API_BASE_URL;
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'web-dashboard',
        'X-Client-Version': '1.0.0'
      },
    });

    this.setupInterceptors();
  }

  /**
   * 인터셉터 설정
   */
  private setupInterceptors(): void {
    // 요청 인터셉터
    this.api.interceptors.request.use(
      (config) => {
        this.requestCount++;
        (config as any).metadata = { startTime: Date.now() };
        
        console.log(`🚀 API 요청 [${this.requestCount}]: ${config.method?.toUpperCase()} ${config.url}`, {
          data: config.data,
          headers: config.headers
        });
        
        return config;
      },
      (error) => {
        this.errorCount++;
        console.error('❌ API 요청 설정 오류:', error);
        return Promise.reject(error);
      }
    );

    // 응답 인터셉터
    this.api.interceptors.response.use(
      (response) => {
        const executionTime = Date.now() - (response.config as any).metadata?.startTime;
        
        console.log(`✅ API 응답 [${response.status}] (${executionTime}ms):`, {
          url: response.config.url,
          data: response.data
        });
        
        return response;
      },
      (error) => {
        this.errorCount++;
        const executionTime = error.config?.metadata?.startTime ? 
          Date.now() - error.config.metadata.startTime : 0;
          
        console.error(`❌ API 오류 (${executionTime}ms):`, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.message || error.message
        });
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 로봇 관절 이동 명령
   */
  async sendJointMoveCommand(
    positions: number[],
    speed: number = 50,
    acceleration: number = 50
  ): Promise<CommandResult> {
    try {
      this.validateJointPositions(positions);
      this.validateSpeedAcceleration(speed, acceleration);

      const response = await this.api.post('/api/robot/move/joint', {
        positions,
        speed,
        acceleration,
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'joint_move');
    } catch (error) {
      throw this.handleApiError(error, 'Joint move command failed');
    }
  }

  /**
   * 로봇 직선 이동 명령
   */
  async sendLinearMoveCommand(
    position: RobotPose,
    speed: number = 50,
    acceleration: number = 50
  ): Promise<CommandResult> {
    try {
      this.validateCartesianPosition(position);
      this.validateSpeedAcceleration(speed, acceleration);

      const response = await this.api.post('/api/robot/move/linear', {
        position: {
          x: position.x,
          y: position.y,
          z: position.z,
          rx: position.rx || 0,
          ry: position.ry || 0,
          rz: position.rz || 0
        },
        speed,
        acceleration,
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'linear_move');
    } catch (error) {
      throw this.handleApiError(error, 'Linear move command failed');
    }
  }

  /**
   * 로봇 정지 명령
   */
  async sendStopCommand(): Promise<CommandResult> {
    try {
      const response = await this.api.post('/api/robot/stop', {
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'stop');
    } catch (error) {
      throw this.handleApiError(error, 'Stop command failed');
    }
  }

  /**
   * 비상정지 명령
   */
  async sendEmergencyStopCommand(): Promise<CommandResult> {
    try {
      const response = await this.api.post('/api/robot/emergency-stop', {
        source: 'web_dashboard',
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'emergency_stop');
    } catch (error) {
      throw this.handleApiError(error, 'Emergency stop command failed');
    }
  }

  /**
   * 홈 위치 이동 명령
   */
  async sendHomeCommand(speed: number = 30): Promise<CommandResult> {
    try {
      this.validateSpeed(speed);

      const response = await this.api.post('/api/robot/home', { 
        speed,
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'home');
    } catch (error) {
      throw this.handleApiError(error, 'Home command failed');
    }
  }

  /**
   * 로봇 속도 설정
   */
  async setRobotSpeed(speed: number): Promise<CommandResult> {
    try {
      this.validateSpeed(speed);

      const response = await this.api.post('/api/robot/speed', { 
        speed,
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'set_speed');
    } catch (error) {
      throw this.handleApiError(error, 'Set speed command failed');
    }
  }

  /**
   * 농도 목표값 설정
   */
  async setConcentrationTarget(target: number): Promise<CommandResult> {
    try {
      if (target < 0 || target > 100) {
        throw new Error('Concentration target must be between 0 and 100');
      }

      const response = await this.api.post('/api/sensors/concentration/target', {
        target,
        source: 'web_dashboard',
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'set_concentration');
    } catch (error) {
      throw this.handleApiError(error, 'Set concentration target failed');
    }
  }

  /**
   * 무게센서 캘리브레이션
   */
  async calibrateWeightSensor(offset?: number): Promise<CommandResult> {
    try {
      const data = {
        ...(offset !== undefined && { offset }),
        timestamp: new Date().toISOString()
      };
      
      const response = await this.api.post('/api/sensors/weight/calibrate', data);
      return this.formatCommandResult(response.data, 'calibrate_weight');
    } catch (error) {
      throw this.handleApiError(error, 'Weight sensor calibration failed');
    }
  }

  /**
   * 배치 명령 실행
   */
  async sendBatchCommands(commands: any[]): Promise<CommandResult> {
    try {
      if (!Array.isArray(commands) || commands.length === 0) {
        throw new Error('Commands array is empty or invalid');
      }

      const response = await this.api.post('/api/control/batch-command', { 
        commands,
        timestamp: new Date().toISOString()
      });
      
      return this.formatCommandResult(response.data, 'batch_commands');
    } catch (error) {
      throw this.handleApiError(error, 'Batch commands failed');
    }
  }

  /**
   * 로봇 상태 조회
   */
  async getRobotStatus(): Promise<any> {
    try {
      const response = await this.api.get('/api/robot/status');
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get robot status');
    }
  }

  /**
   * 센서 데이터 조회
   */
  async getAllSensorData(): Promise<any> {
    try {
      const response = await this.api.get('/api/sensors/all');
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get sensor data');
    }
  }

  /**
   * 시스템 헬스체크
   */
  async getSystemHealth(): Promise<any> {
    try {
      const response = await this.api.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleApiError(error, 'Failed to get system health');
    }
  }

  /**
   * 연결 테스트
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.api.get('/health', { timeout: 5000 });
      return response.data?.status === 'healthy';
    } catch (error) {
      console.error('❌ 연결 테스트 실패:', error);
      return false;
    }
  }

  /**
   * 서비스 통계 조회
   */
  getServiceStats(): {
    requestCount: number;
    errorCount: number;
    successRate: number;
    baseURL: string;
  } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate: this.requestCount > 0 ? 
        ((this.requestCount - this.errorCount) / this.requestCount) * 100 : 0,
      baseURL: this.baseURL
    };
  }

  /**
   * 검증 메서드들
   */
  private validateJointPositions(positions: number[]): void {
    if (!Array.isArray(positions) || positions.length !== 6) {
      throw new Error('Joint positions must be an array of 6 numbers');
    }
    
    positions.forEach((pos, index) => {
      if (typeof pos !== 'number' || isNaN(pos)) {
        throw new Error(`Invalid position at joint ${index + 1}: ${pos}`);
      }
    });
  }

  private validateCartesianPosition(position: RobotPose): void {
    const required = ['x', 'y', 'z'];
    const optional = ['rx', 'ry', 'rz'];
    
    required.forEach(axis => {
      if (typeof position[axis as keyof RobotPose] !== 'number') {
        throw new Error(`Missing or invalid ${axis} coordinate`);
      }
    });
  }

  private validateSpeed(speed: number): void {
    if (typeof speed !== 'number' || isNaN(speed) || speed < 1 || speed > 100) {
      throw new Error('Speed must be a number between 1 and 100');
    }
  }

  private validateSpeedAcceleration(speed: number, acceleration: number): void {
    this.validateSpeed(speed);
    
    if (typeof acceleration !== 'number' || isNaN(acceleration) || acceleration < 1 || acceleration > 100) {
      throw new Error('Acceleration must be a number between 1 and 100');
    }
  }

  /**
   * 응답 포맷팅
   */
  private formatCommandResult(apiResponse: ApiResponse, commandType: string): CommandResult {
    return {
      commandId: `${commandType}_${Date.now()}`,
      status: apiResponse.success ? 'completed' : 'failed',
      message: apiResponse.message,
      error: apiResponse.success ? undefined : apiResponse.message,
      executionTime: apiResponse.executionTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 에러 처리 헬퍼
   */
  private handleApiError(error: any, defaultMessage: string): Error {
    if (error.response) {
      // 서버 응답 오류
      const status = error.response.status;
      const data = error.response.data;
      
      let message = defaultMessage;
      if (data?.error) {
        message = data.error;
      } else if (data?.message) {
        message = data.message;
      }
      
      // 상태 코드별 메시지 개선
      switch (status) {
        case 400:
          message = `잘못된 요청: ${message}`;
          break;
        case 401:
          message = `인증 필요: ${message}`;
          break;
        case 403:
          message = `권한 없음: ${message}`;
          break;
        case 404:
          message = `엔드포인트를 찾을 수 없음: ${message}`;
          break;
        case 500:
          message = `서버 내부 오류: ${message}`;
          break;
        case 503:
          message = `서비스 사용 불가: ${message}`;
          break;
      }
      
      return new Error(`${message} (HTTP ${status})`);
    } else if (error.request) {
      // 네트워크 오류
      return new Error(`${defaultMessage} (네트워크 오류: 서버 응답 없음)`);
    } else {
      // 요청 설정 오류
      return new Error(`${defaultMessage} (요청 오류: ${error.message})`);
    }
  }

  /**
   * 설정 메서드들
   */
  public setBaseURL(url: string): void {
    this.baseURL = url;
    this.api.defaults.baseURL = url;
    console.log('🔧 API Base URL 변경:', url);
  }

  public setTimeout(timeout: number): void {
    this.api.defaults.timeout = timeout;
    console.log('🔧 API 타임아웃 변경:', timeout, 'ms');
  }

  public setAuthToken(token: string): void {
    this.api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('🔧 인증 토큰 설정');
  }

  public clearAuthToken(): void {
    delete this.api.defaults.headers.common['Authorization'];
    console.log('🔧 인증 토큰 제거');
  }

  public getConfig(): any {
    return {
      baseURL: this.baseURL,
      timeout: this.api.defaults.timeout,
      headers: this.api.defaults.headers,
      stats: this.getServiceStats()
    };
  }

  /**
   * 리셋 메서드
   */
  public resetStats(): void {
    this.requestCount = 0;
    this.errorCount = 0;
    console.log('📊 서비스 통계 리셋');
  }
}

export default CommandSenderService;

// 호환성을 위한 래퍼 함수들
export const sendRobotCommand = async (commandType: string, payload?: any): Promise<CommandResult> => {
  const command = { type: commandType, payload };
  const service = new CommandSenderService();
  
  switch (command.type) {
    case 'move_joint':
      return await service.sendJointMoveCommand(
        command.payload.positions,
        command.payload.speed,
        command.payload.acceleration
      );
    case 'move_linear':
      return await service.sendLinearMoveCommand(
        command.payload.target,
        command.payload.speed,
        command.payload.acceleration
      );
    case 'stop':
      return await service.sendStopCommand();
    case 'emergency_stop':
      return await service.sendEmergencyStopCommand();
    case 'home':
      return await service.sendHomeCommand(command.payload?.speed);
    default:
      throw new Error(`Unknown command type: ${command.type}`);
  }
};

// 간편 API 함수들
export const moveJoint = (positions: number[], speed?: number) => 
  new CommandSenderService().sendJointMoveCommand(positions, speed);

export const moveLinear = (position: RobotPose, speed?: number) => 
  new CommandSenderService().sendLinearMoveCommand(position, speed);

export const stopRobot = () => 
  new CommandSenderService().sendStopCommand();

export const emergencyStop = () => 
  new CommandSenderService().sendEmergencyStopCommand();

export const goHome = (speed?: number) => 
  new CommandSenderService().sendHomeCommand(speed);