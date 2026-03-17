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
        background: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid #D5D5D5',
        borderRadius: '12px',
        padding,
        transition: 'border-color 0.15s ease',
      }
    : {
        background: '#FFFFFF',
        borderRadius: '12px',
        padding,
        border: isHovered && hoverable
          ? '1px solid #BBBBBB'
          : '1px solid #D5D5D5',
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
