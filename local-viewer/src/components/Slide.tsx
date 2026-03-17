import type { PlaylistItem } from '../types/playlist';
import '../styles/slide.css';

interface SlideProps {
  item: PlaylistItem;
  opacity: 0 | 1;
  fadeDurationMs: number;
}

/**
 * パターンC（ぼかし背景 + contain前景）スライドコンポーネント
 */
export function Slide({ item, opacity, fadeDurationMs }: SlideProps) {
  return (
    <div
      className="slide-container"
      style={{
        opacity,
        transitionDuration: `${fadeDurationMs}ms`,
        transitionProperty: 'opacity',
      }}
    >
      {/* 背景レイヤー: blur + brightness */}
      <div
        className="bg-blur"
        style={{
          backgroundImage: `url('${item.url}')`,
        }}
      />

      {/* 前景レイヤー: contain表示 */}
      {item.type === 'pdf' ? (
        <canvas className="fg-image" />
      ) : (
        <img className="fg-image" src={item.url} alt="" />
      )}
    </div>
  );
}
