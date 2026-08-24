import {
  ExtraItem,
  RecognitionResult,
  SheetMetadata,
  TableRow,
  recalculateLocal
} from './types';
import {
  STANDARD_SIZES,
  createEmptyStandardTable,
  normalizeSizeToken
} from './sheetTemplate';

export type OcrProgressFn = (msg: string, progress?: number) => void;

interface OcrWord {
  text: string;
  conf: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
}

interface TessWord {
  text?: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

function cleanDigitToken(raw: string): number | null {
  if (!raw) return null;
  let t = raw.trim()
    .replace(/[OoОоD]/g, '0')
    .replace(/[Il|!Іі]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[BbВв]/g, '8')
    .replace(/[Zz]/g, '2')
    .replace(/[^\d]/g, '');
  if (!t) return null;
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n < 1 || n > 999) return null;
  return n;
}

async function preprocessImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 2200;
  const scale = Math.min(3, Math.max(1.5, maxSide / Math.max(bitmap.width, bitmap.height)));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;

  // Grayscale + contrast stretch
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (g < min) min = g;
    if (g > max) max = g;
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    let g = ((d[i] - min) / range) * 255;
    // Slight sharpening via contrast boost
    g = (g - 128) * 1.35 + 128;
    g = Math.max(0, Math.min(255, g));
    // Soft threshold helps handwriting vs grid
    const bin = g > 165 ? 255 : g < 110 ? 0 : g;
    d[i] = d[i + 1] = d[i + 2] = bin;
  }
  ctx.putImageData(img, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), 'image/png');
  });
}

function extractWords(data: { words?: TessWord[] }): OcrWord[] {
  const words: OcrWord[] = [];
  const blocks = data.words || [];
  for (const w of blocks) {
    const text = (w.text || '').trim();
    if (!text) continue;
    const bbox = w.bbox;
    words.push({
      text,
      conf: typeof w.confidence === 'number' ? w.confidence : 0,
      x0: bbox.x0,
      y0: bbox.y0,
      x1: bbox.x1,
      y1: bbox.y1,
      cx: (bbox.x0 + bbox.x1) / 2,
      cy: (bbox.y0 + bbox.y1) / 2
    });
  }
  return words;
}

function findDate(text: string): string {
  const m = text.match(/(\d{1,2})[.,\/](\d{1,2})(?:[.,\/](\d{2,4}))?/);
  if (!m) return new Date().toLocaleDateString('ru-RU');
  return `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}${m[3] ? '.' + m[3] : ''}`;
}

function matchStandardSize(token: string): string | null {
  const norm = normalizeSizeToken(token);
  if (!norm) return null;
  const exact = STANDARD_SIZES.find((s) => s === norm);
  if (exact) return exact;
  // 75x250 etc are extras, not standard
  return null;
}

function parseStandardRows(words: OcrWord[], pageWidth: number): TableRow[] {
  const table = createEmptyStandardTable();
  const bySize = new Map(table.map((r) => [r.size, r]));

  // Find size words and collect digits to the right on same line
  for (const w of words) {
    const size = matchStandardSize(w.text) || matchStandardSize(w.text.replace(/\s+/g, ''));
    if (!size) continue;
    const row = bySize.get(size);
    if (!row) continue;

    const lineTolerance = Math.max(18, (w.y1 - w.y0) * 0.9);
    const rightWords = words
      .filter((o) =>
        o !== w &&
        Math.abs(o.cy - w.cy) <= lineTolerance &&
        o.x0 > w.x1 - 5 &&
        o.x0 < pageWidth * 0.85
      )
      .sort((a, b) => a.x0 - b.x0);

    const nums: number[] = [];
    for (const rw of rightWords) {
      const n = cleanDigitToken(rw.text);
      if (n !== null) nums.push(n);
      if (nums.length >= 2) break;
    }

    // Also try glued tokens like "12 5" or "12/5"
    if (nums.length === 0) {
      for (const rw of rightWords.slice(0, 4)) {
        const parts = rw.text.split(/[\s\/|,;]+/);
        for (const p of parts) {
          const n = cleanDigitToken(p);
          if (n !== null) nums.push(n);
        }
        if (nums.length >= 2) break;
      }
    }

    if (nums.length >= 1) row.grade1_count = nums[0];
    if (nums.length >= 2) row.grade2_count = nums[1];
    // Single number often means only grade2 filled on these sheets
    if (nums.length === 1 && row.grade1_count !== null && row.grade2_count === null) {
      // Heuristic: if only one number and it's on the right half of the row area, treat as grade2
      const firstRight = rightWords[0];
      if (firstRight && firstRight.cx > pageWidth * 0.42) {
        row.grade2_count = row.grade1_count;
        row.grade1_count = null;
      }
    }
  }

  // Line-based fallback from full text lines
  return table;
}

function parseFromTextLines(rawText: string, table: TableRow[]): TableRow[] {
  const bySize = new Map(table.map((r) => [r.size, r]));
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const sizeMatch = line.match(/(\d{2,3})\s*[xх×X*]\s*(\d{2,3})(?:\s*[xх×X*]\s*(\d))?/i);
    if (!sizeMatch) continue;
    const token = `${sizeMatch[1]}X${sizeMatch[2]}${sizeMatch[3] ? 'X' + sizeMatch[3] : ''}`;
    const size = matchStandardSize(token);
    if (!size) continue;
    const row = bySize.get(size);
    if (!row) continue;
    if (row.grade1_count != null || row.grade2_count != null) continue;

    const after = line.slice(sizeMatch.index! + sizeMatch[0].length);
    const nums = [...after.matchAll(/\d{1,3}/g)]
      .map((m) => parseInt(m[0], 10))
      .filter((n) => n >= 1 && n <= 999);

    if (nums.length >= 2) {
      row.grade1_count = nums[0];
      row.grade2_count = nums[1];
    } else if (nums.length === 1) {
      row.grade2_count = nums[0];
    }
  }
  return table;
}

function parseExtraItems(rawText: string, words: OcrWord[]): ExtraItem[] {
  const extras: ExtraItem[] = [];
  const used = new Set<string>();

  const pushExtra = (name: string, size: string, count: number, isSlab = false) => {
    const key = `${size}|${isSlab}`;
    if (used.has(key)) return;
    used.add(key);
    extras.push({
      id: `extra_${extras.length}`,
      name,
      size,
      count,
      unit: 'шт',
      vol_m3: 0,
      is_slab: isSlab
    });
  };

  // Горбыль / гор. 2м
  const slabPatterns = [
    /гор(?:быль)?\.?\s*(?:дел(?:овой)?)?\.?\s*(?:2\s*м\.?)?[^\d]{0,12}(\d{1,3})/gi,
    /гор\.?\s*2\s*м\.?[^\d]{0,12}(\d{1,3})/gi,
    /штакет[^\d]{0,12}(\d{1,3})/gi
  ];
  for (const re of slabPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(rawText)) !== null) {
      const c = parseInt(m[1], 10);
      if (c >= 1 && c <= 999) pushExtra('Горбыль деловой 2м', 'гор. 2м', c, true);
    }
  }

  // Extra beams like 75x250, 75x200, 75x150 (not in standard template)
  const beamRe = /(\d{2,3})\s*[xх×X*]\s*(\d{2,3})(?:\s*[xх×X*]\s*(\d))?[^\d]{0,20}(\d{1,3})/gi;
  let bm: RegExpExecArray | null;
  while ((bm = beamRe.exec(rawText)) !== null) {
    const size = normalizeSizeToken(`${bm[1]}X${bm[2]}${bm[3] ? 'X' + bm[3] : ''}`);
    if (!size) continue;
    if (STANDARD_SIZES.includes(size) || (size.includes('X') && STANDARD_SIZES.includes(size))) continue;
    // skip if it's a standard 3-part size
    if (STANDARD_SIZES.includes(size.toUpperCase())) continue;
    const count = parseInt(bm[4], 10);
    if (count < 1 || count > 999) continue;
    // Only treat non-standard sizes (e.g. 75x250) as extras
    if (/^(75|60|80|90|100)X(100|150|200|250)(X\d)?$/i.test(size) || /^75X/i.test(size)) {
      pushExtra(`Брус ${size}`, size, count, false);
    } else if (!STANDARD_SIZES.includes(size)) {
      // Accept any size not in printed blank if accompanied by count
      const parts = size.split('X');
      if (parts.length >= 2 && parseInt(parts[0], 10) >= 60) {
        pushExtra(`Брус ${size}`, size, count, false);
      }
    }
  }

  // Word-box based extras for sizes like 75x250
  for (const w of words) {
    const norm = normalizeSizeToken(w.text);
    if (!norm || STANDARD_SIZES.includes(norm)) continue;
    if (!/^\d{2,3}X\d{2,3}/.test(norm)) continue;
    const t = parseInt(norm.split('X')[0], 10);
    if (t < 60) continue;

    const lineTol = Math.max(18, (w.y1 - w.y0));
    const right = words
      .filter((o) => o !== w && Math.abs(o.cy - w.cy) <= lineTol && o.x0 > w.x1)
      .sort((a, b) => a.x0 - b.x0);
    for (const rw of right.slice(0, 3)) {
      const n = cleanDigitToken(rw.text);
      if (n !== null) {
        pushExtra(`Брус ${norm}`, norm, n, false);
        break;
      }
    }
  }

  return extras;
}

function parseLogDiameters(rawText: string): number[] {
  const lower = rawText.toLowerCase();
  let section = rawText;

  const markers = ['кругляк', 'кругл', 'бревн', 'диаметр', 'сырь'];
  let bestIdx = -1;
  for (const m of markers) {
    const i = lower.lastIndexOf(m);
    if (i > bestIdx) bestIdx = i;
  }
  if (bestIdx >= 0) {
    section = rawText.slice(bestIdx);
  }

  // Prefer comma/space separated 2-digit diameters typical for logs
  const candidates = [...section.matchAll(/\b([1-4]\d|50)\b/g)].map((m) => parseInt(m[1], 10));

  // Filter: keep plausible log diameters, drop obvious table leftovers if too many
  const logs = candidates.filter((d) => d >= 12 && d <= 50);

  // If we got a huge list, take densest cluster of 8–40 values near end
  if (logs.length > 40) {
    return logs.slice(-30);
  }
  if (logs.length >= 3) return logs;

  // Fallback: whole text diameters sequence
  const all = [...rawText.matchAll(/\b([1-4]\d|50)\b/g)].map((m) => parseInt(m[1], 10));
  return all.filter((d) => d >= 14 && d <= 45).slice(0, 40);
}

export async function recognizeTimberSheet(
  file: File,
  opts: {
    sawnRate?: number;
    slabRate?: number;
    onProgress?: OcrProgressFn;
  } = {}
): Promise<RecognitionResult> {
  const sawnRate = opts.sawnRate ?? 1600;
  const slabRate = opts.slabRate ?? 25;
  const onProgress = opts.onProgress ?? (() => {});

  onProgress('Загрузка и предобработка фото...', 0.05);
  const prepared = await preprocessImage(file);

  onProgress('Запуск Tesseract OCR (rus+eng)...', 0.15);

  // Dynamic import — works in browser / Capacitor WebView, avoids SSR issues
  const Tesseract = await import('tesseract.js');
  const result = await Tesseract.recognize(prepared, 'rus+eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress(`OCR: ${Math.round(m.progress * 100)}%`, 0.2 + m.progress * 0.55);
      } else if (m.status === 'loading language traineddata') {
        onProgress('Загрузка языковых моделей OCR (первый запуск)...', 0.12);
      }
    }
  });

  onProgress('Разбор таблицы, размеров и кругляка...', 0.82);

  const page = result.data;
  const rawText = page.text || '';
  const words = extractWords(page);
  const pageWidth = Math.max(...words.map((w) => w.x1), 1000);

  let standardTable = parseStandardRows(words, pageWidth);
  standardTable = parseFromTextLines(rawText, standardTable);

  const extraItems = parseExtraItems(rawText, words);
  const diameters = parseLogDiameters(rawText);
  const shiftDate = findDate(rawText);

  const avgConf =
    words.length > 0
      ? words.reduce((s, w) => s + (w.conf || 0), 0) / words.length / 100
      : 0.5;

  const filledCount = standardTable.filter((r) => r.grade1_count || r.grade2_count).length;
  onProgress(
    `Найдено: позиций ${filledCount}, доп. ${extraItems.length}, брёвен ${diameters.length}`,
    0.92
  );

  const metadata: SheetMetadata = {
    shift_date: shiftDate,
    shift_type: 'Дневная смена',
    brigade: 'Бригада №1',
    notes: `OCR распознал ${filledCount} строк бланка, ${extraItems.length} доп. позиций, ${diameters.length} диаметров.`,
    processed_at: new Date().toISOString(),
    model_engine: 'Tesseract.js rus+eng (локально, без токенов / без API)',
    ocr_confidence: Math.max(0.35, Math.min(0.98, avgConf))
  };

  const calculated = recalculateLocal(
    metadata,
    standardTable,
    extraItems,
    diameters,
    6.0,
    sawnRate,
    slabRate
  );

  calculated.raw_ocr_sample = rawText.slice(0, 2500);
  onProgress('Готово: кубатура и зарплата пересчитаны', 1);
  return calculated;
}
