'use client';

import React, { useEffect } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = '480px',
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Glassmorphism overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s cubic-bezier(0, 0, 0.58, 1) forwards',
        }}
        onClick={onClose}
      />
      {/* Modal card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        style={{
          position: 'relative',
          background: '#FFFFFF',
          borderRadius: '20px',
          padding: '32px',
          width: '100%',
          maxWidth,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
          animation: 'slideIn 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
          zIndex: 1,
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'var(--gray-6, #F2F2F7)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary, #6E6E73)',
            fontSize: '16px',
            transition: 'background 0.2s',
          }}
        >
          ✕
        </button>

        {title && (
          <h2
            id="modal-title"
            style={{
              fontSize: '22px',
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: '-0.01em',
              color: 'var(--text-primary, #1D1D1F)',
              margin: '0 0 24px 0',
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
