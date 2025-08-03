import React from 'react';

interface Props {
  onChange?: () => void;
}

const ThemeSettings: React.FC<Props> = ({ onChange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">ThemeSettings</h3>
      <p>ThemeSettings 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default ThemeSettings;
