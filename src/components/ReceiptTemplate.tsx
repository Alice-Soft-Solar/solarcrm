import React from 'react';  
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { formatCurrency, formatDate, getPaymentMethodLabel, numberToWords } from '@/utils/receiptFormatters';

interface ReceiptTemplateProps {
  data: {
    receiptNumber: string;
    receiptDate: string;
    companyName: string;
    companyAddress: string;
    companyPhone1: string;
    companyPhone2: string;
    companyEmail: string;
    gstNo: string;
    customerName: string;
    amount: number;
    paymentMethod: string;
    bankName: string;
    chequeNo: string;
    status: string;
    orderValue: number;
    totalReceived: number;
    balanceAmount: number;
  };
}

export const ReceiptTemplate = ({ data }: ReceiptTemplateProps) => {
  // Guard: Ensure data exists
  if (!data) {
    throw new Error('Receipt data missing');
  }

  const paymentMethodLabel = getPaymentMethodLabel(data.paymentMethod);
  const amountInWords = numberToWords(data.amount);
  const phones = [data.companyPhone1, data.companyPhone2].filter(Boolean).join(', ');
  const printedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
  const printedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.phones}>Phones : {phones}</Text>
            <Text style={styles.gst}>GST No: {data.gstNo}</Text>
          </View>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.address}>{data.companyAddress}</Text>
          {data.companyEmail && (
            <Text style={styles.email}>E-Mail: {data.companyEmail}</Text>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title}>BANK RECEIPT</Text>

        {/* Main Receipt Box */}
        <View style={styles.receiptBox}>
          {/* Receipt Number and Date Row */}
          <View style={styles.row}>
            <View style={styles.leftCell}>
              <Text style={styles.label}>Receipt No :</Text>
              <Text style={styles.value}>{data.receiptNumber}</Text>
            </View>
            <View style={styles.rightCell}>
              <Text style={styles.label}>Receipt Date :</Text>
              <Text style={[styles.value, { marginLeft: 6 }]}>{formatDate(data.receiptDate)}</Text>
            </View>
          </View>

          {/* Received From Row */}
          <View style={styles.fullRow}>
            <Text style={styles.label}>Received From :</Text>
            <Text style={styles.valueUnderline}>{data.customerName}</Text>
          </View>

          {/* Amount and By Row */}
          <View style={styles.row}>
            <View style={styles.leftCell}>
              <Text style={styles.label}>Amount :</Text>
              <Text style={styles.amountValue}>{data.amount.toFixed(2)}</Text>
            </View>
            <View style={styles.rightCell}>
              <Text style={styles.label}>By :</Text>
              <Text style={styles.valueUnderline}>{paymentMethodLabel}</Text>
            </View>
          </View>

          {/* Amount in Words Row */}
          <View style={styles.fullRow}>
            <Text style={styles.amountWords}>{amountInWords}</Text>
          </View>

          {/* Bank Name and Cheque No Row */}
          <View style={styles.row}>
            <View style={styles.leftCell}>
              <Text style={styles.label}>Bank Name :</Text>
              <Text style={styles.value}>{data.bankName || ''}</Text>
            </View>
            <View style={styles.rightCell}>
              <Text style={styles.label}>Cheque No :</Text>
              <Text style={[styles.value, { marginLeft: 6 }]}>{data.chequeNo || ''}</Text>
            </View>
          </View>

          {/* Remarks Row */}
          <View style={styles.fullRow}>
            <Text style={styles.label}>Remarks :</Text>
            <Text style={styles.value}>{data.status}</Text>
          </View>

          {/* Signature Space */}
          <View style={styles.signatureArea}>
            <Text style={styles.signature}>Authorised Signature</Text>
          </View>

          {/* Footer with Printed Date and Account Summary */}
          <View style={styles.footer}>
            <Text style={styles.printedOn}>Printed on :   {printedDate}   {printedTime}</Text>
            <Text style={styles.summary}>
              A/c Summary (Incl. this Receipt) : Order Value : {formatCurrency(data.orderValue)}     
              Received : {formatCurrency(data.totalReceived)}     
              Balance : {formatCurrency(data.balanceAmount)}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    fontSize: 9,
  },
  phones: {
    fontWeight: 'bold',
  },
  gst: {
    fontWeight: 'bold',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 1,
  },
  address: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
    fontWeight: 'bold',
  },
  email: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: 'bold',
    marginVertical: 8,
    letterSpacing: 1,
  },
  receiptBox: {
    border: '2 solid #000',
    padding: 0,
  },
  row: {
    flexDirection: 'row',
  },
  fullRow: {
    padding: 6,
    flexDirection: 'row',
  },
  leftCell: {
    flex: 1,
    padding: 6,
    flexDirection: 'row',
  },
  rightCell: {
    flex: 1,
    padding: 6,
    flexDirection: 'row',
  },
  label: {
    fontWeight: 'bold',
    marginRight: 8,
  },
  value: {
    flex: 1,
  },
  valueUnderline: {
    flex: 1,
    borderBottom: '1 solid #000',
    paddingBottom: 2,
    fontWeight: 'bold',
  },
  amountValue: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 11,
    borderBottom: '1 solid #000',
    paddingBottom: 2,
  },
  amountWords: {
    flex: 1,
    borderBottom: '1 solid #000',
    paddingBottom: 2,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  signatureArea: {
    borderBottom: '1 solid #000',
    padding: 30,
    alignItems: 'flex-end',
  },
  signature: {
    fontSize: 9,
    fontStyle: 'italic',
  },
  footer: {
    padding: 6,
  },
  printedOn: {
    fontSize: 8,
    marginBottom: 4,
  },
  summary: {
    fontSize: 9,
    fontWeight: 'bold',
  },
});

// Default export for API route usage
export default ReceiptTemplate;
