import React from 'react';
import { View, StyleSheet } from '@react-pdf/renderer';

interface ReceiptPaymentBoxProps {
  children: React.ReactNode;
}

const styles = StyleSheet.create({
  paymentBox: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    marginTop: 4,
  },
});

export const ReceiptPaymentBox: React.FC<ReceiptPaymentBoxProps> = ({ children }) => {
  return (
    <View style={styles.paymentBox}>
      {children}
    </View>
  );
};


