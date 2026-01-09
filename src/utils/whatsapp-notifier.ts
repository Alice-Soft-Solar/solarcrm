import { createClient } from '@supabase/supabase-js';
import { sendWhatsAppMessage, sendWhatsAppDocument } from './whatsapp';
import { 
  getAdminUsers, 
  getSalesExecutive, 
  getInventoryUsers,
  sendWhatsAppToUsers,
  sendWhatsAppToUser 
} from './whatsapp-helpers';
import { 
  getCustomerPaymentMessage, 
  getAdminPaymentMessage,
  getCustomerStatusUpdateMessage,
  getAdminStatusUpdateMessage,
  getCustomerToBeDispatchedMessage,
  getAdminToBeDispatchedMessage,
  getAdminSalesToBeDispatchedMessage,
  getCustomerDispatchedMessage,
  getAdminSalesDispatchedMessage,
  getCustomerCreationMessage,
  getAdminCreationMessage,
  WorkOrderData
} from './whatsapp-templates';

/**
 * Interface for work order with related data
 */
interface ExtendedWorkOrder {
  id: string;
  work_order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string;
  order_amount: number;
  payment_received?: number;
  plant_capacity?: string | null;
  sales_executive_id?: string;
  company_id: string;
  site_details?: string | null;
  work_order_status?: string | null;
}

/**
 * Notifies all stakeholders about a payment received
 */
export async function notifyPaymentReceived(
  workOrder: ExtendedWorkOrder,
  paymentAmount: number,
  totalPaid: number,
  supabase: any
) {
  try {
    const salesExec = workOrder.sales_executive_id 
      ? await getSalesExecutive(workOrder.sales_executive_id, supabase)
      : null;
    
    const adminUsers = await getAdminUsers(workOrder.company_id, supabase);

    const workOrderData: WorkOrderData = {
      work_order_number: workOrder.work_order_number,
      customer_name: workOrder.customer_name,
      order_amount: workOrder.order_amount,
      payment_received: totalPaid,
      plant_capacity: workOrder.plant_capacity,
      executive_name: salesExec?.full_name,
      executive_contact: salesExec?.phone || undefined,
      customer_phone: workOrder.customer_phone,
    };

    // 1. Notify Customer
    if (workOrder.customer_phone) {
      const customerMsg = getCustomerPaymentMessage(workOrderData, paymentAmount);
      await sendWhatsAppMessage({ to: workOrder.customer_phone, body: customerMsg });
    }

    // 2. Notify Admin
    const adminMsg = getAdminPaymentMessage(workOrderData, paymentAmount);
    await sendWhatsAppToUsers(adminUsers, adminMsg);

    // 3. Notify Sales Executive (the specific one assigned to this work order)
    if (salesExec) {
      await sendWhatsAppToUser(salesExec, adminMsg);
    }
  } catch (error) {
    console.error('Error in notifyPaymentReceived:', error);
  }
}

/**
 * Notifies all stakeholders about a status change
 */
export async function notifyStatusChange(
  workOrder: ExtendedWorkOrder,
  newStatus: string,
  totalPaid: number,
  supabase: any
) {
  try {
    const salesExec = workOrder.sales_executive_id 
      ? await getSalesExecutive(workOrder.sales_executive_id, supabase)
      : null;
    
    const adminUsers = await getAdminUsers(workOrder.company_id, supabase);
    const inventoryUsers = await getInventoryUsers(workOrder.company_id, supabase);

    const workOrderData: WorkOrderData = {
      work_order_number: workOrder.work_order_number,
      customer_name: workOrder.customer_name,
      customer_phone: workOrder.customer_phone,
      customer_address: workOrder.customer_address,
      order_amount: workOrder.order_amount,
      payment_received: totalPaid,
      plant_capacity: workOrder.plant_capacity,
      executive_name: salesExec?.full_name,
      executive_contact: salesExec?.phone || undefined,
      site_details: workOrder.site_details,
    };

    // Special handling for specific statuses
    if (newStatus === 'To Be Dispatched') {
      // Customer
      if (workOrder.customer_phone) {
        await sendWhatsAppMessage({ to: workOrder.customer_phone, body: getCustomerToBeDispatchedMessage(workOrderData) });
      }
      // Admin + Sales Executive
      const adminSalesMsg = getAdminSalesToBeDispatchedMessage(workOrderData);
      await sendWhatsAppToUsers(adminUsers, adminSalesMsg);
      if (salesExec) await sendWhatsAppToUser(salesExec, adminSalesMsg);
      
      // Inventory
      await sendWhatsAppToUsers(inventoryUsers, getAdminToBeDispatchedMessage(workOrderData));
      
    } else if (newStatus === 'Dispatched') {
      // Customer
      if (workOrder.customer_phone) {
        await sendWhatsAppMessage({ to: workOrder.customer_phone, body: getCustomerDispatchedMessage(workOrderData) });
      }
      // Admin + Sales Executive
      const adminSalesMsg = getAdminSalesDispatchedMessage(workOrderData);
      await sendWhatsAppToUsers(adminUsers, adminSalesMsg);
      if (salesExec) await sendWhatsAppToUser(salesExec, adminSalesMsg);

    } else if (newStatus === 'Created') {
      // 1. Notify Customer (Welcome Message)
      if (workOrder.customer_phone) {
        const escalationContact = adminUsers.length > 0 ? (adminUsers[0].phone || 'N/A') : 'N/A';
        const welcomeMsg = getCustomerCreationMessage({
          ...workOrderData,
          escalation_contact: escalationContact,
        });
        await sendWhatsAppMessage({ to: workOrder.customer_phone, body: welcomeMsg });
      }

      // 2. Notify Admin + Sales Executive
      const creationAlert = getAdminCreationMessage(workOrderData);
      await sendWhatsAppToUsers(adminUsers, creationAlert);
      if (salesExec) await sendWhatsAppToUser(salesExec, creationAlert);

    } else {
      // Generic status update (Installed, Completed, Advance Paid, etc.)
      // Customer
      if (workOrder.customer_phone) {
        await sendWhatsAppMessage({ to: workOrder.customer_phone, body: getCustomerStatusUpdateMessage(workOrderData, newStatus) });
      }
      // Admin + Sales Executive
      const adminMsg = getAdminStatusUpdateMessage(workOrderData, newStatus);
      await sendWhatsAppToUsers(adminUsers, adminMsg);
      if (salesExec) await sendWhatsAppToUser(salesExec, adminMsg);
    }
  } catch (error) {
    console.error('Error in notifyStatusChange:', error);
  }
}

/**
 * Notifies customer with a payment receipt (PDF)
 */
export async function notifyPaymentReceipt(
  workOrder: ExtendedWorkOrder,
  receiptNumber: string,
  pdfUrl: string,
  supabase: any
) {
  try {
    if (!workOrder.customer_phone) {
      console.warn('[WhatsApp Notifier] No customer phone for receipt notification');
      return;
    }

    // Generate a signed URL for the PDF (1 day expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('work-order-docs')
      .createSignedUrl(pdfUrl, 86400);

    if (signedError || !signedData?.signedUrl) {
      console.error('[WhatsApp Notifier] Failed to generate signed URL for receipt:', signedError);
      return;
    }

    const caption = `Hello ${workOrder.customer_name}, please find your payment receipt ${receiptNumber} for Work Order ${workOrder.work_order_number}. Thank you!`;
    
    const result = await sendWhatsAppDocument({
      to: workOrder.customer_phone,
      media: signedData.signedUrl,
      filename: `${receiptNumber}.pdf`,
      caption: caption,
      mime_type: 'application/pdf'
    });

    if (result.success) {
      console.log(`✅ Receipt WhatsApp notification sent for ${receiptNumber}`);
    } else {
      console.warn(`⚠️ Receipt WhatsApp failed for ${receiptNumber}:`, result.error);
    }
  } catch (error) {
    console.error('Error in notifyPaymentReceipt:', error);
  }
}

