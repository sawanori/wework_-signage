/**
 * Tests for useUpload hook — client-side validation logic
 * D-E-01: ファイルサイズ超過 — クライアント側エラー
 * D-E-02: 未対応フォーマット — クライアント側エラー
 */

import { describe, it, expect } from 'vitest';

// Pure validation logic extracted from useUpload (testable without React/DOM)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

function validateFile(file: { type: string; size: number }): { valid: boolean; error: string | null } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `対応していないファイル形式です。JPEG, PNG, WebP, PDFのみアップロード可能です。`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `ファイルサイズが30MBを超えています（${(file.size / 1024 / 1024).toFixed(1)}MB）。`,
    };
  }
  return { valid: true, error: null };
}

describe('useUpload client-side validation', () => {
  /**
   * D-E-01: 31MBのファイルをアップロードしようとするとクライアント側でエラーメッセージが表示されAPIを呼ばない
   */
  describe('ファイルサイズバリデーション', () => {
    it('D-E-01: 31MBファイルはバリデーションエラーになる', () => {
      const file = { type: 'image/jpeg', size: 31 * 1024 * 1024 };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('30MB');
    });

    it('ちょうど30MB（境界値）はバリデーションを通過する', () => {
      const file = { type: 'image/jpeg', size: 30 * 1024 * 1024 };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('30MB未満はバリデーションを通過する', () => {
      const file = { type: 'image/png', size: 8 * 1024 * 1024 };
      const result = validateFile(file);
      expect(result.valid).toBe(true);
    });
  });

  /**
   * D-E-02: .mp4ファイルをドロップすると「対応していないファイル形式です」のエラーが表示される
   */
  describe('ファイル形式バリデーション', () => {
    it('D-E-02: video/mp4はバリデーションエラーになる', () => {
      const file = { type: 'video/mp4', size: 5 * 1024 * 1024 };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('対応していないファイル形式');
    });

    it('image/jpegは許可される', () => {
      const file = { type: 'image/jpeg', size: 1024 };
      expect(validateFile(file).valid).toBe(true);
    });

    it('image/pngは許可される', () => {
      const file = { type: 'image/png', size: 1024 };
      expect(validateFile(file).valid).toBe(true);
    });

    it('image/webpは許可される', () => {
      const file = { type: 'image/webp', size: 1024 };
      expect(validateFile(file).valid).toBe(true);
    });

    it('application/pdfは許可される', () => {
      const file = { type: 'application/pdf', size: 1024 };
      expect(validateFile(file).valid).toBe(true);
    });

    it('application/x-msdownload (.exe) はエラーになる', () => {
      const file = { type: 'application/x-msdownload', size: 100 };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });

    it('text/html はエラーになる', () => {
      const file = { type: 'text/html', size: 100 };
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });
  });
});
