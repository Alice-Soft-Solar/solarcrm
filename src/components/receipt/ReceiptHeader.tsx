import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';

interface ReceiptHeaderProps {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  logoUrl?: string;
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
    borderBottom: '2 solid #000',
    paddingBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 12,
    objectFit: 'contain',
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
  },
  companyNameOnly: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  companyInfo: {
    fontSize: 9,
    textAlign: 'center',
    color: '#666',
    marginBottom: 2,
  },
});

export const ReceiptHeader: React.FC<ReceiptHeaderProps> = ({
  companyName,
  companyAddress,
  companyPhone,
  logoUrl,
}) => {
  return (
    <View style={styles.header}>
      {logoUrl ? (
        <View style={styles.headerContent}>
          <Image src={logoUrl} style={styles.logo} />
          <Text style={styles.companyName}>{companyName}</Text>
        </View>
      ) : (
        <Text style={styles.companyNameOnly}>{companyName}</Text>
      )}
      {companyAddress && (
        <Text style={styles.companyInfo}>{companyAddress}</Text>
      )}
      {companyPhone && (
        <Text style={styles.companyInfo}>Phone: {companyPhone}</Text>
      )}
    </View>
  );
};

