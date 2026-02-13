# Paycheck OCR Analyzer

A specialized tool for scanning PDF pay statements from various payroll systems (Workday, ADP, etc.) using OCR technology. It extracts and summarizes paycheck data to help track family income and easily copy values to expense tracking spreadsheets.

## 🎯 Purpose

This tool helps families track their combined income by:
- Scanning pay statements from multiple payroll systems
- Extracting key financial data (gross pay, taxes, deductions, net pay)
- Creating detailed summaries of earnings and deductions
- Making it easy to copy-paste values into Google Sheets or other expense tracking tools

Perfect for tracking household income from multiple jobs or spouses' earnings.

## 🤖 Why OCR Instead of Google API?

Initially built using Google's Gemini API for AI-powered document analysis, this tool evolved to use local OCR processing to avoid API limitations:

- **API Credit Limits**: Google API services have monthly credit limits that can be exhausted with frequent document processing
- **Cost Concerns**: Heavy usage can lead to unexpected charges
- **Privacy**: Local processing keeps sensitive financial data on your device
- **Reliability**: No dependency on external API availability or rate limits
- **Offline Capability**: Works without internet connection once set up

The OCR approach provides the same functionality while being completely free and private.

## ✨ Features

- **Multi-System Support**: Works with Workday, ADP, and other payroll statement formats
- **OCR Processing**: Extracts data from PDF statements automatically
- **Detailed Breakdowns**: Shows taxes (Federal, State, Medicare, Social Security) and deductions (401k, HSA, FSA, Health Insurance)
- **Family Income Tracking**: Consolidate multiple paychecks from different sources
- **Easy Data Export**: Copy values directly to Google Sheets for expense tracking
- **Monthly Summaries**: Aggregate data by month for comprehensive financial overview

## 🚀 Quick Start

**Prerequisites:** Node.js and Python

1. **Install Node.js dependencies:**
   ```bash
   npm install
   ```

2. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Tesseract OCR:**
   - Windows: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki)
   - macOS: `brew install tesseract`
   - Linux: `sudo apt install tesseract-ocr`

4. **Run the application:**
   ```bash
   npm run dev
   ```

## 📊 Usage

1. **Import Pay Statements**: Upload PDF files from Workday, ADP, or other payroll systems
2. **OCR Processing**: The tool automatically extracts financial data from the PDFs
3. **Review Summaries**: View detailed breakdowns of taxes, deductions, and net pay
4. **Copy to Google Sheets**: Easily copy the summarized values to your expense tracking spreadsheet

## 🔧 OCR Processing

For batch processing of multiple pay statements, you can use the command-line OCR processor:

```bash
# Process January pay statements
node ocr_processor.js Jan

# Process February pay statements  
node ocr_processor.js Feb

# Process any month by name (Jan, Feb, Mar, etc.)
node ocr_processor.js [MonthName]
```

This will:
- Scan the `[MonthName]_Pay` folder for PDF files
- Extract data using OCR
- Save JSON files to `[MonthName]OCR` folder
- Generate summaries ready for import into the web app

### 📤 Importing OCR Results

After processing your pay statements, import the generated JSON files into the web app:

1. **Open the Paycheck Calculator** in your browser
2. **Click "Import OCR Data"** button
3. **Select all JSON files** from the `[MonthName]OCR` folder (e.g., `JanOCR/`)
4. **Review the imported data** in the summary tables
5. **Copy values to Google Sheets** for your expense tracking

The app will automatically detect the month from the folder name and organize your paychecks accordingly.

## 🔧 Technical Details

- **Frontend**: React/TypeScript with modern UI components
- **OCR Engine**: Tesseract OCR with custom pattern matching
- **Data Processing**: Python scripts for PDF text extraction and field recognition
- **Storage**: Local browser storage for data persistence

## 📈 Benefits

- **Family Income Tracking**: Consolidate paychecks from multiple family members
- **Tax Planning**: Detailed breakdown of all tax withholdings
- **Budgeting**: Accurate net income calculations for expense planning
- **Record Keeping**: Digital archive of all pay statements
- **Google Sheets Integration**: Seamless data transfer for comprehensive financial tracking
