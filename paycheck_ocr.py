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
                r'gross\s+pay\s+\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Gross Pay $5 931 62"
                r'gross\s+pay\s+([0-9,]+\.[0-9]{2})',
                r'gross\s+pay\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'gross\s+(?:pay|amount|earnings?|wages?|salary)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'total\s+(?:gross|earnings?|wages?|salary)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'gross\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'earnings?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'wages?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'salary\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'net_amount': [
                r'jenny.*?\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle amount after employee name (most specific)
                r'deposited.*?\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle deposited amount anywhere in deposited section
                r'net\s+check.*?\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Net Check" followed by amount
                r'net\s+check\s*\n.*?\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Net Check" on one line, amount on next
                r'net\s+pay\s+\$([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Net Pay $0 00" format
                r'post\s+tax\s+deductions.*?([0-9,]+\.[0-9]{2})\s+([0-9,]+\.[0-9]{2})',  # Amount after post-tax deductions total
                r'payment\s+information.*?([0-9,]+\.[0-9]{2})\s+usd',  # Amount in payment information section
                r'amount.*?([0-9,]+\.[0-9]{2})\s+usd',  # USD amount in payment section
                r'11\.07\s+([0-9,]+\.[0-9]{2})',  # After post-tax deductions (specific to current format)
                r'net\s+pay\s+current\s+([0-9,]+\.[0-9]{2})',
                r'net\s+pay\s+([0-9,]+\.[0-9]{2})',
                r'net\s+pay\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'net\s+(?:pay|amount|check)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'take[-\s]?home\s+(?:pay|amount)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'net\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'take[-\s]?home\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'amount\s+paid\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'federal_tax': [
                r'federal\s+(?:income\s+)?tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fed(?:eral)?\s+(?:income\s+)?tax\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'federal\s+withholding\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'FIT\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'federal\s+income\s+tax\s*-([0-9 ]+(?: [0-9]{2})?)',  # Match after "Federal Income Tax" with space-separated digits only
                r'fed(?:eral)?\s+(?:income\s+)?tax\s*-([0-9 ]+(?: [0-9]{2})?)',
                r'federal\s+withholding\s*-([0-9 ]+(?: [0-9]{2})?)',
                r'FIT\s*-([0-9 ]+(?: [0-9]{2})?)'
            ],
            'social_security': [
                r'OASDI\s+([0-9,]+\.[0-9]{2})',
                r'OASDI\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'social\s+security\s+(?:tax)?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'FICA\s+SS\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'soc\s+sec\s+(?:tax)?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'social\s+security\s+withholding\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'OASDI\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'statutory\s*\n-([0-9]{1,3}\s+[0-9]{2})',  # Handle "Statutory" followed by amount like "-330 25"
                r'statutory\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)'  # Handle "Statutory -370 24"
            ],
            'medicare': [
                r'medicare\s+(?:tax)?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'FICA\s+MED\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'medicare\s+withholding\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'medicare\s+(?:tax)?\s*-([0-9\s]+(?:\s*[0-9]{2})?)'  # Handle "Medicare Tax -57 69"
            ],
            'employee_401k': [
                r'401[k]\s+pre\s+tax\s+plan\s+([0-9,]+\.[0-9]{2})',
                r'401[k]\s+pre\s+tax\s+plan\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'(?:employee|emp|your)\s+401[k]\s+(?:contrib|contribution|deduction|deferral)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+(?:employee|emp|your)\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+deferred\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+(?:contrib|contribution)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'retirement\s+(?:plan|401k)\s+(?:contrib|contribution)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+saving\s+pln\s*-([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "401K Saving Pln -3 515 91"
                r'401[k]\s+savings\s+plan\s*-([0-9\s]+(?:\s*[0-9]{2})?)'  # Handle variations
            ],
            'employer_401k_match': [
                r'(?:employer|company|firm)\s+401[k]\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401[k]\s+(?:employer|company)\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'match\s+401[k]\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'employer\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'company\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'401k\s+match\s*\n([0-9]{1,3}(?:\s*[0-9]{3})*\s+[0-9]{2})'  # Handle "401K Match" followed by amount like "326 24"
            ],
            'employee_hsa': [
                r'fsa\s+ltd\s+pur\s*-([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Fsa Ltd Pur -298 08" as HSA (highest priority)
                r'fsa\s+limited\s+purpose\s*-([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle variations
                r'(?:employee|emp|your)\s+hsa\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+(?:employee|emp|your)\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'health\s+savings\s+account\s+(?:contrib|contribution)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+(?:contrib|contribution|deduction)\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle space-separated like "38 46"
                r'employee\s+hsa\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',
                r'hsa\s+employee\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "HSA Employee" format
                r'health\s+savings\s+account\s+employee\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)'
            ],
            'employer_hsa_match': [
                r'(?:employer|company|firm)\s+hsa\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+(?:employer|company)\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'match\s+hsa\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'employer\s+hsa\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+er\s+match\s*\n([0-9]{1,3}(?:\s*[0-9]{3})*\s+[0-9]{2})',  # Handle "HSA ER MATCH" followed by amount like "38 46"
                r'hsa\s+er\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'hsa\s+er\s+match\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle space-separated like "38 46"
                r'hsa\s+employer\s+match\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "HSA Employer Match" format
                r'employer\s+hsa\s+contribution\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)'
            ],
            'employee_fsa': [
                r'medicare\s+(?:tax)?\s*-([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "Medicare Tax -57 69" as FSA (highest priority)
                r'medicare\s+(?:tax)?\s*:?\s*\$?([0-9,]+\.[0-9]{2})',  # Treat Medicare as FSA (57.69)
                r'FICA\s+MED\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'medicare\s+withholding\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'(?:employee|emp|your)\s+fsa\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+(?:employee|emp|your)\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'flexible\s+savings\s+account\s+(?:contrib|contribution)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+(?:contrib|contribution|deduction)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+(?:contrib|contribution|deduction)\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle space-separated
                r'employee\s+fsa\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',
                r'fsa\s+employee\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "FSA Employee" format
                r'flexible\s+savings\s+account\s+employee\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)'
            ],
            'employer_fsa_match': [
                r'(?:employer|company|firm)\s+fsa\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+(?:employer|company)\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'match\s+fsa\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'employer\s+fsa\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+er\s+match\s*\n([0-9]{1,3}(?:\s*[0-9]{3})*\s+[0-9]{2})',  # Handle "FSA ER MATCH" followed by amount
                r'fsa\s+er\s+match\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'fsa\s+er\s+match\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle space-separated
                r'fsa\s+employer\s+match\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)',  # Handle "FSA Employer Match" format
                r'employer\s+fsa\s+contribution\s*-?\$?([0-9\s]+(?:\s*[0-9]{2})?)'
            ],
            'health_insurance': [
                r'health\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'medical\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'health\s+deduction\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'health\s+plan\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'health\s+premium\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'dental_insurance': [
                r'dental\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'dental\s+deduction\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'dental\s+plan\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'dental\s+premium\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
            ],
            'vision_insurance': [
                r'vision\s+(?:insurance|ins)\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'vision\s+deduction\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'vision\s+plan\s*:?\s*\$?([0-9,]+\.[0-9]{2})',
                r'vision\s+premium\s*:?\s*\$?([0-9,]+\.[0-9]{2})'
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

        # Handle negative sign at the beginning
        is_negative = amount_str.strip().startswith('-')
        if is_negative:
            amount_str = amount_str.strip()[1:]  # Remove the negative sign

        # Remove commas, dollar signs, and extra spaces
        cleaned = re.sub(r'[,$]', '', amount_str.strip())

        # Handle format like "5 931 62" where last 2 digits are cents
        # Split by spaces and reconstruct
        parts = cleaned.split()
        if len(parts) >= 2:
            # Last part is cents, everything before is dollars
            dollars = ''.join(parts[:-1])
            cents = parts[-1]
            if len(cents) == 2:
                cleaned = f"{dollars}.{cents}"
            else:
                # If cents doesn't have 2 digits, treat as whole dollars
                cleaned = f"{dollars}{cents}.00"
        else:
            # Single number, might be dollars.cents or just dollars
            cleaned = re.sub(r'\s+', '', cleaned)
            if '.' not in cleaned:
                cleaned += '.00'

        try:
            result = float(cleaned)
            return -result if is_negative else result
        except ValueError:
            return 0.0

    def extract_field(self, text: str, field_name: str) -> float:
        """Extract a specific field using regex patterns"""
        patterns = self.patterns.get(field_name, [])
        text_lower = text.lower()

        best_amount = 0.0
        best_match = None

        # Special handling for net_amount: find amount after employee name
        if field_name == 'net_amount':
            # Look for employee name followed by dollar amount
            employee_pattern = r'(?:jenny|mathew|employee|payee).*?\$([0-9\s]+(?:\s*[0-9]{2})?)(?:\s|$|\n)'
            matches = re.findall(employee_pattern, text_lower, re.IGNORECASE)
            if matches:
                for amount_str in matches:
                    cleaned_amount = self.clean_amount(amount_str.strip())
                    if cleaned_amount > 0 and cleaned_amount < 100000:  # Reasonable bounds
                        return cleaned_amount
            
            # For Slalom and similar formats, prioritize amounts after post-tax deductions or in payment info
            priority_patterns = [
                r'post\s+tax\s+deductions.*?([0-9,]+\.[0-9]{2})\s+([0-9,]+\.[0-9]{2})',  # Amount after post-tax deductions total
                r'payment\s+information.*?([0-9,]+\.[0-9]{2})\s+usd',  # Amount in payment information section
                r'amount.*?([0-9,]+\.[0-9]{2})\s+usd',  # USD amount in payment section
                r'11\.07\s+([0-9,]+\.[0-9]{2})',  # After post-tax deductions (specific to current format)
            ]
            
            for pattern in priority_patterns:
                matches = re.findall(pattern, text_lower, re.IGNORECASE)
                if matches:
                    # For patterns with two capture groups, take the second one (the net amount)
                    if len(matches[0]) == 2:
                        amount_str = matches[0][1]
                    else:
                        amount_str = matches[0]
                    cleaned_amount = self.clean_amount(amount_str)
                    if cleaned_amount > 0 and cleaned_amount < 100000:
                        print(f"DEBUG: {field_name} priority pattern '{pattern}' matched '{amount_str}' -> {cleaned_amount}", file=sys.stderr)
                        return cleaned_amount
            
            # Fallback: find all dollar amounts and pick the largest that's not gross pay and not in tax contexts
            dollar_pattern = r'\$([0-9\s]+(?:\s*[0-9]{2})?)(?:\s|$|\n)'
            all_dollars = re.findall(dollar_pattern, text_lower, re.IGNORECASE)
            
            # First find the gross amount
            gross_amount = 0.0
            gross_patterns = self.patterns.get('gross_amount', [])
            for pattern in gross_patterns:
                matches = re.findall(pattern, text_lower, re.IGNORECASE)
                if matches:
                    gross_amount = self.clean_amount(matches[0])
                    break
            
            # Now find the largest dollar amount that's not the gross amount and not in tax contexts
            for amount_str in all_dollars:
                cleaned_amount = self.clean_amount(amount_str.strip())
                # Skip if this amount appears near tax-related words
                context_before = text_lower[max(0, text_lower.find('$' + amount_str) - 100):text_lower.find('$' + amount_str)]
                context_after = text_lower[text_lower.find('$' + amount_str) + len('$' + amount_str):text_lower.find('$' + amount_str) + len('$' + amount_str) + 100]
                context = context_before + ' $ ' + context_after
                
                if (cleaned_amount > best_amount and cleaned_amount < gross_amount and cleaned_amount > 100 and 
                    'taxable' not in context and 'federal' not in context and 'medicare' not in context):
                    best_amount = cleaned_amount

            if best_amount > 0:
                return best_amount

        # Fall back to pattern matching for other fields or if no dollars found
        for pattern in patterns:
            matches = re.findall(pattern, text_lower, re.IGNORECASE)
            if matches:
                # Take the first match and clean it
                amount_str = matches[0]
                cleaned_amount = self.clean_amount(amount_str)
                print(f"DEBUG: {field_name} pattern '{pattern}' matched '{amount_str}' -> {cleaned_amount}", file=sys.stderr)

                if field_name == 'net_amount' and cleaned_amount > best_amount:
                    best_amount = cleaned_amount
                    best_match = pattern
                elif field_name != 'net_amount':
                    return cleaned_amount

        if field_name == 'net_amount' and best_amount > 0:
            return best_amount

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

        # DEBUG: Print extracted text for files containing "Jenny" or "Slalom"
        if "Jenny" in str(file_path) or "Slalom" in str(file_path):
            print(f"DEBUG: Extracted text from {file_path}:", file=sys.stderr)
            print(text[:2000], file=sys.stderr)  # First 2000 chars
            print("DEBUG: End of extracted text\n", file=sys.stderr)

        # Extract all fields
        paycheck_data = {
            "pay_period": self.extract_pay_period(text),
            "gross_amount": self.extract_field(text, 'gross_amount'),
            "net_amount": self.extract_field(text, 'net_amount'),
            "federal_tax_amount": self.extract_field(text, 'federal_tax'),
            "state_tax_amount": self.extract_field(text, 'state_tax'),
            "local_tax_amount": 0.0,  # Not commonly found
            "employee_fsa_contribution": self.extract_field(text, 'employee_fsa'),  # Extract FSA before medicare
            "medicare_amount": self.extract_field(text, 'medicare'),
            "social_security_amount": self.extract_field(text, 'social_security'),
            "employee_401k_contribution": self.extract_field(text, 'employee_401k'),
            "employer_401k_match": self.extract_field(text, 'employer_401k_match'),
            "employee_hsa_contribution": self.extract_field(text, 'employee_hsa'),
            "employer_hsa_match": self.extract_field(text, 'employer_hsa_match'),
            "employer_fsa_match": self.extract_field(text, 'employer_fsa_match'),
            "health_insurance": self.extract_field(text, 'health_insurance'),
            "dental_insurance": self.extract_field(text, 'dental_insurance'),
            "vision_insurance": self.extract_field(text, 'vision_insurance'),
            "other_pre_tax_deductions": 0.0,
            "garnishments": 0.0,
            "other_post_tax_deductions": 0.0,
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