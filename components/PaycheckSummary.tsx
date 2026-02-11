import React from 'react';
import { PaycheckData } from '../types';

interface PaycheckSummaryProps {
  paychecks: PaycheckData[];
}

const PaycheckSummary: React.FC<PaycheckSummaryProps> = ({ paychecks }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Calculate totals
  const totals = paychecks.reduce(
    (acc, paycheck) => {
      acc.gross += paycheck.grossAmount;
      acc.federalTax += paycheck.federalTax;
      acc.stateTax += paycheck.stateTax;
      acc.localTax += paycheck.localTax;
      acc.medicare += paycheck.medicare;
      acc.socialSecurity += paycheck.socialSecurity;
      acc.retirement401k += paycheck.preTaxDeductions['401k'];
      acc.employer401kMatch += paycheck.preTaxDeductions.employer401kMatch;
      acc.hsa += paycheck.preTaxDeductions.hsa;
      acc.employerHsaMatch += paycheck.preTaxDeductions.employerHsaMatch;
      acc.healthInsurance += paycheck.preTaxDeductions.healthInsurance;
      acc.otherPreTax += paycheck.preTaxDeductions.other;
      acc.garnishments += paycheck.postTaxDeductions.garnishments;
      acc.otherPostTax += paycheck.postTaxDeductions.other;
      acc.net += paycheck.netAmount;
      return acc;
    },
    {
      gross: 0,
      federalTax: 0,
      stateTax: 0,
      localTax: 0,
      medicare: 0,
      socialSecurity: 0,
      retirement401k: 0,
      employer401kMatch: 0,
      hsa: 0,
      employerHsaMatch: 0,
      healthInsurance: 0,
      otherPreTax: 0,
      garnishments: 0,
      otherPostTax: 0,
      net: 0,
    }
  );

  const totalTaxes = totals.federalTax + totals.stateTax + totals.localTax + totals.medicare + totals.socialSecurity;
  const totalPreTax = totals.retirement401k + totals.employer401kMatch + totals.hsa + totals.employerHsaMatch + totals.healthInsurance + totals.otherPreTax;
  const totalPostTax = totals.garnishments + totals.otherPostTax;
  const totalDeductions = totalTaxes + totalPreTax + totalPostTax;

  if (paychecks.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Paycheck Summary</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Pay */}
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-green-800">Gross Pay</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(totals.gross)}</div>
        </div>

        {/* Total Taxes */}
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-red-800">Total Taxes</div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(totalTaxes)}</div>
        </div>

        {/* Total Deductions */}
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-orange-800">Total Deductions</div>
          <div className="text-2xl font-bold text-orange-900">{formatCurrency(totalDeductions)}</div>
        </div>

        {/* Net Pay */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-sm font-medium text-blue-800">Net Pay</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(totals.net)}</div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tax Breakdown */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Tax Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Federal Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.federalTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">State Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.stateTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Local Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.localTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Medicare:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.medicare)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Social Security:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.socialSecurity)}</span>
            </div>
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Deductions Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">401k Employee:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.retirement401k)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">401k Employer Match:</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(totals.employer401kMatch)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">HSA Employee:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.hsa)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">HSA Employer Match:</span>
              <span className="text-sm font-medium text-green-600">{formatCurrency(totals.employerHsaMatch)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Health Insurance:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.healthInsurance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Other Pre-Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.otherPreTax)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Garnishments:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.garnishments)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Other Post-Tax:</span>
              <span className="text-sm font-medium">{formatCurrency(totals.otherPostTax)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Paycheck Count */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          Total Paychecks: <span className="font-medium">{paychecks.length}</span>
        </div>
      </div>
    </div>
  );
};

export default PaycheckSummary;