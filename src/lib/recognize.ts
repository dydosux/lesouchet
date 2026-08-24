import type { RecognitionResult } from './types';
import { recognizeTimberSheet, type OcrProgressFn } from './ocrEngine';
import {
  getPreferredEngine,
  getStoredApiKey,
  recognizeWithGemini,
  type OcrEngineId
} from './visionOcr';

export async function recognizeSheetSmart(
  file: File,
  opts: {
    sawnRate?: number;
    slabRate?: number;
    engine?: OcrEngineId;
    apiKey?: string;
    onProgress?: OcrProgressFn;
  } = {}
): Promise<RecognitionResult> {
  const engine = opts.engine || getPreferredEngine();
  const apiKey = (opts.apiKey ?? getStoredApiKey()).trim();
  const onProgress = opts.onProgress ?? (() => {});

  if (engine === 'gemini') {
    if (!apiKey) {
      throw new Error(
        'Для точного чтения рукописи нужен бесплатный ключ Gemini. Откройте ⚙ Настройки и вставьте API key с aistudio.google.com'
      );
    }
    try {
      return await recognizeWithGemini(file, {
        apiKey,
        sawnRate: opts.sawnRate,
        slabRate: opts.slabRate,
        onProgress
      });
    } catch (err) {
      onProgress(
        `Gemini ошибка: ${err instanceof Error ? err.message : String(err)}. Пробуем Tesseract...`,
        0.5
      );
      // Fallback only if user somehow had gemini selected but it failed hard
      return await recognizeTimberSheet(file, {
        sawnRate: opts.sawnRate,
        slabRate: opts.slabRate,
        onProgress
      });
    }
  }

  return recognizeTimberSheet(file, {
    sawnRate: opts.sawnRate,
    slabRate: opts.slabRate,
    onProgress
  });
}
