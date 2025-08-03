/**
 * 로봇 프로그램 제어 컴포넌트 - 프로그램 실행, 일시정지, 정지
 */
import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack,
  FileText,
  Upload,
  Download,
  Settings,
  Clock,
  BarChart3
} from 'lucide-react';
import { useRobotState } from '../../contexts/RobotStateContext';
import { sendRobotCommand } from '../../services/commandSender';
import toast from 'react-hot-toast';

interface ProgramInfo {
  name: string;
  id: string;
  status: 'stopped' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  currentLine: number;
  totalLines: number;
  startTime?: Date;
  estimatedEndTime?: Date;
  description?: string;
}

export const ProgramControl: React.FC = () => {
  const { robotState } = useRobotState();
  const [currentProgram, setCurrentProgram] = useState<ProgramInfo | null>(null);
  const [availablePrograms, setAvailablePrograms] = useState<ProgramInfo[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [programSpeed, setProgramSpeed] = useState(100); // 속도 백분율
  const [loopMode, setLoopMode] = useState(false);
  const [stepMode, setStepMode] = useState(false);

  // 프로그램 목록 로드
  useEffect(() => {
    loadAvailablePrograms();
  }, []);

  // 로봇 상태에서 현재 프로그램 정보 업데이트
  useEffect(() => {
    if (robotState.currentProgram) {
      setCurrentProgram(robotState.currentProgram);
    }
  }, [robotState.currentProgram]);

  // 사용 가능한 프로그램 목록 로드
  const loadAvailablePrograms = async () => {
    try {
      const response = await fetch('/api/programs');
      const programs = await response.json();
      setAvailablePrograms(programs);
    } catch (error) {
      console.error('프로그램 목록 로드 실패:', error);
    }
  };

  // 프로그램 선택
  const selectProgram = async (programId: string) => {
    try {
      await sendRobotCommand('selectProgram', { programId });
      setSelectedProgramId(programId);
      const program = availablePrograms.find(p => p.id === programId);
      if (program) {
        setCurrentProgram({ ...program, status: 'stopped', progress: 0, currentLine: 0 });
      }
      toast.success('프로그램 선택됨');
    } catch (error) {
      toast.error(`프로그램 선택 실패: ${error}`);
    }
  };

  // 프로그램 실행
  const runProgram = async () => {
    if (!currentProgram) {
      toast.error('실행할 프로그램을 선택하세요');
      return;
    }

    try {
      await sendRobotCommand('runProgram', { 
        programId: currentProgram.id,
        speed: programSpeed,
        loopMode,
        stepMode
      });
      toast.success('프로그램 실행 시작');
    } catch (error) {
      toast.error(`프로그램 실행 실패: ${error}`);
    }
  };

  // 프로그램 일시정지
  const pauseProgram = async () => {
    try {
      await sendRobotCommand('pauseProgram');
      toast.success('프로그램 일시정지');
    } catch (error) {
      toast.error(`일시정지 실패: ${error}`);
    }
  };

  // 프로그램 정지
  const stopProgram = async () => {
    try {
      await sendRobotCommand('stopProgram');
      toast.success('프로그램 정지');
    } catch (error) {
      toast.error(`정지 실패: ${error}`);
    }
  };

  // 다음 스텝
  const nextStep = async () => {
    try {
      await sendRobotCommand('nextStep');
      toast.success('다음 스텝 실행');
    } catch (error) {
      toast.error(`스텝 실행 실패: ${error}`);
    }
  };

  // 이전 스텝
  const prevStep = async () => {
    try {
      await sendRobotCommand('prevStep');
      toast.success('이전 스텝으로 이동');
    } catch (error) {
      toast.error(`스텝 이동 실패: ${error}`);
    }
  };

  // 프로그램 업로드
  const uploadProgram = async (file: File) => {
    const formData = new FormData();
    formData.append('program', file);

    try {
      const response = await fetch('/api/programs/upload', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        await loadAvailablePrograms();
        toast.success('프로그램 업로드 완료');
      } else {
        throw new Error('업로드 실패');
      }
    } catch (error) {
      toast.error(`프로그램 업로드 실패: ${error}`);
    }
  };

  // 실행 시간 계산
  const getExecutionTime = () => {
    if (!currentProgram?.startTime) return '00:00:00';
    const now = new Date();
    const diff = now.getTime() - currentProgram.startTime.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 상태에 따른 색상
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-green-600 bg-green-100';
      case 'paused': return 'text-yellow-600 bg-yellow-100';
      case 'stopped': return 'text-gray-600 bg-gray-100';
      case 'completed': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return '실행 중';
      case 'paused': return '일시정지';
      case 'stopped': return '정지됨';
      case 'completed': return '완료됨';
      case 'error': return '오류';
      default: return '알 수 없음';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        프로그램 제어
      </h2>

      {/* 현재 프로그램 정보 */}
      {currentProgram && (
        <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {currentProgram.name}
              </h3>
              {currentProgram.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {currentProgram.description}
                </p>
              )}
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentProgram.status)}`}>
              {getStatusText(currentProgram.status)}
            </span>
          </div>

          {/* 진행률 표시 */}
          <div className="mb-3">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
              <span>진행률: {currentProgram.progress.toFixed(1)}%</span>
              <span>라인: {currentProgram.currentLine} / {currentProgram.totalLines}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${currentProgram.progress}%` }}
              />
            </div>
          </div>

          {/* 시간 정보 */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">실행 시간</div>
              <div className="font-mono font-bold text-blue-600">
                {getExecutionTime()}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">예상 종료</div>
              <div className="font-mono font-bold text-green-600">
                {currentProgram.estimatedEndTime ? 
                  currentProgram.estimatedEndTime.toLocaleTimeString() : '--:--:--'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">속도</div>
              <div className="font-mono font-bold text-orange-600">
                {programSpeed}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 프로그램 선택 */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            프로그램 선택
          </h3>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".dcp,.py,.script"
              onChange={(e) => e.target.files?.[0] && uploadProgram(e.target.files[0])}
              className="hidden"
              id="program-upload"
            />
            <label
              htmlFor="program-upload"
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md cursor-pointer transition-colors"
            >
              <Upload size={16} />
              업로드
            </label>
          </div>
        </div>

        <select
          value={selectedProgramId}
          onChange={(e) => selectProgram(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
        >
          <option value="">프로그램을 선택하세요</option>
          {availablePrograms.map(program => (
            <option key={program.id} value={program.id}>
              {program.name} ({program.totalLines} 라인)
            </option>
          ))}
        </select>
      </div>

      {/* 실행 설정 */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 속도 설정 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            실행 속도 ({programSpeed}%)
          </label>
          <input
            type="range"
            min="1"
            max="200"
            value={programSpeed}
            onChange={(e) => setProgramSpeed(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>1%</span>
            <span>100%</span>
            <span>200%</span>
          </div>
        </div>

        {/* 루프 모드 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="loop-mode"
            checked={loopMode}
            onChange={(e) => setLoopMode(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="loop-mode" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
            루프 모드
          </label>
        </div>

        {/* 스텝 모드 */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="step-mode"
            checked={stepMode}
            onChange={(e) => setStepMode(e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
          />
          <label htmlFor="step-mode" className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
            스텝 모드
          </label>
        </div>
      </div>

      {/* 제어 버튼 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {/* 실행 버튼 */}
        <button
          onClick={runProgram}
          disabled={!currentProgram || currentProgram.status === 'running'}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Play size={20} />
          실행
        </button>

        {/* 일시정지 버튼 */}
        <button
          onClick={pauseProgram}
          disabled={!currentProgram || currentProgram.status !== 'running'}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Pause size={20} />
          일시정지
        </button>

        {/* 정지 버튼 */}
        <button
          onClick={stopProgram}
          disabled={!currentProgram || currentProgram.status === 'stopped'}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <Square size={20} />
          정지
        </button>

        {/* 이전 스텝 */}
        <button
          onClick={prevStep}
          disabled={!stepMode || !currentProgram || currentProgram.currentLine <= 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <SkipBack size={20} />
          이전
        </button>

        {/* 다음 스텝 */}
        <button
          onClick={nextStep}
          disabled={!stepMode || !currentProgram}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
        >
          <SkipForward size={20} />
          다음
        </button>
      </div>

      {/* 프로그램 목록 */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          사용 가능한 프로그램
        </h3>
        
        {availablePrograms.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FileText size={48} className="mx-auto mb-3 opacity-50" />
            <p>업로드된 프로그램이 없습니다</p>
            <p className="text-sm">위의 업로드 버튼을 사용하여 프로그램을 추가하세요</p>
          </div>
        ) : (
          <div className="space-y-2">
            {availablePrograms.map(program => (
              <div
                key={program.id}
                className={`flex items-center justify-between p-3 rounded-md cursor-pointer transition-colors ${
                  selectedProgramId === program.id
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
                onClick={() => selectProgram(program.id)}
              >
                <div>
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {program.name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {program.totalLines} 라인 • {program.description || '설명 없음'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(program.status)}`}>
                    {getStatusText(program.status)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // 프로그램 다운로드 또는 상세보기
                    }}
                    className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgramControl;