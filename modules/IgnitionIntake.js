/**
 * FILE: IgnitionIntake.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Intake form for new vehicles to establish a preliminary Work Order and capture data.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { User, Phone, Car, ChevronRight, Clock, AlertCircle, ShieldCheck, Search, XCircle, CheckCircle2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DataBridge from '../DataBridge';

export default function IgnitionIntake({ onComplete }) {
  const [customers] = useState(() => DataBridge.getCustomers() || []);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [formData, setFormData] = useState({
    name: '', phone: '', year: '', make: '', model: '', vin: '', problem: ''
  });

  // Auto-search logic triggered directly by the form inputs
  const nameMatches = formData.name.length > 1 
    ? customers.filter(c => c.name.toLowerCase().includes(formData.name.toLowerCase())) 
    : [];
    
  const phoneMatches = formData.phone.length > 3 && formData.name.length <= 1 
    ? customers.filter(c => c.phone.includes(formData.phone)) 
    : [];

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setFormData(p => ({ ...p, name: c.name, phone: c.phone }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setFormData({ name: '', phone: '', year: '', make: '', model: '', vin: '', problem: formData.problem });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectVehicle = (v) => {
    setFormData(p => ({ ...p, year: String(v.year), make: v.make, model: v.model, vin: v.vin }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleSave = () => {
    if (!formData.name || !formData.model) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const jobId = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;
    onComplete({ 
      ...formData, 
      jobId,
      customerId: selectedCustomer?.id,
      customerTier: selectedCustomer?.tier
    });
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container} keyboardVerticalOffset={100}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.versionTag}>INTAKE.CoreApp.001</Text>
          <Text style={styles.title}>VEHICLE INTAKE</Text>
          <Text style={styles.subtitle}>ESTABLISH PRELIMINARY DATA BRIDGE</Text>
        </View>

      {/* SELECTED CUSTOMER */}
      {selectedCustomer && (
        <View style={styles.selectedCustomerCard}>
          <View style={styles.selectedCustomerHeader}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <User color="#818cf8" size={20} />
              <View style={{marginLeft: 10}}>
                <Text style={styles.selectedCustomerName}>{selectedCustomer.name}</Text>
                <Text style={styles.selectedCustomerPhone}>{selectedCustomer.tier} TIER // {selectedCustomer.phone}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={clearCustomer}>
              <XCircle color="#ef4444" size={24} />
            </TouchableOpacity>
          </View>

          {selectedCustomer.vehicles?.length > 0 && (
            <View style={styles.vehicleList}>
              <Text style={styles.label}>SELECT REGISTERED ASSET</Text>
              {selectedCustomer.vehicles.map((v, i) => {
                const isSelected = formData.vin === v.vin && formData.vin !== '';
                return (
                  <TouchableOpacity key={i} style={[styles.vehicleOption, isSelected && styles.vehicleOptionSelected]} onPress={() => selectVehicle(v)}>
                    <View>
                      <Text style={[styles.vehicleOptionText, isSelected && {color: '#10b981'}]}>{v.year} {v.make} {v.model}</Text>
                      <Text style={styles.vehicleOptionVin}>VIN: {v.vin.slice(-6)}</Text>
                    </View>
                    {isSelected && <CheckCircle2 color="#10b981" size={20} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {!selectedCustomer && (
        <>
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>CUSTOMER NAME (AUTO-SEARCH)</Text>
            <View style={[styles.inputBox, nameMatches.length > 0 ? { borderColor: '#818cf8' } : {}]}>
              <User color="#3b82f6" size={18} style={styles.icon} />
              <TextInput style={styles.input} value={formData.name} onChangeText={(t) => setFormData(p => ({...p, name: t}))} placeholder="Enter Full Name" placeholderTextColor="#475569" />
            </View>
            
            {nameMatches.length > 0 && (
              <View style={styles.searchResults}>
                {nameMatches.map(c => (
                  <TouchableOpacity key={c.id} style={styles.searchResultItem} onPress={() => selectCustomer(c)}>
                    <View>
                      <Text style={styles.searchResultName}>{c.name} <Text style={styles.searchResultTier}>({c.tier})</Text></Text>
                      <Text style={styles.searchResultPhone}>{c.phone}</Text>
                    </View>
                    <ChevronRight color="#475569" size={20} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>CONTACT PHONE</Text>
            <View style={styles.inputBox}>
              <Phone color="#3b82f6" size={18} style={styles.icon} />
              <TextInput style={styles.input} value={formData.phone} onChangeText={(t) => setFormData(p => ({...p, phone: t}))} placeholder="(555) 000-0000" keyboardType="phone-pad" placeholderTextColor="#475569" />
            </View>
            
            {phoneMatches.length > 0 && (
              <View style={styles.searchResults}>
                {phoneMatches.map(c => (
                  <TouchableOpacity key={c.id} style={styles.searchResultItem} onPress={() => selectCustomer(c)}>
                    <View>
                      <Text style={styles.searchResultName}>{c.name} <Text style={styles.searchResultTier}>({c.tier})</Text></Text>
                      <Text style={styles.searchResultPhone}>{c.phone}</Text>
                    </View>
                    <ChevronRight color="#475569" size={20} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </>
      )}

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
  submitText: { color: '#fff', fontSize: 18, fontWeight: '900', marginRight: 10 },
  searchResults: { backgroundColor: '#0f172a', borderRadius: 16, marginTop: 10, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  searchResultName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  searchResultTier: { color: '#818cf8', fontSize: 10, fontWeight: 'bold' },
  searchResultPhone: { color: '#64748b', fontSize: 12, marginTop: 4 },
  selectedCustomerCard: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#818cf8', marginBottom: 20 },
  selectedCustomerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  selectedCustomerName: { color: '#fff', fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
  selectedCustomerPhone: { color: '#818cf8', fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
  vehicleList: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 15 },
  vehicleOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#020617', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  vehicleOptionSelected: { borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)' },
  vehicleOptionText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  vehicleOptionVin: { color: '#64748b', fontSize: 10, marginTop: 4, fontFamily: 'monospace' }
});