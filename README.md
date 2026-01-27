# US Visa Translation Tester (MVP)

A translation testing tool specifically designed for US visa applications (DS-160 / ESTA context).

## Critical Safety Constraints

- **Translation errors may cause visa rejection**
- AI must **NEVER** translate or modify: names, passport numbers, dates, addresses, yes/no answers
- AI is allowed **ONLY** for free-text explanatory fields
- Accuracy and predictability are more important than fluency

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Server-side OpenAI API usage
- Minimal UI, no design libraries

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env.local` file:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## MVP Features

- **Single Free-Text Field**: Test translation with one input field
- **Visa-Strict Mode**: Literal, form-safe translation
- **Sentence-Locked Translation**: Each sentence translated independently
- **Editable Output**: Users can edit translations immediately
- **Risk Indicator**: GREEN / YELLOW / RED based on visa-safety risk
- **Field Gating**: Structure in place for STRICT_NO_AI fields (not shown in MVP)

## API Route

`POST /api/translate`

Request:
```json
{
  "text": "Japanese text to translate",
  "mode": "visa-strict",
  "fieldType": "FREE_TEXT"
}
```

Response:
```json
{
  "translatedText": "English translation",
  "riskLevel": "GREEN" | "YELLOW" | "RED",
  "riskReason": "Optional explanation",
  "sentences": [
    {
      "original": "Japanese sentence",
      "translated": "English sentence",
      "riskLevel": "GREEN"
    }
  ]
}
```

## Important Notes

- This is an MVP for testing purposes only
- Translations are NOT guaranteed
- Always review translations carefully
- Never use for personal identifiers (names, dates, etc.)
