import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * To Be Dispatched PDF Template
 * 
 * Purpose: Generate admin-only report showing work orders with "To Be Dispatched" status
 * with payment details and summary
 */

interface OrderRow {
  recDate: string;
  ordNo: string;
  customerName: string;
  customerAddress: string;
  town: string;
  mobileNo: string;
  contrValue: number;
  receipts: number;
  percentage: number;
  capacity: string;
  striHeight: string;
  building: string;
  salesMan: string;
  remarks: string;
}

interface ToBeDispatchedTemplateProps {
  data: {
    companyName: string;
    companyAddress: string;
    branch: string;
    reportPeriod: string;
    generatedDate: string;
    orderStatus: string;
    orders: OrderRow[];
    summary: {
      totalContrValue: number;
      totalReceipts: number;
    };
  };
}

export const ToBeDispatchedTemplate = ({ data }: ToBeDispatchedTemplateProps) => {
  if (!data) {
    throw new Error('To Be Dispatched report data missing');
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyAddress}>{data.companyAddress}</Text>
          <Text style={styles.reportTitle}>
            Branch: {data.branch} :: TO BE DISPATCHED :: Orders Period: {data.reportPeriod} AS ON: {data.generatedDate}
          </Text>
          <Text style={styles.orderStatus}>OrderStatus: {data.orderStatus}</Text>
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.colRecDate]}>Rec Date</Text>
          <Text style={[styles.headerCell, styles.colOrdNo]}>ordno</Text>
          <Text style={[styles.headerCell, styles.colCustomer]}>Customer Name & Address</Text>
          <Text style={[styles.headerCell, styles.colTown]}>Town</Text>
          <Text style={[styles.headerCell, styles.colMobile]}>MobileNo</Text>
          <Text style={[styles.headerCell, styles.colAmount]}>ContrValue</Text>
          <Text style={[styles.headerCell, styles.colAmount]}>Receipts</Text>
          <Text style={[styles.headerCell, styles.colPercent]}>(%)</Text>
          <Text style={[styles.headerCell, styles.colCapacity]}>Capacity</Text>
          <Text style={[styles.headerCell, styles.colStriHeight]}>StriHeight</Text>
          <Text style={[styles.headerCell, styles.colBuilding]}>Building</Text>
          <Text style={[styles.headerCell, styles.colSalesMan]}>SalesMan</Text>
          <Text style={[styles.headerCell, styles.colRemarks]}>Remarks</Text>
        </View>

        {/* Order Rows */}
        {data.orders.map((order, index) => (
          <View key={index} style={styles.tableRow}>
            <Text style={[styles.cell, styles.colRecDate]}>{order.recDate}</Text>
            <Text style={[styles.cell, styles.colOrdNo]}>{order.ordNo}</Text>
            <View style={[styles.cell, styles.colCustomer]}>
              <Text style={styles.customerText}>{order.customerName}</Text>
              <Text style={styles.addressText}>{order.customerAddress}</Text>
            </View>
            <Text style={[styles.cell, styles.colTown]}>{order.town}</Text>
            <Text style={[styles.cell, styles.colMobile]}>{order.mobileNo}</Text>
            <Text style={[styles.cell, styles.colAmount]}>Rs. {order.contrValue.toFixed(0)}</Text>
            <Text style={[styles.cell, styles.colAmount]}>Rs. {order.receipts.toFixed(0)}</Text>
            <Text style={[styles.cell, styles.colPercent]}>{order.percentage.toFixed(0)}%</Text>
            <Text style={[styles.cell, styles.colCapacity]}>{order.capacity}</Text>
            <Text style={[styles.cell, styles.colStriHeight]}>{order.striHeight}</Text>
            <Text style={[styles.cell, styles.colBuilding]}>{order.building}</Text>
            <Text style={[styles.cell, styles.colSalesMan]}>{order.salesMan}</Text>
            <Text style={[styles.cell, styles.colRemarks]}>{order.remarks}</Text>
          </View>
        ))}

        {/* Totals Row */}
        <View style={styles.totalsRow}>
          <Text style={[styles.cell, styles.colRecDate]}></Text>
          <Text style={[styles.cell, styles.colOrdNo]}></Text>
          <Text style={[styles.cell, styles.colCustomer]}></Text>
          <Text style={[styles.cell, styles.colTown]}></Text>
          <Text style={[styles.cell, styles.colMobile]}></Text>
          <Text style={[styles.cell, styles.colAmount, styles.totalsText]}>Rs. {data.summary.totalContrValue.toFixed(0)}</Text>
          <Text style={[styles.cell, styles.colAmount, styles.totalsText]}>Rs. {data.summary.totalReceipts.toFixed(0)}</Text>
          <Text style={[styles.cell, styles.colPercent]}></Text>
          <Text style={[styles.cell, styles.colCapacity]}></Text>
          <Text style={[styles.cell, styles.colStriHeight]}></Text>
          <Text style={[styles.cell, styles.colBuilding]}></Text>
          <Text style={[styles.cell, styles.colSalesMan]}></Text>
          <Text style={[styles.cell, styles.colRemarks]}></Text>
        </View>
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 7,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 8,
  },
  companyName: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 2,
  },
  reportTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  orderStatus: {
    fontSize: 7,
    marginBottom: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 3,
  },
  headerCell: {
    fontSize: 7,
    fontWeight: 'bold',
    paddingHorizontal: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ccc',
    minHeight: 30,
    alignItems: 'flex-start',
  },
  cell: {
    fontSize: 6,
    paddingVertical: 2,
    paddingHorizontal: 2,
  },
  customerText: {
    fontSize: 6,
    fontWeight: 'bold',
    marginBottom: 1,
  },
  addressText: {
    fontSize: 6,
    lineHeight: 1.2,
  },
  summarySection: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderTop: '2 solid #000',
  },
  summaryTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 8,
    marginBottom: 2,
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '2 solid #000',
    borderBottom: '2 solid #000',
    paddingVertical: 4,
  },
  totalsText: {
    fontWeight: 'bold',
  },
  // Column widths - adjusted to prevent overlap
  colRecDate: {
    width: '6%',
  },
  colOrdNo: {
    width: '7%',
  },
  colCustomer: {
    width: '16%',
  },
  colTown: {
    width: '8%',
  },
  colMobile: {
    width: '9%',
  },
  colAmount: {
    width: '9%',
  },
  colPercent: {
    width: '5%',
  },
  colCapacity: {
    width: '7%',
  },
  colStriHeight: {
    width: '7%',
  },
  colBuilding: {
    width: '7%',
  },
  colSalesMan: {
    width: '9%',
  },
  colRemarks: {
    width: '8%',
  },
  alignCenter: {
    textAlign: 'center',
  },
});

// Default export
export default ToBeDispatchedTemplate;
