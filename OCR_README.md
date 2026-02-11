# OCR Fallback Setup

If you hit API rate limits with Google Gemini, you can use the OCR fallback which processes pay statements locally using Python and Tesseract OCR.

## Quick Start

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Process a file:**
   ```bash
   node ocr_processor.js your_paycheck.pdf
   ```

3. **Import results into the web app:**
   - Copy the JSON output
   - The web app will automatically import the data

## Prerequisites

1. **Python 3.8+** - Download from [python.org](https://python.org)

2. **Tesseract OCR** - Install the OCR engine:
   - **Windows**: Download from [GitHub releases](https://github.com/UB-Mannheim/tesseract/wiki) and add to PATH
   - **macOS**: `brew install tesseract`
   - **Linux**: `sudo apt install tesseract-ocr`

3. **Poppler** (for PDF processing):
   - **Windows**: Included in PyMuPDF
   - **macOS**: `brew install poppler`
   - **Linux**: `sudo apt install poppler-utils`

## Usage

### Method 1: Standalone Processing

Process files from command line and get JSON output:

```bash
# Basic usage
node ocr_processor.js paycheck.pdf

# Specify target month
node ocr_processor.js paycheck.pdf 2026-01

# Full path
node ocr_processor.js "C:\Users\Name\Documents\paycheck.pdf"
```

The script will:
- Extract text using OCR
- Parse pay statement fields
- Output JSON results
- Save results to a timestamped file

### Method 2: Test the OCR Engine

Test with sample data:

```bash
python test_ocr.py
```

## How It Works

The OCR system:
1. **PDFs**: Extracts text directly, falls back to OCR if needed
2. **Images**: Uses Tesseract OCR to extract text
3. **Pattern Matching**: Uses regex patterns to find common pay statement fields
4. **Data Extraction**: Identifies amounts, dates, and deduction types

## Accuracy Notes

OCR processing is less accurate than AI but works without API limits:
- ✅ Works offline
- ✅ No API costs
- ✅ Unlimited processing
- ⚠️ May miss unusual formats
- ⚠️ Requires clean, readable documents

## Supported Fields

The OCR processor can extract:
- Gross amount
- Net amount
- Federal, state, local taxes
- Medicare & Social Security
- Employee 401k contributions
- Employer 401k match
- Health insurance
- Pay period & pay date

## Troubleshooting

**"tesseract command not found"**
- Install Tesseract and ensure it's in your PATH
- On Windows, you may need to restart your terminal

**"Module not found"**
- Run `pip install -r requirements.txt` again
- Ensure you're using the correct Python version

**Poor OCR results**
- Ensure documents are high quality and well-lit
- Try different file formats (PDF vs images)
- Check that text is not too small or distorted

**"spawn python ENOENT"**
- Ensure Python is installed and in your PATH
- Try `python3` instead of `python` in the scripts