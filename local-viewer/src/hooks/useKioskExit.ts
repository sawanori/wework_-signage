import { useState, useEffect, useRef } from 'react';

const ESCAPE_COUNT_REQUIRED = 3;
const ESCAPE_WINDOW_MS = 1000;

/**
 * キオスクモード終了フック
 * Escapeキーを1秒以内に3回押すと終了プロンプトを表示
 */
export function useKioskExit() {
  const [showPrompt, setShowPrompt] = useState(false);
  const escapeTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      if (showPrompt) {
        // プロンプト表示中のキーハンドリング
        if (event.key === 'y' || event.key === 'Y') {
          window.close();
        } else if (event.key === 'n' || event.key === 'N') {
          setShowPrompt(false);
        }
        return;
      }

      if (event.key === 'Escape') {
        const now = Date.now();
        // 1秒以内のEscapeキー押下を記録
        escapeTimestampsRef.current = [
          ...escapeTimestampsRef.current.filter((t) => now - t < ESCAPE_WINDOW_MS),
          now,
        ];

        if (escapeTimestampsRef.current.length >= ESCAPE_COUNT_REQUIRED) {
          escapeTimestampsRef.current = [];
          setShowPrompt(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }, [showPrompt]);

  const handleConfirm = () => {
    window.close();
  };

  const handleCancel = () => {
    setShowPrompt(false);
  };

  return { showPrompt, handleConfirm, handleCancel };
}
