
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, DEFAULT_CATEGORIES } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function processStatement(
  fileBase64: string,
  mimeType: string,
  userMappings: Record<string, string>,
  targetMonth: string // Format: YYYY-MM
): Promise<Transaction[]> {
  const model = "gemini-3-flash-preview";
  const [year, month] = targetMonth.split('-');
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const targetMonthName = monthNames[parseInt(month) - 1];

  const mappingsString = Object.entries(userMappings)
    .map(([m, c]) => `"${m}" -> "${c}"`)
    .join(", ");

  const prompt = `
    Extract all transactions from this credit card statement specifically for ${targetMonthName} ${year}. 
    For each transaction, provide the date, merchant name, and amount.
    Categorize each transaction using one of these categories: [${DEFAULT_CATEGORIES.join(", ")}].
    
    IMPORTANT DATE CONTEXT:
    - The target statement month is ${targetMonthName} ${year}.
    - Ensure dates are returned in YYYY-MM-DD format.
    - If a date on the statement is partial (e.g., "Jan 15"), assume the year is ${year}.
    
    SPECIAL INSTRUCTIONS:
    1. Label any transaction that is a payment to the card, a credit, or a refund as "Payment/Credit".
    2. If the merchant matches any of these known user mappings, ALWAYS use the provided category: ${mappingsString}.
    3. If a merchant is not in the mappings, use your best judgment to pick a category from the list.
    4. Return valid JSON.
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
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
            merchant: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING },
          },
          required: ["date", "merchant", "amount", "category"],
        },
      },
    },
  });

  try {
    const rawData = JSON.parse(response.text || "[]");
    return rawData.map((item: any, index: number) => ({
      id: `${Date.now()}-${index}`,
      date: item.date,
      merchant: item.merchant,
      amount: Math.abs(item.amount),
      category: DEFAULT_CATEGORIES.includes(item.category) ? item.category : "Unknown",
      originalCategory: item.category
    }));
  } catch (error) {
    console.error("Failed to parse Gemini response:", error);
    return [];
  }
}
