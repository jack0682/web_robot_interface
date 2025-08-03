/**
 * 게이지 차트 컴포넌트 - 원형 및 반원형 게이지
 */
import React from 'react';

interface GaugeChartProps {
  value: number;
  min?: number;
  max?: number;
  title?: string;
  unit?: string;
  size?: number;
  type?: 'full' | 'half';
  color?: string;
  warningThreshold?: number;
  dangerThreshold?: number;
  className?: string;
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  min = 0,
  max = 100,
  title = "Gauge",
  unit = "%",
  size = 200,
  type = 'half',
  color,
  warningThreshold,
  dangerThreshold,
  className = ""
}) => {
  const normalizedValue = Math.max(min, Math.min(max, value));
  const percentage = ((normalizedValue - min) / (max - min)) * 100;
  
  // 동적 색상 결정
  const getColor = () => {
    if (color) return color;
    
    if (dangerThreshold && normalizedValue >= dangerThreshold) {
      return '#ef4444'; // 빨강
    }
    if (warningThreshold && normalizedValue >= warningThreshold) {
      return '#f59e0b'; // 주황
    }
    return '#10b981'; // 초록
  };

  const gaugeColor = getColor();
  const radius = (size - 40) / 2;
  const strokeWidth = 20;
  const center = size / 2;
  
  // 극좌표를 직교좌표로 변환
  function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }

  // 원호 경로 생성
  function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    
    return [
      "M", start.x, start.y, 
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
    ].join(" ");
  }

  // 게이지 타입에 따른 각도 설정
  const startAngle = type === 'full' ? 0 : 180;
  const endAngle = type === 'full' ? 360 : 360;
  const totalAngle = endAngle - startAngle;
  const valueAngle = startAngle + (percentage / 100) * totalAngle;

  // 배경 원호
  const backgroundPath = describeArc(center, center, radius, startAngle, endAngle);
  
  // 값 원호
  const valuePath = percentage > 0 ? describeArc(center, center, radius, startAngle, valueAngle) : "";

  // 눈금 생성
  const generateTicks = () => {
    const ticks = [];
    const tickCount = type === 'full' ? 12 : 6;
    const angleStep = totalAngle / tickCount;
    
    for (let i = 0; i <= tickCount; i++) {
      const angle = startAngle + (i * angleStep);
      const tickValue = min + ((max - min) * i / tickCount);
      
      // 큰 눈금
      const outerTick = polarToCartesian(center, center, radius + 5, angle);
      const innerTick = polarToCartesian(center, center, radius - 5, angle);
      
      // 라벨 위치
      const labelPos = polarToCartesian(center, center, radius + 20, angle);
      
      ticks.push(
        <g key={i}>
          <line
            x1={outerTick.x}
            y1={outerTick.y}
            x2={innerTick.x}
            y2={innerTick.y}
            stroke="#6b7280"
            strokeWidth="2"
          />
          <text
            x={labelPos.x}
            y={labelPos.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-xs fill-gray-600 dark:fill-gray-400"
          >
            {tickValue.toFixed(0)}
          </text>
        </g>
      );
    }
    
    return ticks;
  };

  // 바늘 생성
  const generateNeedle = () => {
    if (type !== 'half') return null;
    
    const needleAngle = 180 + (percentage / 100) * 180;
    const needleLength = radius - 10;
    const needleEnd = polarToCartesian(center, center, needleLength, needleAngle);
    
    return (
      <g>
        <line
          x1={center}
          y1={center}
          x2={needleEnd.x}
          y2={needleEnd.y}
          stroke={gaugeColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle
          cx={center}
          cy={center}
          r="6"
          fill={gaugeColor}
        />
      </g>
    );
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* 게이지 SVG */}
      <div className="relative">
        <svg width={size} height={type === 'half' ? size * 0.7 : size} className="overflow-visible">
          {/* 배경 원호 */}
          <path
            d={backgroundPath}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          
          {/* 값 원호 */}
          {valuePath && (
            <path
              d={valuePath}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 6px rgba(59, 130, 246, 0.3))'
              }}
            />
          )}
          
          {/* 눈금 */}
          {generateTicks()}
          
          {/* 바늘 (반원형일 때만) */}
          {generateNeedle()}
          
          {/* 중앙 값 표시 */}
          <text
            x={center}
            y={type === 'half' ? center + 10 : center}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-2xl font-bold fill-gray-900 dark:fill-gray-100"
          >
            {normalizedValue.toFixed(1)}
          </text>
          <text
            x={center}
            y={type === 'half' ? center + 30 : center + 20}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm fill-gray-600 dark:fill-gray-400"
          >
            {unit}
          </text>
        </svg>
        
        {/* 임계값 표시 */}
        {(warningThreshold || dangerThreshold) && (
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex gap-4 text-xs">
            {warningThreshold && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>경고: {warningThreshold}</span>
              </div>
            )}
            {dangerThreshold && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span>위험: {dangerThreshold}</span>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* 제목 */}
      <div className="mt-4 text-center">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {min} - {max} {unit}
        </p>
      </div>
    </div>
  );
};

// 다중 게이지 컴포넌트
export const MultiGauge: React.FC<{
  gauges: Array<{
    title: string;
    value: number;
    min?: number;
    max?: number;
    unit?: string;
    color?: string;
    warningThreshold?: number;
    dangerThreshold?: number;
  }>;
  size?: number;
  className?: string;
}> = ({ gauges, size = 150, className = "" }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {gauges.map((gauge, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <GaugeChart
            {...gauge}
            size={size}
            type="half"
          />
        </div>
      ))}
    </div>
  );
};

export default GaugeChart;