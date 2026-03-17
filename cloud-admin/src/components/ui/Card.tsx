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
        background: 'rgba(255, 255, 255, 0.72)',
        backdropFilter: 'saturate(180%) blur(20px)',
        WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        border: '0.5px solid rgba(255, 255, 255, 0.18)',
        borderRadius: '18px',
        padding,
        transition: 'all 0.3s cubic-bezier(0, 0, 0.58, 1)',
      }
    : {
        background: '#FFFFFF',
        borderRadius: '18px',
        padding,
        boxShadow: isHovered && hoverable
          ? '0 8px 32px rgba(0, 0, 0, 0.10)'
          : '0 4px 16px rgba(0, 0, 0, 0.06)',
        transform: isHovered && hoverable ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'all 0.3s cubic-bezier(0, 0, 0.58, 1)',
        cursor: onClick ? 'pointer' : undefined,
      };

  return (
    <div
      className={className}
      style={{ ...baseStyle, ...style }}
      onMouseEnter={() => hoverable && setIsHovered(true)}
      onMouseLeave={() => hoverable && setIsHovered(false)}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
