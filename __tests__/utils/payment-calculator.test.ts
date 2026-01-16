import { calculateTotalPaid, calculatePaymentPercentage, isDispatchThresholdMet } from '../../src/utils/payment-calculator';

describe('Payment Calculator Utils', () => {
  describe('calculateTotalPaid', () => {
    it('should return 0 for null or undefined payments', () => {
      expect(calculateTotalPaid(null)).toBe(0);
      expect(calculateTotalPaid(undefined)).toBe(0);
    });

    it('should return 0 for empty payments array', () => {
      expect(calculateTotalPaid([])).toBe(0);
    });

    it('should calculate total from "amount" field correctly', () => {
      const payments = [
        { amount: 100 },
        { amount: 200.50 },
        { amount: '50' }
      ];
      // @ts-ignore - '50' is string but should be handled
      expect(calculateTotalPaid(payments)).toBe(350.50);
    });

    it('should calculate total from legacy payment fields', () => {
      const payments = [
        { first_payment: 100, second_payment: 50 },
        { final_payment: 200, additional_payment: 25 }
      ];
      // @ts-ignore
      expect(calculateTotalPaid(payments)).toBe(375);
    });

    it('should handle mixed payment types safely', () => {
      const payments = [
        { amount: 100 },
        { first_payment: 50 } // Should be ignored if we strictly follow logic, but let's see how code behaves.
        // Actually code says: if amount is present (not null/undefined), use it. Else sum others.
      ];
      // Test case 1: mixed records
      const mixedPayments = [
        { amount: 100 }, // New style
        { first_payment: 50, second_payment: 25 } // Old style (amount undefined)
      ];
      // @ts-ignore
      expect(calculateTotalPaid(mixedPayments)).toBe(175);
    });
  });

  describe('calculatePaymentPercentage', () => {
    it('should calculate correct percentage', () => {
      expect(calculatePaymentPercentage(50, 100)).toBe(50);
      expect(calculatePaymentPercentage(25, 100)).toBe(25);
    });

    it('should return 0 if order amount is 0 or negative', () => {
      expect(calculatePaymentPercentage(50, 0)).toBe(0);
      expect(calculatePaymentPercentage(50, -100)).toBe(0);
    });

    it('should handle floating point precision reasonably', () => {
      expect(calculatePaymentPercentage(1, 3)).toBeCloseTo(33.333, 3);
    });
  });

  describe('isDispatchThresholdMet', () => {
    it('should return true if total paid meets default threshold (65%)', () => {
      expect(isDispatchThresholdMet(65, 100)).toBe(true);
      expect(isDispatchThresholdMet(70, 100)).toBe(true);
    });

    it('should return false if total paid is below default threshold', () => {
      expect(isDispatchThresholdMet(64, 100)).toBe(false);
    });

    it('should respect custom threshold', () => {
      expect(isDispatchThresholdMet(50, 100, 0.5)).toBe(true);
      expect(isDispatchThresholdMet(49, 100, 0.5)).toBe(false);
    });

    it('should return false for invalid order amount', () => {
      expect(isDispatchThresholdMet(100, 0)).toBe(false);
    });
  });
});
