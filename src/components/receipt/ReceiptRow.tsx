import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';

interface ReceiptRowProps {
  label: string;
  value: string | number;
  isAmount?: boolean;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 3,
  },
  label: {
    width: '45%',
    fontWeight: 'bold',
  },
  value: {
    width: '55%',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingVertical: 2,
  },
  amountLabel: {
    fontWeight: 'bold',
  },
  amountValue: {
    fontWeight: 'bold',
  },
});

export const ReceiptRow: React.FC<ReceiptRowProps> = ({ label, value, isAmount = false }) => {
  if (isAmount) {
    return (
      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>{label}</Text>
        <Text style={styles.amountValue}>{value}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};


