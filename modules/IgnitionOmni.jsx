/**
 * MODULE: OMNI (Owner's Command Center)
 * VERSION: v1.0.0
 * DESC: High-level shop analytics and subscription ROI tracking.
 */

import React, { useState, useEffect } from 'react';
import { BarChart3, Users, DollarSign, Package, ArrowUpRight, TrendingUp, Mic, TrendingDown, UserPlus, QrCode } from 'lucide-react';
import DataBridge from '../DataBridge';

const StaffManagement = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [enrollLink, setEnrollLink] = useState('');
  const keys = Object.keys(DataBridge.getSystemRoles());

  const createNewStaff = () => {
    if (!name) return alert("Name required");
    const enrollmentToken = Math.random().toString(36).substring(7);
    
    const newProfile = {
      id: `TECH_${Math.floor(Math.random() * 1000)}`,
      name: name,
      phone: phone,
      permissions: selectedKeys,
      status: 'PENDING_ENROLLMENT',
      token: enrollmentToken
    };

    const pending = DataBridge.load('pending_users') || [];
    pending.push(newProfile);
    DataBridge.save('pending_users', pending);
    
    // Simulate routing link for local dev
    setEnrollLink(`${window.location.origin}/?enroll=${enrollmentToken}`);
    setName(''); setPhone(''); setSelectedKeys([]);
  };

  return (
     <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 mt-8 shadow-2xl">
       <h3 className="text-xs font-black uppercase text-slate-400 mb-8 flex items-center gap-3 tracking-widest">
         <UserPlus size={18} className="text-emerald-500" /> Staff Management & Enrollment
       </h3>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <input placeholder="Staff Name" value={name} onChange={e=>setName(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm mb-4 text-white focus:border-blue-500 outline-none" />
            <input placeholder="Phone / Email" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full bg-slate-950 p-4 rounded-2xl border border-slate-800 text-sm mb-6 text-white focus:border-blue-500 outline-none" />
            
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Assign Permission Keys</p>
            <div className="flex flex-wrap gap-2 mb-6">
               {keys.map(k => (
                  <button key={k} onClick={() => setSelectedKeys(prev => prev.includes(k) ? prev.filter(p=>p!==k) : [...prev, k])}
                    className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${selectedKeys.includes(k) ? 'bg-blue-600 border-blue-500 text-white drop-shadow-md' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-white'}`}>
                    {k}
                  </button>
               ))}
            </div>
            <button onClick={createNewStaff} className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] tracking-widest font-black uppercase px-8 py-4 rounded-2xl shadow-lg transition-colors">Generate Invite Link</button>
          </div>
          
          {enrollLink && (
             <div className="bg-black/40 p-8 rounded-[2rem] border-2 border-dashed border-emerald-500/30 flex flex-col items-center justify-center text-center">
                <QrCode size={56} className="text-emerald-500 mb-6 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-4">Pending Enrollment Secured</p>
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 w-full mb-4">
                  <a href={enrollLink} className="text-[10px] text-blue-400 break-all font-mono hover:text-blue-300" target="_blank" rel="noreferrer">{enrollLink}</a>
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mt-2">Open this link on target device to assign PIN.</p>
             </div>
          )}
       </div>
     </div>
   );
};

const ComplianceGuard = () => {
  const [guardActive, setGuardActive] = useState(() => {
    const val = DataBridge.load('is_dot_mandated');
    return val === null ? true : val; // default true
  });
  const [showWarning, setShowWarning] = useState(false);

  const handleToggle = () => {
    if (guardActive) {
      setShowWarning(true); // Force the "At your peril" message
    } else {
      setGuardActive(true);
      DataBridge.save('is_dot_mandated', true);
    }
  };

  return (
    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl mt-8">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-black text-white uppercase italic">DOT Compliance Gate</h3>
          <p className="text-[10px] text-slate-500 uppercase">Forces digital DVIR before asset release</p>
        </div>
        <button 
          onClick={handleToggle}
          className={`w-14 h-8 rounded-full transition-all relative ${guardActive ? 'bg-emerald-600' : 'bg-red-600'}`}
        >
          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${guardActive ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {showWarning && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-[10px] font-black text-red-500 uppercase mb-2 animate-pulse tracking-widest">!!! CRITICAL WARNING !!!</p>
          <p className="text-xs text-slate-300 leading-tight mb-4">
            Disabling this gate removes the FMCSA-mandated inspection barrier. Assets can be released without safety documentation. 
            <span className="text-white font-bold italic"> Disable at your own peril.</span>
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowWarning(false)}
              className="flex-1 bg-slate-800 text-white text-[10px] font-black py-3 rounded-lg"
            >
              CANCEL
            </button>
            <button 
              onClick={() => { 
                setGuardActive(false); 
                setShowWarning(false);
                DataBridge.save('is_dot_mandated', false);
                DataBridge.smartSync('COMPLIANCE_BYPASS', {
                  event: "COMPLIANCE_BYPASS_ENABLED",
                  timestamp: new Date().toISOString(),
                  user: "Owner_Admin",
                  warning_displayed: true,
                  status: "DANGEROUS"
                });
              }}
              className="flex-1 bg-red-600 text-white text-[10px] font-black py-3 rounded-lg"
            >
              I ACCEPT LIABILITY
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * MODULE: OMNI Audit (Leakage Tracker)
 * VERSION: v1.1.0
 * DESC: Reports the difference between Standard pricing and Discounted tiers.
 */
const LeakageAudit = ({ auditData }) => {
  const totalLeakage = auditData.reduce((acc, job) => acc + (job.standardPrice - job.actualPrice), 0);

  return (
    <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 mt-8 shadow-2xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-sm font-black uppercase text-white flex items-center gap-2 italic">
            <TrendingDown size={16} className="text-red-500" /> Margin Leakage Audit
          </h3>
          <p className="text-[9px] text-slate-500 font-mono uppercase">Standard vs. Discounted Billing</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-red-500 uppercase">Total "Favors" Given</p>
          <p className="text-2xl font-black text-white">-${totalLeakage.toLocaleString()}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-4 text-[8px] font-black text-slate-600 uppercase pb-2 px-2">
          <span>Customer</span>
          <span>Tier</span>
          <span>Billed</span>
          <span className="text-right">Leakage</span>
        </div>
        
        {auditData.map((job, i) => (
          <div key={i} className="grid grid-cols-4 items-center bg-black/40 p-3 rounded-xl border border-slate-800 text-[10px]">
            <span className="font-bold text-white uppercase tracking-tighter truncate">{job.customer}</span>
            <span className={`font-black ${job.tier === 'FF' ? 'text-pink-500' : 'text-emerald-500'}`}>
              {job.tier}
            </span>
            <span className="font-mono text-slate-400">${job.actualPrice}</span>
            <span className="text-right font-black text-red-500">
              -${(job.standardPrice - job.actualPrice).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
        <p className="text-[9px] text-slate-500 italic max-w-[200px]">
          *This represents the revenue sacrificed to maintain loyalty and personal relationships.
        </p>
        <button className="bg-slate-800 hover:bg-red-900/20 hover:text-red-500 text-slate-400 text-[9px] font-black px-4 py-2 rounded-lg border border-slate-700 transition-all uppercase">
          Export for Tax/Marketing
        </button>
      </div>
    </div>
  );
};

const IgnitionOmni = ({ activeJob, onEnterKiosk }) => {
  const [trialModules, setTrialModules] = useState([]);
  const [auditData, setAuditData]       = useState([]);
  const [stats, setStats]               = useState({ revenue: 0, jobCount: 0, inventoryValue: 0, efficiency: 0 });

  useEffect(() => {
    // ── Real job data ────────────────────────────────────────────────────────
    const jobs = DataBridge.load('jobs_table') || [];
    const now  = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthJobs    = jobs.filter(j => new Date(j.createdAt || j.created_at) >= monthStart);
    const completedJobs = monthJobs.filter(j => j.status === 'COMPLETE' || j.status === 'AUTHORIZED');
    const monthRevenue  = completedJobs.reduce((sum, j) => {
      const parts  = (j.suggestedParts || []).reduce((s, p) => s + (p.retailPrice || 0), 0);
      const labor  = (j.tasks || []).reduce((s, t) => s + ((t.billed_hours || 0) * (t.rate || 0)), 0);
      return sum + parts + labor;
    }, 0);

    // ── Real inventory value ─────────────────────────────────────────────────
    const inventory    = DataBridge.load('inventory_items') || [];
    const inventoryVal = inventory.reduce((sum, i) => sum + ((i.cost || 0) * (i.qty || 0)), 0);

    // ── Efficiency: % of jobs completed vs started this month ───────────────
    const efficiency = monthJobs.length > 0
      ? Math.round((completedJobs.length / monthJobs.length) * 100)
      : 0;

    setStats({
      revenue:        monthRevenue,
      jobCount:       monthJobs.length,
      inventoryValue: inventoryVal,
      efficiency,
    });

    // ── Trial modules ────────────────────────────────────────────────────────
    const subs = DataBridge.load('system_subscriptions') || {};
    const trls = [];
    Object.keys(subs).forEach(key => {
      const mod = subs[key];
      if (mod.trialActive) {
        const { daysRemaining } = DataBridge.checkTrialStatus(key);
        trls.push({ module: `${key} MODULE`, daysLeft: daysRemaining });
      }
    });
    setTrialModules(trls);

    // ── Leakage audit from real authorized jobs ───────────────────────────────
    const auditRows = completedJobs
      .filter(j => (j.suggestedParts || []).some(p => p.wholesaleCost && p.retailPrice))
      .map(j => {
        const standardTotal = (j.suggestedParts || []).reduce((s, p) => s + (p.retailPrice || 0), 0);
        const actualTotal   = (j.suggestedParts || []).reduce((s, p) => s + ((p.wholesaleCost || 0) * 1.25 * (p.qty || 1)), 0);
        return { customer: j.name || 'Unknown', tier: j.customerTier || 'STANDARD', standardPrice: standardTotal, actualPrice: actualTotal };
      })
      .filter(r => r.standardPrice > 0);

    if (auditRows.length > 0) {
      setAuditData(auditRows);
    } else {
      setAuditData([]);
    }
  }, []);

  return (
    <div className="p-6 bg-slate-950 text-slate-200 min-h-screen">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter">OMNI // Command</h2>
        <p className="text-[10px] font-mono text-blue-500 uppercase tracking-widest">Shop Performance Metrics // {DataBridge.load('shop_info')?.name || 'Your Shop'}</p>
      </header>

      {/* TOP LEVEL TOTALS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Monthly Revenue',   val: `$${(stats.revenue / 1000).toFixed(1)}k`,        change: `${stats.jobCount} jobs`,    icon: <DollarSign size={16}/> },
          { label: 'Active Trials',     val: trialModules.length.toString(),                   change: 'Tracking',                  icon: <Users size={16}/> },
          { label: 'Inventory Value',   val: `$${(stats.inventoryValue / 1000).toFixed(1)}k`, change: 'Live',                      icon: <Package size={16}/> },
          { label: 'Completion Rate',   val: stats.efficiency > 0 ? `${stats.efficiency}%` : '—', change: 'This Month',            icon: <TrendingUp size={16}/> },
        ].map((stat, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 bg-slate-800 rounded-lg text-blue-500">{stat.icon}</div>
              <span className="text-[10px] font-black text-emerald-500 flex items-center">{stat.change} <ArrowUpRight size={10}/></span>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase">{stat.label}</p>
            <p className="text-xl font-black text-white italic">{stat.val}</p>
          </div>
        ))}
      </div>

      {/* TRIAL & BLIND-SPOT TRACKER */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
          <BarChart3 size={16} className="text-blue-500" /> Trial Conversion Pipeline
        </h3>
        <div className="space-y-4">
          {trialModules.length === 0 ? (
            <div className="text-center font-mono text-xs text-slate-500 italic p-6 border border-dashed border-slate-700 rounded-xl">
              No active test-flights or trials currently running. Check Marketplace.
            </div>
          ) : (
            trialModules.map((trial, i) => (
              <div key={i} className="flex justify-between items-center bg-black/40 p-4 rounded-xl border border-slate-800">
                <div>
                  <p className="text-sm font-bold text-white uppercase">{trial.module}</p>
                  <p className="text-[10px] text-slate-500 font-mono uppercase">{trial.daysLeft} Days Remaining</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-orange-500 uppercase">Blurred Insights</p>
                  <p className="text-sm font-black text-white">{trial.blurredAlerts} Alerts ({trial.value})</p>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* LIVE INTELLIGENCE FEED */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-8">
        <h3 className="text-xs font-black uppercase text-slate-400 mb-6 flex items-center gap-2">
          <Mic size={16} className="text-blue-500" /> Live Feed (KOSK Sync)
        </h3>
        <div className="space-y-3">
          {activeJob?.notes && activeJob.notes.length > 0 ? (
            activeJob.notes.map((n, i) => (
               <div key={i} className="bg-black/50 p-4 rounded-xl border border-blue-500/20 text-emerald-400 font-mono text-xs shadow-inner shadow-blue-500/10">
                 {n}
               </div>
            ))
          ) : (
             <div className="text-center font-mono text-xs text-slate-500 italic p-6 border border-dashed border-slate-800 rounded-xl">
               No technician transcriptions available on current active job.
             </div>
          )}
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button onClick={onEnterKiosk} className="bg-emerald-600 p-4 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-colors">
          Initialize KOSK Mode
        </button>
        <button className="bg-blue-600 p-4 rounded-2xl font-black uppercase italic text-xs shadow-lg shadow-blue-900/20">
          Generate Monthly ROI
        </button>
        <button className="bg-slate-800 p-4 rounded-2xl font-black uppercase italic text-xs border border-slate-700">
          Marketplace Tiers
        </button>
      </div>

      {/* COMPLIANCE GUARD PANEL */}
      <ComplianceGuard />

      {/* LEAKAGE AUDIT COMPONENT */}
      <LeakageAudit auditData={auditData} />

      {/* NEW STAFF MANAGEMENT PANEL */}
      <StaffManagement />
    </div>
  );
};

export default IgnitionOmni;
