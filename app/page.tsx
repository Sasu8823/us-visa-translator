'use client';

import { useState } from 'react';
import type { TranslationResponse } from '@/types/translation';

/**
 * MVP Translation Tester for US Visa Applications
 * 
 * ACCURACY NOTES:
 * - Translates ALL content including names, career history, dates, addresses, etc.
 * - Accuracy is paramount for visa applications
 * - Users can edit translations - they own the final wording
 */

export default function Home() {
  const [inputText, setInputText] = useState('');
  const [translation, setTranslation] = useState<TranslationResponse | null>(null);
  const [editableTranslation, setEditableTranslation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const translationMode: 'visa-strict' = 'visa-strict';

  const handleTranslate = async () => {
    if (!inputText.trim()) {
      setError('Please enter text to translate');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: inputText,
          mode: translationMode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Translation failed';
        throw new Error(errorMsg);
      }

      const data: TranslationResponse = await response.json();
      setTranslation(data);
      setEditableTranslation(data.translatedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setTranslation(null);
      setEditableTranslation('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>US Visa Translation Tester (MVP)</h1>
        <p>Test translation accuracy for DS-160 / ESTA applications</p>
      </header>

      <div className="disclaimer">
        <strong>⚠️ Important Disclaimer</strong>
        <p>
          This tool is for testing purposes only. Translations are NOT guaranteed to be accurate or acceptable for visa applications.
          Always review translations carefully, especially for names, dates, addresses, and career history.
          Accuracy is critical for visa applications. You are responsible for the final wording submitted in your visa application.
        </p>
      </div>

      <div className="translation-form">
        <div className="field-group">
          <label className="field-label" htmlFor="input-text">
            Japanese Text (All content can be translated)
          </label>
          <textarea
            id="input-text"
            className="textarea"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter Japanese text to translate..."
            disabled={isLoading}
          />
        </div>

        <button
          className="button"
          onClick={handleTranslate}
          disabled={isLoading || !inputText.trim()}
        >
          {isLoading ? 'Translating...' : 'Translate (Visa-Strict Mode)'}
        </button>

        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
          </div>
        )}

        {isLoading && (
          <div className="loading">Processing translation...</div>
        )}

        {translation && (
          <div className="translation-result">
            <div className="field-group" style={{ marginTop: '1rem' }}>
              <label className="field-label" htmlFor="translated-text">
                Translated Text (Editable)
              </label>
              <textarea
                id="translated-text"
                className="translated-text"
                value={editableTranslation}
                onChange={(e) => setEditableTranslation(e.target.value)}
                placeholder="Translation will appear here..."
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                You can edit this translation. You own the final wording.
              </p>
            </div>

            {/* Sentence breakdown (for transparency) */}
            {translation.sentences.length > 1 && (
              <details style={{ marginTop: '1.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '0.5rem' }}>
                  Sentence-by-Sentence Breakdown ({translation.sentences.length} sentences)
                </summary>
                <div style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                  {translation.sentences.map((sentence, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        backgroundColor: '#f9f9f9',
                        borderRadius: '4px',
                        borderLeft: '3px solid #ccc',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Original:</strong> {sentence.original}
                      </div>
                      <div>
                        <strong>Translated:</strong> {sentence.translated}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
