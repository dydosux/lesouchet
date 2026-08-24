import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ExtraItem,
  RecognitionResult,
  SheetMetadata,
  recalculateLocal
} from './types';
import { STANDARD_SIZES, createEmptyStandardTable, normalizeSizeToken } from './sheetTemplate';
import type { OcrProgressFn } from './ocrEngine';

const STORAGE_KEY = 'lesouchet_gemini_api_key';
const MODEL_PREF_KEY = 'lesouchet_ocr_engine';

export type OcrEngineId = 'gemini' | 'tesseract';

export function getStoredApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function setStoredApiKey(key: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, key.trim());
}

export function getPreferredEngine(): OcrEngineId {
  if (typeof window === 'undefined') return 'gemini';
  const v = localStorage.getItem(MODEL_PREF_KEY);
  return v === 'tesseract' ? 'tesseract' : 'gemini';
}

export function setPreferredEngine(engine: OcrEngineId) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODEL_PREF_KEY, engine);
}

/** Best free multimodal models for document/handwriting OCR (in order). */
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
] as const;

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const b64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(b64);
    };
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function compressForVision(file: File): Promise<{ base64: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2048;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('compress failed'))),
      'image/jpeg',
      0.92
    );
  });
  return { base64: await fileToBase64(blob), mimeType: 'image/jpeg' };
}

interface GeminiSheetJson {
  shift_date?: string;
  standard_rows?: Array<{
    size: string;
    grade1?: number | null;
    grade2?: number | null;
  }>;
  extra_items?: Array<{
    name?: string;
    size: string;
    count: number;
    is_slab?: boolean;
  }>;
  log_diameters_cm?: number[];
  notes?: string;
  confidence?: number;
}

const SYSTEM_PROMPT = `Ты — эксперт по OCR ведомостей распиловки древесины (лесопилка, Россия).
На фото рукописный/печатный бланк учёта пиломатериалов.

ЗАДАЧА: точно считать ВСЕ рукописные цифры и вернуть ТОЛЬКО JSON (без markdown).

Структура бланка обычно такая:
1) Таблица размеров вида 30X100X6, 30X150X3, 50X100X6 и т.п.
   Рядом два столбца: "1 СОРТ" и "2 СОРТ" — количества в штуках (могут быть пустыми).
2) Внизу дописанные вручную позиции: брус 75x250, 75x200, 75x150, горбыль/гор. 2м и т.п.
3) Блок КРУГЛЯК — список диаметров брёвен в см (например 20, 18, 25, 22...).
4) Дата/смена.

Правила:
- Не выдумывай числа, которых нет на фото.
- Если ячейка пустая — null или не включай строку.
- Размеры нормализуй как 30X100X6 (латинская X, без пробелов).
- Для горбыля / гор. 2м / штакет / необрезной: is_slab=true, size="гор. 2м".
- log_diameters_cm — только диаметры кругляка (обычно 12..50), в порядке как на бланке.
- confidence от 0 до 1 — твоя уверенность в чтении рукописи.

Формат ответа JSON:
{
  "shift_date": "24.08.",
  "standard_rows": [{"size":"30X100X6","grade1":12,"grade2":5}],
  "extra_items": [{"name":"Брус 75x250","size":"75x250","count":2,"is_slab":false},{"name":"Горбыль деловой 2м","size":"гор. 2м","count":48,"is_slab":true}],
  "log_diameters_cm": [20,18,20,18,25,22],
  "notes": "кратко что видно",
  "confidence": 0.92
}`;

function mapGeminiToResult(
  parsed: GeminiSheetJson,
  sawnRate: number,
  slabRate: number,
  modelName: string
): RecognitionResult {
  const table = createEmptyStandardTable();
  const bySize = new Map(table.map((r) => [r.size, r]));

  for (const row of parsed.standard_rows || []) {
    const size = normalizeSizeToken(row.size) || row.size.toUpperCase().replace(/Х/g, 'X');
    const target = bySize.get(size);
    if (!target) continue;
    const g1 = row.grade1 == null || row.grade1 === 0 ? null : Number(row.grade1);
    const g2 = row.grade2 == null || row.grade2 === 0 ? null : Number(row.grade2);
    if (g1 != null && !Number.isNaN(g1)) target.grade1_count = g1;
    if (g2 != null && !Number.isNaN(g2)) target.grade2_count = g2;
  }

  // Also accept sizes that are standard but OCR wrote lowercase
  for (const row of parsed.standard_rows || []) {
    const norm = normalizeSizeToken(String(row.size || ''));
    if (!norm) continue;
    const std = STANDARD_SIZES.find((s) => s === norm);
    if (!std) continue;
    const target = bySize.get(std)!;
    if (target.grade1_count == null && row.grade1) target.grade1_count = Number(row.grade1);
    if (target.grade2_count == null && row.grade2) target.grade2_count = Number(row.grade2);
  }

  const extras: ExtraItem[] = [];
  for (const item of parsed.extra_items || []) {
    const count = Number(item.count) || 0;
    if (count <= 0) continue;
    const isSlab =
      !!item.is_slab ||
      /гор|штакет|необрез/i.test(`${item.name || ''} ${item.size || ''}`);
    const size = isSlab
      ? 'гор. 2м'
      : normalizeSizeToken(item.size) || item.size || 'доп';
    extras.push({
      id: `extra_${extras.length}`,
      name: item.name || (isSlab ? 'Горбыль деловой 2м' : `Брус ${size}`),
      size,
      count,
      unit: 'шт',
      vol_m3: 0,
      is_slab: isSlab
    });
  }

  const diameters = (parsed.log_diameters_cm || [])
    .map((d) => Number(d))
    .filter((d) => !Number.isNaN(d) && d >= 8 && d <= 80);

  const metadata: SheetMetadata = {
    shift_date: parsed.shift_date || new Date().toLocaleDateString('ru-RU'),
    shift_type: 'Дневная смена',
    brigade: 'Бригада №1',
    notes: parsed.notes || `Распознано моделью ${modelName}`,
    processed_at: new Date().toISOString(),
    model_engine: `Google ${modelName} Vision (лучшее чтение рукописи)`,
    ocr_confidence: Math.max(0.4, Math.min(0.99, Number(parsed.confidence) || 0.9))
  };

  const result = recalculateLocal(metadata, table, extras, diameters, 6.0, sawnRate, slabRate);
  result.raw_ocr_sample = JSON.stringify(parsed, null, 2);
  return result;
}

function extractJson(text: string): GeminiSheetJson {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('Модель не вернула JSON');
  return JSON.parse(cleaned.slice(start, end + 1)) as GeminiSheetJson;
}

export async function recognizeWithGemini(
  file: File,
  opts: {
    apiKey: string;
    sawnRate?: number;
    slabRate?: number;
    onProgress?: OcrProgressFn;
  }
): Promise<RecognitionResult> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    throw new Error('Нужен бесплатный API-ключ Google AI Studio (Gemini)');
  }

  const onProgress = opts.onProgress ?? (() => {});
  const sawnRate = opts.sawnRate ?? 1600;
  const slabRate = opts.slabRate ?? 25;

  onProgress('Сжатие фото для Vision-модели...', 0.1);
  const { base64, mimeType } = await compressForVision(file);

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown = null;

  for (const modelName of GEMINI_MODELS) {
    try {
      onProgress(`Отправка в ${modelName} (чтение бланка)...`, 0.35);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      });

      const response = await model.generateContent([
        { text: SYSTEM_PROMPT },
        {
          inlineData: {
            mimeType,
            data: base64
          }
        }
      ]);

      const text = response.response.text();
      onProgress('Разбор JSON и расчёт кубатуры/зарплаты...', 0.85);
      const parsed = extractJson(text);
      const result = mapGeminiToResult(parsed, sawnRate, slabRate, modelName);
      onProgress(`Готово через ${modelName}`, 1);
      return result;
    } catch (err) {
      lastError = err;
      onProgress(`${modelName} недоступна, пробуем следующую...`, 0.4);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Не удалось распознать через Gemini. Проверьте API-ключ.');
}
