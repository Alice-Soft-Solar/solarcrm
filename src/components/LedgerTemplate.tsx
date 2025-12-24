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
            SALESMAN WISE - CUSTOMER WISE LEDGERS AS ON : {data.generatedDate}
          </Text>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.colDate]}>Trans.Date</Text>
          <Text style={[styles.cell, styles.colCustomer]}>Customer Name</Text>
          <Text style={[styles.cell, styles.colTown]}>Town</Text>
          <Text style={[styles.cell, styles.colMobile]}>Mobile</Text>
          <Text style={[styles.cell, styles.colItem]}>ItemName</Text>
          <Text style={[styles.cell, styles.colType]}>Tr.Type</Text>
          <Text style={[styles.cell, styles.colAmount]}>OrderCost</Text>
          <Text style={[styles.cell, styles.colAmount]}>ReceivedAmt</Text>
          <Text style={[styles.cell, styles.colAmount]}>Balance</Text>
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
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.alignRight]}>
                      {transaction.orderCost !== null ? transaction.orderCost.toFixed(2) : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.alignRight]}>
                      {transaction.receivedAmt !== null ? transaction.receivedAmt.toFixed(2) : ''}
                    </Text>
                    <Text style={[styles.cell, styles.colAmount, styles.cellText, styles.alignRight]}>
                      {transaction.balance.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
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
    paddingHorizontal: 2,
    fontSize: 7,
    fontWeight: 'bold',
  },
  cellText: {
    fontWeight: 'normal',
  },
  // Column widths (total should be ~100%)
  colDate: {
    width: '10%',
  },
  colCustomer: {
    width: '18%',
  },
  colTown: {
    width: '10%',
  },
  colMobile: {
    width: '11%',
  },
  colItem: {
    width: '10%',
  },
  colType: {
    width: '8%',
  },
  colAmount: {
    width: '11%',
  },
  alignRight: {
    textAlign: 'right',
  },
});
