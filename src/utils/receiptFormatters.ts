/**
 * Utility functions for receipt formatting
 * Pure functions with no side effects for better testability and reusability
 */

export const formatCurrency = (amount: number): string => {
  return `Rs. ${amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getPaymentTypeLabel = (paymentType: string): string => {
  const typeMap: Record<string, string> = {
    'first_payment': 'First Payment (Advance)',
    'second_payment': 'Second Payment',
    'final_payment': 'Final Payment',
    'additional_payment': 'Additional Payment',
  };
  return typeMap[paymentType] || paymentType;
};

/**
 * Maps database payment method values to printed labels for receipts
 */
export const getPaymentMethodLabel = (method: string): string => {
  const methodMap: Record<string, string> = {
    'cash': 'CASH',
    'bank_transfer': 'BANK/NEFT/RTGS/UPI',
    'cheque': 'CHEQUE',
    'online': 'ONLINE',
    'upi': 'UPI',
    'card': 'CARD',
  };
  return methodMap[method?.toLowerCase()] || 'BANK/NEFT/RTGS/UPI';
};

/**
 * Converts number to words for Indian currency
 */
export const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Rupees Only';
  
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  const convertLessThanThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convertLessThanThousand(n % 100) : '');
  };
  
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const remainder = Math.floor(num % 1000);
  
  let result = '';
  if (crore > 0) result += convertLessThanThousand(crore) + ' Crore ';
  if (lakh > 0) result += convertLessThanThousand(lakh) + ' Lakh ';
  if (thousand > 0) result += convertLessThanThousand(thousand) + ' Thousand ';
  if (remainder > 0) result += convertLessThanThousand(remainder);
  
  return 'Rupees ' + result.trim() + ' Only';
};


