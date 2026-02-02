
import React from 'react';
import { CategorySummary } from '../types';

interface Props {
  item: CategorySummary;
}

const CategorySummaryComponent: React.FC<Props> = ({ item }) => {
  return (
    <div className="flex items-center gap-4 group">
      <div 
        className="w-2 h-10 rounded-full transition-all group-hover:scale-110" 
        style={{ backgroundColor: item.color }} 
      />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <p className="text-sm font-semibold text-gray-800 truncate">{item.category}</p>
          <p className="text-sm font-bold text-gray-900">${item.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-xs text-gray-500">{item.count} transactions</p>
          <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
             <div 
                className="h-full rounded-full" 
                style={{ backgroundColor: item.color, width: '60%' }} // Note: this could be percentage of total
             />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategorySummaryComponent;
