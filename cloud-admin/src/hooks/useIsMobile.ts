'use client';

import { useState, useEffect } from 'react';

export const MOBILE_BREAKPOINT = 768;

export function isMobileWidth(width: number): boolean {
  return width < MOBILE_BREAKPOINT;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handler = () => {
      setIsMobile(isMobileWidth(window.innerWidth));
    };

    // Set initial value
    handler();

    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('resize', handler);
    };
  }, []);

  return isMobile;
}
