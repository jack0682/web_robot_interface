import React from 'react';

interface Props {
  onChange?: () => void;
}

const SecuritySettings: React.FC<Props> = ({ onChange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">SecuritySettings</h3>
      <p>SecuritySettings 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default SecuritySettings;
