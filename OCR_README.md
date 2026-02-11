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

# Organize by month folder (recommended)
node ocr_processor.js paycheck.pdf Jan
node ocr_processor.js paycheck.pdf Feb

# Batch process entire month folders
node ocr_processor.js Jan  # Processes all files in Jan_Pay/
node ocr_processor.js Feb  # Processes all files in Feb_Pay/

# Full path
node ocr_processor.js "C:\Users\Name\Documents\paycheck.pdf"
```

### Month Folder Organization

When you specify a month (like "Jan", "Feb", etc.), the OCR processor will:

1. Create a folder named `{Month}OCR` (e.g., `JanOCR`, `FebOCR`)
2. Save JSON files in that folder with simplified names
3. The web app will automatically detect the month when importing

### Batch Processing Entire Folders

You can process all pay statements for an entire month by organizing them in folders:

1. **Organize your files:** Put all pay statements for a month in a `{Month}_Pay` folder
   ```
   Jan_Pay/
   ├── paycheck1.pdf
   ├── paycheck2.pdf
   └── paycheck3.pdf
   ```

2. **Batch process the entire folder:**
   ```bash
   node ocr_processor.js Jan
   ```

3. **Results:** All JSON files will be saved in `JanOCR/` and automatically tagged for January

**Complete workflow:**
```bash
# 1. Organize files by month
mkdir Jan_Pay
cp *.pdf Jan_Pay/

# 2. Batch process entire month
node ocr_processor.js Jan

# 3. Import all results at once in web app
# Files saved to: JanOCR/ocr_*.json
```

**Example:**
```bash
# Process January paychecks
node ocr_processor.js "Jan_Pay/paycheck1.pdf" Jan
node ocr_processor.js "Jan_Pay/paycheck2.pdf" Jan

# This creates:
# JanOCR/ocr_paycheck1.json
# JanOCR/ocr_paycheck2.json

# When you import these files in the web app, it will automatically set them to January 2026
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