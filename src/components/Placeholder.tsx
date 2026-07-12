import React from 'react';

interface PlaceholderProps {
  message: string;
}

export function Placeholder({ message }: PlaceholderProps) {
  return React.createElement(
    'div',
    { className: 'p-4 bg-gray-100 rounded' },
    message
  );
}
