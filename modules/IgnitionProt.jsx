/**
 * MODULE: PROT (Margin Matrix Command)
 * VERSION: v2.0.0
 * PURPOSE: Unified pricing control — configurable slabs, labor rates, overhead costs,
 *          and a full change log for analytics. Replaces the anchor/offset system.
 */

import React, { useState } from 'react';
import {
  Sliders, DollarSign, Building2, History, Plus, Trash2,
  Save, AlertCircle, CheckCircle, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
        : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
    }`}
  >
    <Icon size={13} />
    {label}
  </button>
);

const SaveBanner = ({ saved, onDismiss }) =>
  saved ? (
    <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4">
      <CheckCircle size={14} className="text-emerald-400" />
      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
        Changes saved and logged to audit trail
      </span>
    </div>
  ) : null;

const canEditPricing = () => {
  const user = DataBridge.load('current_user');
  return user?.permissions?.includes('PRICING_AUTHORITY') ||
         user?.permissions?.includes('ADMIN');
};

// ─── TAB 1: SLAB EDITOR ──────────────────────────────────────────────────────

const SlabEditor = () => {
  const [config, setConfig]     = useState(DataBridge.getMarginConfig());
  const [saved, setSaved]       = useState(false);
  const [testCost, setTestCost] = useState('500');
  const editable = canEditPricing();

  const updateSlab = (index, field, value) => {
    const slabs = config.slabs.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    setConfig(c => ({ ...c, slabs }));
    setSaved(false);
  };

  const updateDiscount = (tier, value) => {
    setConfig(c => ({
      ...c,
      tierDiscounts: { ...c.tierDiscounts, [tier]: parseFloat(value) || 0 }
    }));
    setSaved(false);
  };

  const addSlab = () => {
    const last = config.slabs[config.slabs.length - 1];
    const newSlab = { label: 'New Tier', maxCost: null, multiplier: 1.1 };
    const slabs = config.slabs.map((s, i) =>
      i === config.slabs.length - 1 ? { ...s, maxCost: 2000 } : s
    );
    setConfig(c => ({ ...c, slabs: [...slabs, newSlab] }));
    setSaved(false);
  };

  const removeSlab = (index) => {
    if (config.slabs.length <= 2) return;
    const slabs = config.slabs.filter((_, i) => i !== index);
    // Ensure last slab has maxCost: null
    slabs[slabs.length - 1] = { ...slabs[slabs.length - 1], maxCost: null };
    setConfig(c => ({ ...c, slabs }));
    setSaved(false);
  };

  const save = () => {
    const user = DataBridge.load('current_user');
    DataBridge.setMarginConfig(config, user?.id || 'SYSTEM');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const testNum = parseFloat(testCost) || 0;
  const activeSlab = testNum > 0 ? MarginEngine.getSlabForCost(testNum) : null;

  return (
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      {!editable && (
        <div className="flex items-center gap-2 bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
          <Lock size={14} className="text-orange-400" />
          <span className="text-[10px] font-black text-orange-400 uppercase">
            Requires PRICING_AUTHORITY permission to edit
          </span>
        </div>
      )}

      {/* SLAB TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="px-6 pt-6 pb-3 flex justify-between items-center">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Cost → Retail Slabs</h3>
            <p className="text-[9px] text-slate-500 mt-0.5">Each slab applies a markup multiplier based on vendor cost range</p>
          </div>
          {editable && (
            <button onClick={addSlab} className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase hover:text-blue-300 transition-colors">
              <Plus size={12} /> Add Slab
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-800">
          {/* Header row */}
          <div className="grid grid-cols-12 gap-2 px-6 py-2">
            {['Label', 'Cost Up To', 'Multiplier', 'Markup %', 'Example ($500)', ''].map((h, i) => (
              <div key={i} className={`text-[8px] font-black text-slate-600 uppercase tracking-widest ${i === 0 ? 'col-span-3' : i === 5 ? 'col-span-1' : 'col-span-2'}`}>{h}</div>
            ))}
          </div>

          {config.slabs.map((slab, i) => {
            const isActive = activeSlab?.label === slab.label && testNum > 0;
            const exampleRetail = MarginEngine.calculateRetail(500);
            const slabRetail = Math.ceil(500 * slab.multiplier) - 0.01;
            const markupPct = Math.round((slab.multiplier - 1) * 100);

            return (
              <div
                key={i}
                className={`grid grid-cols-12 gap-2 px-6 py-4 items-center transition-colors ${isActive ? 'bg-blue-500/5 border-l-2 border-blue-500' : ''}`}
              >
                {/* Label */}
                <div className="col-span-3">
                  <input
                    value={slab.label}
                    onChange={e => updateSlab(i, 'label', e.target.value)}
                    disabled={!editable}
                    className="w-full bg-black border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-black text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  />
                </div>

                {/* Max Cost */}
                <div className="col-span-2">
                  {slab.maxCost === null ? (
                    <span className="text-[10px] font-black text-slate-500 px-3">Unlimited</span>
                  ) : (
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 text-[10px]">$</span>
                      <input
                        type="number"
                        value={slab.maxCost}
                        onChange={e => updateSlab(i, 'maxCost', parseFloat(e.target.value) || null)}
                        disabled={!editable}
                        className="w-full bg-black border border-slate-800 rounded-lg pl-6 pr-2 py-2 text-[10px] font-black text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      />
                    </div>
                  )}
                </div>

                {/* Multiplier */}
                <div className="col-span-2">
                  <input
                    type="number"
                    value={slab.multiplier}
                    step="0.05"
                    min="1"
                    max="10"
                    onChange={e => updateSlab(i, 'multiplier', parseFloat(e.target.value) || 1)}
                    disabled={!editable}
                    className="w-full bg-black border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-black text-white focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  />
                </div>

                {/* Markup % (calculated) */}
                <div className="col-span-2">
                  <span className={`text-sm font-black ${markupPct >= 100 ? 'text-emerald-400' : markupPct >= 50 ? 'text-blue-400' : 'text-slate-400'}`}>
                    +{markupPct}%
                  </span>
                </div>

                {/* $500 example */}
                <div className="col-span-2">
                  <span className="text-[10px] font-black text-slate-400">${slabRetail.toFixed(2)}</span>
                </div>

                {/* Remove */}
                <div className="col-span-1 flex justify-end">
                  {editable && config.slabs.length > 2 && (
                    <button onClick={() => removeSlab(i)} className="text-slate-700 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE TESTER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Live Price Tester</p>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black">$</span>
            <input
              type="number"
              value={testCost}
              onChange={e => setTestCost(e.target.value)}
              placeholder="Enter vendor cost..."
              className="w-full bg-black border border-slate-800 rounded-xl pl-8 pr-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
          {['STANDARD', 'FLEET', 'LEGACY', 'FF'].map(tier => {
            const retail = MarginEngine.calculateRetail(testNum, tier);
            return (
              <div key={tier} className="bg-black border border-slate-800 rounded-xl px-4 py-3 text-center min-w-[90px]">
                <p className="text-[8px] font-black text-slate-600 uppercase">{tier}</p>
                <p className="text-sm font-black text-white">${retail.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
        {activeSlab && (
          <p className="text-[9px] text-blue-400 mt-2 font-bold">
            Using <span className="italic">{activeSlab.label}</span> slab ({Math.round((activeSlab.multiplier - 1) * 100)}% markup)
          </p>
        )}
      </div>

      {/* TIER DISCOUNTS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Tier Discounts</h3>
        <p className="text-[9px] text-slate-500 mb-5">Applied on top of the slab price for specific customer types</p>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(config.tierDiscounts).map(([tier, val]) => (
            <div key={tier}>
              <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                <span className="text-slate-400">{tier === 'FF' ? 'Friends & Family' : tier}</span>
                <span className="text-slate-300">-{val}%</span>
              </div>
              <input
                type="range" min="0" max="40" step="1" value={val}
                onChange={e => updateDiscount(tier, e.target.value)}
                disabled={!editable}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-blue-500 disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      </div>

      {editable && (
        <button
          onClick={save}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
        >
          <Save size={14} /> Save Pricing Rules
        </button>
      )}
    </div>
  );
};

// ─── TAB 2: LABOR RATES ───────────────────────────────────────────────────────

const LaborRates = () => {
  const [rates, setRatesState] = useState(DataBridge.getSystemRates());
  const [techCost, setTechCost] = useState(25);
  const [saved, setSaved] = useState(false);
  const editable = canEditPricing();

  const overhead = DataBridge.getOverhead();
  const monthlyOverhead = Object.entries(overhead.monthly)
    .filter(([k]) => k !== 'other')
    .reduce((s, [, v]) => s + (parseFloat(v) || 0), 0) +
    (overhead.monthly.other || []).reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);

  const save = () => {
    const user = DataBridge.load('current_user');
    DataBridge.setSystemRates(rates, user?.id || 'SYSTEM');
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const RATE_FIELDS = [
    { key: 'BASE',       label: 'Base Shop Rate',       min: 80,  max: 350, color: 'accent-orange-500',  text: 'text-orange-400' },
    { key: 'DIAGNOSTIC', label: 'Diagnostic Rate',      min: 100, max: 450, color: 'accent-blue-500',    text: 'text-blue-400' },
    { key: 'MOBILE',     label: 'Mobile / Field Rate',  min: 100, max: 500, color: 'accent-purple-500',  text: 'text-purple-400' },
  ];

  return (
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      {/* RATE SLIDERS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5">Billed Labor Rates</h3>
        <div className="space-y-6">
          {RATE_FIELDS.map(({ key, label, min, max, color, text }) => (
            <div key={key}>
              <div className="flex justify-between text-[10px] font-black uppercase mb-2">
                <span className="text-slate-400">{label}</span>
                <span className={text}>${rates[key]}/hr</span>
              </div>
              <input
                type="range" min={min} max={max} step="5"
                value={rates[key]}
                onChange={e => { setRatesState(r => ({ ...r, [key]: parseInt(e.target.value) })); setSaved(false); }}
                disabled={!editable}
                className={`w-full h-2 bg-slate-800 rounded-lg appearance-none ${color} disabled:opacity-50`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* PROFITABILITY BREAKDOWN */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-5">Profitability Breakdown</h3>
        <div className="mb-4">
          <div className="flex justify-between text-[10px] font-black uppercase mb-2">
            <span className="text-slate-400">Tech Cost / Hr (wages + burden)</span>
            <span className="text-slate-300">${techCost}/hr</span>
          </div>
          <input
            type="range" min="15" max="100" step="1" value={techCost}
            onChange={e => setTechCost(parseInt(e.target.value))}
            className="w-full h-1 bg-slate-800 rounded-lg appearance-none accent-slate-500"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {RATE_FIELDS.map(({ key, label, text }) => {
            const billed   = rates[key];
            const overhead = monthlyOverhead > 0 ? Math.round(monthlyOverhead / 160) : 0;
            const profit   = billed - techCost - overhead;
            const margin   = billed > 0 ? ((profit / billed) * 100).toFixed(0) : 0;

            return (
              <div key={key} className="bg-black border border-slate-800 rounded-2xl p-4">
                <p className="text-[8px] font-black text-slate-600 uppercase mb-2">{label}</p>
                <p className={`text-xl font-black italic ${text}`}>${billed}/hr</p>
                <div className="mt-2 space-y-1 text-[8px] font-mono text-slate-600">
                  <div className="flex justify-between"><span>Tech cost</span><span>-${techCost}</span></div>
                  {overhead > 0 && <div className="flex justify-between"><span>Overhead/hr</span><span>-${overhead}</span></div>}
                  <div className="flex justify-between border-t border-slate-800 pt-1 text-white">
                    <span>Net / hr</span>
                    <span className={profit >= 0 ? 'text-emerald-400' : 'text-red-400'}>${profit}</span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.max(0, Math.min(100, margin))}%` }}
                    />
                  </div>
                  <p className={`text-[8px] font-black mt-1 ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margin}% margin</p>
                </div>
              </div>
            );
          })}
        </div>
        {monthlyOverhead === 0 && (
          <p className="text-[9px] text-orange-400 mt-3 flex items-center gap-1">
            <AlertCircle size={11} /> Enter overhead costs in the Overhead tab for accurate net margin
          </p>
        )}
      </div>

      {editable && (
        <button onClick={save} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-orange-900/30 active:scale-95 flex items-center justify-center gap-2">
          <Save size={14} /> Save Labor Rates
        </button>
      )}
    </div>
  );
};

// ─── TAB 3: OVERHEAD ─────────────────────────────────────────────────────────

const OverheadConfig = () => {
  const [overhead, setOverhead] = useState(DataBridge.getOverhead());
  const [saved, setSaved] = useState(false);
  const editable = canEditPricing();

  const setField = (field, value) => {
    setOverhead(o => ({ ...o, monthly: { ...o.monthly, [field]: parseFloat(value) || 0 } }));
    setSaved(false);
  };

  const addOther = () => {
    const other = [...(overhead.monthly.other || []), { label: '', amount: 0 }];
    setOverhead(o => ({ ...o, monthly: { ...o.monthly, other } }));
  };

  const updateOther = (i, field, value) => {
    const other = (overhead.monthly.other || []).map((item, idx) =>
      idx === i ? { ...item, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : item
    );
    setOverhead(o => ({ ...o, monthly: { ...o.monthly, other } }));
    setSaved(false);
  };

  const removeOther = (i) => {
    const other = (overhead.monthly.other || []).filter((_, idx) => idx !== i);
    setOverhead(o => ({ ...o, monthly: { ...o.monthly, other } }));
  };

  const save = () => {
    const user = DataBridge.load('current_user');
    DataBridge.setOverhead(overhead.monthly, user?.id);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const FIXED_FIELDS = [
    { key: 'rent',        label: 'Monthly Rent / Lease' },
    { key: 'electric',    label: 'Electric / Utilities' },
    { key: 'fuel',        label: 'Shop Fuel & Gas' },
    { key: 'insurance',   label: 'Insurance' },
    { key: 'maintenance', label: 'Equipment Maintenance' },
  ];

  const fixedTotal  = FIXED_FIELDS.reduce((s, f) => s + (parseFloat(overhead.monthly[f.key]) || 0), 0);
  const otherTotal  = (overhead.monthly.other || []).reduce((s, o) => s + (parseFloat(o.amount) || 0), 0);
  const grandTotal  = fixedTotal + otherTotal;
  const perHour     = grandTotal > 0 ? (grandTotal / 160).toFixed(2) : '0.00';

  return (
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black text-white uppercase tracking-widest mb-1">Monthly Fixed Costs</h3>
        <p className="text-[9px] text-slate-500 mb-5">Used to calculate real hourly profit margin in the Labor tab</p>

        <div className="space-y-3">
          {FIXED_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-4">
              <label className="text-[10px] font-black text-slate-400 uppercase flex-1">{label}</label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-black">$</span>
                <input
                  type="number"
                  value={overhead.monthly[key] || ''}
                  onChange={e => setField(key, e.target.value)}
                  disabled={!editable}
                  placeholder="0"
                  className="w-full bg-black border border-slate-800 rounded-xl pl-7 pr-3 py-3 text-white font-bold text-sm text-right focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Custom line items */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
          {(overhead.monthly.other || []).map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                value={item.label}
                onChange={e => updateOther(i, 'label', e.target.value)}
                placeholder="Description..."
                disabled={!editable}
                className="flex-1 bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
              />
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-black">$</span>
                <input
                  type="number"
                  value={item.amount || ''}
                  onChange={e => updateOther(i, 'amount', e.target.value)}
                  disabled={!editable}
                  placeholder="0"
                  className="w-full bg-black border border-slate-800 rounded-xl pl-7 pr-3 py-3 text-white font-bold text-sm text-right focus:outline-none focus:border-blue-500 disabled:opacity-50 transition-colors"
                />
              </div>
              {editable && (
                <button onClick={() => removeOther(i)} className="text-slate-700 hover:text-red-400 transition-colors">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {editable && (
            <button onClick={addOther} className="flex items-center gap-1 text-[9px] font-black text-blue-400 uppercase hover:text-blue-300 transition-colors mt-2">
              <Plus size={11} /> Add Custom Cost
            </button>
          )}
        </div>
      </div>

      {/* TOTALS */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Monthly Total</p>
            <p className="text-2xl font-black text-white italic">${grandTotal.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Overhead / Hr</p>
            <p className="text-2xl font-black text-orange-400 italic">${perHour}</p>
            <p className="text-[8px] text-slate-600">Based on 160 billable hrs/mo</p>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Annual Burn</p>
            <p className="text-2xl font-black text-slate-300 italic">${(grandTotal * 12).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {editable && (
        <button onClick={save} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2">
          <Save size={14} /> Save Overhead Costs
        </button>
      )}
    </div>
  );
};

// ─── TAB 4: CHANGE LOG ───────────────────────────────────────────────────────

const ChangeLog = () => {
  const [expanded, setExpanded] = useState(null);
  const log = (DataBridge.load('margin_change_log') || []).slice().reverse();

  const CATEGORY_COLORS = {
    SLAB:        'text-blue-400 bg-blue-400/10 border-blue-400/20',
    LABOR:       'text-orange-400 bg-orange-400/10 border-orange-400/20',
    TIER_OFFSET: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
    OVERHEAD:    'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  };

  if (log.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <History size={40} className="text-slate-700 mb-4" />
        <p className="text-sm font-black text-slate-600 uppercase italic">No changes recorded yet</p>
        <p className="text-[9px] text-slate-700 mt-2">Every pricing change will appear here with who made it and when</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center mb-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{log.length} entries</p>
        <p className="text-[9px] text-slate-600">Most recent first</p>
      </div>

      {log.map((entry, i) => {
        const colorClass = CATEGORY_COLORS[entry.category] || 'text-slate-400 bg-slate-400/10 border-slate-400/20';
        const isOpen = expanded === i;

        return (
          <div key={entry.id || i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : i)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
            >
              <span className={`text-[8px] font-black px-2 py-1 rounded-full border uppercase flex-shrink-0 ${colorClass}`}>
                {entry.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white truncate">{entry.field_changed}</p>
                <p className="text-[9px] text-slate-500">{entry.changed_by} · {new Date(entry.changed_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[9px] font-mono text-red-400 line-through">{entry.old_value ?? '—'}</span>
                <span className="text-[9px] text-slate-600">→</span>
                <span className="text-[9px] font-mono text-emerald-400">{entry.new_value ?? '—'}</span>
                {isOpen ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
              </div>
            </button>
            {isOpen && entry.reason && (
              <div className="px-5 py-3 border-t border-slate-800 bg-slate-950">
                <p className="text-[9px] text-slate-500"><span className="font-black text-slate-400">Note:</span> {entry.reason}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'SLABS',    label: 'Pricing Slabs',  icon: Sliders   },
  { id: 'LABOR',    label: 'Labor Rates',    icon: DollarSign },
  { id: 'OVERHEAD', label: 'Overhead',       icon: Building2  },
  { id: 'LOG',      label: 'Change Log',     icon: History    },
];

const IgnitionProt = () => {
  const [activeTab, setActiveTab] = useState('SLABS');
  const { isExpired } = DataBridge.checkTrialStatus('PROT');

  return (
    <div className={`p-6 bg-slate-950 text-slate-200 min-h-screen ${isExpired ? 'pointer-events-none' : ''}`}>
      <header className="mb-6 border-b border-slate-800 pb-4 flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black italic text-emerald-400 uppercase tracking-tighter">PROT // Margin Command</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Unified Pricing Engine · All modules use this configuration</p>
        </div>
        {isExpired && (
          <span className="flex items-center gap-1 text-[9px] font-black text-red-500 border border-red-500/20 px-3 py-1.5 rounded-full">
            <Lock size={10} /> Locked
          </span>
        )}
      </header>

      <div className={`${isExpired ? 'filter blur-md' : ''}`}>
        {/* TABS */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <Tab key={t.id} id={t.id} label={t.label} icon={t.icon} active={activeTab === t.id} onClick={setActiveTab} />
          ))}
        </div>

        {/* CONTENT */}
        {activeTab === 'SLABS'    && <SlabEditor />}
        {activeTab === 'LABOR'    && <LaborRates />}
        {activeTab === 'OVERHEAD' && <OverheadConfig />}
        {activeTab === 'LOG'      && <ChangeLog />}
      </div>
    </div>
  );
};

export default IgnitionProt;
