import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Ledger PDF Template for Admin Users
 * 
 * Purpose: Generate a sales ledger showing work orders and payments
 * grouped by Sales Executive → Customer with sequential balance calculations
 * 
 * This is NOT a receipt PDF - it's a comprehensive ledger for physical printing
 */

interface LedgerTransaction {
  date: string;
  workOrderNo: string;
  itemName: string; // plant_capacity
  type: 'ORDER' | 'CASH' | 'BANK' | 'CHEQUE' | 'UPI' | 'ONLINE' | 'CARD';
  orderCost: number | null;
  receivedAmt: number | null;
  balance: number; // calculated sequentially
}

interface LedgerCustomer {
  name: string;
  town: string; // extracted from address
  mobile: string;
  transactions: LedgerTransaction[];
}

interface LedgerSalesExecutive {
  name: string;
  customers: LedgerCustomer[];
}

interface LedgerTemplateProps {
  data: {
    companyName: string;
    companyAddress: string;
    companyPhone1: string;
    companyPhone2: string;
    companyEmail: string;
    gstNo: string;
    generatedDate: string;
    fromDate?: string;
    toDate?: string;
    salesExecutives: LedgerSalesExecutive[];
  };
}

export const LedgerTemplate = ({ data }: LedgerTemplateProps) => {
  if (!data) {
    throw new Error('Ledger data missing');
  }

  const phones = [data.companyPhone1, data.companyPhone2].filter(Boolean).join(', ');

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.phones}>Phones: {phones}</Text>
            <Text style={styles.gst}>GST No: {data.gstNo}</Text>
          </View>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.address}>{data.companyAddress}</Text>
          {data.companyEmail && (
            <Text style={styles.email}>E-Mail: {data.companyEmail}</Text>
          )}
          <Text style={styles.subtitle}>
            {data.fromDate && data.toDate 
              ? `SALESMAN WISE - CUSTOMER WISE LEDGERS FROM : ${data.fromDate} TO : ${data.toDate}`
              : `SALESMAN WISE - CUSTOMER WISE LEDGERS AS ON : ${data.generatedDate}`
            }
          </Text>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.colDate, styles.noWrap]}>Trans.Date</Text>
          <Text style={[styles.cell, styles.colWorkOrder, styles.noWrap]}>Work Order No</Text>
          <Text style={[styles.cell, styles.colCustomer, styles.noWrap]}>Customer Name</Text>
          <Text style={[styles.cell, styles.colTown, styles.noWrap]}>Town</Text>
          <Text style={[styles.cell, styles.colMobile, styles.noWrap]}>Mobile</Text>
          <Text style={[styles.cell, styles.colItem, styles.noWrap]}>ItemName</Text>
          <Text style={[styles.cell, styles.colType, styles.noWrap]}>Tr.Type</Text>
          <Text style={[styles.cell, styles.colAmount, styles.amountCell, styles.noWrap]}>OrderCost</Text>
          <Text style={[styles.cell, styles.colAmount, styles.amountCell, styles.noWrap]}>ReceivedAmt</Text>
          <Text style={[styles.cell, styles.colAmount, styles.amountCell, styles.noWrap]}>Balance</Text>
        </View>

        {/* Table Body - Grouped by Sales Executive → Customer */}
        {data.salesExecutives.map((executive, execIndex) => (
          <View key={execIndex}>
            {/* Sales Executive Header Row */}
            <View style={styles.executiveRow}>
              <Text style={styles.executiveName}>{executive.name}</Text>
            </View>

            {/* Customers under this Sales Executive */}
            {executive.customers.map((customer, custIndex) => (
              <View key={custIndex}>
                {/* Customer Transactions */}
                {customer.transactions.map((transaction, transIndex) => (
                  <View key={transIndex} style={styles.tableRow}>
                    <Text style={[styles.cell, styles.colDate, styles.cellText]}>
                      {transaction.date}
                    </Text>
                    <Text style={[styles.cell, styles.colWorkOrder, styles.cellText]}>
                      {transaction.workOrderNo}
                    </Text>
                    <Text style={[styles.cell, styles.colCustomer, styles.cellText]}>
                      {transIndex === 0 ? customer.name : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colTown, styles.cellText]}>
                      {transIndex === 0 ? customer.town : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colMobile, styles.cellText]}>
                      {transIndex === 0 ? customer.mobile : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colItem, styles.cellText]}>
                      {transaction.itemName}
                    </Text>
                    <Text style={[styles.cell, styles.colType, styles.cellText]}>
                      {transaction.type}
                    </Text>
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.amountCell]}>
                      {transaction.orderCost !== null ? transaction.orderCost.toFixed(2) : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.amountCell]}>
                      {transaction.receivedAmt !== null ? transaction.receivedAmt.toFixed(2) : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.amountCell]}>
                      {transaction.balance.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            
            {/* Total Work Orders Row */}
            {/* Total Work Orders Row */}
            {(() => {
              const allTransactions = executive.customers.flatMap(c => c.transactions);
              const totalOrders = allTransactions.filter(t => t.type === 'ORDER').length;
              
              const totalOrderCost = allTransactions.reduce((sum, t) => sum + (t.orderCost || 0), 0);
              const totalReceived = allTransactions.reduce((sum, t) => sum + (t.receivedAmt || 0), 0);
              const totalBalance = totalOrderCost - totalReceived;

              return (
                <View style={styles.totalRow}>
                  {/* Spanning cols for Total Label: Date(50) + WorkOrder(70) + Customer(130) + Town(85) + Mobile(90) + Item(65) + TrType(55) = 545 */}
                  {/* But we want to span until the Amount columns. Let's just use flexGrow or specific width? 
                      Actually, simpler to use empty cells or a spanning text if possible. 
                      react-pdf doesn't support colSpan well in flex layouts. 
                      Let's create cells matching the widths to align totals correctly. */}
                  
                  <Text style={[styles.cell, styles.colDate, styles.totalLabel]}></Text>
                  <Text style={[styles.cell, styles.colWorkOrder, styles.totalLabel]}>TOTAL:</Text>
                  <Text style={[styles.cell, styles.colCustomer, styles.totalLabel]}>{totalOrders} Orders</Text>
                  <Text style={[styles.cell, styles.colTown]}></Text>
                  <Text style={[styles.cell, styles.colMobile]}></Text>
                  <Text style={[styles.cell, styles.colItem]}></Text>
                  <Text style={[styles.cell, styles.colType]}></Text>
                  
                  <Text style={[styles.cell, styles.colAmount, styles.totalValue]}>
                    {totalOrderCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.cell, styles.colAmount, styles.totalValue]}>
                    {totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.cell, styles.colAmount, styles.totalValue]}>
                    {totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                </View>
              );
            })()}
          </View>
        ))}

        {/* Grand Totals Row (All Executives) */}
        {(() => {
          const allTransactions = data.salesExecutives.flatMap(e => e.customers.flatMap(c => c.transactions));
          const grandTotalOrderCost = allTransactions.reduce((sum, t) => sum + (t.orderCost || 0), 0);
          const grandTotalReceived = allTransactions.reduce((sum, t) => sum + (t.receivedAmt || 0), 0);
          const grandTotalBalance = grandTotalOrderCost - grandTotalReceived;

          return (
            <View style={styles.grandTotalRow}>
              <Text style={[styles.cell, styles.colDate, styles.grandTotalLabel]}></Text>
              <Text style={[styles.cell, styles.colWorkOrder, styles.grandTotalLabel]}></Text>
              <Text style={[styles.cell, styles.colCustomer, styles.grandTotalLabel]}></Text>
              <Text style={[styles.cell, styles.colTown]}></Text>
              <Text style={[styles.cell, styles.colMobile]}></Text>
              <Text style={[styles.cell, styles.colItem]}></Text>
              <Text style={[styles.cell, styles.colType]}></Text>
              
              <Text style={[styles.cell, styles.colAmount, styles.grandTotalValue]}>
                {grandTotalOrderCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.cell, styles.colAmount, styles.grandTotalValue]}>
                {grandTotalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
              <Text style={[styles.cell, styles.colAmount, styles.grandTotalValue]}>
                {grandTotalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </View>
          );
        })()}
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 10,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
    fontSize: 7,
  },
  phones: {
    fontWeight: 'bold',
  },
  gst: {
    fontWeight: 'bold',
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  address: {
    fontSize: 7,
    textAlign: 'center',
    marginBottom: 2,
  },
  email: {
    fontSize: 7,
    textAlign: 'center',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 3,
  },
  executiveRow: {
    backgroundColor: '#e8e8e8',
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderBottom: '1 solid #000',
  },
  executiveName: {
    fontSize: 9,
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ccc',
  },
  cell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    fontSize: 7,
    fontWeight: 'bold',
  },
  amountCell: {
    textAlign: 'right',
  },
  noWrap: {
    whiteSpace: 'nowrap',
  },
  cellText: {
    fontWeight: 'normal',
  },
  // Column widths - Fixed numeric widths for A4 landscape (~800 total for proper fit)
  colDate: { width: 50 },
  colWorkOrder: { width: 70 },
  colCustomer: { width: 130 },
  colTown: { width: 85 },
  colMobile: { width: 90 },
  colItem: { width: 65 },
  colType: { width: 55 },
  colAmount: { width: 75 },

  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 4,
    paddingHorizontal: 5,
  },
  totalLabel: {
    fontWeight: 'bold',
    textAlign: 'left',
  },
  totalValue: {
    fontWeight: 'bold',
    textAlign: 'right',
  },

  // Grand Total Styles
  grandTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#d3d3d3', // Light grey as requested
    marginTop: 10,
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 6,
    paddingHorizontal: 5,
  },
  grandTotalLabel: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 9,
    textAlign: 'left',
  },
  grandTotalValue: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 9,
    textAlign: 'right',
  },
});

