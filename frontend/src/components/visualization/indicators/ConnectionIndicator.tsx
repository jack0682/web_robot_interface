import React from 'react';

interface ConnectionIndicatorProps {
  isConnected?: boolean;
  status?: string;
}

const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({ isConnected = false, status = 'disconnected' }) => {
  return (
    <div className="flex items-center">
      <div className={`w-2 h-2 rounded-full mr-2 ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      }`} />
      <span className="text-sm">{isConnected ? '연결됨' : '연결 끊어짐'}</span>
    </div>
  );
};

export default ConnectionIndicator;
