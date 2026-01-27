/**
 * Translation response from API
 */
export interface TranslationResponse {
  translatedText: string;
  sentences: SentenceTranslation[]; // Sentence-by-sentence breakdown
}

/**
 * Individual sentence translation
 * Used for sentence-locked translation (never merge across sentences)
 */
export interface SentenceTranslation {
  original: string;
  translated: string;
}
