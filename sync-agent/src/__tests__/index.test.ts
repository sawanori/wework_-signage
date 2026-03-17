/**
 * テストケース対象: C-EC-04, C-EC-05
 *
 * C-EC-04: PM2クラッシュ再起動 — メインループが60秒間隔で実行されることを検証
 * C-EC-05: 同時ループ防止 — 前回処理が完了前に次の60秒タイマーが発火した場合、並行実行しない
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// fetchをグローバルモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('index.ts メインループ', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * C-EC-04: メインループが60秒ごとに実行される
   */
  it('C-EC-04: メインループが60秒ごとに実行される', async () => {
    const syncLoop = vi.fn().mockResolvedValue(undefined);

    const indexModule = await import('../index.js');
    const startPolling = (indexModule as {
      startPolling?: (syncFn: () => Promise<void>, intervalMs: number) => () => void
    }).startPolling;
    expect(startPolling).toBeDefined();

    const stopPolling = startPolling!(syncLoop, 60_000);

    // 60秒後の実行
    await vi.advanceTimersByTimeAsync(60_000);

    // 120秒後の実行
    await vi.advanceTimersByTimeAsync(60_000);

    // 180秒後の実行
    await vi.advanceTimersByTimeAsync(60_000);

    // 少なくとも2回以上実行されていること
    expect(syncLoop.mock.calls.length).toBeGreaterThanOrEqual(2);

    stopPolling();
  });

  /**
   * C-EC-05: 前回処理が完了前に次の60秒タイマーが発火した場合、並行実行しない
   */
  it('C-EC-05: 前回処理完了前は次のループを実行しない（並行実行防止）', async () => {
    let resolveSync: (() => void) | null = null;
    let concurrentExecutionDetected = false;
    let isRunning = false;

    const syncLoop = vi.fn().mockImplementation(() => {
      if (isRunning) {
        concurrentExecutionDetected = true;
      }
      isRunning = true;
      return new Promise<void>((resolve) => {
        resolveSync = () => {
          isRunning = false;
          resolve();
        };
      });
    });

    const indexModule = await import('../index.js');
    const startPolling = (indexModule as {
      startPolling?: (syncFn: () => Promise<void>, intervalMs: number) => () => void
    }).startPolling;
    expect(startPolling).toBeDefined();

    const stopPolling = startPolling!(syncLoop, 60_000);

    // 最初のタイマー発火
    await vi.advanceTimersByTimeAsync(60_000);

    // 前回のsyncLoopが完了する前に次の60秒が経過
    await vi.advanceTimersByTimeAsync(60_000);

    // syncLoopは1回だけ呼ばれていること（並行実行されていない）
    expect(syncLoop.mock.calls.length).toBe(1);
    expect(concurrentExecutionDetected).toBe(false);

    // 前回のsyncLoopを完了させる
    if (resolveSync) {
      resolveSync();
    }
    // マイクロタスク処理のため少し待つ
    await vi.advanceTimersByTimeAsync(0);

    // さらに60秒経過して次のループ実行
    await vi.advanceTimersByTimeAsync(60_000);

    // 並行実行は一度も発生していないこと
    expect(concurrentExecutionDetected).toBe(false);

    stopPolling();
  });

  /**
   * C-EC-04(追加): ポーリング停止後はループが実行されない
   */
  it('C-EC-04: stopPolling呼び出し後はループが実行されない', async () => {
    const syncLoop = vi.fn().mockResolvedValue(undefined);

    const indexModule = await import('../index.js');
    const startPolling = (indexModule as {
      startPolling?: (syncFn: () => Promise<void>, intervalMs: number) => () => void
    }).startPolling;
    expect(startPolling).toBeDefined();

    const stopPolling = startPolling!(syncLoop, 60_000);

    // 60秒後に1回実行
    await vi.advanceTimersByTimeAsync(60_000);

    const callCountBeforeStop = syncLoop.mock.calls.length;

    // ポーリング停止
    stopPolling();

    // さらに180秒経過
    await vi.advanceTimersByTimeAsync(180_000);

    // 停止後は追加実行されていないこと
    expect(syncLoop.mock.calls.length).toBe(callCountBeforeStop);
  });
});
