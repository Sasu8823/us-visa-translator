import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

/**
 * API Route: POST /api/translate
 * Simple OpenAI translation for US visa applications
 */

// Simple OpenAI client initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface TranslateRequest {
  text: string;
  mode: 'visa-strict';
}

interface TranslationResponse {
  translatedText: string;
  sentences: Array<{
    original: string;
    translated: string;
  }>;
}

/**
 * Split Japanese text into sentences
 * Simple implementation - can be enhanced with proper Japanese sentence segmentation
 */
function splitIntoSentences(text: string): string[] {
  // Split by common Japanese sentence endings: 。、！？ and line breaks
  const sentences = text
    .split(/([。！？\n]+)/)
    .filter(s => s.trim().length > 0)
    .map(s => s.trim());
  
  // Rejoin punctuation with previous sentence
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    if (/^[。！？]+$/.test(sentences[i])) {
      // Punctuation only - attach to previous
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
 * Translate a single sentence using Visa-Strict mode.
 * CRITICAL: Translate everything accurately - names, career history, dates, addresses, etc.
 * Accuracy is required for visa applications. Never infer, embellish, or paraphrase.
 */
async function translateSentence(
  sentence: string,
  mode: 'visa-strict'
): Promise<{ translated: string }> {
  const systemPrompt = `You are a translation assistant for US visa applications (DS-160/ESTA).

CRITICAL ACCURACY RULES - Translate EVERYTHING accurately:
1. Translate ALL content including: names (use standard romanization like Hepburn for Japanese), career history, dates, addresses, passport numbers, yes/no answers, and all other text.
2. Translate literally and accurately. Do not infer, adapt, embellish, or paraphrase.
3. Use common U.S. visa terminology and standard formats.
4. Maintain the exact meaning without adding interpretation or omitting details.
5. For Japanese names, use standard romanization (Hepburn system).
6. For dates, translate to standard US format (MM/DD/YYYY or Month DD, YYYY).
7. For addresses, translate accurately maintaining the structure.

Return ONLY a JSON object with this exact structure:
{
  "translated": "English translation here"
}`;

  const userPrompt = `Translate this Japanese text for a US visa application form (${mode} mode):

"${sentence}"

Return the JSON object only, no additional text.`;

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  
  const completion = await openai.chat.completions.create({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
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
}

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body: TranslateRequest = await request.json();
    const { text, mode } = body;

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

    // Split and translate each sentence
    const sentences = splitIntoSentences(text);
    const sentenceTranslations = await Promise.all(
      sentences.map(sentence => translateSentence(sentence, mode))
    );

    const translatedText = sentenceTranslations.map(st => st.translated).join(' ');

    const response: TranslationResponse = {
      translatedText,
      sentences: sentences.map((original, i) => ({
        original,
        translated: sentenceTranslations[i].translated,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Translation error:', errorMessage);
    
    return NextResponse.json(
      { error: `Translation failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
