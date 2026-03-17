import * as pdfjsLib from 'pdfjs-dist';

const MAX_PAGES = 20;

/**
 * PDFファイルを読み込み、各ページをBlobURL（またはデータURL）の配列として返す
 * @param pdfPath - PDFファイルのパス
 * @param scale - レンダリングスケール
 * @returns 各ページのURL配列（最大20ページ）
 */
export async function loadPdfAsSlides(pdfPath: string, scale: number): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument(pdfPath);
  const pdfDoc = await loadingTask.promise;

  const pageCount = Math.min(pdfDoc.numPages, MAX_PAGES);
  const blobUrls: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const ctx = canvas.getContext('2d');
    const renderContext = {
      canvasContext: ctx,
      viewport,
    };

    await page.render(renderContext as Parameters<typeof page.render>[0]).promise;

    const blobUrl = await new Promise<string>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob) ?? '';
          resolve(String(url));
        } else {
          reject(new Error(`Failed to convert page ${i} to blob`));
        }
      });
    });

    blobUrls.push(blobUrl);
  }

  return blobUrls;
}
