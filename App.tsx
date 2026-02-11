
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, DEFAULT_CATEGORIES, CATEGORY_COLORS } from './types';
import { processStatement } from './geminiService';
import { finalizeTransactions, parseTransactionsFromCsv } from './statementLocal';
import TransactionTable from './components/TransactionTable';
import SpendingChart from './components/SpendingChart';
import CategorySummary from './components/CategorySummary';
import { 
  CloudArrowUpIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userMappings, setUserMappings] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');
  
  // Default to current year-month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Helper for pretty date display
  const formattedSelectedMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    // Use base 10 for parseInt to be safe
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
  }, [selectedMonth]);

  // Load persistence data on mount
  useEffect(() => {
    const savedMappings = localStorage.getItem('smartspend_mappings');
    if (savedMappings) {
      setUserMappings(JSON.parse(savedMappings));
    }
    const savedTransactions = localStorage.getItem('smartspend_history');
    if (savedTransactions) {
      setTransactions(JSON.parse(savedTransactions));
    }
  }, []);

  // Save persistence data on change
  useEffect(() => {
    localStorage.setItem('smartspend_mappings', JSON.stringify(userMappings));
  }, [userMappings]);

  useEffect(() => {
    localStorage.setItem('smartspend_history', JSON.stringify(transactions));
  }, [transactions]);

  // Derived: Transactions belonging ONLY to the selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  const hashFile = async (file: File): Promise<string> => {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const readFileAsBase64 = async (file: File): Promise<string> => {
    const result = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result || ''));
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });

    const base64 = result.split(',')[1];
    if (!base64) throw new Error('Invalid file encoding (base64 missing)');
    return base64;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const isCsv =
        file.type === 'text/csv' ||
        file.name.toLowerCase().endsWith('.csv') ||
        file.type === 'application/vnd.ms-excel';

      if (isCsv) {
        const csvText = await file.text();
        const raw = parseTransactionsFromCsv(csvText, selectedMonth);
        const finalized = finalizeTransactions(raw, userMappings).filter(
          (t) => t.category !== 'Payment/Credit' && t.date.startsWith(selectedMonth)
        );

        if (finalized.length === 0) {
          setError(
            `No valid transactions for ${formattedSelectedMonth} were found in that CSV. ` +
              `Expected columns like "Date", "Description"/"Merchant", and "Amount" (or Debit/Credit).`
          );
        } else {
          setTransactions((prev) => [...finalized, ...prev]);
        }

        setIsProcessing(false);
        event.target.value = '';
        return;
      }

      const fileHash = await hashFile(file);
      const cacheKey = `smartspend_ai_cache:v1:${selectedMonth}:${file.type}:${fileHash}`;
      const cached = localStorage.getItem(cacheKey);

      let rawFromAi: Array<{ date: string; merchant: string; amount: number; category?: string }> = [];

      if (cached) {
        rawFromAi = JSON.parse(cached);
      } else {
        const base64 = await readFileAsBase64(file);
        const aiTransactions = await processStatement(base64, file.type, userMappings, selectedMonth);
        rawFromAi = aiTransactions.map((t) => ({
          date: t.date,
          merchant: t.merchant,
          amount: t.amount,
          category: t.category
        }));
        localStorage.setItem(cacheKey, JSON.stringify(rawFromAi));
      }

      const finalized = finalizeTransactions(rawFromAi, userMappings).filter(
        (t) => t.category !== 'Payment/Credit' && t.date.startsWith(selectedMonth)
      );

      if (rawFromAi.length === 0) {
        setError(`No transactions found in the statement. Please ensure it's a clear image or PDF.`);
      } else if (finalized.length === 0 && rawFromAi.length > 0) {
        setError(`No valid transactions for ${formattedSelectedMonth} were found. Detected items were outside this month or payments.`);
      } else {
        setTransactions((prev) => [...finalized, ...prev]);
      }

      setIsProcessing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process the statement. Please try again.");
      setIsProcessing(false);
    }
    // Reset input
    event.target.value = '';
  };

  const handleJsonImport = () => {
    try {
      const importedData = JSON.parse(jsonImportText);
      const items = Array.isArray(importedData) ? importedData : [importedData];

      const raw = items
        .map((d: any) => ({
          date: String(d.date || d.transaction_date || d.posted_date || '').trim(),
          merchant: String(d.merchant || d.description || d.name || '').trim(),
          amount: Number(d.amount ?? 0),
          category: d.category ? String(d.category) : undefined
        }))
        .filter((t) => !!t.date && !!t.merchant);

      const finalized = finalizeTransactions(raw, userMappings).filter(
        (t) => t.category !== 'Payment/Credit' && t.date.startsWith(selectedMonth)
      );

      if (finalized.length === 0) {
        setError(`No valid transactions for ${formattedSelectedMonth} were found in that JSON.`);
      } else {
        setTransactions((prev) => [...finalized, ...prev]);
        setError(null);
      }

      setShowJsonImport(false);
      setJsonImportText('');
    } catch (e) {
      setError(`Invalid JSON format: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const updateCategory = (id: string, newCategory: string) => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    setTransactions(prev => prev.map(t => 
      t.id === id ? { ...t, category: newCategory } : t
    ));

    setUserMappings(prev => ({
      ...prev,
      [transaction.merchant]: newCategory
    }));
  };

  const removeTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const clearMonth = () => {
    if (window.confirm(`Are you sure you want to clear all transactions for ${formattedSelectedMonth}?`)) {
      setTransactions(prev => prev.filter(t => !t.date.startsWith(selectedMonth)));
    }
  };

  const changeMonth = (offset: number) => {
    const [year, month] = selectedMonth.split('-').map(v => parseInt(v, 10));
    const date = new Date(year, month - 1 + offset);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const displayTransactions = useMemo(() => {
    return monthTransactions.filter(t => 
      t.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [monthTransactions, searchTerm]);

  const categoryTotals = useMemo(() => {
    const summary: Record<string, { total: number, count: number }> = {};
    monthTransactions.forEach(t => {
      if (!summary[t.category]) {
        summary[t.category] = { total: 0, count: 0 };
      }
      summary[t.category].total += t.amount;
      summary[t.category].count += 1;
    });

    return Object.entries(summary).map(([category, data]) => ({
      category,
      total: data.total,
      count: data.count,
      color: CATEGORY_COLORS[category] || CATEGORY_COLORS["Unknown"]
    })).sort((a, b) => b.total - a.total);
  }, [monthTransactions]);

  const grandTotal = useMemo(() => monthTransactions.reduce((sum, t) => sum + t.amount, 0), [monthTransactions]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SmartSpend AI</h1>
          <p className="text-gray-500">Intelligent categorization for your monthly statements.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Enhanced Month Selection */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <button 
              onClick={() => changeMonth(-1)}
              className="p-3 hover:bg-gray-50 text-gray-400 hover:text-indigo-600 transition-colors border-r border-gray-100"
              title="Previous Month"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="relative flex items-center px-4 py-1.5 min-w-[140px]">
              <div className="flex flex-col flex-1">
                <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-0.5">Active Month</span>
                <input 
                  type="month" 
                  className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer w-full"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
              <CalendarIcon className="h-4 w-4 text-gray-300 ml-2" />
            </div>

            <button 
              onClick={() => changeMonth(1)}
              className="p-3 hover:bg-gray-50 text-gray-400 hover:text-indigo-600 transition-colors border-l border-gray-100"
              title="Next Month"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          </div>

          <label className={`
            flex items-center gap-2 px-6 py-3 rounded-xl font-semibold shadow-sm transition-all cursor-pointer
            ${isProcessing ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-indigo-100'}
          `}>
            {isProcessing ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent" />
            ) : <CloudArrowUpIcon className="h-5 w-5" />}
            {isProcessing ? "Analyzing..." : `Upload for ${formattedSelectedMonth}`}
            <input 
              type="file" 
              className="hidden" 
              accept="image/*,application/pdf,text/csv,.csv" 
              onChange={handleFileUpload}
              disabled={isProcessing}
            />
          </label>

          <button
            onClick={() => setShowJsonImport(true)}
            className="px-4 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50"
            type="button"
          >
            Import JSON
          </button>
           
          {monthTransactions.length > 0 && (
            <button 
              onClick={clearMonth}
              className="p-3 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition-colors"
              title={`Clear ${formattedSelectedMonth} data`}
            >
              <TrashIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
          <ExclamationCircleIcon className="h-5 w-5 text-red-400 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {monthTransactions.length > 0 ? (
        <>
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 glass border border-white p-6 rounded-2xl shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Spending Distribution</h2>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">{formattedSelectedMonth}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Spent</p>
                  <p className="text-2xl font-bold text-indigo-600">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="h-64">
                <SpendingChart data={categoryTotals} />
              </div>
            </div>

            <div className="glass border border-white p-6 rounded-2xl shadow-sm overflow-y-auto max-h-[400px]">
              <h2 className="text-xl font-semibold mb-6">Category Summary</h2>
              <div className="space-y-4">
                {categoryTotals.map(item => (
                  <CategorySummary key={item.category} item={item} />
                ))}
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Transactions for {formattedSelectedMonth}</h2>
              <div className="relative">
                <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search merchant or category..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <TransactionTable 
              transactions={displayTransactions} 
              onCategoryChange={updateCategory} 
              onDelete={removeTransaction}
            />
            {displayTransactions.length === 0 && (
              <div className="py-12 text-center text-gray-500">
                No transactions match your search.
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-white border-2 border-dashed border-gray-200 rounded-3xl text-center space-y-4">
          <div className="bg-indigo-50 p-6 rounded-full">
            <CloudArrowUpIcon className="h-12 w-12 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900 font-display tracking-tight">Track your spending for {formattedSelectedMonth}</h3>
            <p className="text-gray-500 max-w-sm mx-auto mt-2">
              Use the month selector above to pick a period, then upload your credit card statement.
            </p>
          </div>
          <div className="flex flex-wrap justify-center items-center gap-4 pt-4">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>PERSISTENT TAG LEARNING</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <CheckCircleIcon className="h-4 w-4 text-green-500" />
              <span>STRICT {formattedSelectedMonth.toUpperCase()} FILTER</span>
            </div>
          </div>
        </div>
      )}

      {/* Persistence Note */}
      <footer className="text-center py-8">
        <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] font-bold">
          Local Storage Persistence • Multi-Month Tracker • Gemini AI Intelligence
        </p>
      </footer>

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Transactions from JSON</h3>
              <p className="text-sm text-gray-600 mb-4">
                Paste an array of items with <code>date</code>, <code>merchant</code>/<code>description</code>, and <code>amount</code>.
              </p>
              <textarea
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
                placeholder='Paste JSON here... e.g. [{"date":"2026-01-15","merchant":"Amazon","amount":42.10}]'
                className="w-full h-64 p-3 border border-gray-300 rounded-md font-mono text-sm"
                spellCheck={false}
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setShowJsonImport(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleJsonImport}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                >
                  Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
