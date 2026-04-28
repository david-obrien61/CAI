import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Settings } from 'lucide-react-native';

export default function IgnitionAdmin({ registry, onToggle, onLockout }) {
  return (
    <View style={styles.container}>
      <Settings color="#3b82f6" size={64} />
      <Text style={styles.title}>Admin Module (Web View)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617'
  },
  title: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 20 }
});
