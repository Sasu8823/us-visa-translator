import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

/**
 * API Route: POST /api/translate
 * 
 * Proper-Noun Aware Translation Pipeline for US Visa Applications
 * 
 * CRITICAL ACCURACY REQUIREMENTS:
 * - Proper nouns (names, clinics, places) must be translated with 100% accuracy
 * - Uses user-maintained knowledge base (glossary.json)
 * - Prevents LLM from "guessing" readings of proper nouns
 * - Falls back safely when unknown names appear
 */

// Initialize OpenAI client (server-side only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.OPENAI_BASE_URL && { baseURL: process.env.OPENAI_BASE_URL }),
});

interface TranslateRequest {
  text: string;
  mode: 'visa-strict';
}

interface TranslationResponse {
  outputText: string;
  riskLevel: 'GREEN' | 'YELLOW' | 'RED';
  warnings: string[];
  appliedGlossary: string[];
  sentences: Array<{
    original: string;
    translated: string;
  }>;
}

/**
 * Glossary entry structure
 */
interface GlossaryEntry {
  en: string;
  confidence: string;
}

interface Glossary {
  [category: string]: {
    [japanese: string]: GlossaryEntry;
  };
}

// In-memory cache for glossary (MVP: simple cache, no invalidation)
let glossaryCache: Glossary | null = null;

/**
 * Load glossary from JSON file
 * Caches in memory for performance (MVP approach)
 * WHY: Visa applications require deterministic proper noun handling
 */
function loadGlossary(): Glossary {
  if (glossaryCache) {
    return glossaryCache;
  }

  try {
    const glossaryPath = path.join(process.cwd(), 'data', 'glossary.json');
    const fileContent = fs.readFileSync(glossaryPath, 'utf-8');
    const glossary = JSON.parse(fileContent) as Glossary;
    
    // Cache for subsequent requests
    glossaryCache = glossary;
    return glossary;
  } catch (error) {
    console.error('Failed to load glossary.json:', error);
    // Return empty glossary if file doesn't exist
    return {};
  }
}

/**
 * Detect proper nouns in text and create placeholder mapping
 * WHY: Prevents LLM from guessing readings - accuracy is critical for visa apps
 */
function protectProperNouns(
  text: string,
  glossary: Glossary
): {
  protectedText: string;
  placeholderMap: Map<string, string>; // placeholder -> English translation
  foundProperNouns: string[]; // List of found Japanese proper nouns
} {
  const placeholderMap = new Map<string, string>();
  const foundProperNouns: string[] = [];
  let protectedText = text;
  let placeholderIndex = 0;

  // Search through all categories in glossary
  for (const category in glossary) {
    const entries = glossary[category];
    
    for (const japanese in entries) {
      const entry = entries[japanese];
      
      // Exact match (case-sensitive) - WHY: Names must match exactly
      if (protectedText.includes(japanese)) {
        const placeholder = `__PN_${placeholderIndex}__`;
        placeholderMap.set(placeholder, entry.en);
        foundProperNouns.push(japanese);
        
        // Replace ALL occurrences of this proper noun
        protectedText = protectedText.replaceAll(japanese, placeholder);
        placeholderIndex++;
      }
    }
  }

  return {
    protectedText,
    placeholderMap,
    foundProperNouns,
  };
}

/**
 * Detect unknown proper nouns (Kanji sequences not in glossary)
 * WHY: We must warn users about potential inaccuracies - visa apps cannot guess
 */
function detectUnknownProperNouns(text: string, glossary: Glossary): string[] {
  const unknownNouns: string[] = [];
  
  // Pattern to detect Kanji sequences (common in Japanese names/places)
  // This is a simple heuristic - can be enhanced with proper NLP
  const kanjiPattern = /[\u4e00-\u9faf]{2,}/g;
  const matches = text.match(kanjiPattern);
  
  if (!matches) {
    return unknownNouns;
  }

  // Build a set of all known proper nouns from glossary
  const knownNouns = new Set<string>();
  for (const category in glossary) {
    for (const japanese in glossary[category]) {
      knownNouns.add(japanese);
    }
  }

  // Check each Kanji sequence
  for (const match of matches) {
    // Skip if it's already in glossary
    if (knownNouns.has(match)) {
      continue;
    }
    
    // Check if it's a substring of any known noun (to avoid false positives)
    let isSubstring = false;
    for (const known of knownNouns) {
      if (known.includes(match) || match.includes(known)) {
        isSubstring = true;
        break;
      }
    }
    
    if (!isSubstring) {
      unknownNouns.push(match);
    }
  }

  return unknownNouns;
}

/**
 * Split Japanese text into sentences
 * WHY: Sentence-locked translation prevents cross-sentence paraphrasing
 */
function splitIntoSentences(text: string): string[] {
  const sentences = text
    .split(/([。！？\n]+)/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());
  
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    if (/^[。！？]+$/.test(sentences[i])) {
      if (result.length > 0) {
        result[result.length - 1] += sentences[i];
      }
    } else {
      result.push(sentences[i]);
    }
  }
  
  return result.filter(s => s.length > 0);
}

/**
 * Translate a single sentence with placeholder protection
 * WHY: Placeholders prevent LLM from modifying verified proper nouns
 */
async function translateSentence(
  sentence: string,
  mode: 'visa-strict'
): Promise<{ translated: string }> {
  const systemPrompt = `You are a translation assistant for US visa applications (DS-160/ESTA).

CRITICAL ACCURACY RULES - Translate EVERYTHING accurately:
1. Translate ALL content including: names, career history, dates, addresses, passport numbers, yes/no answers, and all other text.
2. Translate literally and accurately. Do not infer, adapt, embellish, or paraphrase.
3. Use common U.S. visa terminology and standard formats.
4. Maintain the exact meaning without adding interpretation or omitting details.
5. For dates, translate to standard US format (MM/DD/YYYY or Month DD, YYYY).
6. For addresses, translate accurately maintaining the structure.

CRITICAL: Do NOT modify any placeholders that look like __PN_0__, __PN_1__, etc.
These are protected proper nouns and must remain EXACTLY as they appear.

Return ONLY a JSON object with this exact structure:
{
  "translated": "English translation here"
}`;

  const userPrompt = `Translate this Japanese text for a US visa application form (${mode} mode):

"${sentence}"

IMPORTANT: Preserve all placeholders (__PN_X__) exactly as they appear. Do not translate or modify them.

Return the JSON object only, no additional text.`;

  try {
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1, // Low temperature for deterministic behavior
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    return {
      translated: result.translated || sentence,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    console.error(`Translation error (no PII logged) - Model: ${model}, Error:`, errorMessage);
    
    // Return safe fallback
    return {
      translated: sentence,
    };
  }
}

/**
 * Restore proper nouns from placeholders
 * WHY: Replace placeholders with verified English translations from glossary
 */
function restoreProperNouns(
  translatedText: string,
  placeholderMap: Map<string, string>
): string {
  let restored = translatedText;
  
  // Replace each placeholder with its English translation
  for (const [placeholder, english] of placeholderMap.entries()) {
    restored = restored.replaceAll(placeholder, english);
  }
  
  return restored;
}

export async function POST(request: NextRequest) {
  try {
    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body: TranslateRequest = await request.json();
    const { text, mode } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid text input' },
        { status: 400 }
      );
    }

    if (mode !== 'visa-strict') {
      return NextResponse.json(
        { error: 'Only visa-strict mode is supported' },
        { status: 400 }
      );
    }

    // Load knowledge base
    const glossary = loadGlossary();

    // Step 1: Protect proper nouns with placeholders
    const { protectedText, placeholderMap, foundProperNouns } = protectProperNouns(text, glossary);

    // Step 2: Detect unknown proper nouns (for warnings)
    const unknownProperNouns = detectUnknownProperNouns(text, glossary);

    // Step 3: Split into sentences for sentence-locked translation
    // Keep both original and protected versions for display
    const originalSentences = splitIntoSentences(text);
    const protectedSentences = splitIntoSentences(protectedText);

    // Step 4: Translate each sentence independently
    const sentenceTranslations = await Promise.all(
      protectedSentences.map(sentence => translateSentence(sentence, mode))
    );

    // Step 5: Combine translations
    const combinedTranslated = sentenceTranslations.map(st => st.translated).join(' ');

    // Step 6: Restore proper nouns from placeholders
    const outputText = restoreProperNouns(combinedTranslated, placeholderMap);

    // Step 7: Determine risk level based on unknown proper nouns
    let riskLevel: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    const warnings: string[] = [];

    if (unknownProperNouns.length > 0) {
      // If unknown proper nouns found, mark as YELLOW or RED
      // RED if person names are unknown (most critical for visa apps)
      const hasUnknownPersonNames = unknownProperNouns.some(noun => {
        // Simple heuristic: check if it might be a person name
        // In real implementation, could use more sophisticated detection
        return noun.length >= 2 && noun.length <= 4;
      });

      if (hasUnknownPersonNames) {
        riskLevel = 'RED';
        warnings.push(
          `該当する固有名詞が、ナレッジベースに登録されていない状態です。: ${unknownProperNouns.join(', ')}. ` + '</br></br>' +
          `ビザ申請の提出前に、パスポート記載の綴りに誤りがないかご確認ください。`
        );
      } else {
        riskLevel = 'YELLOW';
        warnings.push(
          `Some proper nouns not found in knowledge base: ${unknownProperNouns.join(', ')}. ` +
          `Please verify translations.`
        );
      }
    }

    // Build response
    const response: TranslationResponse = {
      outputText,
      riskLevel,
      warnings,
      appliedGlossary: foundProperNouns,
      sentences: originalSentences.map((original, i) => ({
        original: original,
        translated: restoreProperNouns(sentenceTranslations[i].translated, placeholderMap),
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('API error (no PII logged):', errorMessage);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
