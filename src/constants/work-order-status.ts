/**
 * Work Order Status constants
 * Centralized to avoid hard-coded strings and ensure consistency
 */

export const WORK_ORDER_STATUS = {
  PENDING: 'Pending',
  TO_BE_DISPATCHED: 'To Be Dispatched',
  DISPATCHED: 'Dispatched',
  CLOSED: 'Closed',
  COMPLETED: 'Completed',
} as const;

export type WorkOrderStatus = typeof WORK_ORDER_STATUS[keyof typeof WORK_ORDER_STATUS];

/**
 * Array of all valid statuses
 */
export const VALID_STATUSES: readonly WorkOrderStatus[] = [
  WORK_ORDER_STATUS.PENDING,
  WORK_ORDER_STATUS.TO_BE_DISPATCHED,
  WORK_ORDER_STATUS.DISPATCHED,
  WORK_ORDER_STATUS.CLOSED,
  WORK_ORDER_STATUS.COMPLETED,
];


