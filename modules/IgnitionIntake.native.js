/**
 * FILE: IgnitionIntake.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Intake form for new vehicles to establish a preliminary Work Order and capture data.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { User, Phone, Car, ChevronRight, Clock, AlertCircle, ShieldCheck } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function IgnitionIntake({ onComplete }) {
  const [formData, setFormData] = useState({
    name: '', phone: '', year: '', make: '', model: '', vin: '', problem: ''
  });

  const handleSave = () => {
    if (!formData.name || !formData.model) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const jobId = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
    onComplete({ ...formData, jobId });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.versionTag}>INTAKE.CoreApp.001</Text>
          <Text style={styles.title}>VEHICLE INTAKE</Text>
          <Text style={styles.subtitle}>ESTABLISH PRELIMINARY DATA BRIDGE</Text>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>CUSTOMER NAME</Text>
          <View style={styles.inputBox}>
            <User color="#3b82f6" size={18} style={styles.icon} />
            <TextInput style={styles.input} value={formData.name} onChangeText={(t) => setFormData(p => ({...p, name: t}))} placeholder="Enter Full Name" placeholderTextColor="#475569" />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>CONTACT PHONE</Text>
          <View style={styles.inputBox}>
            <Phone color="#3b82f6" size={18} style={styles.icon} />
            <TextInput style={styles.input} value={formData.phone} onChangeText={(t) => setFormData(p => ({...p, phone: t}))} placeholder="(555) 000-0000" keyboardType="phone-pad" placeholderTextColor="#475569" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={{flex: 1, marginRight: 10}}>
            <Text style={styles.label}>YEAR</Text>
            <View style={styles.inputBox}>
              <Clock color="#3b82f6" size={18} style={styles.icon} />
              <TextInput style={styles.input} value={formData.year} onChangeText={(t) => setFormData(p => ({...p, year: t}))} placeholder="1999" keyboardType="numeric" placeholderTextColor="#475569" />
            </View>
          </View>
          <View style={{flex: 2}}>
            <Text style={styles.label}>MAKE</Text>
            <View style={styles.inputBox}>
              <Car color="#3b82f6" size={18} style={styles.icon} />
              <TextInput style={styles.input} value={formData.make} onChangeText={(t) => setFormData(p => ({...p, make: t}))} placeholder="Chevrolet" placeholderTextColor="#475569" />
            </View>
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>MODEL</Text>
          <View style={styles.inputBox}>
            <Car color="#3b82f6" size={18} style={styles.icon} />
            <TextInput style={styles.input} value={formData.model} onChangeText={(t) => setFormData(p => ({...p, model: t}))} placeholder="Suburban" placeholderTextColor="#475569" />
          </View>
        </View>

        <View style={styles.inputWrapper}>
          <Text style={styles.label}>PRIMARY COMPLAINT / PROBLEM</Text>
          <View style={[styles.inputBox, {height: 120, alignItems: 'flex-start', paddingTop: 15}]}>
            <AlertCircle color="#f59e0b" size={18} style={styles.icon} />
            <TextInput style={[styles.input, {height: 90}]} multiline value={formData.problem} onChangeText={(t) => setFormData(p => ({...p, problem: t}))} placeholder="Describe the issue..." placeholderTextColor="#475569" />
          </View>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitText}>COMMIT TO QUEUE</Text>
          <ChevronRight color="#fff" size={20} />
        </TouchableOpacity>
        <View style={{height: 100}} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  scrollContent: { padding: 20 },
  header: { marginBottom: 30 },
  versionTag: { color: '#1e293b', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
  inputWrapper: { marginBottom: 20 },
  label: { color: '#94a3b8', fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', paddingHorizontal: 15 },
  icon: { marginRight: 12 },
  input: { flex: 1, height: 55, color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 20 },
  submitBtn: { backgroundColor: '#3b82f6', height: 70, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  submitText: { color: '#fff', fontSize: 18, fontWeight: '900', marginRight: 10 }
});