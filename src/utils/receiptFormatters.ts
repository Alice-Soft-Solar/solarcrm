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
    'first_payment': 'First Payment',
    'second_payment': 'Second Payment',
    'final_payment': 'Final Payment',
    'additional_payment': 'Additional Payment',
  };
  return typeMap[paymentType] || paymentType;
};


