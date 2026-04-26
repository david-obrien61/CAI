/**
 * MODULE: PROC (Parts Procurement)
 * VERSION: v1.0.0
 * DESC: Manage external purchase orders and vendor shadowing.
 */
import React, { useState } from 'react';
import { Package, Truck, Clock, Store } from 'lucide-react';
import DataBridge from '../DataBridge';

/**
 * COMPONENT: ShadowTracker
 * DESC: Tracks external vendors/carriers who are NOT in the system.
 */
const ShadowTracker = ({ orderId, vendorLocation }) => {
  // Logic to determine if we have a live GPS feed or an 'Estimated' position
  const [trackingMode, setTrackingMode] = useState('ALGORITHMIC'); // or 'LIVE_GPS'

  return (
    <div className="bg-slate-900 border-l-4 border-orange-500 p-4 rounded-r-2xl mb-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-[10px] font-black text-orange-500 uppercase">External Carrier: {orderId}</p>
          <h4 className="text-sm font-bold text-white uppercase italic">NAPA Auto Parts - {vendorLocation}</h4>
        </div>
        <div className="bg-orange-500/10 px-2 py-1 rounded text-[8px] font-black text-orange-500 border border-orange-500/20">
          {trackingMode === 'ALGORITHMIC' ? 'ESTIMATED ETA' : 'LIVE TRACKING'}
        </div>
      </div>

      {/* The HUB Visualization Hook */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 w-3/4 animate-pulse"></div>
        </div>
        <span className="text-xs font-black text-white italic">12 MINS</span>
      </div>
      
      <p className="text-[9px] text-slate-500 mt-2 italic">
        *Based on typical delivery route from Bagdad St. warehouse.
      </p>
    </div>
  );
};

const IgnitionProc = () => {
  const { isExpired } = DataBridge.checkTrialStatus('PROC');

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen relative">
      <header className="mb-8 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-emerald-500">PROC // Procurement</h2>
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">External Vendor Routing</p>
      </header>
      
      <div className={`${isExpired ? 'filter blur-md pointer-events-none opacity-30 relative' : 'relative'}`}>
        <h3 className="text-xs font-black uppercase text-slate-400 mb-4 flex items-center gap-2">
          <Truck size={16} className="text-orange-500" /> Active Shadow Feeds
        </h3>
        
        <ShadowTracker orderId="PO-9928" vendorLocation="Leander" />
        
        <button className="w-full mt-4 bg-slate-900 border-2 border-dashed border-slate-700 text-slate-500 rounded-2xl p-6 flex flex-col items-center justify-center hover:text-white hover:border-slate-500 transition-colors">
            <Store size={32} className="mb-2" />
            <span className="text-xs font-black uppercase">Initialize New Purchase Order</span>
        </button>
      </div>

      {isExpired && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-50 pointer-events-none"></div>
      )}
    </div>
  );
};

export default IgnitionProc;
