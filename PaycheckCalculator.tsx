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
  const [processingProgress, setProcessingProgress] = useState<{ current: number; total: number; fileName?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonImportText, setJsonImportText] = useState('');

  // Default to current year-month
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return month;
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

  // Function to import OCR data from file
  const importOCRData = () => {
    // Create a hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.multiple = true; // Allow multiple file selection
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        let totalImported = 0;
        let processedFiles = 0;
        let detectedMonth: string | null = null;

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const importedData = JSON.parse(e.target?.result as string);

              // Detect month from folder name (e.g., "JanOCR/ocr_file.json" -> "Jan")
              const filePath = file.webkitRelativePath || file.name;
              const monthMatch = filePath.match(/^([A-Za-z]+)OCR\//);
              if (monthMatch && !detectedMonth) {
                const monthName = monthMatch[1];
                // Convert month name to YYYY-MM format
                const monthMap: { [key: string]: string } = {
                  'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
                  'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
                };
                const monthNum = monthMap[monthName];
                if (monthNum) {
                  const currentYear = new Date().getFullYear();
                  detectedMonth = `${currentYear}-${monthNum}`;
                }
              }

              processOCRData(importedData, detectedMonth);
              totalImported += Array.isArray(importedData) ? importedData.length : 1;
            } catch (error) {
              setError(`❌ Failed to parse ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            } finally {
              processedFiles++;
              if (processedFiles === files.length && totalImported > 0) {
                let successMessage = `✅ Successfully imported ${totalImported} paycheck(s) from ${files.length} OCR file(s)!`;
                if (detectedMonth) {
                  successMessage += ` Auto-detected month: ${detectedMonth}`;
                }
                setError(successMessage);
                setTimeout(() => setError(null), 3000);
              }
            }
          };
          reader.readAsText(file);
        }
      }
    };
    input.click();
  };

  // Function to process OCR data
  const processOCRData = (importedData: any, detectedMonth?: string) => {
    const paychecksToAdd = Array.isArray(importedData) ? importedData : [importedData];

    // Convert imported data to PaycheckData format
    const formattedPaychecks: PaycheckData[] = paychecksToAdd.map((data: any, index: number) => ({
      id: `ocr-imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
      payPeriod: data.pay_period || data.payPeriod || "",
      grossAmount: Number(data.gross_amount || data.grossAmount) || 0,
      federalTax: Number(data.federal_tax_amount || data.federalTax) || 0,
      stateTax: Number(data.state_tax_amount || data.stateTax) || 0,
      localTax: Number(data.local_tax_amount || data.localTax) || 0,
      medicare: (() => {
        const fsaAmount = Number(data.employee_fsa_contribution || data.fsa_contribution || data.preTaxDeductions?.fsa) || 0;
        const medicareAmount = Number(data.medicare_amount || data.medicare) || 0;
        // If FSA captured the medicare amount, don't double-count it
        return fsaAmount > 0 ? 0 : medicareAmount;
      })(),
      socialSecurity: Number(data.social_security_amount || data.socialSecurity) || 0,
      preTaxDeductions: {
        '401k': Number(data.employee_401k_contribution || data.preTaxDeductions?.['401k']) || 0,
        employer401kMatch: Number(data.employer_401k_match || data.preTaxDeductions?.employer401kMatch) || 0,
        hsa: Number(data.employee_hsa_contribution || data.hsa_contribution || data.preTaxDeductions?.hsa) || 0,
        employerHsaMatch: Number(data.employer_hsa_match || data.preTaxDeductions?.employerHsaMatch) || 0,
        fsa: Number(data.employee_fsa_contribution || data.fsa_contribution || data.preTaxDeductions?.fsa) || 0,
        employerFsaMatch: Number(data.employer_fsa_match || data.preTaxDeductions?.employerFsaMatch) || 0,
        healthInsurance: Number(data.health_insurance || data.preTaxDeductions?.healthInsurance) || 0,
        other: Number(data.other_pre_tax_deductions || data.preTaxDeductions?.other || data.dental_insurance || data.vision_insurance) || 0,
      },
      postTaxDeductions: {
        garnishments: Number(data.garnishments || data.postTaxDeductions?.garnishments) || 0,
        other: Number(data.other_post_tax_deductions || data.postTaxDeductions?.other) || 0,
      },
      netAmount: Number(data.net_amount || data.netAmount) || 0,
      payDate: detectedMonth ? `${detectedMonth}-01` : (data.pay_date || data.payDate || ""),
      source: 'OCR' as const,
    }));

    setPaychecks(prev => [...formattedPaychecks, ...prev]);
    // Success message is now handled in importOCRData function
  };

  // Migrate existing paychecks to include HSA fields
  useEffect(() => {
    if (paychecks.length > 0) {
      const needsMigration = paychecks.some(paycheck => 
        !paycheck.preTaxDeductions.hasOwnProperty('hsa') || 
        !paycheck.preTaxDeductions.hasOwnProperty('employerHsaMatch') ||
        !paycheck.preTaxDeductions.hasOwnProperty('fsa') ||
        !paycheck.preTaxDeductions.hasOwnProperty('employerFsaMatch') ||
        (paycheck.preTaxDeductions.fsa > 0 && paycheck.medicare > 0) // Double-counting issue
      );

      if (needsMigration) {
        const migratedPaychecks = paychecks.map(paycheck => {
          const fsa = paycheck.preTaxDeductions.fsa || 0;
          const medicare = paycheck.medicare || 0;
          
          return {
            ...paycheck,
            medicare: fsa > 0 ? 0 : medicare, // If FSA has value, medicare should be 0
            preTaxDeductions: {
              '401k': paycheck.preTaxDeductions['401k'] || 0,
              employer401kMatch: paycheck.preTaxDeductions.employer401kMatch || 0,
              hsa: paycheck.preTaxDeductions.hsa || 0,
              employerHsaMatch: paycheck.preTaxDeductions.employerHsaMatch || 0,
              fsa: paycheck.preTaxDeductions.fsa || 0,
              employerFsaMatch: paycheck.preTaxDeductions.employerFsaMatch || 0,
              healthInsurance: paycheck.preTaxDeductions.healthInsurance || 0,
              other: paycheck.preTaxDeductions.other || 0,
            }
          };
        });
        setPaychecks(migratedPaychecks);
      }
    }
  }, [paychecks.length > 0 ? paychecks[0]?.id : null]); // Only run when paychecks change

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

  const handleJsonImport = () => {
    try {
      const importedData = JSON.parse(jsonImportText);
      const paychecksToAdd = Array.isArray(importedData) ? importedData : [importedData];

      // Convert imported data to PaycheckData format
      const formattedPaychecks: PaycheckData[] = paychecksToAdd.map((data: any, index: number) => ({
        id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
        payPeriod: data.pay_period || data.payPeriod || "",
        grossAmount: Number(data.gross_amount || data.grossAmount) || 0,
        federalTax: Number(data.federal_tax_amount || data.federalTax) || 0,
        stateTax: Number(data.state_tax_amount || data.stateTax) || 0,
        localTax: Number(data.local_tax_amount || data.localTax) || 0,
        medicare: (() => {
          const fsaAmount = Number(data.employee_fsa_contribution || data.fsa_contribution || data.preTaxDeductions?.fsa) || 0;
          const medicareAmount = Number(data.medicare_amount || data.medicare) || 0;
          // If FSA captured the medicare amount, don't double-count it
          return fsaAmount > 0 ? 0 : medicareAmount;
        })(),
        socialSecurity: Number(data.social_security_amount || data.socialSecurity) || 0,
        preTaxDeductions: {
          '401k': Number(data.employee_401k_contribution || data.preTaxDeductions?.['401k']) || 0,
          employer401kMatch: Number(data.employer_401k_match || data.preTaxDeductions?.employer401kMatch) || 0,
          hsa: Number(data.employee_hsa_contribution || data.hsa_contribution || data.preTaxDeductions?.hsa) || 0,
          employerHsaMatch: Number(data.employer_hsa_match || data.preTaxDeductions?.employerHsaMatch) || 0,
          fsa: Number(data.employee_fsa_contribution || data.fsa_contribution || data.preTaxDeductions?.fsa) || 0,
          employerFsaMatch: Number(data.employer_fsa_match || data.preTaxDeductions?.employerFsaMatch) || 0,
          healthInsurance: Number(data.health_insurance || data.preTaxDeductions?.healthInsurance) || 0,
          other: Number(data.other_pre_tax_deductions || data.preTaxDeductions?.other || data.dental_insurance || data.vision_insurance) || 0,
        },
        postTaxDeductions: {
          garnishments: Number(data.garnishments || data.postTaxDeductions?.garnishments) || 0,
          other: Number(data.other_post_tax_deductions || data.postTaxDeductions?.other) || 0,
        },
        netAmount: Number(data.net_amount || data.netAmount) || 0,
        payDate: data.pay_date || data.payDate || "",
        source: data.source_system || data.source || "Imported",
      }));

      setPaychecks(prev => [...formattedPaychecks, ...prev]);
      setShowJsonImport(false);
      setJsonImportText('');
      setError(null);
    } catch (err) {
      setError(`Invalid JSON format: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    // Validate file count (up to 8 total files)
    if (files.length > 8) {
      setError("Please upload a maximum of 8 files at once.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProcessingProgress({ current: 0, total: files.length });

    try {
      const allNewPaychecks: PaycheckData[] = [];
      const failedFiles: string[] = [];
      let processedCount = 0;

      // Process files sequentially to avoid overwhelming the API
      for (const file of files) {
        setProcessingProgress({ current: processedCount, total: files.length, fileName: file.name });

        try {

          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = (e.target?.result as string);
              if (!result) {
                reject(new Error('Empty file result'));
                return;
              }
              const base64Data = result.split(',')[1];
              if (!base64Data) {
                reject(new Error('Invalid file format'));
                return;
              }
              resolve(base64Data);
            };
            reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
            reader.readAsDataURL(file);
          });

          const newPaychecks = await processPaycheck(base64, file.type, selectedMonth);

          if (newPaychecks.length > 0) {
            allNewPaychecks.push(...newPaychecks);
          } else {
            console.warn(`No paychecks found in ${file.name}`);
            failedFiles.push(file.name);
          }

        } catch (fileError) {
          console.error(`Error processing file ${file.name}:`, fileError);
          failedFiles.push(file.name);
        }

        processedCount++;
        setProcessingProgress({ current: processedCount, total: files.length });
      }

      // Show results
      if (allNewPaychecks.length > 0) {
        setPaychecks(prev => {
          const newState = [...allNewPaychecks, ...prev];
          return newState;
        });
        setError(null);

        if (failedFiles.length > 0) {
          setError(`Successfully processed ${allNewPaychecks.length} paychecks, but failed to process: ${failedFiles.join(', ')}`);
        }
      } else {
        setError(`No paycheck data found in any of the uploaded files. Please ensure they are clear images or PDFs of pay statements. Failed files: ${failedFiles.join(', ')}`);
      }

    } catch (err) {
      console.error('Critical error during batch processing:', err);
      setError(`Critical error: ${err instanceof Error ? err.message : 'Unknown error occurred'}`);
    } finally {
      // Keep progress visible for a moment to show completion
      setTimeout(() => {
        setIsProcessing(false);
        setProcessingProgress(null);
      }, 1000);
      // Clear the input so the same files can be uploaded again if needed
      event.target.value = '';
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
            Upload multiple pay statements from Workday or ADP to analyze your earnings, taxes, and deductions
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
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={isProcessing}
                />
                <div className={`flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                  isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}>
                  <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                  {isProcessing && processingProgress
                    ? `Processing ${processingProgress.current}/${processingProgress.total}...`
                    : isProcessing
                    ? 'Processing...'
                    : 'Upload Pay Statements'}
                </div>
              </label>

              <button
                onClick={() => setShowJsonImport(true)}
                className="flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                disabled={isProcessing}
              >
                📄 Import JSON
              </button>

              <button
                onClick={importOCRData}
                className="flex items-center px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-green-50 hover:bg-green-100"
                disabled={isProcessing}
              >
                🤖 Import OCR Files
              </button>

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
                {error.includes('OCR') && (
                  <div className="mt-2">
                    <p className="text-sm text-red-700">
                      💡 Try the standalone OCR processor:
                    </p>
                    <code className="block mt-1 p-2 bg-red-100 text-red-900 rounded text-xs">
                      node ocr_processor.js your_file.pdf
                    </code>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <div className="ml-3">
                <p className="text-sm text-blue-800">
                  {processingProgress
                    ? processingProgress.fileName
                      ? `Processing "${processingProgress.fileName}"... (${processingProgress.current}/${processingProgress.total} completed)`
                      : `Processing pay statements... (${processingProgress.current}/${processingProgress.total} completed)`
                    : 'Processing your pay statements...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <PaycheckSummary paychecks={monthPaychecks} />

        {/* All Paychecks Summary (if different from month view) */}
        {paychecks.length > monthPaychecks.length && (
          <div className="mt-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-800">
                    <strong>All Paychecks Total:</strong> You have {paychecks.length} paychecks total, but only {monthPaychecks.length} are shown for {formattedSelectedMonth}.
                    Total 401k across all paychecks: ${paychecks.reduce((sum, p) => sum + p.preTaxDeductions['401k'], 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <PaycheckSummary paychecks={paychecks} />
            </div>
          </div>
        )}

        {/* Paycheck Table */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Paycheck Details - {formattedSelectedMonth}
                {paychecks.length > monthPaychecks.length && (
                  <span className="text-sm text-gray-500 ml-2">
                    (showing {monthPaychecks.length} of {paychecks.length} total)
                  </span>
                )}
              </h3>
            </div>
            <div className="p-6">
              <PaycheckTable paychecks={monthPaychecks} />
            </div>
          </div>
        </div>

        {/* All Paychecks Table (if different from month view) */}
        {paychecks.length > monthPaychecks.length && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  All Paycheck Details (All Months)
                </h3>
              </div>
              <div className="p-6">
                <PaycheckTable paychecks={paychecks} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Import Paycheck Data from JSON</h3>
              <p className="text-sm text-gray-600 mb-4">
                Paste JSON data from the OCR processor or any compatible format.
              </p>
              <textarea
                value={jsonImportText}
                onChange={(e) => setJsonImportText(e.target.value)}
                placeholder='Paste JSON here... e.g. [{"gross_amount": 5000, "employee_401k_contribution": 1000, ...}]'
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
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Import Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaycheckCalculator;