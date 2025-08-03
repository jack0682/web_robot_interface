import React from 'react';

interface Props {
  onClose?: () => void;
  timeRange?: string;
}

const DataExportPanel: React.FC<Props> = ({ onClose, timeRange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">DataExportPanel</h3>
      <p>DataExportPanel 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default DataExportPanel;
