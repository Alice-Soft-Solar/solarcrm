/**
 * Work Order Number Generation Utility
 * 
 * Format: <3 letter Company Code><2 digit year code><2 digit month code><4 digit serial number>
 * Example: GMS25120001
 * 
 * - Company Code: 3 letters (e.g., GMS)
 * - Year Code: 2 digits (e.g., 25 for 2025)
 * - Month Code: 2 digits (e.g., 12 for December)
 * - Serial Number: 4 digits (e.g., 0001, 0002, etc.)
 */

/**
 * Generate work order number
 * @param companyCode - 3 letter company code (e.g., "GMS")
 * @param year - Full year (e.g., 2025) - will be converted to 2 digits (25)
 * @param month - Month number (1-12) - will be zero-padded to 2 digits
 * @param serialNumber - Serial number (1-9999) - will be zero-padded to 4 digits
 * @returns Work order number in format: CCCYYMMSSSS
 */
export function generateWorkOrderNumber(
  companyCode: string,
  year: number,
  month: number,
  serialNumber: number
): string {
  // Validate and format company code (3 letters, uppercase)
  const code = companyCode.toUpperCase().slice(0, 3).padEnd(3, 'X');
  if (code.length !== 3) {
    throw new Error('Company code must be exactly 3 characters');
  }

  // Convert year to 2-digit format (e.g., 2025 -> 25)
  const yearCode = String(year).slice(-2).padStart(2, '0');

  // Format month to 2 digits (1-12 -> 01-12)
  const monthCode = String(month).padStart(2, '0');
  if (month < 1 || month > 12) {
    throw new Error('Month must be between 1 and 12');
  }

  // Format serial number to 4 digits (1-9999 -> 0001-9999)
  const serialCode = String(serialNumber).padStart(4, '0');
  if (serialNumber < 1 || serialNumber > 9999) {
    throw new Error('Serial number must be between 1 and 9999');
  }

  return `${code}${yearCode}${monthCode}${serialCode}`;
}

/**
 * Parse work order number to extract components
 * @param workOrderNumber - Work order number (e.g., "GMS25120001")
 * @returns Object with parsed components
 */
export function parseWorkOrderNumber(workOrderNumber: string): {
  companyCode: string;
  year: number;
  month: number;
  serialNumber: number;
} {
  if (workOrderNumber.length !== 11) {
    throw new Error('Invalid work order number format. Expected 11 characters.');
  }

  const companyCode = workOrderNumber.slice(0, 3);
  const yearCode = workOrderNumber.slice(3, 5);
  const monthCode = workOrderNumber.slice(5, 7);
  const serialCode = workOrderNumber.slice(7, 11);

  // Convert 2-digit year to full year (assume 2000-2099)
  const year = 2000 + parseInt(yearCode, 10);
  const month = parseInt(monthCode, 10);
  const serialNumber = parseInt(serialCode, 10);

  return {
    companyCode,
    year,
    month,
    serialNumber,
  };
}

/**
 * Get current year and month for work order number generation
 */
export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // JavaScript months are 0-indexed
  };
}


