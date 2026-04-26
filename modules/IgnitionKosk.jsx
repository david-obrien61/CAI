/**
 * MODULE: KOSK (Technician Kiosk)
 * VERSION: v1.0.1
 * DESC: Simplified, high-contrast UI for shop-floor operations.
 */

import React, { useState } from 'react';
import { Clock, Barcode, ClipboardList, Mic, Play, Square, CheckCircle, Unlock, Activity, AlertOctagon } from 'lucide-react';
import DataBridge from '../DataBridge';
import { useIgnitionVoice } from '../hooks/useIgnitionVoice';
import IgnitionHandover from './IgnitionHandover';
import { usePowerSense } from '../hooks/usePowerSense';

const IgnitionKosk = ({ activeJob, onUpdateJob, onExitKiosk }) => {
  const [isClockedIn, setIsClockedIn] = useState(false);
  const isDotMandated = (() => {
    const val = DataBridge.load('is_dot_mandated');
    return val === null ? true : val;
  })();

  const [showHandover, setShowHandover] = useState(false);

  const handleVoiceCommand = (cmd) => {
    if (cmd === 'suspend') {
      setShowHandover(true);
    }
  };

  const executeHandover = ({ note, isOperable }) => {
     const updatedJob = {
        ...activeJob,
        status: 'SUSPENDED',
        handover: { note, isOperable, timestamp: Date.now() }
     };
     onUpdateJob(updatedJob);
     DataBridge.save('active_job_context', updatedJob);
     setShowHandover(false);
  };

  const { isToolboxMode, voiceMode, autoLockEnabled } = usePowerSense();
  const { isListening } = useIgnitionVoice(handleVoiceCommand, voiceMode);

  const handleDictate = () => {
    const note = prompt("🎤 Simulating Voice Transcription.\nSpeak now (type your note):");
    if (note) {
      const updatedJob = {
        ...activeJob,
        notes: [...(activeJob.notes || []), `[${new Date().toLocaleTimeString()}] TRANSCRIPT: "${note}"`]
      };
      
      // Hoisted state update
      onUpdateJob(updatedJob);
      // Persistent state update
      DataBridge.save('active_job_context', updatedJob);
    }
  };

  return (
    <div className={`p-4 bg-black text-white min-h-screen flex flex-col relative w-full h-full transition-all duration-700 ${
      isToolboxMode 
        ? 'border-[6px] border-blue-500 shadow-[0_0_120px_rgba(59,130,246,0.3)_inset] rounded-[2rem]' 
        : 'border-t-4 border-slate-900 rounded-none'
    }`}>
      {showHandover && (
        <IgnitionHandover 
          activeJob={activeJob} 
          onSubmit={executeHandover} 
          onCancel={() => setShowHandover(false)} 
        />
      )}

      {/* KIOSK ESCAPE HATCH */}
      <button onClick={onExitKiosk} className="absolute top-8 right-6 text-slate-800 hover:text-slate-500 transition-colors z-50">
        <Unlock size={20} />
      </button>

      {/* KIOSK HEADER: TIME & STATUS */}
      <header className="flex justify-between items-center bg-slate-900 p-6 rounded-3xl border border-slate-800 mb-6 mt-4 relative overflow-hidden">
        {isListening && (
           <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.8)]"></div>
        )}
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${isListening ? 'text-blue-500 animate-pulse' : 'text-blue-500'}`}>
            {isListening ? 'Tech Station 01 (Listening)' : 'Tech Station 01'}
          </p>
          <h2 className="text-3xl font-black tabular-nums">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 uppercase mb-1">Current Status</p>
          <span className={`text-xs font-black px-3 py-1 rounded-full ${isClockedIn ? 'bg-emerald-500 text-black' : 'bg-red-500 text-white'}`}>
            {isClockedIn ? 'ON THE CLOCK' : 'CLOCKED OUT'}
          </span>
        </div>
      </header>

      {/* PRIMARY KIOSK ACTIONS */}
      <div className="grid grid-cols-1 gap-4 flex-1">
        
        {/* TIME CLOCK TOGGLE */}
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => {
              if (!isClockedIn) {
                 const assignedSize = activeJob?.assigned_crew_size || 1;
                 const currentTechs = activeJob?.active_techs?.length || 0;
                 if (assignedSize !== 'ALL' && currentTechs >= assignedSize) {
                    alert(`CREW CAP REACHED: Work Order designated for ${assignedSize} mechanic(s) maximum.`);
                    return;
                 }
                 const newTechs = [...(activeJob?.active_techs || []), 'TECH_01'];
                 const updated = { ...activeJob, active_techs: newTechs };
                 onUpdateJob(updated);
                 DataBridge.save('active_job_context', updated);
              } else {
                 const newTechs = (activeJob?.active_techs || []).filter(t => t !== 'TECH_01');
                 const updated = { ...activeJob, active_techs: newTechs };
                 onUpdateJob(updated);
                 DataBridge.save('active_job_context', updated);
              }
              setIsClockedIn(!isClockedIn);
            }}
            className={`h-32 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 ${
              isClockedIn ? 'bg-red-600 shadow-lg shadow-red-900/20 col-span-1' : 'bg-emerald-600 shadow-lg shadow-emerald-900/20 col-span-2'
            }`}
          >
            {isClockedIn ? <Square size={32} fill="white" /> : <Play size={32} fill="white" />}
            <span className="text-xl font-black uppercase italic tracking-tighter">
              {isClockedIn ? 'Punch Out' : 'Punch In'}
            </span>
          </button>

          {isClockedIn && (
            <button 
              onClick={() => setShowHandover(true)}
              className="h-32 bg-slate-800 border-2 border-slate-700 rounded-3xl flex flex-col items-center justify-center gap-2 transition-all hover:border-orange-500 active:scale-95"
            >
              <AlertOctagon size={32} className="text-orange-500" />
              <span className="text-xl font-black uppercase italic tracking-tighter text-white">Suspend</span>
            </button>
          )}
        </div>

        {/* SCAN / INVENTORY ACTION */}
        <button className="h-28 bg-slate-800 rounded-3xl border-2 border-slate-700 flex flex-col items-center justify-center gap-2 active:scale-95">
          <Barcode size={32} className="text-blue-500" />
          <span className="text-lg font-black uppercase italic tracking-tighter text-white">Scan Part / Bin</span>
        </button>

        {/* EXTERNAL PARTS ETA TRACKER */}
        <div className="bg-slate-900 border border-orange-500/30 p-4 rounded-3xl flex justify-between items-center relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-orange-500 animate-pulse"></div>
          <div>
             <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest pl-2">External PO Shadow</p>
             <h4 className="text-sm font-bold text-white uppercase italic pl-2">NAPA Auto Parts - PO-9928</h4>
          </div>
          <div className="text-right">
             <p className="text-[9px] font-black text-slate-500 uppercase">Parts Inbound</p>
             <span className="text-xl font-black text-white italic tabular-nums">12 MINS</span>
          </div>
        </div>

        {/* ACTIVE TASK / PMI WORKFLOW */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2">
                <ClipboardList size={14} /> Active Work Order
              </h3>
              <span className="bg-blue-600/20 text-blue-500 text-[10px] px-2 py-1 rounded font-bold">Priority</span>
            </div>
            <p className="text-xl font-black text-white mb-1">{activeJob.unit} - {activeJob.id}</p>
            <p className="text-xs text-slate-500 mb-2">Bay 4 // Engine Shop</p>
            
            {/* PINNED DIGITAL NOTE (High-Visibility Safety Injection) */}
            {activeJob?.status === 'SUSPENDED' && activeJob?.handover && (
              <div className={`mt-4 mb-4 border-l-4 p-4 rounded-r-2xl shadow-lg ${
                activeJob.handover.isOperable ? 'bg-yellow-500/10 border-yellow-500' : 'bg-orange-600/20 border-orange-600'
              }`}>
                <div className="flex justify-between items-center mb-2">
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${
                    activeJob.handover.isOperable ? 'text-yellow-500' : 'text-orange-500 animate-pulse'
                  }`}>
                    {activeJob.handover.isOperable ? 'Shift Handover Note' : 'CRITICAL: DO NOT MOVE'}
                  </h3>
                </div>
                <p className="text-white font-mono text-sm leading-relaxed">{activeJob.handover.note}</p>
              </div>
            )}

            <div className={`mt-2 text-[10px] font-black uppercase flex items-center gap-1 border w-fit px-2 py-1 rounded ${
              activeJob.status === 'AUTHORIZED' 
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' 
                : 'border-orange-500/20 bg-orange-500/10 text-orange-400'
            }`}>
              Workflow Status: {activeJob.status}
            </div>
          </div>
          
          {/* Notes display inside Kosk */}
          {activeJob.notes && activeJob.notes.length > 0 && (
            <div className="mt-4 bg-black/50 p-3 rounded-lg border border-slate-800 max-h-24 overflow-y-auto">
              <p className="text-[10px] text-slate-500 font-black mb-1">TRANSCRIBED NOTES:</p>
              {activeJob.notes.map((n, i) => (
                <p key={i} className="text-[10px] text-emerald-400 italic font-mono mb-1">{n}</p>
              ))}
            </div>
          )}

          <div className="flex gap-4 mt-6">
            <button onClick={handleDictate} className="flex-1 bg-slate-800 p-4 rounded-2xl flex items-center justify-center gap-2 border border-slate-700 active:bg-slate-700">
              <Mic size={20} className="text-blue-500" />
              <span className="text-xs font-black uppercase">Dictate Notes</span>
            </button>
            <button className="flex-1 bg-white text-black p-4 rounded-2xl flex items-center justify-center gap-2 font-black active:bg-slate-200">
              <CheckCircle size={20} />
              <span className="text-xs font-black uppercase">Finish Job</span>
            </button>
          </div>
        </div>
      </div>

      {/* THE GREASEMONKEY FAST-ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/90 backdrop-blur-md pb-24">
        <button 
          className="w-full bg-emerald-600 h-24 rounded-2xl flex items-center justify-center gap-4 active:bg-emerald-500 shadow-2xl transition-transform active:scale-[0.98]"
          onClick={() => {
            if (isDotMandated) {
                alert("DOT MANDATE ACTIVE: Digital Inspection Form Required before completion.");
                return;
            }
            DataBridge.smartSync('KOSK_TECH_ACTION', { action: "Complete Inspection", timestamp: Date.now() });
            alert("Smart Action Triggered: Auto-advancing workflow! (Safety Gates Bypassed)");
          }}
        >
          <div className="bg-white/20 p-3 rounded-full animate-pulse">
            <CheckCircle size={32} className="text-white" />
          </div>
          <span className="text-2xl font-black uppercase italic text-white tracking-widest">
            {activeJob ? "Complete Inspection" : "Start New Job"}
          </span>
        </button>
      </div>

    </div>
  );
};

export default IgnitionKosk;
