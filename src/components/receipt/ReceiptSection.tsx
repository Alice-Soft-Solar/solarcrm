import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

interface ReceiptSectionProps {
  title: string;
  children: React.ReactNode;
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 6,
    borderBottom: '1 solid #ccc',
    paddingBottom: 3,
  },
});

export const ReceiptSection: React.FC<ReceiptSectionProps> = ({ title, children }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
};


