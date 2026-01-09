import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Dues Report PDF Template
 * 
 * Purpose: Generate admin-only dues report showing work orders grouped by sales executive
 * with payment summaries, subtotals, and grand totals
 */

interface OrderRow {
  ordDate: string;
  ordNo: string;
  customerName: string;
  town: string;
  units: number;
  mobileNo: string;
  contrValue: number;
  receipts: number;
  balance: number;
  ordStatus: string;
  recPercent: number;
}

interface Subtotal {
  totalUnits: number;
  totalContrValue: number;
  totalReceipts: number;
  totalBalance: number;
}

interface SalesExecutiveGroup {
  executiveName: string;
  orders: OrderRow[];
  subtotal: Subtotal;
}

interface GrandTotal {
  totalUnits: number;
  totalContrValue: number;
  totalReceipts: number;
  totalBalance: number;
}

interface DuesReportTemplateProps {
  data: {
    companyName: string;
    companyAddress: string;
    branch: string;
    reportPeriod: string;
    generatedDate: string;
    orderStatus: string;
    salesExecutives: SalesExecutiveGroup[];
    grandTotal: GrandTotal;
  };
}

export const DuesReportTemplate = ({ data }: DuesReportTemplateProps) => {
  if (!data) {
    throw new Error('Dues report data missing');
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyAddress}>{data.companyAddress}</Text>
          <Text style={styles.reportTitle}>
            Branch: {data.branch} :: DUES REPORT :: Order Received Period: {data.reportPeriod} AS ON: {data.generatedDate}
          </Text>
          <Text style={styles.orderStatus}>OrderStatus: {data.orderStatus}</Text>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.colOrdDate]}>Ord Date</Text>
          <Text style={[styles.cell, styles.colOrdNo]}>Ord.No</Text>
          <Text style={[styles.cell, styles.colCustomer]}>Customer Name</Text>
          <Text style={[styles.cell, styles.colTown]}>Town</Text>
          <Text style={[styles.cell, styles.colUnits]}>Units</Text>
          <Text style={[styles.cell, styles.colMobile]}>Mobile No</Text>
          <Text style={[styles.cell, styles.colAmount]}>Contr.Value</Text>
          <Text style={[styles.cell, styles.colAmount]}>Receipts</Text>
          <Text style={[styles.cell, styles.colAmount]}>Balance</Text>
          <Text style={[styles.cell, styles.colStatus]}>Ord.Status</Text>
          <Text style={[styles.cell, styles.colPercent]}>Rec.%</Text>
        </View>

        {/* Sales Executive Groups */}
        {data.salesExecutives.map((executive, execIndex) => (
          <View key={execIndex}>
            {/* Executive Name Header */}
            <View style={styles.executiveHeader}>
              <Text style={styles.executiveName}>{executive.executiveName}</Text>
            </View>

            {/* Orders for this Executive */}
            {executive.orders.map((order, orderIndex) => (
              <View key={orderIndex} style={styles.tableRow}>
                <Text style={[styles.cell, styles.colOrdDate, styles.cellText]}>{order.ordDate}</Text>
                <Text style={[styles.cell, styles.colOrdNo, styles.cellText]}>{order.ordNo}</Text>
                <Text style={[styles.cell, styles.colCustomer, styles.cellText]}>{order.customerName}</Text>
                <Text style={[styles.cell, styles.colTown, styles.cellText]}>{order.town}</Text>
                <Text style={[styles.cell, styles.colUnits, styles.cellText, styles.alignCenter]}>{order.units}</Text>
                <Text style={[styles.cell, styles.colMobile, styles.cellText]}>{order.mobileNo}</Text>
                <Text style={[styles.cell, styles.colAmount, styles.cellText]}>Rs. {order.contrValue.toFixed(0)}</Text>
                <Text style={[styles.cell, styles.colAmount, styles.cellText]}>Rs. {order.receipts.toFixed(0)}</Text>
                <Text style={[styles.cell, styles.colAmount, styles.cellText]}>Rs. {order.balance.toFixed(0)}</Text>
                <Text style={[styles.cell, styles.colStatus, styles.cellText]}>{order.ordStatus}</Text>
                <Text style={[styles.cell, styles.colPercent, styles.cellText, styles.alignRight]}>{order.recPercent.toFixed(2)}%</Text>
              </View>
            ))}

            {/* Subtotal Row */}
            <View style={styles.subtotalRow}>
              <Text style={[styles.cell, styles.colOrdDate]}></Text>
              <Text style={[styles.cell, styles.colOrdNo]}></Text>
              <Text style={[styles.cell, styles.colCustomer, styles.subtotalLabel]}>Sales Man wise Totals:</Text>
              <Text style={[styles.cell, styles.colTown]}></Text>
              <Text style={[styles.cell, styles.colUnits, styles.alignCenter]}>{executive.subtotal.totalUnits}</Text>
              <Text style={[styles.cell, styles.colMobile]}></Text>
              <Text style={[styles.cell, styles.colAmount]}>Rs. {executive.subtotal.totalContrValue.toFixed(0)}</Text>
              <Text style={[styles.cell, styles.colAmount]}>Rs. {executive.subtotal.totalReceipts.toFixed(0)}</Text>
              <Text style={[styles.cell, styles.colAmount]}>Rs. {executive.subtotal.totalBalance.toFixed(0)}</Text>
              <Text style={[styles.cell, styles.colStatus]}></Text>
              <Text style={[styles.cell, styles.colPercent]}></Text>
            </View>
          </View>
        ))}

        {/* Grand Total Row */}
        <View style={styles.grandTotalRow}>
          <Text style={[styles.cell, styles.colOrdDate]}></Text>
          <Text style={[styles.cell, styles.colOrdNo]}></Text>
          <Text style={[styles.cell, styles.colCustomer, styles.grandTotalLabel]}>Sales Man wise Totals:</Text>
          <Text style={[styles.cell, styles.colTown]}></Text>
          <Text style={[styles.cell, styles.colUnits, styles.alignCenter]}>{data.grandTotal.totalUnits}</Text>
          <Text style={[styles.cell, styles.colMobile]}></Text>
          <Text style={[styles.cell, styles.colAmount]}>Rs. {data.grandTotal.totalContrValue.toFixed(0)}</Text>
          <Text style={[styles.cell, styles.colAmount]}>Rs. {data.grandTotal.totalReceipts.toFixed(0)}</Text>
          <Text style={[styles.cell, styles.colAmount]}>Rs. {data.grandTotal.totalBalance.toFixed(0)}</Text>
          <Text style={[styles.cell, styles.colStatus]}></Text>
          <Text style={[styles.cell, styles.colPercent]}></Text>
        </View>
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
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 3,
  },
  companyAddress: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 3,
  },
  reportTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  orderStatus: {
    fontSize: 8,
    marginBottom: 5,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 3,
  },
  executiveHeader: {
    backgroundColor: '#e8e8e8',
    paddingVertical: 3,
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
  subtotalRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottom: '1 solid #000',
    paddingVertical: 3,
    fontWeight: 'bold',
  },
  grandTotalRow: {
    flexDirection: 'row',
    backgroundColor: '#e0e0e0',
    borderTop: '2 solid #000',
    borderBottom: '2 solid #000',
    paddingVertical: 4,
    fontWeight: 'bold',
  },
  cell: {
    paddingVertical: 2,
    paddingHorizontal: 2,
    fontSize: 7,
    fontWeight: 'bold',
  },
  cellText: {
    fontWeight: 'normal',
  },
  subtotalLabel: {
    fontWeight: 'bold',
  },
  grandTotalLabel: {
    fontWeight: 'bold',
  },
  // Column widths - adjusted to prevent overlap
  colOrdDate: {
    width: '7%',
  },
  colOrdNo: {
    width: '8%',
  },
  colCustomer: {
    width: '16%',
  },
  colTown: {
    width: '10%',
  },
  colUnits: {
    width: '5%',
  },
  colMobile: {
    width: '10%',
  },
  colAmount: {
    width: '11%',
  },
  colStatus: {
    width: '12%',
  },
  colPercent: {
    width: '7%',
  },
  alignRight: {
    textAlign: 'right',
  },
  alignCenter: {
    textAlign: 'center',
  },
});

// Default export
export default DuesReportTemplate;
