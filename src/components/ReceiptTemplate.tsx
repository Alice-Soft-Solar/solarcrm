import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { ReceiptHeader } from './receipt/ReceiptHeader';
import { ReceiptSection } from './receipt/ReceiptSection';
import { ReceiptRow } from './receipt/ReceiptRow';
import { ReceiptPaymentBox } from './receipt/ReceiptPaymentBox';
import { formatCurrency, formatDate, getPaymentTypeLabel } from '@/utils/receiptFormatters';

interface ReceiptData {
  receiptNumber: string;
  receiptDate: string;
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyLogoUrl?: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  workOrderNumber: string;
  orderAmount: number;
  paymentType: string;
  paymentAmount: number;
  paymentMethod: string;
  transactionDate: string;
  totalPaid: number;
  pendingAmount: number;
}

// Optimized styles with reduced white space for compact PDF
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  receiptNumber: {
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTop: '2 solid #000',
  },
  signature: {
    marginTop: 20,
    paddingTop: 10,
    borderTop: '1 solid #ccc',
  },
  signatureLine: {
    borderTop: '1 solid #000',
    width: '50%',
    marginTop: 20,
  },
  footer: {
    marginTop: 15,
    paddingTop: 10,
    borderTop: '1 solid #ccc',
    textAlign: 'center',
    fontSize: 8,
    color: '#666',
  },
  footerText: {
    marginTop: 3,
  },
});

const ReceiptTemplate: React.FC<{ data: ReceiptData }> = ({ data }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Company Header with Logo */}
        <ReceiptHeader
          companyName={data.companyName}
          companyAddress={data.companyAddress}
          companyPhone={data.companyPhone}
          logoUrl={data.companyLogoUrl}
        />

        {/* Receipt Title */}
        <Text style={styles.title}>PAYMENT RECEIPT</Text>
        <Text style={styles.receiptNumber}>Receipt No: {data.receiptNumber}</Text>

        {/* Receipt Date */}
        <ReceiptRow
          label="Receipt Date:"
          value={formatDate(data.receiptDate)}
        />

        {/* Customer Details */}
        <ReceiptSection title="Customer Details">
          <ReceiptRow label="Name:" value={data.customerName} />
          <ReceiptRow label="Address:" value={data.customerAddress} />
          <ReceiptRow label="Phone:" value={data.customerPhone} />
        </ReceiptSection>

        {/* Work Order Details */}
        <ReceiptSection title="Work Order Details">
          <ReceiptRow label="Work Order Number:" value={data.workOrderNumber} />
          <ReceiptRow
            label="Order Amount:"
            value={formatCurrency(data.orderAmount)}
          />
        </ReceiptSection>

        {/* Payment Details */}
        <ReceiptSection title="Payment Details">
          <ReceiptPaymentBox>
            <ReceiptRow
              label="Payment Type:"
              value={getPaymentTypeLabel(data.paymentType)}
            />
            <ReceiptRow
              label="Payment Method:"
              value={data.paymentMethod || 'N/A'}
            />
            <ReceiptRow
              label="Transaction Date:"
              value={formatDate(data.transactionDate)}
            />
            <ReceiptRow
              label="Amount Paid:"
              value={formatCurrency(data.paymentAmount)}
              isAmount
            />
          </ReceiptPaymentBox>
        </ReceiptSection>

        {/* Payment Summary */}
        <ReceiptSection title="Payment Summary">
          <ReceiptRow
            label="Order Amount:"
            value={formatCurrency(data.orderAmount)}
            isAmount
          />
          <ReceiptRow
            label="Total Paid:"
            value={formatCurrency(data.totalPaid)}
            isAmount
          />
          <View style={styles.totalRow}>
            <Text style={{ fontWeight: 'bold' }}>Pending Amount:</Text>
            <Text style={{ fontWeight: 'bold' }}>
              {formatCurrency(data.pendingAmount)}
            </Text>
          </View>
        </ReceiptSection>

        {/* Signature Section */}
        <View style={styles.signature}>
          <View style={styles.signatureLine} />
          <Text style={styles.footer}>Authorized Signature</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>This is a computer-generated receipt. No signature required.</Text>
          <Text style={styles.footerText}>Thank you for your business!</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ReceiptTemplate;
