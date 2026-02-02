import React, { useState, useEffect, useMemo } from 'react';
import { PaycheckData } from './types';
import { processPaycheck } from './paycheckService';
import PaycheckTable from './components/PaycheckTable';
import PaycheckSummary from './components/PaycheckSummary';
import {
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  TrashIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const PaycheckCalculator: React.FC = () => {
  const [paychecks, setPaychecks] = useState<PaycheckData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Load saved paychecks on mount
  useEffect(() => {
    const savedPaychecks = localStorage.getItem('paycheck_calculator_data');
    if (savedPaychecks) {
      setPaychecks(JSON.parse(savedPaychecks));
    }
  }, []);

  // Save paychecks on change
  useEffect(() => {
    localStorage.setItem('paycheck_calculator_data', JSON.stringify(paychecks));
  }, [paychecks]);

  // Filter paychecks by selected month
  const monthPaychecks = useMemo(() => {
    return paychecks.filter(paycheck => {
      if (!paycheck.payDate) return false;
      return paycheck.payDate.startsWith(selectedMonth);
    });
  }, [paychecks, selectedMonth]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const newPaychecks = await processPaycheck(base64, file.type, selectedMonth);

        if (newPaychecks.length === 0) {
          setError(`No paycheck data found in the statement. Please ensure it's a clear image or PDF of a pay statement.`);
        } else {
          setPaychecks(prev => [...newPaychecks, ...prev]);
        }
        setIsProcessing(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError("Failed to process the pay statement. Please try again.");
      setIsProcessing(false);
    }
  };

  const clearAllData = () => {
    setPaychecks([]);
    localStorage.removeItem('paycheck_calculator_data');
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    let newYear = year;
    let newMonth = month;

    if (direction === 'prev') {
      newMonth -= 1;
      if (newMonth < 1) {
        newMonth = 12;
        newYear -= 1;
      }
    } else {
      newMonth += 1;
      if (newMonth > 12) {
        newMonth = 1;
        newYear += 1;
      }
    }

    setSelectedMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Paycheck Calculator</h1>
          <p className="text-gray-600">
            Upload your pay statements from Workday or ADP to analyze your earnings and deductions
          </p>
        </div>

        {/* Month Navigation */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <span className="text-lg font-medium text-gray-900">{formattedSelectedMonth}</span>
              </div>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-4">
              <label className="relative cursor-pointer">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                <div className={`flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  {isProcessing ? 'Processing...' : 'Upload Pay Statement'}
                </div>
              </label>

              {paychecks.length > 0 && (
                <button
                  onClick={clearAllData}
                  className="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  <TrashIcon className="h-5 w-5 mr-2" />
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <ExclamationCircleIcon className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">Processing your pay statement...</p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <PaycheckSummary paychecks={monthPaychecks} />

        {/* Paycheck Table */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Paycheck Details - {formattedSelectedMonth}
              </h3>
            </div>
            <div className="p-6">
              <PaycheckTable paychecks={monthPaychecks} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaycheckCalculator;