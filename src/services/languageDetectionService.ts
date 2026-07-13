export interface LanguageDetectionResult {
  language: string; // BCP-47
  confidence: number; // 0..1
}

const SCRIPT_RANGES: Array<{ language: string; regex: RegExp; baseConfidence: number }> = [
  { language: 'ko', regex: /[가-힣]/, baseConfidence: 0.97 },
  { language: 'ja', regex: /[぀-ヿ]/, baseConfidence: 0.95 },
  { language: 'zh-CN', regex: /[一-鿿]/, baseConfidence: 0.85 },
  { language: 'th', regex: /[฀-๿]/, baseConfidence: 0.97 },
  { language: 'km', regex: /[ក-៿]/, baseConfidence: 0.97 },
  { language: 'ru', regex: /[Ѐ-ӿ]/, baseConfidence: 0.9 },
  { language: 'ne', regex: /[ऀ-ॿ]/, baseConfidence: 0.9 },
  { language: 'si', regex: /[඀-෿]/, baseConfidence: 0.95 },
  { language: 'vi', regex: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i, baseConfidence: 0.9 },
];

/**
 * 문자 스크립트 기반 경량 언어 감지. AI 호출 전 1차 추정치를 제공하고,
 * 라틴 문자만 사용하는 언어(en, vi(성조 없는 표기), tl, uz 등)는 신뢰도를 낮게 반환해
 * 사용자 확인을 요청하도록 유도한다.
 */
export function detectLanguageHeuristically(text: string): LanguageDetectionResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { language: 'und', confidence: 0 };
  }

  for (const { language, regex, baseConfidence } of SCRIPT_RANGES) {
    if (regex.test(trimmed)) {
      const matches = trimmed.match(new RegExp(regex, 'g')) ?? [];
      const ratio = matches.length / trimmed.length;
      const confidence = Math.min(0.99, baseConfidence * Math.min(1, ratio * 4 + 0.3));
      return { language, confidence: Number(confidence.toFixed(2)) };
    }
  }

  // 라틴 문자만 있는 경우 언어를 확정하기 어렵다 (en/vi/tl/uz 등).
  const isLatinOnly = /^[\x00-\x7f\s\p{P}]*$/u.test(trimmed);
  if (isLatinOnly) {
    return { language: 'en', confidence: 0.4 };
  }

  return { language: 'und', confidence: 0.2 };
}

export function resolveEffectiveLanguage(
  requestedLanguage: string | undefined,
  detected: LanguageDetectionResult,
): LanguageDetectionResult {
  if (requestedLanguage && requestedLanguage !== 'auto') {
    return { language: requestedLanguage, confidence: 1 };
  }
  return detected;
}
