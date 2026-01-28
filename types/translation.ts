/**
 * Translation response from API
 * Proper-noun aware translation with risk assessment
 */
export interface TranslationResponse {
  outputText: string;
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  warnings: string[];
  appliedGlossary: string[]; // List of proper nouns found and applied from glossary
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
