#!/usr/bin/env python3
"""
Test script for the OCR paycheck processor
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from paycheck_ocr import PaycheckOCRProcessor

def test_ocr():
    """Test the OCR processor with sample data"""
    processor = PaycheckOCRProcessor()

    # Test with sample text that mimics a pay statement
    sample_text = """
    PAY STATEMENT
    Pay Period: 12/14/2025 - 12/27/2025
    Pay Date: 01/02/2026

    GROSS PAY: $5,971.61
    Federal Tax: $685.12
    State Tax: $0.00
    Social Security: $370.24
    Medicare: $86.59

    401k Employee: $1,313.75
    401k Employer Match: $328.44
    Health Insurance: $0.00

    NET PAY: $3,515.91
    """

    print("Testing field extraction from sample text:")
    print(f"Gross Amount: ${processor.extract_field(sample_text, 'gross_amount'):.2f}")
    print(f"Net Amount: ${processor.extract_field(sample_text, 'net_amount'):.2f}")
    print(f"Federal Tax: ${processor.extract_field(sample_text, 'federal_tax'):.2f}")
    print(f"State Tax: ${processor.extract_field(sample_text, 'state_tax'):.2f}")
    print(f"Social Security: ${processor.extract_field(sample_text, 'social_security'):.2f}")
    print(f"Medicare: ${processor.extract_field(sample_text, 'medicare'):.2f}")
    print(f"Employee 401k: ${processor.extract_field(sample_text, 'employee_401k'):.2f}")
    print(f"Employer 401k Match: ${processor.extract_field(sample_text, 'employer_401k_match'):.2f}")
    print(f"Health Insurance: ${processor.extract_field(sample_text, 'health_insurance'):.2f}")
    print(f"Pay Period: {processor.extract_pay_period(sample_text)}")
    print(f"Pay Date: {processor.extract_date(sample_text, 'pay_date')}")

if __name__ == "__main__":
    test_ocr()