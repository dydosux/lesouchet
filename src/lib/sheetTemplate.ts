import { ExtraItem, RecognitionResult, TableRow, recalculateLocal } from './types';

export const STANDARD_SIZES = [
  '30X100X3', '30X100X4', '30X100X5', '30X100X6',
  '30X150X3', '30X150X4', '30X150X5', '30X150X6',
  '30X200X3', '30X200X4', '30X200X5', '30X200X6',
  '40X100X3', '40X100X4', '40X100X5', '40X100X6',
  '40X150X3', '40X150X4', '40X150X5', '40X150X6',
  '50X100X3', '50X100X4', '50X100X5', '50X100X6',
  '50X150X3', '50X150X4', '50X150X5', '50X150X6',
  '50X200X3', '50X200X4', '50X200X5', '50X200X6',
  '100X100X6', '100X150X6', '100X200X6',
  '150X150X6', '150X200X6',
  '200X200X6'
];

export function createEmptyStandardTable(): TableRow[] {
  return STANDARD_SIZES.map((size) => ({
    id: `row_${size}`,
    size,
    grade1_count: null,
    grade2_count: null,
    grade1_vol_m3: 0,
    grade2_vol_m3: 0,
    total_vol_m3: 0,
    is_filled: false
  }));
}

export function createEmptySheet(
  sawnRate = 1600,
  slabRate = 25
): RecognitionResult {
  return recalculateLocal(
    {
      shift_date: new Date().toLocaleDateString('ru-RU'),
      shift_type: 'Дневная смена',
      brigade: 'Бригада №1',
      notes: 'Загрузите фото бланка — OCR распознает данные автоматически.',
      processed_at: new Date().toISOString(),
      model_engine: 'Tesseract.js OCR (локально, без токенов)',
      ocr_confidence: 0
    },
    createEmptyStandardTable(),
    [] as ExtraItem[],
    [],
    6.0,
    sawnRate,
    slabRate
  );
}

export function normalizeSizeToken(raw: string): string | null {
  if (!raw) return null;
  let s = raw
    .toUpperCase()
    .replace(/[Х×*]/g, 'X')
    .replace(/[^0-9X]/g, '')
    .replace(/X+/g, 'X');

  // Fix common OCR splits: 30X1O0X6 -> 30X100X6
  s = s.replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1');

  const m3 = s.match(/^(\d{2,3})X(\d{2,3})X(\d)$/);
  if (m3) return `${m3[1]}X${m3[2]}X${m3[3]}`;

  const m2 = s.match(/^(\d{2,3})X(\d{2,3})$/);
  if (m2) return `${m2[1]}X${m2[2]}`;

  return null;
}
