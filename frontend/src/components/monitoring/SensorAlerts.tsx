import React from 'react';

interface Props {
  onClose?: () => void;
  timeRange?: string;
}

const SensorAlerts: React.FC<Props> = ({ onClose, timeRange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">SensorAlerts</h3>
      <p>SensorAlerts 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default SensorAlerts;
