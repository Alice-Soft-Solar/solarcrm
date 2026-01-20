/**
 * Conditional debug logger - only logs in development
 * Use this instead of console.log for debug statements
 */
export const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
};

/**
 * Production-safe logger for errors
 * Always logs errors but sanitizes sensitive info in production
 */
export const errorLog = (message: string, error?: any) => {
  if (process.env.NODE_ENV === 'production') {
    // In production, only log the message without sensitive details
    console.error(message);
  } else {
    // In development, log full error details
    console.error(message, error);
  }
};
