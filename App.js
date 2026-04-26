/**
 * FILE: App.js
 * PLATFORM: Mobile (React Native / Expo)
 * PURPOSE: Main entry point and secure terminal router for the Ignition OS mobile app.
 * DEPENDENCIES: react, react-native, react-native-safe-area-context, lucide-react-native, expo-haptics
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, FlatList, Dimensions, StatusBar } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  Lock, ChevronLeft, Tag, LayoutList, Scan, Package, Mic,
  Clock, Ghost, Wrench, ShoppingCart, Zap, ShieldCheck, Truck, Settings, LayoutGrid, ShieldAlert, FileSignature
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// Hooks & Modules
import { useDataBridge } from './hooks/useDataBridge';
import { useIgnitionCipher } from './hooks/useIgnitionCipher'; 
import TechKeypad from './modules/TechKeypad';
import IgnitionIntake from './modules/IgnitionIntake';
import IgnitionQueue from './modules/IgnitionQueue';
import IgnitionVIN from './modules/IgnitionVIN';
import PartsList from './modules/PartsList';
import IgnitionAdmin from './modules/IgnitionAdmin';
import IgnitionVoice from './modules/IgnitionVoice';
import CustomerEstimate from './modules/CustomerEstimate';
import EnrollmentCatch from './EnrollmentCatch';

const { width } = Dimensions.get('window');
const TILE_SIZE = (width / 4) - 15;

/**
 * Refactored ModuleRouter: 
 * Extracts the heavy switch statement into a pure component to prevent 
 * MainContent from recalculating inline JSX functions on every render.
 */
const ModuleRouter = ({ 
  currentModule, 
  selectedJob, 
  setSelectedJob, 
  setCurrentModule, 
  jobs, 
  registry, 
  activeProfile, 
  addJob, 
  updateJob, 
  toggleModule, 
  triggerGlobalLockout, 
  updatePrefs 
}) => {
  switch(currentModule) {
    case 'intake': 
      return (
        <IgnitionIntake 
          onComplete={(d) => { 
            addJob(d); 
            setCurrentModule(null); 
          }} 
        />
      );
    case 'queue': 
      return (
        <IgnitionQueue 
          jobs={jobs} 
          onSelectJob={(j) => { 
            setSelectedJob(j); 
            if (j.status === 'NEEDS_ESTIMATE') {
              setCurrentModule('estimate_doc');
            } else if (j.isValidated) {
              setCurrentModule('voice');
            } else {
              setCurrentModule('vin'); 
            }
          }} 
        />
      );
    case 'vin': 
      return (
        <IgnitionVIN 
          jobData={selectedJob} 
          onComplete={(verifiedData) => {
            updateJob(selectedJob.jobId, { ...verifiedData, isValidated: true });
            setSelectedJob({ ...selectedJob, ...verifiedData, isValidated: true });
            setCurrentModule('voice'); 
          }} 
        />
      );
    case 'voice': 
      return (
        <IgnitionVoice 
          selectedJob={selectedJob} 
          onApprove={(notes, parts) => {
            updateJob(selectedJob.jobId, { transcription: notes, suggestedParts: parts, status: 'NEEDS_ESTIMATE' });
            setCurrentModule(null);
          }}
        />
      );
    case 'estimates':
      return (
        <IgnitionQueue 
          jobs={jobs.filter(job => job.status === 'NEEDS_ESTIMATE')} 
          onSelectJob={(j) => { 
            setSelectedJob(j); 
            setCurrentModule('estimate_doc'); 
          }} 
        />
      );
    case 'estimate_doc':
      return <CustomerEstimate selectedJob={selectedJob} />;
    case 'parts': 
      return <PartsList selectedJob={selectedJob} profile={activeProfile} onUpdatePrefs={updatePrefs} />;
    case 'admin': 
      return <IgnitionAdmin registry={registry} onToggle={toggleModule} onLockout={triggerGlobalLockout} />;
    default: 
      return null;
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <MainContent />
    </SafeAreaProvider>
  );
}

function MainContent() {
  const insets = useSafeAreaInsets();
  const [currentModule, setCurrentModule] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  
  const { registry, jobs, isLocked, addJob, updateJob, toggleModule, triggerGlobalLockout, unlockSystem } = useDataBridge();
  const { activeProfile, authenticate, logout, updatePrefs, signWaiver } = useIgnitionCipher();

  const getIcon = (id, color) => {
    const p = { color, size: 28, strokeWidth: 2 };
    switch(id) {
      case 'intake': return <Tag {...p} />;
      case 'queue': return <LayoutList {...p} />;
      case 'vin': return <Scan {...p} />;
      case 'voice': return <Mic {...p} />;
      case 'parts': return <Package {...p} />;
      case 'procure': return <ShoppingCart {...p} />;
      case 'estimates': return <FileSignature {...p} />;
      case 'tools': return <Wrench {...p} />;
      case 'admin': return <Settings {...p} />;
      case 'fleet': return <Truck {...p} />;
      case 'inv': return <Zap {...p} />;
      default: return <LayoutGrid {...p} />;
    }
  };

  if (isLocked) {
    return (
      <View style={[styles.lockoutScreen, { paddingTop: insets.top }]}>
        <ShieldAlert color="#ef4444" size={80} />
        <Text style={styles.lockoutTitle}>SYSTEM SUSPENDED</Text>
        <Text style={styles.lockoutText}>Terminal access restricted by Administrator.</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={unlockSystem}>
          <Text style={styles.unlockText}>RE-AUTHORIZE TERMINAL</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />
      {!activeProfile ? (
        <View style={styles.loginCenter}>
          <Text style={styles.cipherLabel}>IGNITION OS // SECURE TERMINAL</Text>
          <TechKeypad onUnlock={authenticate} />
        </View>
      ) : !activeProfile.hasSignedWaiver ? (
        <View style={{flex: 1}}>
          <EnrollmentCatch profile={activeProfile} onComplete={signWaiver} />
        </View>
      ) : (
        <View style={{flex: 1}}>
          <View style={styles.header}>
            {currentModule ? (
              <TouchableOpacity onPress={() => setCurrentModule(null)} style={styles.backBtn}>
                <ChevronLeft color="#3b82f6" size={24} /><Text style={styles.backText}>DASHBOARD</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.titleRow}>
                <View>
                  <Text style={styles.welcome}>{activeProfile.name}</Text>
                  <Text style={styles.subHeader}>{activeProfile.role} // SESSION ACTIVE</Text>
                </View>
                <TouchableOpacity onPress={logout} style={styles.powerBtn}>
                  <Lock color="#ef4444" size={18} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          
          {currentModule ? (
            <ModuleRouter 
              currentModule={currentModule}
              selectedJob={selectedJob}
              setSelectedJob={setSelectedJob}
              setCurrentModule={setCurrentModule}
              jobs={jobs}
              registry={registry}
              activeProfile={activeProfile}
              addJob={addJob}
              updateJob={updateJob}
              toggleModule={toggleModule}
              triggerGlobalLockout={triggerGlobalLockout}
              updatePrefs={updatePrefs}
            />
          ) : (
            <FlatList
              data={activeProfile.allowed.map(id => registry[id]).filter(item => item && item.active)}
              numColumns={4}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.grid}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.tile} 
                  onPress={() => { 
                    setCurrentModule(item.id); 
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); 
                  }}
                >
                  <View style={[styles.iconContainer, { borderColor: item.color + '40' }]}>
                    {getIcon(item.id, item.color)}
                  </View>
                  <Text style={styles.tileLabel}>{item.label.toUpperCase()}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  loginCenter: { flex: 1, justifyContent: 'center', padding: 30 },
  cipherLabel: { color: '#334155', textAlign: 'center', marginBottom: 20, fontSize: 10, fontWeight: '900', letterSpacing: 3 },
  header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  welcome: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  subHeader: { color: '#475569', fontSize: 10, fontWeight: 'bold' },
  powerBtn: { padding: 10, backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#1e293b' },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { color: '#3b82f6', fontWeight: 'bold', fontSize: 12, marginLeft: 5 },
  grid: { padding: 10 },
  tile: { width: TILE_SIZE, margin: 7, alignItems: 'center', marginBottom: 15 },
  iconContainer: { width: TILE_SIZE - 5, height: TILE_SIZE - 5, backgroundColor: '#0f172a', borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  tileLabel: { color: '#94a3b8', fontSize: 7, fontWeight: '900', marginTop: 8, textAlign: 'center' },
  lockoutScreen: { flex: 1, backgroundColor: '#450a0a', justifyContent: 'center', alignItems: 'center', padding: 40 },
  lockoutTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 30 },
  lockoutText: { color: '#fca5a5', textAlign: 'center', marginTop: 15, fontSize: 16, lineHeight: 24 },
  unlockBtn: { marginTop: 40, backgroundColor: '#fff', padding: 20, borderRadius: 16 },
  unlockText: { color: '#450a0a', fontWeight: '900' }
});