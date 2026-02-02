import { GoogleGenAI } from "@google/genai";
import { PaycheckData } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processPaycheck(
  fileBase64: string,
  mimeType: string,
  targetMonth: string // Format: YYYY-MM
): Promise<PaycheckData[]> {
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
      * 401k contribution
      * Health insurance
      * Other pre-tax deductions
    - Post-tax deductions:
      * Garnishments
      * Other post-tax deductions
    - Net amount (take-home pay)
    - Pay date
    - Source system (Workday, ADP, or Other)

    IMPORTANT:
    - Return amounts as numbers (remove $ signs and commas)
    - If a field is not present or zero, use 0
    - Pay period should be in format "MM/DD/YYYY - MM/DD/YYYY"
    - Pay date should be in YYYY-MM-DD format
    - If multiple paychecks in one statement, extract all of them
    - Return valid JSON array of paycheck objects
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

  // Extract JSON from the response
  const jsonMatch = text.match(/\[[\s\S]*\]/) || text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No valid JSON found in AI response");
  }

  let parsedData;
  try {
    parsedData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Failed to parse JSON:", jsonMatch[0]);
    throw new Error("Invalid JSON response from AI");
  }

  // Ensure we have an array
  const paychecks = Array.isArray(parsedData) ? parsedData : [parsedData];

  // Validate and clean the data
  return paychecks.map((paycheck: any, index: number) => ({
    id: `${targetMonth}-${Date.now()}-${index}`,
    payPeriod: paycheck.payPeriod || "",
    grossAmount: Number(paycheck.grossAmount) || 0,
    federalTax: Number(paycheck.federalTax) || 0,
    stateTax: Number(paycheck.stateTax) || 0,
    localTax: Number(paycheck.localTax) || 0,
    medicare: Number(paycheck.medicare) || 0,
    socialSecurity: Number(paycheck.socialSecurity) || 0,
    preTaxDeductions: {
      '401k': Number(paycheck.preTaxDeductions?.['401k']) || 0,
      healthInsurance: Number(paycheck.preTaxDeductions?.healthInsurance) || 0,
      other: Number(paycheck.preTaxDeductions?.other) || 0,
    },
    postTaxDeductions: {
      garnishments: Number(paycheck.postTaxDeductions?.garnishments) || 0,
      other: Number(paycheck.postTaxDeductions?.other) || 0,
    },
    netAmount: Number(paycheck.netAmount) || 0,
    payDate: paycheck.payDate || "",
    source: paycheck.source || "Other",
  }));
}