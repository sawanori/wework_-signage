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
    background: '#FFFFFF',
    color: '#000000',
    border: 'none',
  },
  secondary: {
    background: 'transparent',
    color: '#A1A1A1',
    border: 'none',
  },
  outline: {
    background: 'transparent',
    color: '#FAFAFA',
    border: '1px solid #2A2A2A',
  },
  danger: {
    background: '#EF4444',
    color: 'white',
    border: 'none',
  },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    padding: '6px 12px',
    fontSize: '13px',
    minWidth: '60px',
  },
  md: {
    padding: '8px 16px',
    fontSize: '14px',
    minWidth: '80px',
  },
  lg: {
    padding: '10px 20px',
    fontSize: '15px',
    minWidth: '120px',
  },
};

const variantHoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'rgba(255,255,255,0.9)',
  },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    color: '#FAFAFA',
  },
  outline: {
    background: 'rgba(255,255,255,0.06)',
    borderColor: '#3A3A3A',
  },
  danger: {
    background: '#DC2626',
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
    borderRadius: '8px',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.15s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: '-0.01em',
    opacity: disabled || loading ? 0.4 : 1,
    transform: isPressed ? 'scale(0.98)' : 'scale(1)',
    ...variantStyles[variant],
    ...sizeStyles[size],
    ...(isHovered && !disabled && !loading ? variantHoverStyles[variant] : {}),
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
              width: '12px',
              height: '12px',
              border: '1.5px solid currentColor',
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
