import { GoogleGenAI } from "@google/genai";
import { PaycheckData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Check if we should use OCR fallback instead of AI
const USE_OCR_FALLBACK = process.env.USE_OCR === 'true';

export async function processPaycheck(
  fileBase64: string,
  mimeType: string,
  targetMonth: string // Format: YYYY-MM
): Promise<PaycheckData[]> {
  // If OCR is explicitly requested, provide instructions
  if (USE_OCR_FALLBACK) {
    throw new Error(
      "OCR Mode Selected: Use the standalone processor instead:\n\n" +
      "1. Run: node ocr_processor.js your_file.pdf\n" +
      "2. Copy the JSON output\n" +
      "3. Click '📄 Import JSON' in the web app\n\n" +
      "This processes files locally without API calls."
    );
  }

  // If no API key, suggest OCR
  if (!process.env.API_KEY) {
    throw new Error(
      "No API key found. To use AI processing, add GEMINI_API_KEY to your environment.\n\n" +
      "For offline processing, use: node ocr_processor.js your_file.pdf"
    );
  }

  console.log("Using AI processing");

  try {
    const model = "gemini-3-flash-preview";
    const [year, month] = targetMonth.split('-');
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const targetMonthName = monthNames[parseInt(month) - 1];

    const prompt = `
    Extract all paycheck information from this pay statement for ${targetMonthName} ${year}.
    Look for pay statements from Workday, ADP, or other payroll systems.

    For each paycheck, extract the following information:
    - Pay period (date range)
    - Gross amount (total earnings before deductions)
    - Federal tax amount
    - State tax amount
    - Local tax amount (if any)
    - Medicare amount
    - Social Security amount
    - Pre-tax deductions:
      * employee_401k_contribution (employee's 401k contribution amount)
      * employer_401k_match (employer's matching contribution amount)
      * employee_hsa_contribution (employee's HSA contribution amount)
      * employer_hsa_match (employer's HSA matching contribution amount)
      * health_insurance (health insurance deduction)
      * other_pre_tax_deductions (any other pre-tax deductions)
    - Post-tax deductions:
      * garnishments
      * other_post_tax_deductions
    - Net amount (take-home pay)
    - Pay date
    - Source system (Workday, ADP, or Other)

    IMPORTANT: Return the data in the following JSON structure for each paycheck:
    {
      "pay_period": "MM/DD/YYYY - MM/DD/YYYY",
      "gross_amount": 1234.56,
      "federal_tax_amount": 123.45,
      "state_tax_amount": 0,
      "local_tax_amount": 0,
      "medicare_amount": 12.34,
      "social_security_amount": 76.54,
      "employee_401k_contribution": 200.00,
      "employer_401k_match": 50.00,
      "health_insurance": 100.00,
      "other_pre_tax_deductions": 0,
      "garnishments": 0,
      "other_post_tax_deductions": 0,
      "net_amount": 987.65,
      "pay_date": "YYYY-MM-DD",
      "source_system": "ADP"
    }
  `;

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: fileBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text || "[]";
    console.log("Raw AI response:", text);
    console.log("Response length:", text.length);

    // Extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response. Full response:", text);
      throw new Error(`No valid JSON found in AI response. Response: ${text.substring(0, 200)}...`);
    }

    console.log("Extracted JSON match:", jsonMatch[0]);

    let parsedData;
    try {
      parsedData = JSON.parse(jsonMatch[0]);
      console.log("Successfully parsed JSON:", parsedData);
    } catch (e) {
      console.error("Failed to parse JSON:", jsonMatch[0]);
      console.error("Parse error:", e);
      throw new Error(`Invalid JSON response from AI: ${e instanceof Error ? e.message : 'Unknown parse error'}. JSON: ${jsonMatch[0].substring(0, 200)}...`);
    }

    // Ensure we have an array
    const paychecks = Array.isArray(parsedData) ? parsedData : [parsedData];
    console.log(`Processing ${paychecks.length} paycheck(s)`);

    // Validate and clean the data
    const validatedPaychecks = paychecks
      .map((paycheck: any, index: number) => {
      if (!paycheck || typeof paycheck !== 'object') {
        console.warn(`Invalid paycheck data at index ${index}:`, paycheck);
        return null;
      }

      const processedPaycheck = {
        id: `${targetMonth}-${Date.now()}-${index}`,
        payPeriod: paycheck.pay_period || paycheck.payPeriod || "",
        grossAmount: Number(paycheck.gross_amount || paycheck.grossAmount) || 0,
        federalTax: Number(paycheck.federal_tax_amount || paycheck.federalTax) || 0,
        stateTax: Number(paycheck.state_tax_amount || paycheck.stateTax) || 0,
        localTax: Number(paycheck.local_tax_amount || paycheck.localTax) || 0,
        medicare: Number(paycheck.medicare_amount || paycheck.medicare) || 0,
        socialSecurity: Number(paycheck.social_security_amount || paycheck.socialSecurity) || 0,
        preTaxDeductions: {
          '401k': Number(paycheck.pre_tax_deductions?.['employee_401k_contribution'] || paycheck.pre_tax_deductions?.['401k_contribution'] || paycheck.pre_tax_deductions?.['employee_401k'] || paycheck.pre_tax_deductions?.['401k'] || paycheck.preTaxDeductions?.['401k'] || paycheck['employee_401k_contribution'] || paycheck['401k_contribution'] || paycheck['employee_401k'] || paycheck['401k']) || 0,
          employer401kMatch: Number(paycheck.pre_tax_deductions?.['employer_401k_match'] || paycheck.pre_tax_deductions?.['401k_match'] || paycheck.pre_tax_deductions?.['employer_match'] || paycheck.preTaxDeductions?.employer401kMatch || paycheck['employer_401k_match'] || paycheck['401k_match'] || paycheck['employer_match']) || 0,
          healthInsurance: Number(paycheck.pre_tax_deductions?.health_insurance || paycheck.pre_tax_deductions?.healthInsurance || paycheck.preTaxDeductions?.healthInsurance || paycheck.health_insurance || paycheck.healthInsurance) || 0,
          other: Number(paycheck.pre_tax_deductions?.other_pre_tax_deductions || paycheck.pre_tax_deductions?.other || paycheck.preTaxDeductions?.other || paycheck.other_pre_tax_deductions || paycheck.other) || 0,
        },
        postTaxDeductions: {
          garnishments: Number(paycheck.post_tax_deductions?.garnishments || paycheck.postTaxDeductions?.garnishments) || 0,
          other: Number(paycheck.post_tax_deductions?.other_post_tax_deductions || paycheck.post_tax_deductions?.other || paycheck.postTaxDeductions?.other) || 0,
        },
        netAmount: Number(paycheck.net_amount || paycheck.netAmount) || 0,
        payDate: paycheck.pay_date || paycheck.payDate || "",
        source: paycheck.source_system || paycheck.source || "Other",
      };

      // Try to normalize payDate to YYYY-MM-DD format
      if (processedPaycheck.payDate) {
        try {
          // If it's already in YYYY-MM-DD format, keep it
          if (/^\d{4}-\d{2}-\d{2}$/.test(processedPaycheck.payDate)) {
            // Already in correct format
          } else {
            // Try to parse and format it
            const date = new Date(processedPaycheck.payDate);
            if (!isNaN(date.getTime())) {
              processedPaycheck.payDate = date.toISOString().split('T')[0];
            }
          }
        } catch (e) {
          console.warn('Could not parse payDate:', processedPaycheck.payDate);
        }
      }

      console.log(`Paycheck ${index + 1} pre-tax deductions:`, paycheck.pre_tax_deductions || paycheck.preTaxDeductions);
      console.log(`Mapped 401k: ${processedPaycheck.preTaxDeductions['401k']}, employer match: ${processedPaycheck.preTaxDeductions.employer401kMatch}`);

      console.log(`Processed paycheck ${index + 1}:`, {
        gross: processedPaycheck.grossAmount,
        net: processedPaycheck.netAmount,
        source: processedPaycheck.source,
        payDate: processedPaycheck.payDate
      });

      return processedPaycheck;
    })
    .filter((paycheck): paycheck is PaycheckData => paycheck !== null);

    console.log(`Returning ${validatedPaychecks.length} validated paychecks`);
    return validatedPaychecks;

  } catch (aiError) {
    // Check if it's a rate limit or quota error
    const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
      throw new Error(
        `🤖 API Rate Limit Exceeded!\n\n` +
        `You've hit the free tier limit (20 requests/day).\n\n` +
        `🔄 Switch to OCR Processing:\n\n` +
        `1. Run: node ocr_processor.js your_file.pdf\n` +
        `2. Copy the JSON output\n` +
        `3. Click "📄 Import JSON" in the web app\n\n` +
        `OCR processes files locally with no API limits!`
      );
    }

    // Re-throw other AI errors
    throw aiError;
  }
}