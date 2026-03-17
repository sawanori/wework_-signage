/**
 * 画像をプリロードする
 * @param url - プリロードする画像のURL
 * @returns ロード完了でresolve、エラーでrejectするPromise
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}
