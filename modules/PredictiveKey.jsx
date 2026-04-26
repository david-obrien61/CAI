/**
 * MODULE: Predictive Fleet Key
 * VERSION: v1.6.0
 * UPDATES: 
 * - Integrated Subscription Tiers (Basic/Pro/Elite).
 * - Added Management Toggle (Shop-Managed vs. Self-PMI).
 * - Added ROI Cost-Avoidance Logic for Elite reporting.
 */

import React, { useState } from 'react';
import { 
  Activity, Shield, Zap, Crown, Wrench, 
  AlertCircle, CheckCircle2, TrendingUp, Lock 
} from 'lucide-react';

const PredictiveKey = ({ clientTier = 'PRO' }) => {
  // 1. STATE: Assets with Tier-Dependent Risk Data
  const [assets, setAssets] = useState([
    {
      id: 'U-1102',
      name: 'Unit 1102 (Peterbilt)',
      type: 'VEHICLE',
      managedBy: 'SHOP',
      telematicsRisk: 78,
      lastPMI: '2026-02-15',
      pmiDue: '2026-05-15',
      savingsAvoided: 1600
    },
    {
      id: 'S-COMP-01',
      name: 'Shop Compressor A',
      type: 'SHOP_EQUIPMENT',
      managedBy: 'CLIENT', // Self-PMI Option
      telematicsRisk: 5,
      lastPMI: '2026-01-01',
      pmiDue: '2026-04-20',
      savingsAvoided: 450
    }
  ]);

  const isPro = clientTier === 'PRO' || clientTier === 'ELITE';
  const isElite = clientTier === 'ELITE';

  const getRiskColor = (prob) => {
    if (prob > 70) return 'text-red-500';
    if (prob > 40) return 'text-orange-400';
    return 'text-emerald-400';
  };

  return (
    <div className="p-6 bg-slate-900 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-4 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Predictive & PMI Hub</h2>
          <div className="flex gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-[9px] font-black flex items-center gap-1 ${
              isElite ? 'bg-purple-600 text-white' : isPro ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'
            }`}>
              {isElite ? <Crown size={10}/> : isPro ? <Zap size={10}/> : <Shield size={10}/>}
              {clientTier} ACCESS
            </span>
          </div>
        </div>
      </header>

      {/* ELITE SECTION: ROI DASHBOARD */}
      {isElite && (
        <section className="mb-8 grid grid-cols-2 gap-4">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
            <p className="text-[10px] text-emerald-500 font-black uppercase mb-1">Estimated Savings (Monthly)</p>
            <p className="text-3xl font-black text-white">$2,050.00</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 p-4 rounded-2xl">
            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Downtime Avoided</p>
            <p className="text-3xl font-black text-white">14.2 hrs</p>
          </div>
        </section>
      )}

      {/* ASSET LIST */}
      <div className="grid gap-4">
        {assets.map(asset => (
          <div key={asset.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-5 shadow-xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{asset.name}</h3>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded border mt-2 inline-block ${
                  asset.managedBy === 'CLIENT' ? 'border-amber-500/30 text-amber-500' : 'border-blue-500/30 text-blue-500'
                }`}>
                  {asset.managedBy === 'CLIENT' ? 'SELF-MANAGED PMI' : 'SHOP-MANAGED'}
                </span>
              </div>
              
              {/* TIER LOCK: Risk score only for Pro/Elite */}
              <div className="text-right">
                <p className="text-[10px] text-slate-500 font-black uppercase">Health Risk</p>
                {isPro ? (
                  <p className={`text-2xl font-black ${getRiskColor(asset.telematicsRisk)}`}>
                    {asset.telematicsRisk}%
                  </p>
                ) : (
                  <div className="flex items-center gap-1 text-slate-600 mt-1">
                    <Lock size={12} /> <span className="text-[10px] font-bold">PRO ONLY</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Next PMI Due</p>
                <p className="text-sm font-bold text-slate-200">{asset.pmiDue}</p>
              </div>
              <div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700">
                <p className="text-[9px] text-slate-500 uppercase font-black mb-1">Status</p>
                <p className="text-sm font-bold text-emerald-400">HEALTHY</p>
              </div>
            </div>

            {/* ACTION FOOTER */}
            <div className="flex gap-2">
              <button className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black py-3 rounded-xl transition-all uppercase tracking-widest">
                {asset.managedBy === 'CLIENT' ? 'LOG SELF-INSPECTION' : 'VIEW SERVICE LOGS'}
              </button>
              {isElite && (
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 rounded-xl transition-all">
                  <TrendingUp size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictiveKey;
