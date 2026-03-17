import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlaylistItem, GlobalSettings } from '../types/playlist';
import { Slide } from './Slide';
import { loadPdfAsSlides } from '../lib/pdfLoader';

const PDF_PAGE_DURATION_MS = 20000;
const PDF_RENDER_SCALE = 2.0;

interface PlayerProps {
  items: PlaylistItem[];
  globalSettings: GlobalSettings;
}

interface SlideEntry {
  item: PlaylistItem;
  key: string;
}

/**
 * 有効な表示時間を計算する
 * intervalMs < fadeDurationMs の場合、実効時間 = fadeDurationMs + 3000ms
 */
function getEffectiveDuration(
  item: PlaylistItem,
  globalSettings: GlobalSettings
): number {
  const { fadeDurationMs, intervalMs } = globalSettings;
  const rawDuration = item.durationOverrideMs ?? intervalMs;
  return rawDuration < fadeDurationMs ? fadeDurationMs + 3000 : rawDuration;
}

/**
 * PDFアイテムをBlobURL画像アイテムに展開する
 * PDFの各ページは1ページあたり20秒固定で表示
 */
async function expandPdfItems(items: PlaylistItem[]): Promise<PlaylistItem[]> {
  const expanded: PlaylistItem[] = [];
  for (const item of items) {
    if (item.type !== 'pdf') {
      expanded.push(item);
      continue;
    }
    try {
      const blobUrls = await loadPdfAsSlides(item.url, PDF_RENDER_SCALE);
      blobUrls.forEach((blobUrl, pageIndex) => {
        expanded.push({
          id: `${item.id}_page${pageIndex + 1}`,
          url: blobUrl,
          hash: item.hash,
          type: 'image',
          durationOverrideMs: PDF_PAGE_DURATION_MS,
          position: item.position,
        });
      });
    } catch (err) {
      console.error(`[Player] PDF展開失敗: ${item.url}`, err);
      // PDF展開に失敗したアイテムはスキップ
    }
  }
  return expanded;
}

/**
 * プレイリストをループ再生するプレイヤーコンポーネント
 * 2枚DOM管理でフェードトランジションを実現
 */
export function Player({ items, globalSettings }: PlayerProps) {
  const { fadeDurationMs } = globalSettings;

  // PDF展開後のアイテムリスト（非同期で更新される）
  const [expandedItems, setExpandedItems] = useState<PlaylistItem[]>(() =>
    items.filter((item) => item.type !== 'pdf')
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  // slides: 現在表示中のスライドエントリー（最大2枚）
  const [slides, setSlides] = useState<SlideEntry[]>(() => {
    const initialItems = items.filter((item) => item.type !== 'pdf');
    if (initialItems.length === 0) return [];
    return [{ item: initialItems[0], key: `${initialItems[0].id}-0` }];
  });

  const currentIndexRef = useRef(0);
  const expandedItemsRef = useRef(expandedItems);
  const globalSettingsRef = useRef(globalSettings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransitioningRef = useRef(false);

  expandedItemsRef.current = expandedItems;
  globalSettingsRef.current = globalSettings;

  const scheduleNext = useCallback((index: number) => {
    const currentItems = expandedItemsRef.current;
    if (currentItems.length === 0) return;

    const currentItem = currentItems[index];
    const duration = getEffectiveDuration(currentItem, globalSettingsRef.current);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      const latestItems = expandedItemsRef.current;
      const nextIndex = (index + 1) % latestItems.length;
      const nextItem = latestItems[nextIndex];
      const fd = globalSettingsRef.current.fadeDurationMs;

      if (fd === 0) {
        // 即座に切替
        setCurrentIndex(nextIndex);
        setSlides([{ item: nextItem, key: `${nextItem.id}-${nextIndex}` }]);
        isTransitioningRef.current = false;
        scheduleNext(nextIndex);
      } else {
        // フェード開始: 新スライドを追加
        setSlides((prev) => [
          ...prev,
          { item: nextItem, key: `${nextItem.id}-${nextIndex}` },
        ]);
        setCurrentIndex(nextIndex);

        // fadeDurationMs 後に旧スライドをアンマウント
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
        fadeTimerRef.current = setTimeout(() => {
          setSlides([{ item: nextItem, key: `${nextItem.id}-${nextIndex}` }]);
          isTransitioningRef.current = false;
          scheduleNext(nextIndex);
        }, fd);
      }
    }, duration);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // PDFアイテムを非同期に展開してexpandedItemsを更新する
  useEffect(() => {
    const hasPdf = items.some((item) => item.type === 'pdf');
    if (!hasPdf) {
      setExpandedItems(items);
      return;
    }

    let cancelled = false;
    expandPdfItems(items).then((expanded) => {
      if (!cancelled) {
        setExpandedItems(expanded);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [items]);

  // expandedItems が更新されたらプレイヤーを再初期化する
  useEffect(() => {
    if (expandedItems.length === 0) {
      console.error('[Player] プレイリストが空です。黒画面を表示します。');
      setSlides([]);
      return;
    }

    // 初期化
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    setSlides([{ item: expandedItems[0], key: `${expandedItems[0].id}-0` }]);
    isTransitioningRef.current = false;

    scheduleNext(0);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      isTransitioningRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedItems, fadeDurationMs]);

  // currentIndex を ref に同期
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  if (items.length === 0) {
    return (
      <div
        data-testid="black-screen"
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: 'black',
        }}
      />
    );
  }

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {slides.map((entry) => (
        <div
          key={entry.key}
          data-slide-id={entry.item.id}
          className="slide-fade"
          style={{
            position: 'absolute',
            inset: 0,
            transitionDuration: `${fadeDurationMs}ms`,
            transitionProperty: 'opacity',
          }}
        >
          <Slide
            item={entry.item}
            opacity={1}
            fadeDurationMs={fadeDurationMs}
          />
        </div>
      ))}
    </div>
  );
}
