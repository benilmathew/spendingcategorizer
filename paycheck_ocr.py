#!/usr/bin/env python3
"""
Paycheck OCR Processor - Extract data from pay statements without AI API calls
Uses Tesseract OCR and regex patterns to extract common pay statement fields.
"""

import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import fitz  # PyMuPDF for PDF processing
import pytesseract
from PIL import Image
import io

class PaycheckOCRProcessor:
    def __init__(self):
        # Common regex patterns for pay statement fields
        self.patterns = {
            'gross_amount': [
                r'gross\s+(?:pay|amount|earnings?)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'total\s+(?:gross|earnings?)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'gross\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'earnings?\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'net_amount': [
                r'net\s+(?:pay|amount)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'take[-\s]?home\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'net\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'federal_tax': [
                r'federal\s+(?:income\s+)?tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fed(?:eral)?\s+tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'state_tax': [
                r'state\s+(?:income\s+)?tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'state\s+tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'social_security': [
                r'social\s+security\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'FICA\s+SS\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'soc\s+sec\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'medicare': [
                r'medicare\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'FICA\s+MED\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'employee_401k': [
                r'(?:employee|emp)\s+401[k]\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+deferred\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'employer_401k_match': [
                r'(?:employer|company)\s+401[k]\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'match\s+401[k]\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'health_insurance': [
                r'health\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'medical\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'health\s+deduction\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'pay_period': [
                r'pay\s+period\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4}\s*-\s*[0-9]{1,2}/[0-9]{1,2}/[0-9]{4})',
                r'period\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4}\s*-\s*[0-9]{1,2}/[0-9]{1,2}/[0-9]{4})'
            ],
            'pay_date': [
                r'pay\s+date\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})',
                r'check\s+date\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})',
                r'date\s*:?\s*([0-9]{1,2}/[0-9]{1,2}/[0-9]{4})'
            ]
        }

    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """Extract text from PDF using PyMuPDF"""
        try:
            doc = fitz.open(pdf_path)
            text = ""
            for page in doc:
                text += page.get_text()
            doc.close()
            return text
        except Exception as e:
            print(f"Error extracting text from PDF: {e}", file=sys.stderr)
            return ""

    def extract_text_from_image(self, image_path: str) -> str:
        """Extract text from image using Tesseract OCR"""
        try:
            image = Image.open(image_path)
            text = pytesseract.image_to_string(image)
            return text
        except Exception as e:
            print(f"Error extracting text from image: {e}", file=sys.stderr)
            return ""

    def pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        """Convert PDF pages to images"""
        try:
            doc = fitz.open(pdf_path)
            images = []
            for page in doc:
                pix = page.get_pixmap()
                img = Image.open(io.BytesIO(pix.tobytes()))
                images.append(img)
            doc.close()
            return images
        except Exception as e:
            print(f"Error converting PDF to images: {e}", file=sys.stderr)
            return []

    def ocr_pdf(self, pdf_path: str) -> str:
        """OCR PDF by converting to images first"""
        try:
            images = self.pdf_to_images(pdf_path)
            text = ""
            for img in images:
                page_text = pytesseract.image_to_string(img)
                text += page_text + "\n"
            return text
        except Exception as e:
            print(f"Error OCR'ing PDF: {e}", file=sys.stderr)
            return ""

    def clean_amount(self, amount_str: str) -> float:
        """Clean and convert amount string to float"""
        if not amount_str:
            return 0.0

        # Remove commas and dollar signs
        cleaned = re.sub(r'[,$]', '', amount_str.strip())
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def extract_field(self, text: str, field_name: str) -> float:
        """Extract a specific field using regex patterns"""
        patterns = self.patterns.get(field_name, [])
        text_lower = text.lower()

        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                # Take the first match and clean it
                amount_str = matches[0]
                return self.clean_amount(amount_str)

        return 0.0

    def extract_date(self, text: str, field_name: str) -> str:
        """Extract date fields"""
        patterns = self.patterns.get(field_name, [])
        text_lower = text.lower()

        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                date_str = matches[0]
                # Convert MM/DD/YYYY to YYYY-MM-DD
                try:
                    parts = date_str.split('/')
                    if len(parts) == 3:
                        month, day, year = parts
                        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                except:
                    pass
                return date_str

        return ""

    def extract_pay_period(self, text: str) -> str:
        """Extract pay period range"""
        patterns = self.patterns.get('pay_period', [])
        text_lower = text.lower()

        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                return matches[0]

        return ""

    def process_file(self, file_path: str) -> Dict:
        """Process a single pay statement file"""
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        # Extract text based on file type
        if file_path.suffix.lower() == '.pdf':
            # Try direct text extraction first
            text = self.extract_text_from_pdf(str(file_path))
            if not text.strip():
                # Fall back to OCR
                text = self.ocr_pdf(str(file_path))
        else:
            # Assume it's an image
            text = self.extract_text_from_image(str(file_path))

        if not text.strip():
            raise ValueError(f"Could not extract text from {file_path}")

        # Extract all fields
        paycheck_data = {
            "pay_period": self.extract_pay_period(text),
            "gross_amount": self.extract_field(text, 'gross_amount'),
            "federal_tax_amount": self.extract_field(text, 'federal_tax'),
            "state_tax_amount": self.extract_field(text, 'state_tax'),
            "local_tax_amount": 0.0,  # Not commonly found
            "medicare_amount": self.extract_field(text, 'medicare'),
            "social_security_amount": self.extract_field(text, 'social_security'),
            "employee_401k_contribution": self.extract_field(text, 'employee_401k'),
            "employer_401k_match": self.extract_field(text, 'employer_401k_match'),
            "health_insurance": self.extract_field(text, 'health_insurance'),
            "other_pre_tax_deductions": 0.0,
            "garnishments": 0.0,
            "other_post_tax_deductions": 0.0,
            "net_amount": self.extract_field(text, 'net_amount'),
            "pay_date": self.extract_date(text, 'pay_date'),
            "source_system": "OCR"
        }

        return paycheck_data

def main():
    if len(sys.argv) < 2:
        print("Usage: python paycheck_ocr.py <file_path> [target_month]", file=sys.stderr)
        sys.exit(1)

    file_path = sys.argv[1]
    target_month = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        processor = PaycheckOCRProcessor()
        result = processor.process_file(file_path)

        # If target_month is provided, we could filter here, but for now just return the data
        print(json.dumps([result], indent=2))

    except Exception as e:
        print(f"Error processing file: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()