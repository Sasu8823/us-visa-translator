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
      setEditableTranslation(data.outputText);
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
        <h1>アメリカビザ翻訳テスター（MVP）</h1>
        <p>DS-160 / ESTA申請のための翻訳精度テスト</p>
      </header>

      <div className="disclaimer">
        <strong>⚠️ 重要な免責事項</strong>
        <p>
          このツールはテスト目的のみに使用してください。
          翻訳の正確性やビザ申請への適合性は保証されません。
          氏名、日付、住所、職歴など、翻訳文は必ず慎重にご確認ください。
          ビザ申請では正確さが非常に重要です。
          ビザ申請書類の最終的な文言については、ご自身の責任となります。
        </p>
      </div>

      <div className="translation-form">
        <div className="field-group">
          <label className="field-label" htmlFor="input-text">
            日本語テキスト（すべての内容を翻訳可能）
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
          <div className="loading">翻訳中...</div>
        )}

        {translation && (
          <div className="translation-result">
            {/* Risk Level Indicator */}
            <div
              className={`risk-indicator ${translation.riskLevel === 'GREEN'
                ? 'green'
                : translation.riskLevel === 'YELLOW'
                  ? 'yellow'
                  : 'red'
                }`}
              style={{ marginBottom: '1rem' }}
            >
              <span>
                {translation.riskLevel === 'GREEN'
                  ? '✓ Low Risk'
                  : translation.riskLevel === 'YELLOW'
                    ? '⚠ Moderate Risk'
                    : '✗ High Risk'}
              </span>
            </div>

            {/* Warnings */}
            {translation.warnings.length > 0 && (
              <div
                style={{
                  backgroundColor: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '4px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  fontSize: '0.9rem',
                }}
              >
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>
                  ⚠️ Warnings:
                </strong>
                {translation.warnings.map((warning, idx) => (
                  <p key={idx} style={{ margin: '0.5rem 0', color: '#856404' }}>
                    {warning}
                  </p>
                ))}
              </div>
            )}

            {/* Applied Glossary */}
            {translation.appliedGlossary.length > 0 && (
              <div
                style={{
                  backgroundColor: '#d4edda',
                  border: '1px solid #28a745',
                  borderRadius: '4px',
                  padding: '0.75rem',
                  marginBottom: '1rem',
                  fontSize: '0.85rem',
                }}
              >
                <strong>✓ 知識ベースから適用された用語:</strong>{' '}
                {translation.appliedGlossary.join(', ')}
              </div>
            )}

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
                この翻訳は編集可能です。最終的な文言はあなたに帰属します。
              </p>
            </div>

            {/* Sentence breakdown (for transparency) */}
            {translation.sentences.length > 1 && (
              <details style={{ marginTop: '1.5rem' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '0.5rem' }}>
                  文ごとの内訳「全{translation.sentences.length} 文」
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
                        <strong>原文:</strong> {sentence.original}
                      </div>
                      <div>
                        <strong>翻訳:</strong> {sentence.translated}
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
