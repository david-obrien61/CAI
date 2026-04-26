/**
 * MODULE: PROT (Invoice & Margin Protector)
 * VERSION: v1.4.0
 * UPDATES: Integrated Margin Matrix with Global Anchor and Tier Offsets.
 */

import React, { useState } from 'react';
import { Settings, Users, Heart, ShieldCheck, Sliders, Camera, Lock } from 'lucide-react';
import DataBridge from '../DataBridge';

const IgnitionProt = () => {
  const { isExpired } = DataBridge.checkTrialStatus('PROT');

  const [matrix, setMatrixState] = useState(DataBridge.getProtMatrix());
  const [rates, setRatesState] = useState(DataBridge.getSystemRates());

  const setMatrix = (newMatrix) => {
    setMatrixState(newMatrix);
    DataBridge.save('prot_matrix', newMatrix); // Persist across modules
  };

  const setRates = (newRates) => {
    setRatesState(newRates);
    const currentUser = DataBridge.load('current_user') || { id: 'SYSTEM' };
    DataBridge.setSystemRates(newRates, currentUser.id);
  };

  const [ffEnabled, setFfEnabled] = useState(false);
  const [selectedTier, setSelectedTier] = useState('STANDARD');
  const [scanResult, setScanResult] = useState(null);

  // 2. Logic: Uses DataBridge calculations
  const getActiveMargin = (tier) => DataBridge.getActiveMargin(tier);
  const calculateRetail = (cost, margin) => DataBridge.calculateRetail(cost, margin);

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-emerald-500">PROT // Margin Matrix</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Pricing Strategy Command</p>
        </div>
        {isExpired ? (
          <span className="text-[9px] font-black text-red-500 border border-red-500/20 px-2 py-1 rounded">LOCKED</span>
        ) : (
          <Settings className="text-slate-600 hover:rotate-90 transition-transform cursor-pointer" />
        )}
      </header>

      {/* SYSTEM ECONOMIC CONTROL: LABOR RATES */}
      <section className={`bg-slate-900 p-6 rounded-3xl border border-slate-800 mb-4 shadow-2xl relative ${isExpired ? 'filter blur-md pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-6">
          <Sliders size={16} className="text-orange-500" />
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Master Labor Economics</h3>
        </div>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                <span className="text-slate-500 italic">Base Rate</span>
                <span className="text-orange-500">${rates.BASE}/hr</span>
              </div>
              <input type="range" min="100" max="300" step="5" value={rates.BASE} onChange={(e) => setRates({...rates, BASE: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-orange-500" />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                <span className="text-slate-500 italic">Mobile Rate</span>
                <span className="text-slate-300">${rates.MOBILE}/hr</span>
              </div>
              <input type="range" min="150" max="400" step="5" value={rates.MOBILE} onChange={(e) => setRates({...rates, MOBILE: parseInt(e.target.value)})} className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-slate-400" />
            </div>
          </div>
        </div>
      </section>

      {/* ADMIN CONTROL: THE MATRIX */}
      <section className={`bg-slate-900 p-6 rounded-3xl border border-slate-800 mb-8 shadow-2xl relative ${isExpired ? 'filter blur-md pointer-events-none' : ''}`}>
        <div className="flex items-center gap-2 mb-6">
          <Sliders size={16} className="text-blue-500" />
          <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Master Margin Offsets</h3>
        </div>
        
        <div className="space-y-6">
          {/* THE ANCHOR */}
          <div>
            <div className="flex justify-between text-[10px] font-black uppercase mb-2">
              <span className="text-white italic">Global Anchor (Standard)</span>
              <span className="text-blue-500">{matrix.anchor}%</span>
            </div>
            <input 
              type="range" min="20" max="60" value={matrix.anchor}
              onChange={(e) => setMatrix({...matrix, anchor: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none accent-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* FLEET OFFSET */}
            <div>
              <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                <span className="text-slate-500 italic">Fleet Disc. Offset</span>
                <span className="text-slate-300">-{matrix.fleetOffset}%</span>
              </div>
              <input 
                type="range" min="0" max="20" value={matrix.fleetOffset}
                onChange={(e) => setMatrix({...matrix, fleetOffset: parseInt(e.target.value)})}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-slate-400"
              />
            </div>
            {/* LEGACY OFFSET */}
            <div>
              <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                <span className="text-slate-500 italic">Legacy Disc. Offset</span>
                <span className="text-slate-300">-{matrix.legacyOffset}%</span>
              </div>
              <input 
                type="range" min="0" max="30" value={matrix.legacyOffset}
                onChange={(e) => setMatrix({...matrix, legacyOffset: parseInt(e.target.value)})}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-slate-400"
              />
            </div>
          </div>
        </div>
      </section>

      {/* TIER SELECTION VISUALIZER */}
      <div className={`flex gap-2 mb-8 overflow-x-auto pb-2 ${isExpired ? 'filter blur-md pointer-events-none opacity-30' : ''}`}>
        {['STANDARD', 'FLEET', 'LEGACY', 'FF'].map(tier => {
          if (tier === 'FF' && !ffEnabled) return null;
          const isActive = selectedTier === tier;
          return (
            <button 
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`flex-shrink-0 px-6 py-3 rounded-xl border font-black text-[10px] uppercase transition-all ${
                isActive ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg shadow-emerald-900/40' : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
            >
              {tier} ({getActiveMargin(tier)}%)
            </button>
          );
        })}
        <button 
          onClick={() => setFfEnabled(!ffEnabled)}
          className={`flex-shrink-0 px-4 py-3 rounded-xl border font-black text-[10px] uppercase ${ffEnabled ? 'bg-pink-600 text-white' : 'bg-slate-900 text-slate-700 border-dashed border-slate-800'}`}
        >
          {ffEnabled ? 'F&F Active' : '+ Add F&F'}
        </button>
      </div>

      {/* SCANNER RESULT (PREVIEW) */}
      <div className={`${isExpired ? 'filter blur-md pointer-events-none opacity-30 relative' : 'relative'}`}>
        {scanResult ? (
          <div className="bg-slate-900 p-8 rounded-3xl border-2 border-emerald-500/20 shadow-inner">
            <p className="text-[10px] font-black text-slate-500 uppercase mb-4 tracking-[0.2em] italic text-center underline decoration-emerald-500/50 underline-offset-4">
              Pricing Calculation for {selectedTier}
            </p>
            <div className="flex justify-between items-end mb-8">
              <div>
                <p className="text-3xl font-black text-white italic tracking-tighter">${calculateRetail(scanResult.cost, getActiveMargin(selectedTier))}</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Calculated Quote</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-emerald-500">+{getActiveMargin(selectedTier)}%</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase italic">Current Margin</p>
              </div>
            </div>
            <button className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-emerald-900/30 transition-colors hover:bg-emerald-500">
              Push Pricing to Estimate
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setScanResult({ cost: 500 })}
            className="w-full p-12 bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-3xl flex flex-col items-center gap-4 text-slate-600 group hover:text-blue-500 transition-colors"
          >
            <Camera size={40} />
            <p className="text-[10px] font-black uppercase italic tracking-widest">Capture Invoice to Apply Matrix</p>
          </button>
        )}
      </div>
      
      {/* PAYWALL DIALOG (If rendering natively through CoreApp TrialGatekeeper this is redundant, but added for safety) */}
      {isExpired && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50 pointer-events-none">
           {/* Managed externally by CoreApp */}
        </div>
      )}
    </div>
  );
};

export default IgnitionProt;
