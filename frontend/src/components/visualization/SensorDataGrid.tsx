/**
 * 센서 데이터 그리드 컴포넌트 - Hook 연동 버전
 */
import React from 'react';
import { useMqttData } from '../../hooks/useMqttData';
import { Thermometer, Weight, Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface SensorDataGridProps {
  className?: string;
}

const SensorDataGrid: React.FC<SensorDataGridProps> = ({ 
  className = "" 
}) => {
  // MQTT 데이터에서 센서 정보 가져오기
  const { 
    weightSensor, 
    concentration, 
    isConnected, 
    lastUpdate,
    error 
  } = useMqttData();

  // 센서 데이터 배열 구성
  const sensorData = [
    {
      id: 'weight',
      name: '무게 센서',
      value: weightSensor?.weight || 0,
      unit: weightSensor?.unit || 'kg',
      status: weightSensor?.status || 'normal',
      quality: weightSensor?.quality || 'good',
      lastUpdate: weightSensor?.timestamp || null,
      icon: Weight,
      connected: !!weightSensor
    },
    {
      id: 'concentration',
      name: '농도 센서', 
      value: concentration?.targetValue || 0,
      unit: concentration?.unit || '%',
      status: concentration?.status || 'normal',
      quality: concentration?.quality || 'good',
      lastUpdate: concentration?.timestamp || null,
      icon: Activity,
      connected: !!concentration
    }
  ];

  // 상태별 색상 매핑
  const getStatusConfig = (status: string, quality: string, connected: boolean) => {
    if (!connected) {
      return {
        color: 'text-gray-600 dark:text-gray-400',
        bgColor: 'bg-gray-100 dark:bg-gray-700',
        label: '연결 끊김'
      };
    }

    if (status === 'error' || quality === 'error') {
      return {
        color: 'text-red-600 dark:text-red-400',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        label: '오류'
      };
    }

    if (status === 'warning' || quality === 'poor') {
      return {
        color: 'text-yellow-600 dark:text-yellow-400',
        bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
        label: '경고'
      };
    }

    return {
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      label: '정상'
    };
  };

  // 품질별 표시
  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent':
      case 'good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'fair':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'poor':
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {/* 헤더 */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            센서 데이터
          </h3>
          
          {/* 전체 연결 상태 */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isConnected ? 'MQTT 연결됨' : 'MQTT 연결 끊김'}
            </span>
          </div>
        </div>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
          </div>
        </div>
      )}
      
      {/* 센서 카드 그리드 */}
      <div className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sensorData.map((sensor) => {
            const statusConfig = getStatusConfig(sensor.status, sensor.quality, sensor.connected);
            const Icon = sensor.icon;
            
            return (
              <div
                key={sensor.id}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50"
              >
                {/* 센서 헤더 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    <span className="font-medium text-gray-900 dark:text-white">
                      {sensor.name}
                    </span>
                  </div>
                  
                  {/* 연결 상태 표시 */}
                  <div className="flex items-center space-x-1">
                    {getQualityIcon(sensor.quality)}
                    <div className={`w-2 h-2 rounded-full ${sensor.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>

                {/* 센서 값 */}
                <div className="mb-3">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {sensor.connected ? sensor.value.toFixed(2) : '--'}
                    <span className="text-lg font-normal text-gray-600 dark:text-gray-400 ml-1">
                      {sensor.unit}
                    </span>
                  </div>
                </div>

                {/* 상태 및 시간 */}
                <div className="flex items-center justify-between">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusConfig.bgColor} ${statusConfig.color}`}>
                    {statusConfig.label}
                  </span>
                  
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {sensor.lastUpdate ? (
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(sensor.lastUpdate).toLocaleTimeString()}</span>
                      </div>
                    ) : (
                      '데이터 없음'
                    )}
                  </div>
                </div>

                {/* 품질 정보 */}
                {sensor.connected && (
                  <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">품질:</span>
                      <span className={`font-medium ${
                        sensor.quality === 'excellent' || sensor.quality === 'good' ? 'text-green-600 dark:text-green-400' :
                        sensor.quality === 'fair' ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {sensor.quality === 'excellent' ? '최고' :
                         sensor.quality === 'good' ? '양호' :
                         sensor.quality === 'fair' ? '보통' :
                         sensor.quality === 'poor' ? '나쁨' : '오류'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 마지막 업데이트 시간 */}
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>마지막 MQTT 업데이트:</span>
          <span>{lastUpdate ? new Date(lastUpdate).toLocaleString() : '업데이트 없음'}</span>
        </div>
      </div>
    </div>
  );
};

export default SensorDataGrid;