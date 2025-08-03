import React from 'react';

interface EmergencyStopButtonProps {
  onEmergencyStop?: () => void;
}

const EmergencyStopButton: React.FC<EmergencyStopButtonProps> = ({ onEmergencyStop }) => {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">EmergencyStopButton</h3>
      <p>EmergencyStopButton 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default EmergencyStopButton;
