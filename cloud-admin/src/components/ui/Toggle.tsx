'use client';

import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
}

export function Toggle({ checked, onChange, label, disabled = false, id }: ToggleProps) {
  const toggleId = id ?? `toggle-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <label
      htmlFor={toggleId}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <input
        type="checkbox"
        id={toggleId}
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        style={{ display: 'none' }}
      />
      {/* Toggle track */}
      <span
        role="switch"
        aria-checked={checked}
        style={{
          display: 'inline-block',
          width: '51px',
          height: '31px',
          background: checked ? '#34C759' : '#E9E9EB',
          borderRadius: '16px',
          position: 'relative',
          transition: 'background 0.3s cubic-bezier(0, 0, 0.58, 1)',
          flexShrink: 0,
        }}
      >
        {/* Toggle thumb */}
        <span
          style={{
            display: 'block',
            width: '27px',
            height: '27px',
            background: 'white',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: '2px',
            transition: 'transform 0.3s cubic-bezier(0, 0, 0.58, 1)',
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
            boxShadow: '0 3px 8px rgba(0, 0, 0, 0.15)',
          }}
        />
      </span>
      {label && (
        <span
          style={{
            fontSize: '17px',
            color: 'var(--text-primary, #1D1D1F)',
            letterSpacing: '-0.02em',
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
}
