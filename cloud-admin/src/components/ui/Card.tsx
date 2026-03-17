'use client';

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  hoverable?: boolean;
  glass?: boolean;
  padding?: string | number;
  onClick?: () => void;
}

export function Card({
  children,
  className,
  style,
  hoverable = false,
  glass = false,
  padding = '24px',
  onClick,
}: CardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyle: React.CSSProperties = glass
    ? {
        background: 'rgba(20, 20, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid #2A2A2A',
        borderRadius: '12px',
        padding,
        transition: 'border-color 0.15s ease',
      }
    : {
        background: '#141414',
        borderRadius: '12px',
        padding,
        border: isHovered && hoverable
          ? '1px solid #3A3A3A'
          : '1px solid #2A2A2A',
        transition: 'border-color 0.15s ease',
        cursor: onClick ? 'pointer' : undefined,
      };

  return (
    <div
      className={className}
      style={{ ...baseStyle, ...style }}
      onMouseEnter={() => (hoverable || onClick) && setIsHovered(true)}
      onMouseLeave={() => (hoverable || onClick) && setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
