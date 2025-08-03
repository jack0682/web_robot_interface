import React from 'react';

interface Props {
  onChange?: () => void;
}

const ConnectionSettings: React.FC<Props> = ({ onChange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">연결 설정</h3>
      <p>연결 설정 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default ConnectionSettings;
