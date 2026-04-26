/**
 * MODULE: HUB (Dispatch & Logistics)
 * VERSION: v1.0.0
 * DESC: Live map-based dispatching and mobile unit tracking.
 */

import React, { useState } from 'react';
import { Map, Navigation, Truck, AlertCircle, Radio, Clock, Lock, Package } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionHub = ({ activeJob }) => {
  const { isExpired } = DataBridge.checkTrialStatus('HUB');

  // Telematics Hook: Connect the active_job_context in the DataBridge
  const hasCriticalFailure = activeJob?.inventory?.specialized?.some(item => item.health === 'RED');
  
  const baseUnits = [
    { id: 'M-1', name: 'Mobile Tech 1 (John)', status: 'ON_JOB', lat: '30.57', lng: '-97.85', eta: '14 mins' },
    { id: 'M-2', name: 'Mobile Tech 2 (Dave)', status: 'IDLE', lat: '30.61', lng: '-97.88', eta: 'N/A' },
  ];

  // Map the hoisted activeJob into a live telematics unit
  const mappedActiveJob = activeJob ? { 
    id: activeJob.id, 
    name: `${activeJob.unit} (Active Job)`, 
    status: hasCriticalFailure ? 'CRITICAL' : 'ON_JOB', 
    lat: '30.55', 
    lng: '-97.82', 
    eta: activeJob.status === 'IN_TRANSIT' ? '8 mins' : 'At Shop / Dispatching',
    fault: hasCriticalFailure ? 'FLUX PMI ALERT' : ''
  } : null;

  const units = mappedActiveJob ? [...baseUnits, mappedActiveJob] : baseUnits;

  // External Carrier Virtual Markers
  const ghostUnits = [
    { id: 'PO-9928', name: 'NAPA Carrier (External)', status: 'SHADOW', lat: '30.565', lng: '-97.845', eta: '12 mins' }
  ];

  return (
    <div className="p-0 bg-black text-slate-200 min-h-screen flex flex-col relative">
      {/* HUD OVERLAY HEADER */}
      <header className="absolute top-6 left-6 right-6 z-10 flex justify-between items-start pointer-events-none">
        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 pointer-events-auto">
          <h2 className="text-xl font-black italic text-white uppercase tracking-tighter text-blue-500">HUB // Dispatch</h2>
          <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Active Fleet: {units.length} Units</p>
        </div>
        
        <div className="bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-700 pointer-events-auto text-right">
          <div className="flex items-center gap-2 text-emerald-500 mb-1 justify-end">
            <Radio size={12} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest">Live Telematics</span>
          </div>
          <p className="text-xs font-bold text-white uppercase">Leander, TX Zone</p>
        </div>
      </header>

      {/* THE MAP (Simulated Viewport) */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden">
        {/* Mock Map Background via CSS Grid for API-free prototyping */}
        <div 
          className={`absolute inset-0 flex items-center justify-center transition-all ${isExpired ? 'filter blur-2xl grayscale' : ''}`}
          style={{
            backgroundColor: '#020617', // slate-950
            backgroundImage: 'linear-gradient(rgba(30, 41, 59, 0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 41, 59, 0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            backgroundPosition: 'center center'
          }}
        >
          {/* Subtle glowing orb in the center to represent city topology */}
          <div className="w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none"></div>
        </div>

        {/* MOCK UNIT MARKERS */}
        {!isExpired && units.map(unit => (
          <div key={unit.id} className="absolute transition-all cursor-pointer group" style={{ top: `${(parseFloat(unit.lat)-30.5)*1000}%`, left: `${(parseFloat(unit.lng)+97.9)*1000}%` }}>
            <div className={`p-2 rounded-full border-2 ${unit.status === 'CRITICAL' ? 'bg-red-500 border-white shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse' : 'bg-blue-600 border-white shadow-[0_0_15px_rgba(37,99,235,0.5)]'}`}>
              <Truck size={16} className="text-white" />
            </div>
            {/* TOOLTIP */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-tighter">{unit.name}</p>
              <p className="text-[8px] text-slate-400 uppercase">{unit.status} // ETA: {unit.eta}</p>
            </div>
          </div>
        ))}

        {/* EXTERNAL SHADOW MARKERS */}
        {!isExpired && ghostUnits.map(unit => (
          <div key={unit.id} className="absolute transition-all cursor-pointer group z-10" style={{ top: `${(parseFloat(unit.lat)-30.5)*1000}%`, left: `${(parseFloat(unit.lng)+97.9)*1000}%` }}>
            <div className="p-2 rounded-full border-2 border-orange-500 border-dashed bg-slate-900 shadow-[0_0_15px_rgba(249,115,22,0.6)] animate-pulse">
              <Package size={16} className="text-orange-500" />
            </div>
            {/* TOOLTIP */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 shadow-xl">
              <p className="text-[10px] font-black uppercase tracking-tighter text-orange-500">{unit.name}</p>
              <p className="text-[8px] text-slate-400 uppercase">{unit.status} // ETA: {unit.eta}</p>
            </div>
          </div>
        ))}

        {/* PAYWALL OVERLAY */}
        {isExpired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md z-30">
            <div className="bg-slate-900 p-8 rounded-3xl border border-blue-500/30 text-center max-w-xs shadow-2xl shadow-blue-900/50">
              <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50">
                <Map size={32} className="text-blue-500" />
              </div>
              <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Logistics Locked</h3>
              <p className="text-xs text-slate-400 mb-6 uppercase leading-relaxed font-bold">Your 30-day trial for HUB has expired. Live tracking and dispatching are hidden.</p>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl text-xs uppercase shadow-lg shadow-blue-900/40 transition">Activate HUB</button>
            </div>
          </div>
        )}
      </div>

      {/* UNIT STATUS LIST (BOTTOM DRAWER) */}
      <footer className="bg-slate-900 border-t border-slate-800 p-6 max-h-64 overflow-y-auto z-40">
        <h3 className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2">
          <Truck size={12} /> Fleet Unit Overview
        </h3>
        <div className="grid gap-3">
          {units.map(unit => (
            <div key={unit.id} className={`flex justify-between items-center bg-black/40 p-4 rounded-2xl border ${unit.status === 'CRITICAL' ? 'border-red-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${unit.status === 'CRITICAL' ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,1)]' : 'bg-emerald-500 animate-pulse'}`}></div>
                <div>
                  <p className="text-xs font-black text-white uppercase italic">{unit.name}</p>
                  {unit.status === 'CRITICAL' && <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-1"><AlertCircle size={10} className="inline mr-1"/> FAULT DETECTED: {unit.fault}</p>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-500 uppercase italic">Current ETA</p>
                <p className="text-sm font-black text-white">{unit.eta}</p>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default IgnitionHub;
