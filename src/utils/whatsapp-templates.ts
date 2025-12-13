/**
 * WhatsApp message templates for work order notifications
 */

export interface WorkOrderData {
  work_order_number: string;
  customer_name: string;
  order_amount: number;
  payment_received?: number;
  plant_capacity?: string | null;
  executive_name?: string;
  executive_contact?: string;
  escalation_contact?: string;
  site_details?: string | null;
  customer_address?: string;
  customer_phone?: string;
}

/**
 * Formats currency in Indian format
 */
function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Customer message template for work order creation
 */
export function getCustomerCreationMessage(data: WorkOrderData): string {
  const paymentReceived = data.payment_received || 0;
  const plantCapacity = data.plant_capacity || 'N/A';
  const executiveContact = data.executive_contact || 'N/A';
  const escalationContact = data.escalation_contact || 'N/A';

  return `Dear ${data.customer_name}, Welcome to GM Solar Systems Family!
Your Work Order Number: ${data.work_order_number} has successfully registered.
Total Work Order Amount: ${formatCurrency(data.order_amount)}
Payment Received: ${formatCurrency(paymentReceived)}
Plant Capacity: ${plantCapacity}
Note: Set up will finished with in 15 days of receiving total Work Order Amount.Setup will be finished within 15 days from the date of receipt of total work order amount.

For all your queries contact: ${executiveContact} / ${escalationContact}`;
}

/**
 * Admin/Executive message template for work order creation
 */
export function getAdminCreationMessage(data: WorkOrderData): string {
  const paymentReceived = data.payment_received || 0;
  const plantCapacity = data.plant_capacity || 'N/A';
  const executiveName = data.executive_name || 'N/A';
  const executiveContact = data.executive_contact || 'N/A';

  return `New Work Order ${data.work_order_number} has successfully registered.
Total Work Order Amount: ${formatCurrency(data.order_amount)}
Payment Received: ${formatCurrency(paymentReceived)}
Plant Capacity: ${plantCapacity}
Executive Name: ${executiveName}
Executive Contact: ${executiveContact}`;
}

/**
 * Customer message template for "To Be Dispatched" status
 */
export function getCustomerToBeDispatchedMessage(data: WorkOrderData): string {
  return `Dear ${data.customer_name},

Your work order #${data.work_order_number} has been ready to be dispatched.

We will notify you once the dispatch is completed.

Thank you for your patience!

GM Solar Systems`;
}

/**
 * Admin/Inventory message template for "To Be Dispatched" status
 */
export function getAdminToBeDispatchedMessage(data: WorkOrderData): string {
  const plantCapacity = data.plant_capacity || 'N/A';
  const siteDetails = data.site_details || 'N/A';
  const customerAddress = data.customer_address || 'N/A';

  return `Work Order #${data.work_order_number} - To Be Dispatched

Customer Details:
Name: ${data.customer_name}
Phone: ${data.customer_phone || 'N/A'}
Address: ${customerAddress}

Order Details:
Plant Capacity: ${plantCapacity}
Total Amount: ${formatCurrency(data.order_amount)}
Payment Received: ${formatCurrency(data.payment_received || 0)}

Site Details: ${siteDetails}

Please verify stock and keep ready for dispatch.`;
}

/**
 * Admin/Sales Executive message template for "To Be Dispatched" status
 * Information message for admin and sales executive when payment reaches 65%
 */
export function getAdminSalesToBeDispatchedMessage(data: WorkOrderData): string {
  const plantCapacity = data.plant_capacity || 'N/A';
  const siteDetails = data.site_details || 'N/A';
  const customerAddress = data.customer_address || 'N/A';
  const executiveName = data.executive_name || 'N/A';

  return `Work Order #${data.work_order_number} - To Be Dispatched

Status Update: Payment has reached 65% threshold. Work order is ready for dispatch.

Customer Information:
Name: ${data.customer_name}
Phone: ${data.customer_phone || 'N/A'}
Address: ${customerAddress}

Order Details:
Plant Capacity: ${plantCapacity} kW
Total Order Amount: ${formatCurrency(data.order_amount)}
Payment Received: ${formatCurrency(data.payment_received || 0)}
Payment Percentage: ${data.order_amount > 0 ? ((data.payment_received || 0) / data.order_amount * 100).toFixed(1) : '0'}%

Site Details: ${siteDetails}
Sales Executive: ${executiveName}

Note: Inventory team has been notified to prepare stock for dispatch.`;
}

/**
 * Customer message template for "Dispatched" status
 */
export function getCustomerDispatchedMessage(data: WorkOrderData): string {
  return `Dear ${data.customer_name},

Equipment against the work order #${data.work_order_number} has been dispatched successfully.
Thank you for choosing GM Solar Systems!

For any queries, please contact: ${data.executive_contact || 'N/A'}`;
}

/**
 * Admin/Sales Executive message template for "Dispatched" status
 * Notification when work order is marked as dispatched by inventory
 */
export function getAdminSalesDispatchedMessage(data: WorkOrderData): string {
  const plantCapacity = data.plant_capacity || 'N/A';
  const customerAddress = data.customer_address || 'N/A';
  const executiveName = data.executive_name || 'N/A';

  return `Work Order #${data.work_order_number} - Dispatched

Status Update: Work order has been successfully dispatched.

Customer Information:
Name: ${data.customer_name}
Phone: ${data.customer_phone || 'N/A'}
Address: ${customerAddress}

Order Summary:
Plant Capacity: ${plantCapacity} kW
Total Order Amount: ${formatCurrency(data.order_amount)}
Payment Received: ${formatCurrency(data.payment_received || 0)}
Sales Executive: ${executiveName}

Customer has been notified via WhatsApp.

GM Solar Systems`;
}

