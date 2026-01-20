import ExcelJS from 'exceljs';

/**
 * Utility to export data to Excel using ExcelJS (secure replacement for xlsx)
 * @param data - Array of objects to export
 * @param fileName - Name of the file (without extension)
 * @param sheetName - Name of the worksheet
 */
export const exportToExcel = async (data: any[], fileName: string, sheetName: string = 'Report') => {
  if (!data || data.length === 0) return;

  // Create a new workbook and worksheet
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // Get headers from first object
  const headers = Object.keys(data[0]);
  worksheet.columns = headers.map(header => ({
    header,
    key: header,
    width: 15
  }));

  // Add rows
  data.forEach(row => {
    worksheet.addRow(row);
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' }
  };

  // Generate buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}_${new Date().getTime()}.xlsx`;
  link.click();
  window.URL.revokeObjectURL(url);
};

/**
 * Get headers for a specific report type
 */
export const getReportHeaders = (type: string): string[] => {
  switch (type) {
    case 'customer_list': return ['No', 'Customer Name', 'Town', 'Phone', 'Plant Capacity', 'Status'];
    case 'executive_wise_orders': return ['Executive', 'No', 'Customer', 'Town', 'Order Date', 'Amount', 'Status'];
    // Match Screenshot: RecDate | RecNo | AccountName | RecAmount | Mobileno | Pay Mode | Cheque No | RecStatus | Receipt Part | Executive / Salesman
    case 'receipts_list': return ['RecDate', 'RecNo', 'AccountName', 'RecAmount', 'Mobileno', 'Pay Mode', 'Cheque No', 'RecStatus', 'Receipt Part', 'Executive / Salesman'];
    case 'status_detailed':
    case 'summary_report': return ['No', 'Customer', 'Town', 'Capacity', 'Status', 'Order Value', 'Total Paid', 'Dues'];
    // Match Screenshot: Trans.Date | Customer Name | Town | Mobile | ItemName | Tr.Type | OrderCost | ReceivedAmt | Balance
    case 'ledger': return ['Trans.Date', 'Customer Name', 'Town', 'Mobile', 'ItemName', 'Tr.Type', 'OrderCost', 'ReceivedAmt', 'Balance', 'Executive'];
    case 'stage_6_stages': return ['No', 'Customer', 'Town', 'Created', 'Adv Paid', 'To Dispatch', 'Dispatched', 'Installed', 'Completed'];
    case 'to_be_dispatched': return ['No', 'Customer', 'Town', 'Mobile', 'Amount', 'Paid', 'Paid %', 'Capacity', 'Executive'];
    case 'stock_dispatched':
    case 'erection_done':
    case 'erection_dues': return ['No', 'Customer', 'Town', 'Mobile', 'Status', 'Dispatched Date', 'Erection Date', 'Paid', 'Dues'];
    case 'subsidy_report':
    case 'subsidy_not_eligible':
    case 'subsidy_not_ready':
    case 'subsidy_not_received': return ['No', 'Customer', 'Town', 'Capacity', 'Subsidy Status', 'Subsidy Amt', 'Order Dues'];
    case 'dues_report': return ['Executive', 'Order No', 'Customer', 'Town', 'Mobile', 'Total Value', 'Total Received', 'Pending Balance'];
    default: return [];
  }
};

/**
 * Map API response data to a format suitable for Excel or PDF
 */
export const mapDataForExport = (data: any[], type: string) => {
  const headers = getReportHeaders(type);
  return data.map(item => {
    const mapped: any = {};
    const values = getReportRowValues(item, type);
    headers.forEach((header, index) => {
      mapped[header] = values[index];
    });
    return mapped;
  });
};

/**
 * Get raw values for a report row in order of headers
 */
export const getReportRowValues = (item: any, type: string): any[] => {
  switch (type) {
    case 'customer_list':
      return [item.work_order_number, item.customer_name, item.town || '-', item.customer_phone, item.plant_capacity || '-', item.work_order_status];
    case 'executive_wise_orders':
      return [item.executiveName, item.work_order_number, item.customer_name, item.town || '-', item.created_at ? new Date(item.created_at).toLocaleDateString() : '', item.order_amount, item.work_order_status];
    case 'receipts_list':
      return [
        item.transaction_date ? new Date(item.transaction_date).toLocaleDateString() : '',
        item.receipt_number || item.work_order_number || '', // Fallback to WO Num if receipt not generated
        item.customer_name || 'Revenue',
        item.amount ? item.amount.toLocaleString() : '0',
        item.mobileno || '',
        item.payment_method || '',
        item.cheque_number || '', // Cheque No
        'Pending', // RecStatus - hardcoded as Pending based on screenshot sample or could map from status
        item.first_payment ? 'Advance-Payment' : (item.final_payment ? 'Final-Payment' : 'Part-Payment'), // Logic for Receipt Part
        item.executiveName
      ];
    case 'status_detailed':
    case 'summary_report':
      return [item.work_order_number, item.customer_name, item.town || '-', item.plant_capacity || '-', item.work_order_status, item.order_amount, item.totalPaid, item.balance];
    case 'ledger':
      return [
        item.date ? new Date(item.date).toLocaleDateString() : '', // Trans.Date
        item.customer_name || '', // Customer Name (dots handled in API)
        item.town || '',
        item.mobile || '',
        item.description || '', // ItemName
        item.type || '', // Tr.Type (formatted in API)
        item.debit ? item.debit.toLocaleString() : '', // OrderCost
        item.credit ? item.credit.toLocaleString() : '', // ReceivedAmt
        item.balance ? item.balance.toLocaleString() : '', // Balance
        item.executiveName
      ];
    case 'stage_6_stages':
      return [
        item.work_order_number, 
        item.customer_name, 
        item.town || '-',
        item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A',
        item.advance_paid_at ? new Date(item.advance_paid_at).toLocaleDateString() : 'N/A',
        item.to_be_dispatched_at ? new Date(item.to_be_dispatched_at).toLocaleDateString() : 'N/A',
        item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : 'N/A',
        item.erection_done_at ? new Date(item.erection_done_at).toLocaleDateString() : 'N/A',
        item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'
      ];
    case 'to_be_dispatched':
      return [item.work_order_number, item.customer_name, item.town || '-', item.customer_phone, item.order_amount, item.totalPaid, `${item.paymentPercentage.toFixed(1)}%`, item.plant_capacity || '-', item.executiveName];
    case 'stock_dispatched':
    case 'erection_done':
    case 'erection_dues':
      return [item.work_order_number, item.customer_name, item.town || '-', item.customer_phone, item.work_order_status, item.dispatched_at ? new Date(item.dispatched_at).toLocaleDateString() : 'N/A', item.erection_done_at ? new Date(item.erection_done_at).toLocaleDateString() : 'N/A', item.totalPaid, item.balance];
    case 'subsidy_report':
    case 'subsidy_not_eligible':
    case 'subsidy_not_ready':
    case 'subsidy_not_received':
      return [item.work_order_number, item.customer_name, item.town || '-', item.plant_capacity || '-', item.subsidy_status || 'Pending', item.subsidy_amount || 0, item.balance];
    case 'dues_report':
      return [item.executiveName, item.work_order_number, item.customer_name, item.town || '-', item.customer_phone, item.order_amount, item.totalPaid, item.balance];
    default:
      return Object.values(item);
  }
};
