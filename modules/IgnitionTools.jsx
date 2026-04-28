import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Wrench } from 'lucide-react-native';
import ToolChecklist from './ToolChecklist';

export default function IgnitionTools({ profile }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Wrench color="#8b5cf6" size={32} />
        <Text style={styles.title}>TOOL CUSTODY & HARDWARE</Text>
        <Text style={styles.subtitle}>ASSIGNED TO: {profile?.name || 'TECHNICIAN'}</Text>
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ToolChecklist onValidationChange={(isValid) => console.log('Tools Validated:', isValid)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  header: { marginBottom: 30, alignItems: 'flex-start' },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 10 },
  subtitle: { color: '#8b5cf6', fontSize: 10, fontWeight: 'bold', marginTop: 5, letterSpacing: 1 },
  content: { flex: 1 }
});