/**
 * generateVersion() ユニットテスト
 *
 * 検証内容:
 * - generateVersion() が "v_" + UNIXタイムスタンプ（秒）形式を返すこと
 * - 2回呼び出しで、同一秒内なら同一になりうるが、秒をまたぐと異なる値になること
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateVersion } from '@/lib/version';

describe('generateVersion()', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * "v_" + UNIXタイムスタンプ（秒）形式を返す
   */
  it('"v_" + UNIXタイムスタンプ（秒）形式の文字列を返す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-17T12:00:00.000Z'));

    const version = generateVersion();

    // "v_1710676800" のような形式になること
    expect(version).toMatch(/^v_\d+$/);

    // "v_" プレフィックスがあること
    expect(version.startsWith('v_')).toBe(true);

    // タイムスタンプ部分が数値であること
    const timestampPart = version.slice(2);
    expect(Number.isInteger(Number(timestampPart))).toBe(true);

    // タイムスタンプが10桁前後の妥当な値であること（UNIX時間は2024年時点で10桁）
    expect(timestampPart.length).toBeGreaterThanOrEqual(10);
  });

  /**
   * Date.now() に基づいて正しいUNIXタイムスタンプ（秒）を使用する
   */
  it('現在時刻のUNIXタイムスタンプ（秒）を使用する', () => {
    vi.useFakeTimers();
    // 特定の時刻を固定: 2024-03-17 12:00:00 UTC = 1710676800
    const fixedTime = new Date('2024-03-17T12:00:00.000Z');
    vi.setSystemTime(fixedTime);

    const version = generateVersion();
    const expectedTimestamp = Math.floor(fixedTime.getTime() / 1000);

    expect(version).toBe(`v_${expectedTimestamp}`);
  });

  /**
   * 2回呼び出しで同一秒内なら同一値を返す（タイマー固定）
   */
  it('同一秒内の2回呼び出しでは同一のversionを返す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-17T12:00:00.000Z'));

    const version1 = generateVersion();
    const version2 = generateVersion();

    expect(version1).toBe(version2);
  });

  /**
   * 秒をまたいだ2回呼び出しでは異なる値を返す
   */
  it('秒をまたいだ2回呼び出しでは異なるversionを返す', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-03-17T12:00:00.000Z'));

    const version1 = generateVersion();

    // 1秒進める
    vi.advanceTimersByTime(1000);

    const version2 = generateVersion();

    expect(version1).not.toBe(version2);
  });
});
