import { describe, expect, it } from "vitest";
import {
  buildOhlcHistory,
  computeVolatilityMetricValues,
  type OhlcHistoryBar,
} from "../src/services/newsVolatilityMetrics.js";

function roundTo4(value: number): number {
  return Number(value.toFixed(4));
}

function pctChange(current: number, reference: number): number {
  return roundTo4(((current - reference) / reference) * 100);
}

function sampleStdDev(values: number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => {
    const delta = value - mean;
    return sum + (delta * delta);
  }, 0) / (values.length - 1);
  return roundTo4(Math.sqrt(variance));
}

function buildBars(count: number): OhlcHistoryBar[] {
  const bars: OhlcHistoryBar[] = [];
  let close = 100;

  for (let index = 0; index < count; index += 1) {
    if (index > 0) {
      close *= 1 + (index / 100);
    }
    const openMovePct = 1 + (index * 0.5);
    const highMovePct = openMovePct + 1;
    const open = close / (1 + (openMovePct / 100));
    const high = open * (1 + (highMovePct / 100));

    bars.push({
      Datetime: `2026-01-${String(index + 1).padStart(2, "0")}`,
      Open: roundTo4(open),
      High: roundTo4(high),
      Close: roundTo4(close),
    });
  }

  return bars;
}

describe("newsVolatilityMetrics", () => {
  it("computes HV and z-score from the most recent completed samples", () => {
    const bars = buildBars(10);
    const history = buildOhlcHistory(bars);
    const actualMetrics = {
      changePct: 10,
      changeFromOpen: 7.5,
      changeOpenToHigh: 9,
      change1d: 12.5,
      change3d: null,
      change7d: null,
      change14d: null,
      change30d: null,
    };

    const result = computeVolatilityMetricValues(history, bars[8].Datetime, actualMetrics, 3);

    const changePctSamples = [7, 6, 5].map((index) => pctChange(bars[index].Close, bars[index - 1].Close));
    const changeFromOpenSamples = [7, 6, 5].map((index) => pctChange(bars[index].Close, bars[index].Open));
    const change1dSamples = [6, 5, 4].map((index) => pctChange(bars[index + 1].Close, bars[index - 1].Close));

    const expectedHvChangePct = sampleStdDev(changePctSamples);
    const expectedHvChangeFromOpen = sampleStdDev(changeFromOpenSamples);
    const expectedHvChange1d = sampleStdDev(change1dSamples);

    expect(result.hvChangePct).toBe(expectedHvChangePct);
    expect(result.zscoreChangePct).toBe(roundTo4(actualMetrics.changePct / expectedHvChangePct));
    expect(result.hvChangeFromOpen).toBe(expectedHvChangeFromOpen);
    expect(result.zscoreChangeFromOpen).toBe(roundTo4(actualMetrics.changeFromOpen / expectedHvChangeFromOpen));
    expect(result.hvChange1d).toBe(expectedHvChange1d);
    expect(result.zscoreChange1d).toBe(roundTo4(actualMetrics.change1d / expectedHvChange1d));
  });

  it("returns null HV and z-score when the completed sample count is insufficient", () => {
    const bars = buildBars(6);
    const history = buildOhlcHistory(bars);

    const result = computeVolatilityMetricValues(history, bars[4].Datetime, {
      changePct: 5,
      changeFromOpen: 4,
      changeOpenToHigh: 3,
      change1d: 2,
      change3d: 1,
      change7d: 1,
      change14d: 1,
      change30d: 1,
    }, 5);

    expect(result.hvChangePct).toBeNull();
    expect(result.zscoreChangePct).toBeNull();
    expect(result.hvChange1d).toBeNull();
    expect(result.zscoreChange1d).toBeNull();
  });

  it("keeps z-score null when HV is zero", () => {
    const bars: OhlcHistoryBar[] = Array.from({ length: 6 }, (_, index) => ({
      Datetime: `2026-02-${String(index + 1).padStart(2, "0")}`,
      Open: 100,
      High: 101,
      Close: 100,
    }));
    const history = buildOhlcHistory(bars);

    const result = computeVolatilityMetricValues(history, bars[4].Datetime, {
      changePct: 5,
      changeFromOpen: 2,
      changeOpenToHigh: 1,
      change1d: 3,
      change3d: null,
      change7d: null,
      change14d: null,
      change30d: null,
    }, 3);

    expect(result.hvChangePct).toBe(0);
    expect(result.zscoreChangePct).toBeNull();
  });
});