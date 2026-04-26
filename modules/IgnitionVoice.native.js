/**
 * FILE: IgnitionVoice.native.js
 * PLATFORM: Mobile (React Native)
 * PURPOSE: Handles voice recordings, submits them to a local AI transcriber API, and displays extracted parts manifests.
 * DEPENDENCIES: react, react-native, lucide-react-native, expo-haptics, expo-audio
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Mic, Square, ShieldCheck, AlertCircle, Car, Activity, CheckCircle2, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync } from 'expo-audio';

export default function IgnitionVoice({ selectedJob, onApprove }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [suggestedParts, setSuggestedParts] = useState([]);
  const [isApproved, setIsApproved] = useState(false);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const toggleRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (isRecording) {
      setIsRecording(false);
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      setIsParsing(true);

      try {
        const formData = new FormData();
        formData.append('file', { uri, type: 'audio/m4a', name: 'diagnostic.m4a' });

        // Points to your local Python API properly
        const response = await fetch('http://192.168.1.14:8000/transcribe', {
          method: 'POST',
          body: formData,
        });
        
        const data = await response.json();
        setTranscription(data.transcription);
        setSuggestedParts(data.partsManifest);
      } catch (err) {
        console.error("Transcription error: ", err);
      } finally {
        setIsParsing(false);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      try {
        const permission = await AudioModule.requestRecordingPermissionsAsync();
        if (!permission.granted) return;
        
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await audioRecorder.prepareToRecordAsync();
        audioRecorder.record();
        setIsRecording(true);
      } catch (err) {
        console.error('Failed to start recording', err);
      }
    }
  };

  const handleApprove = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsApproved(true);
    setTimeout(() => onApprove(transcription, suggestedParts), 1000);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.notesArea}>
        {isRecording ? (
          <Text style={styles.listeningText}>LISTENING TO TECHNICIAN...</Text>
        ) : isParsing ? (
          <ActivityIndicator color="#3b82f6" size="large" />
        ) : transcription ? (
          <Text style={styles.transcriptionText}>"{transcription}"</Text>
        ) : (
          <Text style={styles.placeholderText}>Awaiting technician voice input...</Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!transcription ? (
          <TouchableOpacity style={[styles.diagBtn, isRecording && styles.recordingBtn]} onPress={toggleRecording}>
            {isRecording ? <Square color="#fff" size={24} /> : <Mic color="#fff" size={24} />}
            <Text style={styles.diagBtnText}>{isRecording ? "STOP & TRANSCRIBE" : "START DIAGNOSTIC"}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.diagBtn} onPress={handleApprove}>
            <Text style={styles.diagBtnText}>APPROVE & SEND ESTIMATE</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617', padding: 20 },
  // ... Rest of styles
});