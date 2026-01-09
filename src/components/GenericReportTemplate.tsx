import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface GenericReportTemplateProps {
  data: {
    title: string;
    companyName: string;
    companyAddress: string;
    gstNumber?: string;
    reportPeriod: string;
    generatedDate: string;
    headers: string[];
    rows: any[][];
    totals?: (string | number)[];
  };
}

export const GenericReportTemplate = ({ data }: GenericReportTemplateProps) => {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {/* GST Number - Top Left */}
          {data.gstNumber && (
            <Text style={styles.gstNumber}>GST No: {data.gstNumber}</Text>
          )}
          
          {/* Company Name - Centered */}
          <Text style={styles.companyName}>{data.companyName}</Text>
          
          {/* Company Address - Below name */}
          <Text style={styles.companyAddress}>{data.companyAddress}</Text>
          
          {/* Report Title */}
          <Text style={styles.reportTitle}>{data.title}</Text>
          
          {/* Meta Info */}
          <Text style={styles.meta}>Period: {data.reportPeriod} | Generated: {data.generatedDate}</Text>
        </View>

        {/* Table */}
        <View style={styles.table}>
          {/* Table Header */}
          <View style={[styles.row, styles.tableHeader]}>
            {data.headers.map((header, i) => (
              <Text key={i} style={[styles.cell, styles.headerCell, { flex: 1 }, getAlignment(header)]}>
                {header}
              </Text>
            ))}
          </View>

          {/* Table Rows */}
          {data.rows.map((row, i) => (
            <View key={i} style={styles.row}>
              {row.map((cell, j) => (
                <Text key={j} style={[styles.cell, { flex: 1 }, getAlignment(data.headers[j])]}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}

          {/* Totals Row */}
          {data.totals && (
            <View style={[styles.row, styles.totalsRow]}>
              {data.totals.map((total, i) => (
                <Text key={i} style={[styles.cell, styles.headerCell, { flex: 1 }, getAlignment(data.headers[i])]}>
                  {total}
                </Text>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  );
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: 'Helvetica' },
  header: { marginBottom: 20, alignItems: 'center', position: 'relative' },
  gstNumber: { fontSize: 9, position: 'absolute', top: 0, left: 0, fontWeight: 'bold' },
  companyName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, marginTop: 15 },
  companyAddress: { fontSize: 9, marginBottom: 8 },
  reportTitle: { fontSize: 12, fontWeight: 'bold', textDecoration: 'underline', marginBottom: 4 },
  meta: { fontSize: 8, color: '#666' },
  table: { width: 'auto', borderStyle: 'solid', borderWidth: 1, borderColor: '#000' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#000', minHeight: 15, alignItems: 'center' },
  tableHeader: { backgroundColor: '#f0f0f0' },
  totalsRow: { backgroundColor: '#e0e0e0', fontWeight: 'bold' },
  cell: { padding: 3, borderRightWidth: 1, borderColor: '#000' },
  headerCell: { fontWeight: 'bold' },
  textRight: { textAlign: 'right' },
  textCenter: { textAlign: 'center' },
});

// Helper to determine alignment
export const getAlignment = (header: string) => {
  const rightAligned = ['value', 'amount', 'paid', 'balance', 'cost', 'receipts', 'summary', 'units'];
  const centerAligned = ['no', 'date', 'status', 'stage', 'phone'];
  
  const lowerHeader = header.toLowerCase();
  if (rightAligned.some(term => lowerHeader.includes(term))) return styles.textRight;
  if (centerAligned.some(term => lowerHeader.includes(term))) return styles.textCenter;
  return {};
};

export default GenericReportTemplate;
