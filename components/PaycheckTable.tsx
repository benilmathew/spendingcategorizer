import React from 'react';
import { PaycheckData } from '../types';

interface PaycheckTableProps {
  paychecks: PaycheckData[];
}

const PaycheckTable: React.FC<PaycheckTableProps> = ({ paychecks }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US');
    } catch {
      return dateString;
    }
  };

  if (paychecks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No paycheck data available. Upload a pay statement to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pay Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pay Period
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Source
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Gross
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Taxes
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Pre-Tax
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Post-Tax
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Net
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {paychecks.map((paycheck) => {
            const totalTaxes = paycheck.federalTax + paycheck.stateTax + paycheck.localTax + paycheck.medicare + paycheck.socialSecurity;
            const totalPreTax = paycheck.preTaxDeductions['401k'] + paycheck.preTaxDeductions.healthInsurance + paycheck.preTaxDeductions.other;
            const totalPostTax = paycheck.postTaxDeductions.garnishments + paycheck.postTaxDeductions.other;

            return (
              <tr key={paycheck.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(paycheck.payDate)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {paycheck.payPeriod}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {paycheck.source}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  {formatCurrency(paycheck.grossAmount)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-red-600">
                  {formatCurrency(totalTaxes)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-orange-600">
                  {formatCurrency(totalPreTax)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-yellow-600">
                  {formatCurrency(totalPostTax)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-green-600">
                  {formatCurrency(paycheck.netAmount)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PaycheckTable;