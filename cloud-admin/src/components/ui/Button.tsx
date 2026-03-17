'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: '#007AFF',
    color: 'white',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: '#007AFF',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: '#007AFF',
    border: '2px solid #007AFF',
  },
  danger: {
    background: '#FF3B30',
    color: 'white',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '8px 16px',
    fontSize: '14px',
    minWidth: '60px',
  },
  md: {
    padding: '12px 24px',
    fontSize: '17px',
    minWidth: '100px',
  },
  lg: {
    padding: '16px 32px',
    fontSize: '21px',
    minWidth: '140px',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  disabled,
  style,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  ...props
}: ButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  const baseStyle: React.CSSProperties = {
    borderRadius: '980px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s cubic-bezier(0, 0, 0.58, 1)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif",
    fontWeight: 500,
    lineHeight: 1.24,
    letterSpacing: '-0.02em',
    opacity: disabled || loading ? 0.5 : 1,
    transform: isPressed
      ? 'scale(0.98)'
      : isHovered && !disabled && !loading && variant === 'primary'
        ? 'scale(1.02)'
        : 'scale(1)',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(isHovered && !disabled && !loading && variant === 'primary'
      ? { background: '#0071E3' }
      : {}),
    ...(isHovered && !disabled && !loading && variant === 'outline'
      ? { background: '#007AFF', color: 'white' }
      : {}),
    ...style,
  };

  return (
    <button
      style={baseStyle}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        setIsHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setIsHovered(false);
        setIsPressed(false);
        onMouseLeave?.(e);
      }}
      onMouseDown={(e) => {
        setIsPressed(true);
        onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        setIsPressed(false);
        onMouseUp?.(e);
      }}
      {...props}
    >
      {loading ? (
        <>
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: '2px solid currentColor',
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}
