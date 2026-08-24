// ГОСТ 2708-75: Объемы круглых лесоматериалов (длина L = 6.0 м)
// Ключ: диаметр в верхнем торце (вершине) в см -> объем в м³
export const GOST_2708_75_L6: Record<number, number> = {
  10: 0.058, 11: 0.071, 12: 0.086, 13: 0.103, 14: 0.123,
  15: 0.142, 16: 0.164, 17: 0.188, 18: 0.214, 19: 0.242,
  20: 0.270, 21: 0.300, 22: 0.330, 23: 0.365, 24: 0.400,
  25: 0.440, 26: 0.480, 27: 0.520, 28: 0.560, 29: 0.610,
  30: 0.660, 31: 0.710, 32: 0.760, 33: 0.815, 34: 0.870,
  35: 0.930, 36: 0.990, 37: 1.050, 38: 1.110, 39: 1.180,
  40: 1.250, 42: 1.390, 44: 1.540, 46: 1.690, 48: 1.850,
  50: 2.020
};

export interface TableRow {
  id: string;
  size: string;
  grade1_count: number | null;
  grade2_count: number | null;
  grade1_vol_m3: number;
  grade2_vol_m3: number;
  total_vol_m3: number;
  is_filled: boolean;
}

export interface ExtraItem {
  id: string;
  name: string;
  size: string;
  count: number;
  unit: string;
  vol_m3: number;
  is_slab?: boolean;
}

export interface RoundwoodBreakdown {
  diameter: number;
  volume_m3: number;
}

export interface RoundwoodLogs {
  diameters: number[];
  count: number;
  total_volume_m3: number;
  breakdown: RoundwoodBreakdown[];
}

export interface SalaryCalculation {
  sawn_rate_per_m3: number;        // Ставка за м³ (по умолчанию 1600 руб/м³)
  slab_rate_per_piece: number;     // Ставка за 1 шт горбыля 2м (по умолчанию 25 руб/шт)
  sawn_base_volume_m3: number;     // Кубатура готового пиломатериала (1с + 2с + брус)
  sawn_salary_rub: number;         // sawn_base_volume_m3 * 1600
  slab_count: number;              // Количество горбыля 2м (шт)
  slab_salary_rub: number;         // slab_count * 25
  total_salary_rub: number;        // sawn_salary_rub + slab_salary_rub
}

export interface SheetSummary {
  total_grade1_count: number;
  total_grade2_count: number;
  total_pieces: number;
  total_grade1_volume_m3: number;
  total_grade2_volume_m3: number;
  total_extra_volume_m3: number;
  total_sawn_base_volume_m3: number; // Чистая кубатура готового пиломатериала
  total_sawn_volume_m3: number;      // Общая кубатура
  total_logs_count: number;
  total_logs_volume_m3: number;
  raw_yield_percent: number;         // Точный процент выхода
  yield_percent: number;             // Округленный ВСЕГДА В МЕНЬШУЮ сторону (Math.floor)
  salary: SalaryCalculation;
}

export interface SheetMetadata {
  shift_date: string;
  shift_type?: string;
  brigade?: string;
  notes: string;
  processed_at?: string;
  model_engine: string;
  ocr_confidence?: number;
}

export interface RecognitionResult {
  metadata: SheetMetadata;
  summary: SheetSummary;
  standard_table: TableRow[];
  extra_items: ExtraItem[];
  roundwood_logs: RoundwoodLogs;
  raw_ocr_sample?: string;
}

export function parseDimensions(sizeStr: string): [number | null, number | null, number | null] {
  if (!sizeStr) return [null, null, null];
  const clean = sizeStr.toLowerCase().replace(/\*/g, 'x').replace(/х/g, 'x').replace(/×/g, 'x').replace(/\s+/g, '');
  const parts = clean.split('x');
  if (parts.length >= 3) {
    const t = parseFloat(parts[0]);
    const w = parseFloat(parts[1]);
    const l = parseFloat(parts[2]);
    if (!isNaN(t) && !isNaN(w) && !isNaN(l)) return [t, w, l];
  } else if (parts.length === 2) {
    const t = parseFloat(parts[0]);
    const w = parseFloat(parts[1]);
    if (!isNaN(t) && !isNaN(w)) return [t, w, 6.0];
  }
  return [null, null, null];
}

export function calculateSawnVolume(sizeStr: string, count: number): number {
  if (!count || count <= 0) return 0;
  const [t, w, l] = parseDimensions(sizeStr);
  if (t !== null && w !== null && l !== null) {
    const vol = (t / 1000.0) * (w / 1000.0) * l * count;
    return Math.round(vol * 10000) / 10000;
  }
  return 0;
}

export function calculateLogVolume(d: number, lenM: number = 6.0): number {
  if (lenM === 6.0 && GOST_2708_75_L6[d]) {
    return GOST_2708_75_L6[d];
  }
  const radiusM = (d + (lenM / 2.0) * 1.0) / 200.0;
  return Math.round(Math.PI * Math.pow(radiusM, 2) * lenM * 1000) / 1000;
}

export function recalculateLocal(
  metadata: SheetMetadata,
  standardTable: TableRow[],
  extraItems: ExtraItem[],
  diameters: number[],
  logLength: number = 6.0,
  sawnRatePerM3: number = 1600,
  slabRatePerPiece: number = 25
): RecognitionResult {
  let g1Count = 0;
  let g2Count = 0;
  let g1Vol = 0;
  let g2Vol = 0;

  const updatedStandard = standardTable.map((row) => {
    const c1 = row.grade1_count && row.grade1_count > 0 ? Number(row.grade1_count) : 0;
    const c2 = row.grade2_count && row.grade2_count > 0 ? Number(row.grade2_count) : 0;
    const v1 = calculateSawnVolume(row.size, c1);
    const v2 = calculateSawnVolume(row.size, c2);

    g1Count += c1;
    g2Count += c2;
    g1Vol += v1;
    g2Vol += v2;

    return {
      ...row,
      grade1_count: c1 > 0 ? c1 : null,
      grade2_count: c2 > 0 ? c2 : null,
      grade1_vol_m3: v1,
      grade2_vol_m3: v2,
      total_vol_m3: Math.round((v1 + v2) * 10000) / 10000,
      is_filled: c1 > 0 || c2 > 0
    };
  });

  let extraCount = 0;
  let extraVol = 0;
  let totalSlabPieces = 0;
  let sawnExtraVol = 0;

  const updatedExtra = extraItems.map((item) => {
    const c = Number(item.count) || 0;
    let v = 0;
    if (item.is_slab) {
      v = Math.round(c * 0.015 * 1000) / 1000;
      totalSlabPieces += c;
    } else {
      v = calculateSawnVolume(item.size, c);
      sawnExtraVol += v;
    }
    extraCount += c;
    extraVol += v;
    return {
      ...item,
      count: c,
      vol_m3: v
    };
  });

  let totalLogsVol = 0;
  const breakdown: RoundwoodBreakdown[] = diameters.map((d) => {
    const v = calculateLogVolume(d, logLength);
    totalLogsVol += v;
    return { diameter: d, volume_m3: v };
  });

  const sawnBaseVol = Math.round((g1Vol + g2Vol + sawnExtraVol) * 1000) / 1000;
  const totalSawnVol = Math.round((g1Vol + g2Vol + extraVol) * 1000) / 1000;
  const logsTotalVolRounded = Math.round(totalLogsVol * 1000) / 1000;

  // Процент выхода леса: кубатура готовой продукции / кубатура кругляка * 100
  // ВСЕГДА округляем в меньшую сторону: Math.floor
  const rawYield = logsTotalVolRounded > 0 ? (sawnBaseVol / logsTotalVolRounded) * 100 : 0;
  const yieldFloor = Math.floor(rawYield);

  // Расчёт зарплаты:
  // Готовая продукция * 1600 руб/м³
  const sawnSalary = Math.round(sawnBaseVol * sawnRatePerM3);
  // Горбыль 2м (штакет, необрезная) * 25 руб/шт
  const slabSalary = Math.round(totalSlabPieces * slabRatePerPiece);
  // Итого зарплата
  const totalSalary = sawnSalary + slabSalary;

  return {
    metadata,
    summary: {
      total_grade1_count: g1Count,
      total_grade2_count: g2Count,
      total_pieces: g1Count + g2Count + extraCount,
      total_grade1_volume_m3: Math.round(g1Vol * 1000) / 1000,
      total_grade2_volume_m3: Math.round(g2Vol * 1000) / 1000,
      total_extra_volume_m3: Math.round(extraVol * 1000) / 1000,
      total_sawn_base_volume_m3: sawnBaseVol,
      total_sawn_volume_m3: totalSawnVol,
      total_logs_count: diameters.length,
      total_logs_volume_m3: logsTotalVolRounded,
      raw_yield_percent: Math.round(rawYield * 10) / 10,
      yield_percent: yieldFloor,
      salary: {
        sawn_rate_per_m3: sawnRatePerM3,
        slab_rate_per_piece: slabRatePerPiece,
        sawn_base_volume_m3: sawnBaseVol,
        sawn_salary_rub: sawnSalary,
        slab_count: totalSlabPieces,
        slab_salary_rub: slabSalary,
        total_salary_rub: totalSalary
      }
    },
    standard_table: updatedStandard,
    extra_items: updatedExtra,
    roundwood_logs: {
      diameters,
      count: diameters.length,
      total_volume_m3: logsTotalVolRounded,
      breakdown
    }
  };
}
