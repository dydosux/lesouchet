import { RecognitionResult } from './types';

export const DEMO_PRESET_DATA: RecognitionResult = {
  metadata: {
    shift_date: "24.08.",
    shift_type: "Дневная смена",
    brigade: "Бригада №1",
    notes: "Распиловка сосны 6м. Расчёт зарплаты: 1600 руб/м³ готовой продукции + 25 руб/шт за 2м горбыль.",
    processed_at: "2026-08-24 14:35",
    model_engine: "OpenCV + Tesseract OCR Rus/Eng (Автономно / 0 токенов)",
    ocr_confidence: 0.95
  },
  summary: {
    total_grade1_count: 39,
    total_grade2_count: 42,
    total_pieces: 141,
    total_grade1_volume_m3: 1.638,
    total_grade2_volume_m3: 1.564,
    total_extra_volume_m3: 1.298,
    total_sawn_base_volume_m3: 4.192,  // 1.638 (1с) + 1.564 (2с) + 0.990 (брус 75x250, 75x200, 75x150)
    total_sawn_volume_m3: 4.500,
    total_logs_count: 14,
    total_logs_volume_m3: 4.887,
    raw_yield_percent: 85.7,
    yield_percent: 85, // Округляем всегда в меньшую сторону (Math.floor(4.192 / 4.887 * 100))
    salary: {
      sawn_rate_per_m3: 1600,
      slab_rate_per_piece: 25,
      sawn_base_volume_m3: 4.192,
      sawn_salary_rub: 6707, // 4.192 * 1600 = 6707.2 руб -> 6707 руб
      slab_count: 48,
      slab_salary_rub: 1200, // 48 * 25 = 1200 руб
      total_salary_rub: 7907 // 6707 + 1200 = 7907 руб
    }
  },
  standard_table: [
    { id: "row_30X100X3", size: "30X100X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X100X4", size: "30X100X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X100X5", size: "30X100X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X100X6", size: "30X100X6", grade1_count: 12, grade2_count: 5, grade1_vol_m3: 0.216, grade2_vol_m3: 0.09, total_vol_m3: 0.306, is_filled: true },
    { id: "row_30X150X3", size: "30X150X3", grade1_count: null, grade2_count: 10, grade1_vol_m3: 0, grade2_vol_m3: 0.135, total_vol_m3: 0.135, is_filled: true },
    { id: "row_30X150X4", size: "30X150X4", grade1_count: null, grade2_count: 10, grade1_vol_m3: 0, grade2_vol_m3: 0.18, total_vol_m3: 0.18, is_filled: true },
    { id: "row_30X150X5", size: "30X150X5", grade1_count: null, grade2_count: 5, grade1_vol_m3: 0, grade2_vol_m3: 0.1125, total_vol_m3: 0.1125, is_filled: true },
    { id: "row_30X150X6", size: "30X150X6", grade1_count: 6, grade2_count: 19, grade1_vol_m3: 0.162, grade2_vol_m3: 0.513, total_vol_m3: 0.675, is_filled: true },
    { id: "row_30X200X3", size: "30X200X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X200X4", size: "30X200X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X200X5", size: "30X200X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_30X200X6", size: "30X200X6", grade1_count: 2, grade2_count: 4, grade1_vol_m3: 0.072, grade2_vol_m3: 0.144, total_vol_m3: 0.216, is_filled: true },
    { id: "row_40X100X3", size: "40X100X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X100X4", size: "40X100X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X100X5", size: "40X100X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X100X6", size: "40X100X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X150X3", size: "40X150X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X150X4", size: "40X150X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X150X5", size: "40X150X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_40X150X6", size: "40X150X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X100X3", size: "50X100X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X100X4", size: "50X100X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X100X5", size: "50X100X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X100X6", size: "50X100X6", grade1_count: 10, grade2_count: 2, grade1_vol_m3: 0.3, grade2_vol_m3: 0.06, total_vol_m3: 0.36, is_filled: true },
    { id: "row_50X150X3", size: "50X150X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X150X4", size: "50X150X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X150X5", size: "50X150X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X150X6", size: "50X150X6", grade1_count: 3, grade2_count: 1, grade1_vol_m3: 0.135, grade2_vol_m3: 0.045, total_vol_m3: 0.18, is_filled: true },
    { id: "row_50X200X3", size: "50X200X3", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X200X4", size: "50X200X4", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X200X5", size: "50X200X5", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_50X200X6", size: "50X200X6", grade1_count: null, grade2_count: 1, grade1_vol_m3: 0, grade2_vol_m3: 0.06, total_vol_m3: 0.06, is_filled: true },
    { id: "row_100X100X6", size: "100X100X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_100X150X6", size: "100X150X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_100X200X6", size: "100X200X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_150X150X6", size: "150X150X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_150X200X6", size: "150X200X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false },
    { id: "row_200X200X6", size: "200X200X6", grade1_count: null, grade2_count: null, grade1_vol_m3: 0, grade2_vol_m3: 0, total_vol_m3: 0, is_filled: false }
  ],
  extra_items: [
    { id: "extra_0", name: "Брус 75x250", size: "75x250", count: 2, unit: "шт", vol_m3: 0.225, is_slab: false },
    { id: "extra_1", name: "Брус 75x200", size: "75x200", count: 4, unit: "шт", vol_m3: 0.360, is_slab: false },
    { id: "extra_2", name: "Брус 75x150", size: "75x150", count: 6, unit: "шт", vol_m3: 0.405, is_slab: false },
    { id: "extra_3", name: "Горбыль деловой 2м", size: "гор. 2м", count: 48, unit: "шт", vol_m3: 0.720, is_slab: true }
  ],
  roundwood_logs: {
    diameters: [20, 18, 20, 18, 25, 22, 15, 20, 23, 21, 22, 22, 31, 36],
    count: 14,
    total_volume_m3: 4.887,
    breakdown: [
      { diameter: 20, volume_m3: 0.270 },
      { diameter: 18, volume_m3: 0.214 },
      { diameter: 20, volume_m3: 0.270 },
      { diameter: 18, volume_m3: 0.214 },
      { diameter: 25, volume_m3: 0.440 },
      { diameter: 22, volume_m3: 0.330 },
      { diameter: 15, volume_m3: 0.142 },
      { diameter: 20, volume_m3: 0.270 },
      { diameter: 23, volume_m3: 0.365 },
      { diameter: 21, volume_m3: 0.300 },
      { diameter: 22, volume_m3: 0.330 },
      { diameter: 22, volume_m3: 0.330 },
      { diameter: 31, volume_m3: 0.710 },
      { diameter: 36, volume_m3: 0.990 }
    ]
  }
};
