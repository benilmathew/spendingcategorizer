import { DEFAULT_CATEGORIES, Transaction } from './types';

type RawTransaction = Omit<Transaction, 'id' | 'category'> & { category?: string };

function normalizeMerchant(merchant: string): string {
  return merchant.replace(/\s+/g, ' ').trim();
}

function findMappedCategory(
  merchant: string,
  userMappings: Record<string, string>
): string | null {
  const normalizedMerchant = normalizeMerchant(merchant);

  if (userMappings[normalizedMerchant]) return userMappings[normalizedMerchant];

  const lower = normalizedMerchant.toLowerCase();
  for (const [key, category] of Object.entries(userMappings)) {
    if (key.toLowerCase() === lower) return category;
  }

  return null;
}

function keywordCategory(merchant: string): string | null {
  const m = merchant.toLowerCase();

  const rules: Array<[string, string[]]> = [
    [
      'Food & Groceries',
      [
        'grocery',
        'supermarket',
        'market',
        'whole foods',
        'trader joe',
        'kroger',
        'safeway',
        'aldi',
        'publix',
        'costco',
        'walmart',
        'target'
      ]
    ],
    [
      'Eating Out',
      ['restaurant', 'cafe', 'coffee', 'starbucks', 'chipotle', 'mcdonald', 'doordash', 'uber eats', 'grubhub']
    ],
    ['Transport & Fuel', ['uber', 'lyft', 'shell', 'exxon', 'chevron', 'bp', 'valero', 'gas', 'fuel', 'parking', 'toll']],
    ['Utilities & Bills', ['utility', 'electric', 'water', 'internet', 'verizon', 'comcast', 'xfinity', 'att', 'tmobile']],
    ['Subscriptions', ['subscription', 'netflix', 'spotify', 'hulu', 'disney', 'prime', 'apple.com/bill', 'google *', 'google storage']],
    ['Shopping', ['amazon', 'amzn', 'best buy', 'ebay', 'etsy', 'ikea']],
    ['Entertainment', ['movie', 'cinema', 'theater', 'ticketmaster', 'concert']],
    ['Health & Wellness', ['pharmacy', 'cvs', 'walgreens', 'fitness', 'gym', 'planet fitness']],
    ['Travel', ['airlines', 'delta', 'united', 'american airlines', 'hotel', 'marriott', 'hilton', 'airbnb', 'expedia']],
    ['Education', ['tuition', 'udemy', 'coursera', 'college', 'university']]
  ];

  for (const [category, keywords] of rules) {
    if (keywords.some((k) => m.includes(k))) return category;
  }

  return null;
}

export function categorizeTransaction(
  merchant: string,
  amount: number,
  userMappings: Record<string, string>
): string {
  const normalizedMerchant = normalizeMerchant(merchant);

  if (!normalizedMerchant) return 'Unknown';

  // If it looks like a payment/credit/refund, prefer that category.
  const lower = normalizedMerchant.toLowerCase();
  if (
    amount < 0 ||
    /(payment|autopay|credit|refund|returned|reversal)\b/.test(lower)
  ) {
    return 'Payment/Credit';
  }

  const mapped = findMappedCategory(normalizedMerchant, userMappings);
  if (mapped && DEFAULT_CATEGORIES.includes(mapped)) return mapped;

  const byKeyword = keywordCategory(normalizedMerchant);
  if (byKeyword) return byKeyword;

  return 'Unknown';
}

export function finalizeTransactions(
  raw: RawTransaction[],
  userMappings: Record<string, string>
): Transaction[] {
  return raw
    .map((t, index) => {
      const merchant = normalizeMerchant(t.merchant);
      const amount = Number(t.amount) || 0;
      const category = categorizeTransaction(merchant, amount, userMappings);

      return {
        id: `${Date.now()}-${index}`,
        date: t.date,
        merchant,
        amount: Math.abs(amount),
        category,
        originalCategory: t.category
      };
    })
    .filter((t) => !!t.date && /^\d{4}-\d{2}-\d{2}$/.test(t.date));
}

// Very small CSV parser that handles quoted fields.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && (char === ',' || char === '\t')) {
      row.push(field);
      field = '';
      continue;
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((v) => v.trim() !== '')) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((v) => v.trim() !== '')) rows.push(row);
  return rows;
}

function pickHeaderIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = normalized.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

function toIsoDate(value: string, fallbackYear: number): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // MM/DD/YYYY or MM/DD/YY or MM/DD
  const mdy = v.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
  if (mdy) {
    const month = String(parseInt(mdy[1], 10)).padStart(2, '0');
    const day = String(parseInt(mdy[2], 10)).padStart(2, '0');
    let year = fallbackYear;
    if (mdy[3]) {
      const y = parseInt(mdy[3], 10);
      year = y < 100 ? 2000 + y : y;
    }
    return `${year}-${month}-${day}`;
  }

  // "Jan 15" or "Jan 15 2026"
  const mon = v.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s+(\d{4}))?$/);
  if (mon) {
    const monthName = mon[1].toLowerCase();
    const monthMap: Record<string, number> = {
      jan: 1,
      january: 1,
      feb: 2,
      february: 2,
      mar: 3,
      march: 3,
      apr: 4,
      april: 4,
      may: 5,
      jun: 6,
      june: 6,
      jul: 7,
      july: 7,
      aug: 8,
      august: 8,
      sep: 9,
      sept: 9,
      september: 9,
      oct: 10,
      october: 10,
      nov: 11,
      november: 11,
      dec: 12,
      december: 12
    };
    const monthNum = monthMap[monthName];
    if (!monthNum) return null;
    const month = String(monthNum).padStart(2, '0');
    const day = String(parseInt(mon[2], 10)).padStart(2, '0');
    const year = mon[3] ? parseInt(mon[3], 10) : fallbackYear;
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function parseTransactionsFromCsv(
  csvText: string,
  targetMonth: string
): Array<{ date: string; merchant: string; amount: number }> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const dateIdx = pickHeaderIndex(headers, ['date', 'transaction date', 'posted date', 'trans date']);
  const merchantIdx = pickHeaderIndex(headers, ['merchant', 'description', 'name', 'memo']);
  const amountIdx = pickHeaderIndex(headers, ['amount', 'transaction amount', 'amt']);
  const debitIdx = pickHeaderIndex(headers, ['debit']);
  const creditIdx = pickHeaderIndex(headers, ['credit']);

  const [yearStr] = targetMonth.split('-');
  const fallbackYear = parseInt(yearStr, 10);

  const dataRows = rows.slice(1);
  const parsed: Array<{ date: string; merchant: string; amount: number }> = [];

  for (const r of dataRows) {
    const dateRaw = dateIdx >= 0 ? (r[dateIdx] ?? '') : '';
    const merchantRaw = merchantIdx >= 0 ? (r[merchantIdx] ?? '') : '';

    const iso = toIsoDate(dateRaw, fallbackYear);
    if (!iso || !iso.startsWith(targetMonth)) continue;

    let amount = 0;
    if (amountIdx >= 0 && r[amountIdx] != null && String(r[amountIdx]).trim() !== '') {
      amount = Number(String(r[amountIdx]).replace(/[$,]/g, ''));
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? Number(String(r[debitIdx] ?? '').replace(/[$,]/g, '')) : 0;
      const credit = creditIdx >= 0 ? Number(String(r[creditIdx] ?? '').replace(/[$,]/g, '')) : 0;
      // debit is spending (+), credit is money back (-)
      amount = (Number.isFinite(debit) ? debit : 0) - (Number.isFinite(credit) ? credit : 0);
    }

    if (!Number.isFinite(amount)) amount = 0;
    if (!merchantRaw.trim()) continue;

    parsed.push({ date: iso, merchant: merchantRaw, amount });
  }

  return parsed;
}

