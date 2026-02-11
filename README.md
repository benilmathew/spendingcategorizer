# Financial Analysis Suite

A comprehensive AI-powered financial analysis toolkit with two specialized applications:

## 🛒 Spending Categorizer
Upload your credit card statements and let AI automatically categorize your expenses. Track spending patterns and get insights into your financial habits.

**Features:**
- AI-powered transaction categorization
- Monthly spending analysis
- Interactive charts and summaries
- Custom category mappings
- Data persistence

## 💰 Income Calculator
Upload your pay statements from Workday or ADP to analyze your earnings, taxes, and deductions. Get detailed breakdowns of your take-home pay.

**Features:**
- Pay statement analysis (Workday & ADP)
- Tax breakdown (Federal, State, Local, Medicare, Social Security)
- Deduction analysis (401k, Health Insurance, etc.)
- Monthly income summaries
- Net pay calculations

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

The app will start with a landing page where you can choose between the Spending Categorizer and Income Calculator.

## OCR Fallback (No API Required)

If you hit API rate limits or prefer offline processing, you can use the OCR fallback:

1. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Install Tesseract OCR:**
   - Windows: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)
   - macOS: `brew install tesseract`
   - Linux: `sudo apt install tesseract-ocr`

3. **Enable OCR mode:**
   ```bash
   # Remove API key or set USE_OCR=true
   set USE_OCR=true
   ```

4. **Restart the app:**
   ```bash
   npm run dev
   ```

See [OCR_README.md](OCR_README.md) for detailed setup instructions.
