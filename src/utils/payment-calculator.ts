/**
 * Payment calculation utilities
 * Centralized payment calculation logic to ensure consistency across the application
 */

interface PaymentData {
  first_payment?: number | string | null;
  second_payment?: number | string | null;
  final_payment?: number | string | null;
  additional_payment?: number | string | null;
  amount?: number | string | null;
}

/**
 * Calculate total paid amount from payment records
 * Handles both payment type fields (first_payment, second_payment, etc.) and amount field
 * 
 * @param payments - Array of payment objects
 * @returns Total paid amount as a number
 */
export function calculateTotalPaid(payments: PaymentData[] | null | undefined): number {
  if (!payments || payments.length === 0) {
    return 0;
  }

  return payments.reduce((total, payment) => {
    // If payment has an 'amount' field, use it (for newer payment records)
    if (payment.amount !== null && payment.amount !== undefined) {
      return total + parseFloat(String(payment.amount));
    }

    // Otherwise, sum up all payment type fields (for older records or specific payment types)
    // Convert null/undefined to 0 before parseFloat to avoid NaN
    const first = payment.first_payment != null ? parseFloat(String(payment.first_payment)) : 0;
    const second = payment.second_payment != null ? parseFloat(String(payment.second_payment)) : 0;
    const final = payment.final_payment != null ? parseFloat(String(payment.final_payment)) : 0;
    const additional = payment.additional_payment != null ? parseFloat(String(payment.additional_payment)) : 0;
    
    return total + first + second + final + additional;
  }, 0);
}

/**
 * Calculate payment percentage
 * 
 * @param totalPaid - Total amount paid
 * @param orderAmount - Total order amount
 * @returns Payment percentage as a number (0-100)
 */
export function calculatePaymentPercentage(
  totalPaid: number,
  orderAmount: number
): number {
  if (orderAmount <= 0) {
    return 0;
  }
  return (totalPaid / orderAmount) * 100;
}

/**
 * Check if payment threshold is met for dispatch
 * 
 * @param totalPaid - Total amount paid
 * @param orderAmount - Total order amount
 * @param threshold - Threshold percentage (default: 0.65 for 65%)
 * @returns True if threshold is met
 */
export function isDispatchThresholdMet(
  totalPaid: number,
  orderAmount: number,
  threshold: number = 0.65
): boolean {
  if (orderAmount <= 0) {
    return false;
  }
  return totalPaid >= orderAmount * threshold;
}


