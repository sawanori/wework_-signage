/**
 * テストケース対象:
 * A-N-07: PDFスライド表示（3ページPDFが3つのBlobURLを返す）
 * A-E-04: 破損PDFファイル（pdf.jsがエラーを返した場合エラーをスローする）
 * A-EC-04: PDF 100ページ（最大20スライド上限）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadPdfAsSlides } from '../lib/pdfLoader';

// pdf.js モック
const mockRenderTask = {
  promise: Promise.resolve(),
};

const mockCanvas = {
  getContext: vi.fn().mockReturnValue({}),
  width: 0,
  height: 0,
  toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
    cb(new Blob(['fake-image-data'], { type: 'image/png' }));
  }),
};

const makeMockPage = (pageNum: number) => ({
  getViewport: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
  render: vi.fn().mockReturnValue(mockRenderTask),
});

const makeMockPdfDocument = (numPages: number) => ({
  numPages,
  getPage: vi.fn(async (pageNum: number) => makeMockPage(pageNum)),
});

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(),
  GlobalWorkerOptions: { workerSrc: '' },
}));

// URL.createObjectURL のモック
const mockObjectURL = 'blob:http://localhost/fake-uuid';
global.URL.createObjectURL = vi.fn().mockReturnValue(mockObjectURL);
global.URL.revokeObjectURL = vi.fn();

// document.createElement('canvas') のモック
const originalCreateElement = document.createElement.bind(document);

describe('pdfLoader', () => {
  let pdfjsLib: typeof import('pdfjs-dist');

  beforeEach(async () => {
    vi.clearAllMocks();
    pdfjsLib = await import('pdfjs-dist');

    // canvas要素のモック
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // A-N-07: 3ページPDFが3つのBlobURLを返す
  describe('A-N-07: 正常系 - 3ページPDF', () => {
    it('3ページのPDFが3つのBlobURLを返す', async () => {
      const mockDoc = makeMockPdfDocument(3);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await loadPdfAsSlides('/data/images/test.pdf', 1.0);

      expect(result).toHaveLength(3);
      result.forEach((url) => {
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(0);
      });
    });

    it('3ページPDFで getPage が3回呼ばれる', async () => {
      const mockDoc = makeMockPdfDocument(3);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await loadPdfAsSlides('/data/images/test.pdf', 1.0);

      expect(mockDoc.getPage).toHaveBeenCalledTimes(3);
      expect(mockDoc.getPage).toHaveBeenCalledWith(1);
      expect(mockDoc.getPage).toHaveBeenCalledWith(2);
      expect(mockDoc.getPage).toHaveBeenCalledWith(3);
    });

    it('loadPdfAsSlides に正しいパスが渡される', async () => {
      const mockDoc = makeMockPdfDocument(1);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await loadPdfAsSlides('/data/images/menu.pdf', 1.5);

      expect(pdfjsLib.getDocument).toHaveBeenCalledWith(
        expect.stringContaining('/data/images/menu.pdf')
      );
    });
  });

  // A-N-07: 各ページが20秒固定表示（型チェック）
  describe('A-N-07: PDFページの表示時間', () => {
    it('loadPdfAsSlides はstring配列を返す（各BlobURLに対してdurationは20秒で固定される前提）', async () => {
      const mockDoc = makeMockPdfDocument(2);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await loadPdfAsSlides('/data/images/test.pdf', 1.0);

      // BlobURLの配列が返ること（表示時間20秒はPlaylistItem生成側で固定する）
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      result.forEach((url) => {
        expect(typeof url).toBe('string');
      });
    });
  });

  // A-E-04: 破損PDFでエラーがスローされる
  describe('A-E-04: 破損PDFファイル', () => {
    it('pdf.js が getDocument でエラーを返した場合、エラーがスローされる', async () => {
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF structure')),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await expect(
        loadPdfAsSlides('/data/images/corrupt.pdf', 1.0)
      ).rejects.toThrow();
    });

    it('破損PDFのエラーメッセージが保持される', async () => {
      const errorMessage = 'Invalid PDF structure';
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.reject(new Error(errorMessage)),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await expect(
        loadPdfAsSlides('/data/images/corrupt.pdf', 1.0)
      ).rejects.toThrow(errorMessage);
    });

    it('ページレンダリングでエラーが発生した場合もエラーがスローされる', async () => {
      const mockPageWithError = {
        getViewport: vi.fn().mockReturnValue({ width: 1920, height: 1080 }),
        render: vi.fn().mockReturnValue({
          promise: Promise.reject(new Error('Render failed')),
        }),
      };
      const mockDoc = {
        numPages: 1,
        getPage: vi.fn(async () => mockPageWithError),
      };
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await expect(
        loadPdfAsSlides('/data/images/corrupt.pdf', 1.0)
      ).rejects.toThrow();
    });
  });

  // A-EC-04: 100ページPDFで最大20スライド（上限）が返される
  describe('A-EC-04: PDF 100ページ - 上限20スライド', () => {
    it('100ページのPDFから最大20つのBlobURLが返される（21ページ以降は無視）', async () => {
      const mockDoc = makeMockPdfDocument(100);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await loadPdfAsSlides('/data/images/large.pdf', 1.0);

      expect(result).toHaveLength(20);
    });

    it('100ページPDFで getPage が20回しか呼ばれない', async () => {
      const mockDoc = makeMockPdfDocument(100);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      await loadPdfAsSlides('/data/images/large.pdf', 1.0);

      // getPage は1〜20ページ分のみ呼ばれる
      expect(mockDoc.getPage).toHaveBeenCalledTimes(20);
      expect(mockDoc.getPage).not.toHaveBeenCalledWith(21);
    });

    it('20ページのPDFは全ページ（20スライド）が返される', async () => {
      const mockDoc = makeMockPdfDocument(20);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await loadPdfAsSlides('/data/images/exactly20.pdf', 1.0);

      expect(result).toHaveLength(20);
    });

    it('21ページのPDFは20スライドに切り捨てられる', async () => {
      const mockDoc = makeMockPdfDocument(21);
      vi.mocked(pdfjsLib.getDocument).mockReturnValue({
        promise: Promise.resolve(mockDoc),
      } as ReturnType<typeof pdfjsLib.getDocument>);

      const result = await loadPdfAsSlides('/data/images/twentyone.pdf', 1.0);

      expect(result).toHaveLength(20);
    });
  });
});
