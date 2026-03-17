import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'SF Mono',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      colors: {
        apple: {
          blue: '#007AFF',
          'blue-hover': '#0071E3',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          yellow: '#FFCC00',
          gray1: '#8E8E93',
          gray2: '#AEAEB2',
          gray3: '#C7C7CC',
          gray4: '#D1D1D6',
          gray5: '#E5E5EA',
          gray6: '#F2F2F7',
        },
        text: {
          primary: '#1D1D1F',
          secondary: '#6E6E73',
          tertiary: '#86868B',
        },
        bg: {
          primary: '#FFFFFF',
          secondary: '#F5F5F7',
          grouped: '#F2F2F7',
        },
      },
      borderRadius: {
        'apple-sm': '8px',
        'apple': '12px',
        'apple-card': '18px',
        'apple-modal': '20px',
        'apple-pill': '980px',
        'apple-toggle': '16px',
      },
      boxShadow: {
        'apple-card': '0 4px 16px rgba(0, 0, 0, 0.06)',
        'apple-card-hover': '0 8px 32px rgba(0, 0, 0, 0.10)',
        'apple-modal': '0 20px 60px rgba(0, 0, 0, 0.15)',
      },
      spacing: {
        '18': '72px',
        '22': '88px',
      },
      transitionTimingFunction: {
        'apple-out': 'cubic-bezier(0, 0, 0.58, 1)',
        'apple-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
      transitionDuration: {
        '200': '200ms',
        '300': '300ms',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0, 0, 0.58, 1) forwards',
        'fade-in': 'fadeIn 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
        'slide-in': 'slideIn 0.3s cubic-bezier(0, 0, 0.58, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
