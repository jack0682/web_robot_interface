import React from 'react';

interface Props {
  onChange?: () => void;
}

const NotificationSettings: React.FC<Props> = ({ onChange }) => {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-4">NotificationSettings</h3>
      <p>NotificationSettings 컴포넌트 (구현 예정)</p>
    </div>
  );
};

export default NotificationSettings;
