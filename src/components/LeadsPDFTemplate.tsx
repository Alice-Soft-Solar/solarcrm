import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

/**
 * Leads PDF Template
 * 
 * Purpose: Generate a leads report in landscape format
 * Matches styling with LedgerTemplate
 */

export interface LeadRow {
  id: string;
  executive_name: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  power_bill: number | null;
  power_units: number | null;
  customer_address: string;
  visit_status: string;
  status: string;
}

export interface LeadsPDFProps {
  companyName: string;
  leads: LeadRow[];
  generatedAt: string;
  filterInfo?: string;
}

// Format date/time for display
const formatDateTime = (dateString: string): string => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

// Format phone number
const formatPhone = (phone: string | number): string => {
  if (!phone) return 'N/A';
  const phoneStr = String(phone);
  if (phoneStr.length === 10) {
    return `+91${phoneStr}`;
  }
  return phoneStr;
};

// Show full address with line wrap
const formatAddress = (address: string): string => {
  if (!address) return 'N/A';
  return address;
};

export default function LeadsPDFTemplate({ companyName, leads, generatedAt, filterInfo }: LeadsPDFProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header Section */}
        <View style={styles.header}>
          <Text style={styles.companyName}>{companyName || 'Solar CRM'}</Text>
          <Text style={styles.subtitle}>
            LEADS REPORT AS ON : {generatedAt}
          </Text>
          {filterInfo && (
            <Text style={styles.filterInfo}>Filters: {filterInfo}</Text>
          )}
        </View>

        {/* Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, styles.colExecutive, styles.headerCell]}>Executive</Text>
          <Text style={[styles.cell, styles.colTime, styles.headerCell]}>Time</Text>
          <Text style={[styles.cell, styles.colCustomer, styles.headerCell]}>Customer</Text>
          <Text style={[styles.cell, styles.colMobile, styles.headerCell]}>Mobile</Text>
          <Text style={[styles.cell, styles.colBill, styles.headerCell, styles.textRight]}>Bill</Text>
          <Text style={[styles.cell, styles.colUnits, styles.headerCell, styles.textRight]}>Units</Text>
          <Text style={[styles.cell, styles.colAddress, styles.headerCell]}>Address</Text>
          <Text style={[styles.cell, styles.colVisitStatus, styles.headerCell]}>Visit Status</Text>
          <Text style={[styles.cell, styles.colStatus, styles.headerCell]}>Status</Text>
        </View>

        {/* Table Rows */}
        {leads.map((lead, index) => (
          <View key={lead.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowAlt}>
            <Text style={[styles.cell, styles.colExecutive, styles.cellText]}>
              {lead.executive_name || 'N/A'}
            </Text>
            <Text style={[styles.cell, styles.colTime, styles.cellText]}>
              {formatDateTime(lead.created_at)}
            </Text>
            <Text style={[styles.cell, styles.colCustomer, styles.cellText]}>
              {lead.customer_name || 'N/A'}
            </Text>
            <Text style={[styles.cell, styles.colMobile, styles.cellText]}>
              {formatPhone(lead.customer_phone)}
            </Text>
            <Text style={[styles.cell, styles.colBill, styles.cellText, styles.textRight]}>
              {lead.power_bill ? `Rs. ${lead.power_bill.toFixed(0)}` : 'N/A'}
            </Text>
            <Text style={[styles.cell, styles.colUnits, styles.cellText, styles.textRight]}>
              {lead.power_units ?? 'N/A'}
            </Text>
            <Text style={[styles.cell, styles.colAddress, styles.cellText]}>
              {formatAddress(lead.customer_address)}
            </Text>
            <Text style={[styles.cell, styles.colVisitStatus, styles.cellText]}>
              {lead.visit_status || 'First Visit'}
            </Text>
            <Text style={[styles.cell, styles.colStatus, styles.cellText]}>
              {lead.status || 'N/A'}
            </Text>
          </View>
        ))}

        {/* Total Row */}
        <View style={styles.totalRow}>
          <Text style={[styles.cell, styles.totalLabel]}>TOTAL: {leads.length} Leads</Text>
        </View>
      </Page>
    </Document>
  );
}

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
    fontSize: 16,
    fontWeight: 'bold',
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
  filterInfo: {
    fontSize: 7,
    textAlign: 'center',
    color: '#666',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 3,
  },
  headerCell: {
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ccc',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #ccc',
    backgroundColor: '#f9f9f9',
  },
  cell: {
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 7,
  },
  cellText: {
    fontWeight: 'normal',
  },
  textRight: {
    textAlign: 'right',
  },
  // Column widths - optimized for A4 landscape (~800 total)
  // Only Address field is allowed to wrap
  colExecutive: { width: 70 },
  colTime: { width: 80 },
  colCustomer: { width: 120 },
  colMobile: { width: 80 },
  colBill: { width: 55 },
  colUnits: { width: 35 },
  colAddress: { width: 115 },
  colVisitStatus: { width: 60 },
  colStatus: { width: 85 },

  totalRow: {
    flexDirection: 'row',
    backgroundColor: '#e8e8e8',
    borderTop: '1 solid #000',
    borderBottom: '1 solid #000',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  totalLabel: {
    fontWeight: 'bold',
    textAlign: 'left',
  },
});
