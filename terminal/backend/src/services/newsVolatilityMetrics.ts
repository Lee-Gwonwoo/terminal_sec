export const VOLATILITY_LOOKBACK = 60;

export const HV_METRIC_KEYS = [
  "hv_change_pct",
  "hv_change_from_open_pct",
  "hv_change_open_to_high_pct",
  "hv_change_1d_pct",
  "hv_change_3d_pct",
  "hv_change_7d_pct",
  "hv_change_14d_pct",
  "hv_change_30d_pct",
] as const;

export const ZSCORE_METRIC_KEYS = [
  "zscore_change_pct",
  "zscore_change_from_open_pct",
  "zscore_change_open_to_high_pct",
  "zscore_change_1d_pct",
  "zscore_change_3d_pct",
  "zscore_change_7d_pct",
  "zscore_change_14d_pct",
  "zscore_change_30d_pct",
] as const;

export const VOLATILITY_METRIC_KEYS = [...HV_METRIC_KEYS, ...ZSCORE_METRIC_KEYS] as const;

export type OhlcHistoryBar = {
  Datetime: string;
  Open: number;
  High: number;
  Close: number;
};

export type OhlcHistory = {
  bars: OhlcHistoryBar[];
  indexByDate: Map<string, number>;
};

export type ActualChangeMetricValues = {
  changePct: number | null;
  changeFromOpen: number | null;
  changeOpenToHigh: number | null;
  change1d: number | null;
  change3d: number | null;
  change7d: number | null;
  change14d: number | null;
  change30d: number | null;
};

export type VolatilityMetricValues = {
  hvChangePct: number | null;
  hvChangeFromOpen: number | null;
  hvChangeOpenToHigh: number | null;
  hvChange1d: number | null;
  hvChange3d: number | null;
  hvChange7d: number | null;
  hvChange14d: number | null;
  hvChange30d: number | null;
  zscoreChangePct: number | null;
  zscoreChangeFromOpen: number | null;
  zscoreChangeOpenToHigh: number | null;
  zscoreChange1d: number | null;
  zscoreChange3d: number | null;
  zscoreChange7d: number | null;
  zscoreChange14d: number | null;
  zscoreChange30d: number | null;
};

type MetricSpec = {
  actualField: keyof ActualChangeMetricValues;
  hvField: keyof VolatilityMetricValues;
  zscoreField: keyof VolatilityMetricValues;
  hvKey: (typeof HV_METRIC_KEYS)[number];
  zscoreKey: (typeof ZSCORE_METRIC_KEYS)[number];
  forwardTradingDays: number;
  sample: (bars: OhlcHistoryBar[], index: number) => number | null;
};

const METRIC_SPECS: MetricSpec[] = [
  {
    actualField: "changePct",
    hvField: "hvChangePct",
    zscoreField: "zscoreChangePct",
    hvKey: "hv_change_pct",
    zscoreKey: "zscore_change_pct",
    forwardTradingDays: 0,
    sample: (bars, index) => {
      if (index < 1) return null;
      return pctChange(bars[index].Close, bars[index - 1].Close);
    },
  },
  {
    actualField: "changeFromOpen",
    hvField: "hvChangeFromOpen",
    zscoreField: "zscoreChangeFromOpen",
    hvKey: "hv_change_from_open_pct",
    zscoreKey: "zscore_change_from_open_pct",
    forwardTradingDays: 0,
    sample: (bars, index) => pctChange(bars[index].Close, bars[index].Open),
  },
  {
    actualField: "changeOpenToHigh",
    hvField: "hvChangeOpenToHigh",
    zscoreField: "zscoreChangeOpenToHigh",
    hvKey: "hv_change_open_to_high_pct",
    zscoreKey: "zscore_change_open_to_high_pct",
    forwardTradingDays: 0,
    sample: (bars, index) => pctChange(bars[index].High, bars[index].Open),
  },
  {
    actualField: "change1d",
    hvField: "hvChange1d",
    zscoreField: "zscoreChange1d",
    hvKey: "hv_change_1d_pct",
    zscoreKey: "zscore_change_1d_pct",
    forwardTradingDays: 1,
    sample: (bars, index) => forwardClosePctChange(bars, index, 1),
  },
  {
    actualField: "change3d",
    hvField: "hvChange3d",
    zscoreField: "zscoreChange3d",
    hvKey: "hv_change_3d_pct",
    zscoreKey: "zscore_change_3d_pct",
    forwardTradingDays: 3,
    sample: (bars, index) => forwardClosePctChange(bars, index, 3),
  },
  {
    actualField: "change7d",
    hvField: "hvChange7d",
    zscoreField: "zscoreChange7d",
    hvKey: "hv_change_7d_pct",
    zscoreKey: "zscore_change_7d_pct",
    forwardTradingDays: 5,
    sample: (bars, index) => forwardClosePctChange(bars, index, 5),
  },
  {
    actualField: "change14d",
    hvField: "hvChange14d",
    zscoreField: "zscoreChange14d",
    hvKey: "hv_change_14d_pct",
    zscoreKey: "zscore_change_14d_pct",
    forwardTradingDays: 10,
    sample: (bars, index) => forwardClosePctChange(bars, index, 10),
  },
  {
    actualField: "change30d",
    hvField: "hvChange30d",
    zscoreField: "zscoreChange30d",
    hvKey: "hv_change_30d_pct",
    zscoreKey: "zscore_change_30d_pct",
    forwardTradingDays: 22,
    sample: (bars, index) => forwardClosePctChange(bars, index, 22),
  },
];

function roundTo4(value: number): number {
  return Number(value.toFixed(4));
}

function pctChange(current: number, reference: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(reference) || reference === 0) {
    return null;
  }
  return roundTo4(((current - reference) / reference) * 100);
}

function forwardClosePctChange(bars: OhlcHistoryBar[], index: number, forwardTradingDays: number): number | null {
  if (index < 1) return null;
  const targetIndex = index + forwardTradingDays;
  if (targetIndex >= bars.length) return null;
  return pctChange(bars[targetIndex].Close, bars[index - 1].Close);
}

function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => {
    const delta = value - mean;
    return sum + (delta * delta);
  }, 0) / (values.length - 1);
  if (!Number.isFinite(variance) || variance < 0) return null;
  return roundTo4(Math.sqrt(variance));
}

function emptyVolatilityMetricValues(): VolatilityMetricValues {
  return {
    hvChangePct: null,
    hvChangeFromOpen: null,
    hvChangeOpenToHigh: null,
    hvChange1d: null,
    hvChange3d: null,
    hvChange7d: null,
    hvChange14d: null,
    hvChange30d: null,
    zscoreChangePct: null,
    zscoreChangeFromOpen: null,
    zscoreChangeOpenToHigh: null,
    zscoreChange1d: null,
    zscoreChange3d: null,
    zscoreChange7d: null,
    zscoreChange14d: null,
    zscoreChange30d: null,
  };
}

export function buildOhlcHistory(bars: OhlcHistoryBar[]): OhlcHistory {
  const indexByDate = new Map<string, number>();
  bars.forEach((bar, index) => {
    indexByDate.set(bar.Datetime, index);
  });
  return { bars, indexByDate };
}

export function computeVolatilityMetricValues(
  history: OhlcHistory,
  anchorDate: string,
  actualMetrics: ActualChangeMetricValues,
  lookback = VOLATILITY_LOOKBACK,
): VolatilityMetricValues {
  const anchorIndex = history.indexByDate.get(anchorDate);
  if (anchorIndex === undefined) {
    return emptyVolatilityMetricValues();
  }

  const result = emptyVolatilityMetricValues();

  for (const spec of METRIC_SPECS) {
    const samples: number[] = [];
    for (let sampleIndex = anchorIndex - 1 - spec.forwardTradingDays; sampleIndex >= 0 && samples.length < lookback; sampleIndex -= 1) {
      const sampleValue = spec.sample(history.bars, sampleIndex);
      if (sampleValue !== null) {
        samples.push(sampleValue);
      }
    }

    if (samples.length < lookback) {
      result[spec.hvField] = null;
      result[spec.zscoreField] = null;
      continue;
    }

    const hv = sampleStdDev(samples);
    result[spec.hvField] = hv;

    const actualValue = actualMetrics[spec.actualField];
    result[spec.zscoreField] = hv !== null && hv !== 0 && actualValue !== null
      ? roundTo4(actualValue / hv)
      : null;
  }

  return result;
}

export const VOLATILITY_FIELD_SPECS = METRIC_SPECS.map((spec) => ({
  actualField: spec.actualField,
  hvField: spec.hvField,
  zscoreField: spec.zscoreField,
  hvKey: spec.hvKey,
  zscoreKey: spec.zscoreKey,
  forwardTradingDays: spec.forwardTradingDays,
}));