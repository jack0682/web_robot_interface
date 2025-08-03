import React from 'react';

interface Props {
  timeRange?: string;
  [key: string]: any;
}

const SensorHistoryChart: React.FC<Props> = (props) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">SensorHistoryChart</h3>
      <p>SensorHistoryChart 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default SensorHistoryChart;
