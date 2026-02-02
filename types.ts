
export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  category: string;
  originalCategory?: string; // What AI suggested initially
}

export interface PaycheckData {
  id: string;
  payPeriod: string;
  grossAmount: number;
  federalTax: number;
  stateTax: number;
  localTax: number;
  medicare: number;
  socialSecurity: number;
  preTaxDeductions: {
    '401k': number;
    healthInsurance: number;
    other: number;
  };
  postTaxDeductions: {
    garnishments: number;
    other: number;
  };
  netAmount: number;
  payDate: string;
  source: 'Workday' | 'ADP' | 'Other';
}

export interface PaycheckSummary {
  totalGross: number;
  totalNet: number;
  totalTaxes: number;
  totalDeductions: number;
  paycheckCount: number;
}

export interface CategorySummary {
  category: string;
  total: number;
  count: number;
  color: string;
}

export interface UserMapping {
  merchant: string;
  category: string;
}

export const DEFAULT_CATEGORIES = [
  "Food & Groceries",
  "Eating Out",
  "Transport & Fuel",
  "Health & Wellness",
  "Shopping",
  "Entertainment",
  "Utilities & Bills",
  "Rent/Mortgage",
  "Travel",
  "Unknown",
  "Subscriptions",
  "Education",
  "Payment/Credit"
];

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Groceries": "#10b981",
  "Eating Out": "#f59e0b",
  "Transport & Fuel": "#3b82f6",
  "Health & Wellness": "#ec4899",
  "Shopping": "#8b5cf6",
  "Entertainment": "#6366f1",
  "Utilities & Bills": "#ef4444",
  "Rent/Mortgage": "#14b8a6",
  "Travel": "#06b6d4",
  "Unknown": "#6b7280",
  "Subscriptions": "#f43f5e",
  "Education": "#84cc16",
  "Payment/Credit": "#94a3b8"
};
