import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

interface QuotationPDFTemplateProps {
  data: {
    quotation_number: string;
    quotation_date: string;
    customer_name: string;
    customer_address: string;
    customer_city: string;
    customer_phone: string;
    plant_capacity: string;
    system_type: string;
    roof_type?: string;
    order_amount: number;
    panel_brand: string;
    payment_terms: string;
    delivery_days: string;
    warranty_years: string;
    components_list?: string;
    scope_of_work?: string;
  };
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Times-Roman',
    fontSize: 11,
    lineHeight: 1.4,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
    textDecoration: 'underline',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  fromSection: {
    flex: 1,
  },
  dateSection: {
    width: 120,
    textAlign: 'right',
  },
  sectionLabel: {
    fontWeight: 'bold',
    marginBottom: 3,
  },
  customerName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  text: {
    marginBottom: 2,
  },
  toSection: {
    marginBottom: 20,
  },
  companyName: {
    fontWeight: 'bold',
    marginBottom: 2,
  },
  paragraph: {
    textAlign: 'justify',
    marginBottom: 15,
    lineHeight: 1.5,
  },
  bold: {
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tableLabel: {
    width: 160,
    fontWeight: 'bold',
  },
  tableValue: {
    flex: 1,
  },
  singleRow: {
    marginBottom: 10,
  },
  signatureSection: {
    marginTop: 50,
    alignItems: 'flex-end',
  },
  signatureText: {
    fontStyle: 'italic',
    marginBottom: 30,
  },
  signatureLine: {
    fontStyle: 'italic',
    marginBottom: 5,
  },
  signatureName: {
    fontWeight: 'bold',
  },
});

const formatDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: '2-digit' 
    }).replace(/ /g, '-');
  } catch {
    return dateStr;
  }
};

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export const QuotationPDFTemplate = ({ data }: QuotationPDFTemplateProps) => {
  if (!data) {
    throw new Error('Quotation data missing');
  }

  const componentsText = data.components_list || '(TATA Panels, Inverter, Cables, ACDC box, and Structure)';
  const scopeText = data.scope_of_work || 'Technical Feasibility, Transport, Erection, Installation, Testing and Commissioning, Civil works and Subsidy status follow-up.';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>WORK ORDER</Text>

        {/* Header: From and Date */}
        <View style={styles.headerRow}>
          <View style={styles.fromSection}>
            <Text style={styles.sectionLabel}>From</Text>
            <Text style={styles.customerName}>{data.customer_name}</Text>
            <Text style={styles.text}>{data.customer_address}</Text>
            <Text style={styles.text}>{data.customer_city}</Text>
            <Text style={styles.text}>Phone : {data.customer_phone}</Text>
          </View>
          <View style={styles.dateSection}>
            <Text>Date : {formatDate(data.quotation_date)}</Text>
          </View>
        </View>

        {/* To Section */}
        <View style={styles.toSection}>
          <Text style={styles.sectionLabel}>To</Text>
          <Text style={styles.companyName}>G M SOLAR SYSTEMS</Text>
          <Text style={styles.text}>2ndFloor, Naga Sai Complex</Text>
          <Text style={styles.text}>Opp.Stall Girls High School,</Text>
          <Text style={styles.text}>Nagarampalem,</Text>
          <Text style={styles.text}>Guntur-522004</Text>
          <Text style={styles.text}>Andhra Pradesh.</Text>
        </View>

        {/* Main Paragraph */}
        <Text style={styles.paragraph}>
          Work Order for EPC (engineering Procurement and commissioning) of{' '}
          <Text style={styles.bold}>{data.plant_capacity} {data.system_type}</Text>  
           {data.roof_type} Rooftop Solar Power plant at our premises rooftop. Total cost of the project Rs.{' '}
          <Text style={styles.bold}>{formatCurrency(data.order_amount)}</Text> including Transport and all taxes.
        </Text>

        {/* Supply of Materials */}
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Supply of Materials :</Text>
          <View style={styles.tableValue}>
            <Text style={styles.bold}>{data.panel_brand} {data.plant_capacity} {data.system_type}</Text>
            <Text>{componentsText}</Text>
          </View>
        </View>

        {/* GMSOLAR Scope of Work */}
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>GMSOLAR Scope of Work :</Text>
          <Text style={styles.tableValue}>{scopeText}</Text>
        </View>

        {/* Payment */}
        <View style={styles.singleRow}>
          <Text><Text style={styles.bold}>Payment :</Text> {data.payment_terms}</Text>
        </View>

        {/* Delivery & Commissioning */}
        <View style={styles.singleRow}>
          <Text>
            <Text style={styles.bold}>Delivery & Commissioning :</Text> Within {data.delivery_days} days from the date of your confirmation of order.
          </Text>
        </View>

        {/* Warranty */}
        <View style={styles.singleRow}>
          <Text>
            <Text style={styles.bold}>Warranty :</Text> {data.warranty_years} Years on Supplied Equipment's
          </Text>
        </View>

        {/* Signature Section */}
        <View style={styles.signatureSection}>
          <Text style={styles.signatureText}>Yours Sincerely</Text>
          <Text style={styles.signatureLine}>Signature</Text>
          <Text style={styles.signatureName}>{data.customer_name}</Text>
        </View>
      </Page>
    </Document>
  );
};
