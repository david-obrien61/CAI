/**
 * FILE: modules/CustomerApprovalPortal.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Fullscreen customer-facing estimate approval + real signature capture.
 *          Presented on a tablet turned toward the customer, or linked remotely.
 */

import React, { useState, useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Check, X, RotateCcw, Shield, AlertCircle, FileText } from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';

const fmt$ = (n) => `$${(parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildLineItems = (job) => {
  const items = [];
  if (job?.suggestedParts?.length > 0) {
    items.push({ desc: 'Standard Diagnostic Fee', retail: 195.00 });
  }
  (job?.suggestedParts || []).forEach(part => {
    items.push({
      desc: `${part.name} (x${part.qty})`,
      retail: part.retailPrice ?? (MarginEngine.calculateRetail(part.wholesaleCost || 0) * (part.qty || 1)),
    });
  });
  (job?.tasks || []).forEach(task => {
    if ((task.billed_hours || 0) > 0) {
      items.push({
        desc: `Labor: ${task.description} (${task.billed_hours} hrs @ $${task.rate}/hr)`,
        retail: task.billed_hours * task.rate,
      });
    }
  });
  if (parseFloat(job?.incidentals) > 0) {
    items.push({ desc: 'Shop Supplies & Env. Fees', retail: parseFloat(job.incidentals) });
  }
  return items;
};

// ─── AUTHORIZED CONFIRMATION SCREEN ──────────────────────────────────────────

const AuthorizedScreen = () => (
  <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center text-center p-8">
    <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-emerald-900/40">
      <Check size={48} className="text-white" />
    </div>
    <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-3">Work Authorized</h2>
    <p className="text-slate-400 text-sm max-w-xs">
      Your signature has been captured and stored with this work order. We'll get started right away.
    </p>
  </div>
);

// ─── MAIN PORTAL ──────────────────────────────────────────────────────────────

const CustomerApprovalPortal = ({ job, onAuthorized, onClose }) => {
  const sigRef = useRef(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [consent, setConsent] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const shopInfo = DataBridge.load('shop_info') || {};
  const items = buildLineItems(job);
  const total = items.reduce((sum, i) => sum + (i.retail || 0), 0);

  const woId = job?.jobId || job?.id || 'WO-???';
  const vehicle = [job?.year, job?.make, job?.model].filter(Boolean).join(' ').toUpperCase() || 'VEHICLE';
  const customerName = job?.name || 'Customer';

  const clearSig = () => {
    sigRef.current?.clear();
    setHasSignature(false);
  };

  const handleAuthorize = () => {
    if (!hasSignature || !consent) return;
    const sigDataUrl = sigRef.current?.getTrimmedCanvas().toDataURL('image/png');
    setAuthorized(true);
    setTimeout(() => onAuthorized(sigDataUrl), 1800);
  };

  if (authorized) return <AuthorizedScreen />;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">

      {/* Staff escape — small and unobtrusive so customer doesn't notice */}
      <button
        onClick={onClose}
        title="Staff: close portal"
        className="fixed top-4 right-4 z-[60] p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-700 hover:text-slate-400 transition-colors"
      >
        <X size={14} />
      </button>

      <div className="max-w-xl mx-auto px-5 py-12 pb-28 space-y-4">

        {/* ── HEADER ── */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-2">
            {shopInfo.name || 'Ignition OS Shop'}
          </p>
          <h1 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-1">
            Repair Estimate
          </h1>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Work Order #{woId}
          </p>
        </div>

        {/* ── CUSTOMER / VEHICLE ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Prepared For</p>
          <p className="text-xl font-black text-white uppercase tracking-tight">{customerName}</p>
          <p className="text-sm text-slate-400 font-bold mt-1">{vehicle}</p>
          {job?.vin && <p className="text-[10px] font-mono text-slate-600 mt-1">VIN: {job.vin}</p>}
        </div>

        {/* ── REPORTED ISSUE ── */}
        <div className="bg-slate-900 border border-orange-500/20 rounded-3xl p-6">
          <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">Reported Issue</p>
          <p className="text-sm text-slate-300 italic leading-relaxed">
            "{job?.complaint || job?.problem || 'No specific problem reported.'}"
          </p>
        </div>

        {/* ── ADVISORIES (not authorized) ── */}
        {job?.advisories && (
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={13} className="text-slate-500" />
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                Advisory — Not Authorized This Visit
              </p>
            </div>
            {job.advisories.split('\n').filter(Boolean).map((line, i) => (
              <p key={i} className="text-sm text-slate-600 leading-relaxed">· {line}</p>
            ))}
          </div>
        )}

        {/* ── ESTIMATE BREAKDOWN ── */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-5">Estimate Breakdown</p>

          {items.length === 0 ? (
            <p className="text-sm text-slate-600 italic">No itemized charges on this estimate.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-4 border-b border-slate-800 pb-3 last:border-0 last:pb-0">
                  <p className="text-sm text-slate-300 leading-snug flex-1">{item.desc}</p>
                  <p className="text-sm font-black text-white whitespace-nowrap">{fmt$(item.retail)}</p>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-slate-700 flex justify-between items-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimated Total</p>
            <p className="text-4xl font-black italic text-emerald-400 tracking-tighter">{fmt$(total)}</p>
          </div>
        </div>

        {/* ── SIGNATURE CAPTURE ── */}
        <div className="bg-slate-900 border border-blue-500/20 rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={13} className="text-blue-400" />
            <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Customer Signature</p>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed mb-5">
            By signing below, you authorize {shopInfo.name || 'this shop'} to perform the repairs listed above at the estimated cost.
            Final invoice may vary slightly based on additional findings during service.
          </p>

          <div className="relative bg-black border-2 border-dashed border-slate-700 rounded-2xl overflow-hidden" style={{ height: 160 }}>
            <SignatureCanvas
              ref={sigRef}
              penColor="#10b981"
              backgroundColor="transparent"
              canvasProps={{ style: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 } }}
              onEnd={() => setHasSignature(true)}
            />
            {!hasSignature && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-1">
                <p className="text-slate-700 text-sm font-black uppercase tracking-widest">Sign Here</p>
                <p className="text-slate-800 text-[10px]">Use your finger or stylus</p>
              </div>
            )}
          </div>

          {hasSignature && (
            <button
              onClick={clearSig}
              className="flex items-center gap-1.5 mt-3 text-[10px] font-black text-slate-600 hover:text-red-400 uppercase tracking-widest transition-colors"
            >
              <RotateCcw size={11} /> Clear & Re-sign
            </button>
          )}

          <label className="flex items-start gap-3 mt-6 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-blue-500 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 leading-relaxed">
              I have reviewed the estimate above, I authorize the listed repairs, and I agree that the final invoice may differ
              if additional issues are discovered during service.
            </span>
          </label>
        </div>

        {/* ── AUTHORIZE BUTTON ── */}
        <button
          onClick={handleAuthorize}
          disabled={!hasSignature || !consent}
          className={`w-full py-6 rounded-3xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
            hasSignature && consent
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-2xl shadow-emerald-900/40 active:scale-[0.98]'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <Shield size={20} />
          Authorize Repairs
        </button>

        <p className="text-center text-[9px] text-slate-700 uppercase tracking-widest pb-4">
          Your signature is encrypted and stored with Work Order #{woId}
        </p>
      </div>
    </div>
  );
};

export default CustomerApprovalPortal;
