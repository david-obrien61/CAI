/**
 * FILE: HandOffAlert.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Alert banner for highlighting critical vehicle inoperability and shift change notes on the UI.
 * DEPENDENCIES: react, lucide-react
 */

import React from 'react';
import { AlertTriangle, Moon } from 'lucide-react';

const HandOffAlert = ({ statusNote, isInoperable, techId, timestamp }) => {
  if (!statusNote && !isInoperable) return null;

  return (
    <div className="w-full space-y-1 mb-4">
      {/* SAFETY CRITICAL: INOPERABLE BANNER */}
      {isInoperable && (
        <div className="bg-red-600 animate-pulse p-3 flex items-center justify-center gap-3">
          <AlertTriangle size={20} className="text-white" />
          <span className="font-black text-white uppercase tracking-tighter text-sm">
            DO NOT START — VEHICLE INOPERABLE
          </span>
        </div>
      )}

      {/* CONTEXTUAL NOTE: THE "YELLOW ALERT" */}
      {statusNote && (
        <div className="bg-yellow-400 p-4 border-l-8 border-black text-black">
          <div className="flex justify-between items-start mb-1">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest">
              <Moon size={12} /> Shift Change Note
            </span>
            <span className="text-[9px] font-mono font-bold uppercase">
              Tech: {techId} // {timestamp}
            </span>
          </div>
          <p className="text-sm font-bold leading-tight uppercase italic">
            "{statusNote}"
          </p>
        </div>
      )}
    </div>
  );
};

export default HandOffAlert;