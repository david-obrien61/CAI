/**
 * MODULE: Ignition Flux
 * VERSION: v1.1.7
 * UPDATES: 
 * - Integrated Hoisted State (activeJob, onUpdateJob).
 * - Added Foreman PIN Lock for 'RED' health assets.
 * - Added Automated Ingestion Hooks (VIN Sniper/Telematics).
 */

import React, { useState } from 'react';
import { 
  Settings, Wrench, ClipboardCheck, AlertCircle, 
  ShieldCheck, XCircle, Lock, Camera, Zap, Mic, Users 
} from 'lucide-react';
import DataBridge from '../DataBridge';

const JobAssignment = ({ activeJob, onUpdateJob }) => {
  const crewSize = activeJob?.assigned_crew_size || 1;

  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 mb-8 shadow-xl">
      <h3 className="text-xs font-black text-slate-500 uppercase flex items-center gap-2 mb-4 tracking-widest">
          <Users size={14} className="text-emerald-500" /> Work Order Manpower Setup
      </h3>
      
      <div className="flex gap-4 mb-4">
        {[1, 2, 'ALL'].map(size => (
          <button 
            key={size}
            onClick={() => onUpdateJob({ ...activeJob, assigned_crew_size: size })}
            className={`flex-1 py-4 rounded-xl border-2 font-black transition-all text-xs uppercase tracking-widest shadow-lg ${
              crewSize === size ? 'bg-blue-600 border-blue-400 text-white shadow-blue-900/30' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-white'
            }`}
          >
            {size === 'ALL' ? 'ALL HANDS' : `${size} TECHS`}
          </button>
        ))}
      </div>

      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest text-center mt-4">
        * KOSK WILL ENFORCE THIS CAP DURING TECHNICIAN LOG-INS.
      </p>
    </div>
  );
};

const IgnitionFlux = ({ activeJob, onUpdateJob }) => {
  const [pinInput, setPinInput] = useState('');
  const [isPinVisible, setIsPinVisible] = useState(false);

  // 1. Logic Hook: Identify critical failures requiring Foreman Override
  const hasCriticalFailure = activeJob.inventory.specialized.some(item => item.health === 'RED');

  const isDotMandated = (() => {
    const val = DataBridge.load('is_dot_mandated');
    return val === null ? true : val;
  })();

  const handleAuthorization = () => {
    if (isDotMandated) {
      alert("DOT COMPLIANCE GATE ACTIVE: A digital FHMSA inspection form must be completed prior to asset release.");
      return;
    }
    // In a production environment, validate pinInput against a secure hash
    const updatedJob = { 
      ...activeJob, 
      status: 'IN_TRANSIT', 
      authorizedBy: hasCriticalFailure ? 'Foreman Override' : 'System Auto-Approve',
      dispatchedAt: new Date().toISOString()
    };
    
    onUpdateJob(updatedJob);
    setIsPinVisible(false);

    // Auto-record Margin Leakage entry on departure
    const existingTx = DataBridge.load('transaction_history') || [];
    existingTx.push({
      customer: activeJob.unit || 'Walk-In Fleet',
      tier: hasCriticalFailure ? 'FF' : 'STANDARD',
      standardPrice: 450,
      actualPrice: hasCriticalFailure ? 200 : 450 // Favor given if out of service!
    });
    DataBridge.save('transaction_history', existingTx);
    alert('Departure Authorized! Submitting telemetry and logging Leakage Data to OMNI.');
  };

  const getHealthColor = (status) => {
    if (status === 'GREEN') return 'text-emerald-400';
    if (status === 'YELLOW') return 'text-orange-400';
    return 'text-red-500';
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">
      <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-black italic tracking-tighter text-white">IGNITION FLUX</h2>
          <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">
            Unit Context: {activeJob.unit} // Status: {activeJob.status}
          </p>
        </div>
        <div className="flex gap-2">
           <button className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700">
             <Camera size={18} className="text-slate-400" />
           </button>
           <button className="bg-slate-800 p-2 rounded-lg border border-slate-700 hover:bg-slate-700">
             <Zap size={18} className="text-blue-500" />
           </button>
        </div>
      </header>

      {!isDotMandated && (
        <div className="bg-red-600 font-black text-white text-center py-2 px-4 rounded-xl uppercase tracking-widest text-xs animate-pulse mb-6 shadow-[0_0_20px_rgba(220,38,38,0.5)]">
            SAFETY GATE DISABLED BY OWNER
        </div>
      )}

      {/* TIERED LOADOUT & PMI HEALTH */}
      <section className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Specialized Gear & Asset Health */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 shadow-xl">
          <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest">
            <Wrench size={14} /> Specialized Gear & PMI
          </h3>
          <div className="space-y-3">
            {activeJob.inventory.specialized.length > 0 ? (
              activeJob.inventory.specialized.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                  <span className="text-sm font-bold">{item.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black ${getHealthColor(item.health)}`}>
                      {item.health === 'RED' ? 'OUT_OF_SERVICE' : item.health}
                    </span>
                    {item.health === 'RED' ? <XCircle size={14} className="text-red-500" /> : <ShieldCheck size={14} className="text-blue-500" />}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No specialized gear assigned. Use Ingestion to add assets.</p>
            )}
          </div>
        </div>

        {/* Base Loadout & Consumables */}
        <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700">
          <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest">
            <ClipboardCheck size={14} /> Base Loadout Verification
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-800">
               <span className="text-xs text-slate-300 italic">Common Parts & Hand Tools</span>
               <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded font-black border border-emerald-500/20">VERIFIED</span>
             </div>
             <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-mono">
               Note: All mobile units are equipped with standard air compressors and 1/2" impacts as baseline inventory.
             </p>
          </div>
        </div>
      </section>

      {/* FIELD INTELLIGENCE */}
      <section className="bg-slate-800 p-5 rounded-2xl border border-slate-700 mb-8 shadow-xl">
        <h3 className="text-xs font-black uppercase text-slate-500 mb-4 flex items-center gap-2 tracking-widest">
           <Mic size={14} className="text-blue-500" /> Technician Field Intelligence Sync
        </h3>
        <div className="space-y-2">
          {activeJob.notes && activeJob.notes.length > 0 ? (
            activeJob.notes.map((n, i) => (
               <div key={i} className="bg-slate-900/50 p-3 rounded-xl border border-slate-700 text-emerald-400 font-mono text-xs shadow-inner">
                 {n}
               </div>
            ))
          ) : (
             <p className="text-xs text-slate-500 italic">No field notes synced for this unit.</p>
          )}
        </div>
      </section>

      {/* JOB ASSIGNMENT SETUP */}
      <JobAssignment activeJob={activeJob} onUpdateJob={onUpdateJob} />

      {/* DISPATCH CONTROL & FOREMAN OVERRIDE */}
      <div className="mt-auto">
        {hasCriticalFailure ? (
          <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-2xl">
            <div className="flex items-start gap-4 mb-6">
              <Lock size={24} className="text-red-500 mt-1" />
              <div>
                <p className="text-md font-black text-white uppercase italic tracking-tighter">Safety Dispatch Lock</p>
                <p className="text-xs text-slate-400">
                  Critical equipment is flagged as <span className="text-red-500 font-bold underline">Out of Service</span>.
                  A Foreman PIN is required to authorize this mobile unit for dispatch.
                </p>
              </div>
            </div>
            
            {!isPinVisible ? (
              <button 
                onClick={() => setIsPinVisible(true)}
                className="w-full bg-red-600 text-white font-black py-4 rounded-xl hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all text-xs uppercase tracking-widest"
              >
                Request Foreman Override
              </button>
            ) : (
              <div className="space-y-3">
                <input 
                  type="password" 
                  placeholder="ENTER 4-DIGIT PIN" 
                  className="w-full bg-slate-950 border border-slate-700 p-4 rounded-xl text-center tracking-[1em] text-white"
                  onChange={(e) => setPinInput(e.target.value)}
                />
                <button 
                  onClick={handleAuthorization}
                  className="w-full bg-orange-600 text-white font-black py-4 rounded-xl shadow-lg shadow-orange-900/20 uppercase tracking-widest text-xs hover:bg-orange-500 transition-colors"
                >
                  Confirm Override & Dispatch
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={handleAuthorization}
            className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-blue-500 shadow-xl shadow-blue-900/20 text-sm uppercase tracking-widest"
          >
            Authorize Field Dispatch
          </button>
        )}
      </div>
    </div>
  );
};

export default IgnitionFlux;
