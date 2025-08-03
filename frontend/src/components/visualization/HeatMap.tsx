/**
 * 히트맵 컴포넌트 - 2D 데이터 시각화
 */
import React, { useState, useMemo } from 'react';

interface HeatMapProps {
  data: number[][];
  xLabels?: string[];
  yLabels?: string[];
  title?: string;
  colorScheme?: 'rdylbu' | 'viridis' | 'plasma' | 'inferno';
  cellSize?: number;
  showValues?: boolean;
  className?: string;
}

export const HeatMap: React.FC<HeatMapProps> = ({
  data,
  xLabels = [],
  yLabels = [],
  title = "Heat Map",
  colorScheme = 'rdylbu',
  cellSize = 40,
  showValues = true,
  className = ""
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null);

  // 데이터 범위 계산
  const { min, max } = useMemo(() => {
    const flatData = data.flat();
    return {
      min: Math.min(...flatData),
      max: Math.max(...flatData)
    };
  }, [data]);

  // 색상 스케일 생성
  const colorScale = useMemo(() => {
    const schemes = {
      rdylbu: (t: number) => `hsl(${240 - t * 120}, 80%, 60%)`, // 파란색에서 빨간색으로
      viridis: (t: number) => `hsl(${240 - t * 240}, 70%, ${20 + t * 60}%)`,
      plasma: (t: number) => `hsl(${300 - t * 240}, 80%, ${30 + t * 50}%)`,
      inferno: (t: number) => `hsl(${60 - t * 60}, 90%, ${10 + t * 70}%)`
    };
    
    // 간단한 선형 스케일 구현
    const normalizeValue = (value: number) => {
      return Math.max(0, Math.min(1, (value - min) / (max - min)));
    };
    
    return {
      color: (value: number) => schemes[colorScheme](normalizeValue(value))
    };
  }, [min, max, colorScheme]);

  // 값을 색상으로 변환
  const getColor = (value: number) => {
    if (isNaN(value)) return '#f3f4f6';
    return colorScale.color(value);
  };

  // 텍스트 색상 결정 (대비를 위해)
  const getTextColor = (value: number) => {
    const normalizedValue = (value - min) / (max - min);
    return normalizedValue > 0.5 ? '#ffffff' : '#000000';
  };

  const rows = data.length;
  const cols = data[0]?.length || 0;
  const width = cols * cellSize + 100; // 라벨 공간 추가
  const height = rows * cellSize + 100;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg p-4 ${className}`}>
      {/* 제목 */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {title}
        </h3>
        
        {/* 색상 범례 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">{min.toFixed(2)}</span>
          <div className="flex">
            {Array.from({ length: 20 }, (_, i) => {
              const value = min + (max - min) * (i / 19);
              return (
                <div
                  key={i}
                  className="w-3 h-4"
                  style={{ backgroundColor: getColor(value) }}
                />
              );
            })}
          </div>
          <span className="text-sm text-gray-600 dark:text-gray-400">{max.toFixed(2)}</span>
        </div>
      </div>

      {/* 히트맵 */}
      <div className="relative">
        <svg width={width} height={height} className="overflow-visible">
          {/* Y축 라벨 */}
          {yLabels.map((label, i) => (
            <text
              key={i}
              x={40}
              y={80 + i * cellSize + cellSize / 2}
              textAnchor="end"
              dominantBaseline="central"
              className="text-sm fill-gray-600 dark:fill-gray-400"
            >
              {label}
            </text>
          ))}

          {/* X축 라벨 */}
          {xLabels.map((label, i) => (
            <text
              key={i}
              x={60 + i * cellSize + cellSize / 2}
              y={70}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-sm fill-gray-600 dark:fill-gray-400"
              transform={`rotate(-45, ${60 + i * cellSize + cellSize / 2}, 70)`}
            >
              {label}
            </text>
          ))}

          {/* 히트맵 셀 */}
          {data.map((row, i) =>
            row.map((value, j) => (
              <g key={`${i}-${j}`}>
                <rect
                  x={60 + j * cellSize}
                  y={80 + i * cellSize}
                  width={cellSize}
                  height={cellSize}
                  fill={getColor(value)}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={() => setHoveredCell({ x: j, y: i, value })}
                  onMouseLeave={() => setHoveredCell(null)}
                />
                
                {/* 값 표시 */}
                {showValues && !isNaN(value) && (
                  <text
                    x={60 + j * cellSize + cellSize / 2}
                    y={80 + i * cellSize + cellSize / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-xs font-medium pointer-events-none"
                    fill={getTextColor(value)}
                  >
                    {value.toFixed(1)}
                  </text>
                )}
              </g>
            ))
          )}
        </svg>

        {/* 툴팁 */}
        {hoveredCell && (
          <div className="absolute bg-black text-white text-xs rounded px-2 py-1 pointer-events-none z-10">
            <div>X: {xLabels[hoveredCell.x] || hoveredCell.x}</div>
            <div>Y: {yLabels[hoveredCell.y] || hoveredCell.y}</div>
            <div>Value: {hoveredCell.value.toFixed(3)}</div>
          </div>
        )}
      </div>
      
      {/* 통계 정보 */}
      <div className="mt-4 grid grid-cols-4 gap-4 text-center">
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">최솟값</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{min.toFixed(3)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">최댓값</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{max.toFixed(3)}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">평균</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {(data.flat().reduce((sum, val) => sum + (isNaN(val) ? 0 : val), 0) / data.flat().filter(val => !isNaN(val)).length).toFixed(3)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700 rounded p-2">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">크기</div>
          <div className="text-xs text-gray-600 dark:text-gray-400">{rows} × {cols}</div>
        </div>
      </div>
    </div>
  );
};

// 로봇 작업공간 히트맵 컴포넌트
export const WorkspaceHeatMap: React.FC<{
  workspaceData: number[][];
  title?: string;
  className?: string;
}> = ({ workspaceData, title = "로봇 작업공간 히트맵", className = "" }) => {
  // 작업공간 좌표 라벨 생성
  const xLabels = Array.from({ length: workspaceData[0]?.length || 0 }, (_, i) => 
    `X${(i * 100 - 500).toString()}`
  );
  const yLabels = Array.from({ length: workspaceData.length }, (_, i) => 
    `Y${(500 - i * 100).toString()}`
  );

  return (
    <HeatMap
      data={workspaceData}
      xLabels={xLabels}
      yLabels={yLabels}
      title={title}
      colorScheme="viridis"
      cellSize={30}
      showValues={false}
      className={className}
    />
  );
};

// 조인트 상관관계 히트맵
export const JointCorrelationHeatMap: React.FC<{
  correlationMatrix: number[][];
  jointNames?: string[];
  className?: string;
}> = ({ 
  correlationMatrix, 
  jointNames = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'],
  className = ""
}) => {
  return (
    <HeatMap
      data={correlationMatrix}
      xLabels={jointNames}
      yLabels={jointNames}
      title="조인트 상관관계 매트릭스"
      colorScheme="rdylbu"
      cellSize={50}
      showValues={true}
      className={className}
    />
  );
};

export default HeatMap;