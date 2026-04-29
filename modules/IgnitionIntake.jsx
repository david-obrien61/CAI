/**
 * FILE: IgnitionIntake.jsx
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Vehicle intake form. Captures all fields required to generate a complete
 *          work order. VIN validation is handled separately by IgnitionVIN.
 */

import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import {
  User, Phone, Mail, Car, ChevronRight, AlertCircle,
  ShieldCheck, Search, XCircle, CheckCircle2, Gauge,
  CreditCard, MessageSquare, ClipboardList
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DataBridge from '../DataBridge';

export default function IgnitionIntake({ onComplete }) {
  const [customers]         = useState(() => DataBridge.getCustomers() || []);
  const [selectedCustomer,  setSelectedCustomer]  = useState(null);

  const [formData, setFormData] = useState({
    // Customer
    name:        '',
    phone:       '',
    email:       '',
    // Vehicle
    year:        '',
    make:        '',
    model:       '',
    licensePlate:'',
    milesIn:     '',
    // Job
    complaint:   '',
    advisories:  '',     // pre-existing conditions / deferred items
  });

  // Service advisor auto-stamped from current logged-in user
  const currentUser     = DataBridge.load('current_user');
  const serviceAdvisor  = currentUser?.name || 'UNASSIGNED';

  // ── CRM auto-search ────────────────────────────────────────────────────────
  const nameMatches = formData.name.length > 1
    ? customers.filter(c => c.name.toLowerCase().includes(formData.name.toLowerCase()))
    : [];

  const phoneMatches = formData.phone.length > 3 && formData.name.length <= 1
    ? customers.filter(c => c.phone.includes(formData.phone))
    : [];

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setFormData(p => ({ ...p, name: c.name, phone: c.phone, email: c.email || '' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setFormData(p => ({ ...p, name: '', phone: '', email: '', year: '', make: '', model: '', licensePlate: '' }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const selectVehicle = (v) => {
    setFormData(p => ({
      ...p,
      year:         String(v.year || ''),
      make:         v.make  || '',
      model:        v.model || '',
      licensePlate: v.licensePlate || '',
    }));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (!formData.name.trim() || !formData.model.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const jobId = `JOB-${Math.floor(1000 + Math.random() * 9000)}`;

    onComplete({
      ...formData,
      jobId,
      serviceAdvisor,
      customerId:   selectedCustomer?.id   || null,
      customerTier: selectedCustomer?.tier || 'STANDARD',
      milesIn:      parseInt(formData.milesIn.replace(/\D/g, '')) || 0,
      createdAt:    new Date().toISOString(),
    });
  };

  const set = (field) => (val) => setFormData(p => ({ ...p, [field]: val }));

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.versionTag}>INTAKE.CoreApp.002</Text>
          <Text style={styles.title}>VEHICLE INTAKE</Text>
          <Text style={styles.subtitle}>ESTABLISH PRELIMINARY DATA BRIDGE</Text>
        </View>

        {/* SERVICE ADVISOR STAMP */}
        <View style={styles.advisorStamp}>
          <ShieldCheck color="#3b82f6" size={14} />
          <Text style={styles.advisorText}>Service Advisor: <Text style={styles.advisorName}>{serviceAdvisor}</Text></Text>
        </View>

        {/* ── SELECTED CUSTOMER CARD ── */}
        {selectedCustomer && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedCardHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <User color="#818cf8" size={20} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={styles.selectedName}>{selectedCustomer.name}</Text>
                  <Text style={styles.selectedMeta}>{selectedCustomer.tier} TIER // {selectedCustomer.phone}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={clearCustomer}>
                <XCircle color="#ef4444" size={24} />
              </TouchableOpacity>
            </View>

            {/* Registered vehicles */}
            {selectedCustomer.vehicles?.length > 0 && (
              <View style={styles.vehicleList}>
                <Text style={styles.label}>SELECT REGISTERED ASSET</Text>
                {selectedCustomer.vehicles.map((v, i) => {
                  const active = formData.make === v.make && formData.model === v.model;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[styles.vehicleOption, active && styles.vehicleOptionActive]}
                      onPress={() => selectVehicle(v)}
                    >
                      <View>
                        <Text style={[styles.vehicleText, active && { color: '#10b981' }]}>
                          {v.year} {v.make} {v.model}
                        </Text>
                        <Text style={styles.vehicleVin}>VIN: {(v.vin || '').slice(-6)}</Text>
                      </View>
                      {active && <CheckCircle2 color="#10b981" size={20} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ── CUSTOMER SEARCH (new customer) ── */}
        {!selectedCustomer && (
          <>
            <SectionHeader label="CUSTOMER" />

            <Field label="CUSTOMER NAME (AUTO-SEARCH)">
              <InputBox icon={<User color="#3b82f6" size={18} />} highlight={nameMatches.length > 0}>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={set('name')}
                  placeholder="Full Name"
                  placeholderTextColor="#475569"
                />
              </InputBox>
              {nameMatches.length > 0 && (
                <SearchResults matches={nameMatches} onSelect={selectCustomer} />
              )}
            </Field>

            <Field label="CONTACT PHONE">
              <InputBox icon={<Phone color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.phone}
                  onChangeText={set('phone')}
                  placeholder="(555) 000-0000"
                  keyboardType="phone-pad"
                  placeholderTextColor="#475569"
                />
              </InputBox>
              {phoneMatches.length > 0 && (
                <SearchResults matches={phoneMatches} onSelect={selectCustomer} />
              )}
            </Field>

            <Field label="EMAIL (for estimates & invoices)">
              <InputBox icon={<Mail color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.email}
                  onChangeText={set('email')}
                  placeholder="customer@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#475569"
                />
              </InputBox>
            </Field>
          </>
        )}

        {/* ── VEHICLE ── */}
        <SectionHeader label="VEHICLE" />

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Field label="YEAR">
              <InputBox icon={<Car color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.year}
                  onChangeText={set('year')}
                  placeholder="2005"
                  keyboardType="numeric"
                  maxLength={4}
                  placeholderTextColor="#475569"
                />
              </InputBox>
            </Field>
          </View>
          <View style={{ flex: 2 }}>
            <Field label="MAKE">
              <InputBox icon={<Car color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.make}
                  onChangeText={set('make')}
                  placeholder="Toyota"
                  placeholderTextColor="#475569"
                />
              </InputBox>
            </Field>
          </View>
        </View>

        <Field label="MODEL">
          <InputBox icon={<Car color="#3b82f6" size={18} />}>
            <TextInput
              style={styles.input}
              value={formData.model}
              onChangeText={set('model')}
              placeholder="Camry LE"
              placeholderTextColor="#475569"
            />
          </InputBox>
        </Field>

        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Field label="LICENSE PLATE">
              <InputBox icon={<CreditCard color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.licensePlate}
                  onChangeText={set('licensePlate')}
                  placeholder="DL2Z482 TX"
                  autoCapitalize="characters"
                  placeholderTextColor="#475569"
                />
              </InputBox>
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="MILES IN">
              <InputBox icon={<Gauge color="#3b82f6" size={18} />}>
                <TextInput
                  style={styles.input}
                  value={formData.milesIn}
                  onChangeText={set('milesIn')}
                  placeholder="112,095"
                  keyboardType="numeric"
                  placeholderTextColor="#475569"
                />
              </InputBox>
            </Field>
          </View>
        </View>

        {/* ── JOB ── */}
        <SectionHeader label="JOB DETAILS" />

        <Field label="PRIMARY COMPLAINT">
          <InputBox icon={<AlertCircle color="#f59e0b" size={18} />} tall>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={formData.complaint}
              onChangeText={set('complaint')}
              placeholder="Customer's reason for visit..."
              placeholderTextColor="#475569"
            />
          </InputBox>
        </Field>

        <Field label="ADVISORY NOTES (pre-existing / deferred)">
          <InputBox icon={<ClipboardList color="#94a3b8" size={18} />} tall>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={formData.advisories}
              onChangeText={set('advisories')}
              placeholder="Oil pan gasket leaking, valve cover leaking, spark plugs due @120k..."
              placeholderTextColor="#475569"
            />
          </InputBox>
          <Text style={styles.fieldNote}>
            These are noted but NOT authorized for this visit. Will appear on the customer copy.
          </Text>
        </Field>

        {/* SUBMIT */}
        <TouchableOpacity style={styles.submitBtn} onPress={handleSave}>
          <Text style={styles.submitText}>COMMIT TO QUEUE</Text>
          <ChevronRight color="#fff" size={20} />
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── LOCAL COMPONENTS ─────────────────────────────────────────────────────────

const SectionHeader = ({ label }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.sectionLine} />
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={styles.sectionLine} />
  </View>
);

const Field = ({ label, children }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const InputBox = ({ icon, children, highlight, tall }) => (
  <View style={[
    styles.inputBox,
    tall   && { height: 110, alignItems: 'flex-start', paddingTop: 14 },
    highlight && { borderColor: '#818cf8' }
  ]}>
    <View style={styles.inputIcon}>{icon}</View>
    {children}
  </View>
);

const SearchResults = ({ matches, onSelect }) => (
  <View style={styles.searchResults}>
    {matches.map(c => (
      <TouchableOpacity key={c.id} style={styles.searchItem} onPress={() => onSelect(c)}>
        <View>
          <Text style={styles.searchName}>{c.name} <Text style={styles.searchTier}>({c.tier})</Text></Text>
          <Text style={styles.searchPhone}>{c.phone}</Text>
        </View>
        <ChevronRight color="#475569" size={20} />
      </TouchableOpacity>
    ))}
  </View>
);

// ─── STYLES ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#020617' },
  scrollContent:  { padding: 20 },

  header:         { marginBottom: 20 },
  versionTag:     { color: '#1e293b', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  title:          { color: '#fff', fontSize: 24, fontWeight: '900' },
  subtitle:       { color: '#475569', fontSize: 10, fontWeight: 'bold' },

  advisorStamp:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#1e293b', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  advisorText:    { color: '#64748b', fontSize: 11, fontWeight: 'bold' },
  advisorName:    { color: '#3b82f6', fontWeight: '900' },

  sectionHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  sectionLine:    { flex: 1, height: 1, backgroundColor: '#1e293b' },
  sectionLabel:   { color: '#334155', fontSize: 9, fontWeight: '900', letterSpacing: 2 },

  field:          { marginBottom: 16 },
  label:          { color: '#94a3b8', fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  inputBox:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 16, borderWidth: 1, borderColor: '#1e293b', paddingHorizontal: 15 },
  inputIcon:      { marginRight: 12 },
  input:          { flex: 1, height: 55, color: '#fff', fontSize: 15, fontWeight: '600' },
  multiline:      { height: 80, textAlignVertical: 'top', paddingTop: 4 },

  row:            { flexDirection: 'row', marginBottom: 0 },

  fieldNote:      { color: '#334155', fontSize: 9, fontWeight: 'bold', marginTop: 6, paddingHorizontal: 4 },

  // CRM results
  searchResults:  { backgroundColor: '#0f172a', borderRadius: 16, marginTop: 8, borderWidth: 1, borderColor: '#1e293b', overflow: 'hidden' },
  searchItem:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  searchName:     { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  searchTier:     { color: '#818cf8', fontSize: 10, fontWeight: 'bold' },
  searchPhone:    { color: '#64748b', fontSize: 12, marginTop: 3 },

  // Selected customer
  selectedCard:        { backgroundColor: '#0f172a', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#818cf8', marginBottom: 20 },
  selectedCardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  selectedName:        { color: '#fff', fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
  selectedMeta:        { color: '#818cf8', fontSize: 10, fontWeight: 'bold', marginTop: 2, letterSpacing: 1 },
  vehicleList:         { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 14 },
  vehicleOption:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#020617', padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1e293b' },
  vehicleOptionActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.05)' },
  vehicleText:         { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  vehicleVin:          { color: '#64748b', fontSize: 10, marginTop: 3, fontFamily: 'monospace' },

  // Submit
  submitBtn:      { backgroundColor: '#3b82f6', height: 70, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10, shadowColor: '#3b82f6', shadowOpacity: 0.3, shadowRadius: 12 },
  submitText:     { color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 10, letterSpacing: 1 },
});
