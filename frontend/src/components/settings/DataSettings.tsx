import React from 'react';

interface Props {
  onChange?: () => void;
}

const DataSettings: React.FC<Props> = ({ onChange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">DataSettings</h3>
      <p>DataSettings 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default DataSettings;
