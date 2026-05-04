/**
 * MODULE: CoreApp (The Umbrella)
 * VERSION: v0.8.0
 * DESC: Master Controller for Ignition OS. 
 * Features: Global State Hoisting, Subscription Gatekeeping, and Blurred Trial Previews.
 */

import React, { useState, useEffect } from 'react';
import DataBridge from './DataBridge';
import { supabase } from './supabase';
import OnboardingWizard from './OnboardingWizard';
import IgnitionFlux from './modules/IgnitionFlux';
import PredictiveKey from './modules/PredictiveKey';
import AdminSubscription from './modules/AdminSubscription';
import IgnitionCipher from './modules/IgnitionCipher';
import IgnitionStok from './modules/IgnitionStok';
import IgnitionOmni from './modules/IgnitionOmni';
import IgnitionKosk from './modules/IgnitionKosk';
import IgnitionProt from './modules/IgnitionProt';
import IgnitionPort from './modules/IgnitionPort';
import IgnitionHub from './modules/IgnitionHub';
import IgnitionProc from './modules/IgnitionProc';
import IgnitionCRM from './modules/IgnitionCRM';
import IgnitionCompliance from './modules/IgnitionCompliance';
import IgnitionAdmin from './modules/IgnitionAdmin';
import IgnitionAudit from './modules/IgnitionAudit';
import { Lock, LayoutDashboard, Truck, Activity, ShoppingCart, Search, Package, BarChart3, ShieldCheck, Users, Map, Store, ScanLine, QrCode, DollarSign, RefreshCw, UserPlus, ClipboardCheck, Cog, FileSearch, CheckCircle, ChevronRight } from 'lucide-react';

/**
 * UI: Join Flow — tech/staff scan owner's QR code, pick role, set PIN, land in app
 */
const JoinFlow = ({ shopId }) => {
  const [phase, setPhase]     = useState('role');   // 'role' | 'pin' | 'done'
  const [role, setRole]       = useState(null);
  const [name, setName]       = useState('');
  const [pin, setPin]         = useState('');
  const [shopName, setShopName] = useState('');
  const [error, setError]     = useState('');

  useEffect(() => {
    supabase.from('shops').select('name').eq('id', shopId).single()
      .then(({ data }) => { if (data?.name) setShopName(data.name); });
  }, [shopId]);

  const ROLES = [
    { id: 'TECH',    label: 'Technician',    color: 'blue',   desc: 'Intake · VIN · Voice · Workflow' },
    { id: 'SERVICE', label: 'Front Office',  color: 'purple', desc: 'Queue · Estimates · Customers' },
  ];

  const finalize = () => {
    if (pin.length !== 4) return setError('PIN must be 4 digits.');
    if (!name.trim())     return setError('Your name is required.');
    DataBridge.setShopId(shopId);
    const profiles = DataBridge.getProfiles();
    if (profiles[pin])    return setError('That PIN is already taken — choose another.');
    const newProfile = {
      id: pin, name: name.trim(), role,
      allowed: role === 'TECH'
        ? ['intake','queue','vin','voice','estimates','parts','tools']
        : ['intake','queue','estimates','parts','procure','crm','kiosk'],
      preferences: { pinnedSpecs: ['Model Year','Make','Model'] },
      hasSignedWaiver: false,
      permissions: role === 'TECH' ? ['TECH'] : ['TECH'],
    };
    const updated = { ...profiles, [pin]: newProfile };
    DataBridge.save('user_profiles', updated);
    DataBridge.save('current_user', newProfile);
    window.history.replaceState({}, '', '/');
    setPhase('done');
    setTimeout(() => window.location.reload(), 1200);
  };

  if (phase === 'done') return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6">
      <div className="w-20 h-20 bg-emerald-600/10 border border-emerald-500/30 rounded-3xl flex items-center justify-center mb-6">
        <CheckCircle size={40} className="text-emerald-400" />
      </div>
      <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">You're In</h1>
      <p className="text-slate-500 text-[10px] uppercase tracking-widest">Loading {shopName}...</p>
    </div>
  );

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-2">Ignition OS</p>
          <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">
            {shopName ? `Join ${shopName}` : 'Join Shop'}
          </h1>
        </div>

        {phase === 'role' && (
          <div className="space-y-3">
            {ROLES.map(({ id, label, color, desc }) => (
              <button
                key={id}
                onClick={() => { setRole(id); setPhase('pin'); }}
                className={`w-full bg-slate-900 border border-slate-800 hover:border-${color}-500/50 rounded-3xl p-6 flex items-center gap-4 text-left transition-all active:scale-[0.98]`}
              >
                <div className={`w-12 h-12 rounded-2xl bg-${color}-600/10 border border-${color}-500/20 flex items-center justify-center flex-shrink-0`}>
                  <Users size={20} className={`text-${color}-400`} />
                </div>
                <div>
                  <p className="text-sm font-black text-white uppercase italic tracking-tighter">{label}</p>
                  <p className="text-[9px] text-slate-500 mt-0.5">{desc}</p>
                </div>
                <ChevronRight size={16} className="text-slate-600 ml-auto" />
              </button>
            ))}
          </div>
        )}

        {phase === 'pin' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-5">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Your Name</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="First name or nickname"
                className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Create Your 4-Digit PIN</label>
              <input
                type="password" value={pin} maxLength={4}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                placeholder="••••"
                className="w-full bg-black border border-slate-800 rounded-xl p-4 text-white font-bold text-2xl tracking-[1em] text-center focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-[10px] font-bold">{error}</p>}
            <button
              onClick={finalize}
              disabled={pin.length !== 4 || !name.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-colors active:scale-95"
            >
              Join Shop
            </button>
            <button onClick={() => setPhase('role')} className="w-full text-slate-600 text-[10px] font-black uppercase tracking-wider hover:text-slate-400 transition-colors">
              ← Change Role
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * UI: The Enrollment Generator & Gate
 */
const EnrollmentGate = ({ token }) => {
   const [pin, setPin] = useState('');
   const [enrolled, setEnrolled] = useState(false);
   const [profile, setProfile] = useState(() => {
      const pending = DataBridge.load('pending_users') || [];
      return pending.find(p => p.token === token);
   });

   if (!profile) return (
     <div className="h-screen w-screen bg-black flex items-center justify-center text-center p-10">
       <h1 className="text-2xl font-black text-red-500 uppercase tracking-tighter">Fault: Invalid or Expired Enrollment Token.</h1>
     </div>
   );

   const finalize = () => {
      if (pin.length !== 4) return alert("PIN must be exactly 4 digits.");
      // Move to active users
      const users = DataBridge.load('users_table') || [];
      const finalProfile = { ...profile, pin, status: 'ACTIVE' };
      delete finalProfile.token;
      users.push(finalProfile);
      DataBridge.save('users_table', users);

      // Remove from pending
      const pending = DataBridge.load('pending_users') || [];
      const newPending = pending.filter(p => p.token !== token);
      DataBridge.save('pending_users', newPending);

      setEnrolled(true);
   };

   if (enrolled) {
      return (
         <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-center p-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            <div className="bg-slate-900 border border-emerald-500/30 p-12 rounded-[3rem] shadow-2xl shadow-emerald-900/20 max-w-sm w-full flex flex-col items-center">
              <div className="bg-black p-6 rounded-3xl border border-slate-800 mb-8 inline-block shadow-inner">
                <QrCode size={100} className="text-emerald-500" />
              </div>
              <h1 className="text-2xl font-black text-white italic uppercase mb-2 tracking-tighter">Enrollment Complete</h1>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-8">Identity Matrix Synced to Registry</p>
              
              <div className="bg-slate-950 px-8 py-4 rounded-xl border border-slate-800 mb-8">
                <p className="font-mono text-emerald-400 text-3xl font-black tracking-[0.5em]">{pin}</p>
              </div>

              <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-8">Scan this badge to bind to a physical terminal, or use your PIN.</p>
              
              <a href="/" className="bg-blue-600 text-white px-8 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] w-full block hover:bg-blue-500 transition-colors">
                Initialize System (Login)
              </a>
            </div>
         </div>
      );
   }

   return (
      <div className="h-screen w-screen bg-black flex flex-col items-center justify-center text-center p-6 relative">
         <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
         <div className="z-10 bg-slate-900 p-10 rounded-[3rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center">
           <h1 className="text-2xl font-black text-white italic uppercase mb-2 tracking-tighter">Secure Initialization</h1>
           <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-8">Welcome, <span className="text-blue-400">{profile.name}</span>.<br/>Set your 4-Digit Identity PIN.</p>
           
           <input 
             type="password" 
             value={pin} 
             onChange={e=>setPin(e.target.value.replace(/[^0-9]/g, ''))} 
             maxLength={4} 
             className="bg-slate-950 border border-slate-700 rounded-2xl text-white text-4xl tracking-[1em] text-center w-full p-6 mb-8 focus:border-emerald-500 outline-none transition-colors" 
             placeholder="----" 
           />
           
           <button onClick={finalize} className="bg-emerald-600 text-white px-8 py-5 rounded-2xl font-black flex items-center justify-center gap-2 uppercase tracking-widest text-[10px] w-full hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-900/40">
             <UserPlus size={16} /> Secure Profile
           </button>
         </div>
      </div>
   );
};

/**
 * LOGIC: The Access Gatekeeper
 */
const AccessGatekeeper = ({ requiredPermissions, children }) => {
  const currentUser = DataBridge.load('current_user');
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideMode, setOverrideMode] = useState(false);

  if (!currentUser) return null;

  // Deep Security Registry Rollout
  const rolesRegistry = DataBridge.getSystemRoles();
  const userCapabilities = currentUser.permissions.flatMap(role => rolesRegistry[role] || []);

  // Granular Access Check
  const hasAccess = requiredPermissions.some(rp => userCapabilities.includes(rp)) || overrideActive;

  if (hasAccess) return children;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <ShieldCheck size={80} className="text-red-500 mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
      <h2 className="text-3xl font-black uppercase text-white mb-2 tracking-tighter">Access Denied</h2>
      <p className="text-slate-400 mb-8 max-w-xs text-xs uppercase tracking-widest leading-relaxed">
        Your identity matrix lacks clearance for: <span className="text-red-400 font-bold">{requiredPermissions.join(' or ')}</span>.
      </p>
      
      {!overrideMode ? (
         <button onClick={() => setOverrideMode(true)} className="bg-slate-900 text-slate-300 px-8 py-4 rounded-2xl border border-slate-700 font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition shadow-xl">
           Request Manager Override
         </button>
      ) : (
         <div className="bg-slate-900 border border-slate-700 p-8 rounded-[2rem] w-full max-w-xs shadow-2xl">
           <p className="text-[10px] uppercase font-black text-orange-500 mb-6 animate-pulse tracking-widest">Awaiting Manager Scan</p>
           <div className="w-full aspect-square bg-black border-2 border-dashed border-slate-700 flex flex-col items-center justify-center rounded-3xl mb-6 group cursor-pointer hover:border-blue-500 transition-colors" 
                onClick={() => {
                  DataBridge.smartSync('MANAGER_OVERRIDE_GRANTED', { timestamp: Date.now(), requestedBy: currentUser.id });
                  setOverrideActive(true);
                  alert("Manager Override Granted for single session.");
                }}>
             <ScanLine size={48} className="text-slate-600 group-hover:text-blue-500 transition-colors mb-2" />
             <p className="text-[8px] uppercase tracking-widest font-bold text-slate-600 group-hover:text-blue-500">Tap to Simulate QR</p>
           </div>
           <p className="text-[9px] text-slate-500 uppercase tracking-wider">A system log will be generated.</p>
         </div>
      )}
    </div>
  );
};

/**
 * UI: The PIN Login Block
 */
const IdentityMatrix = ({ onLogin }) => {
  const [pin, setPin] = useState('');
  
  const handleLogin = () => {
     const user = DataBridge.authenticate(pin);
     if (user) {
        onLogin(user);
     } else {
        alert("SECURITY FAULT: Invalid Identity PIN.");
        setPin('');
     }
  };

  return (
    <div className="h-screen w-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
       {/* Background Grid Pattern */}
       <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(30,41,59,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(30,41,59,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
       
       <div className="z-10 bg-slate-900/90 backdrop-blur-md p-10 rounded-[3rem] border border-slate-800 shadow-2xl w-full max-w-sm text-center">
         <div className="bg-slate-950 w-24 h-24 mx-auto rounded-3xl flex items-center justify-center border border-slate-800 shadow-xl mb-8">
            <Lock size={40} className="text-blue-500" />
         </div>
         <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter mb-2">Identity Matrix</h1>
         <p className="text-[9px] font-mono text-slate-500 mb-8 uppercase tracking-[0.2em]">{`Enter 4-Digit Security Authorization`}</p>
         
         <input 
           type="password" 
           placeholder="----" 
           value={pin} 
           onChange={e => setPin(e.target.value)} 
           className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center tracking-[1em] text-3xl text-white font-black mb-8 focus:outline-none focus:border-blue-500 transition-colors" 
           maxLength={4} 
         />
         <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] hover:bg-blue-500 shadow-lg shadow-blue-900/40 active:scale-95 transition-transform">
           Authenticate
         </button>
         
         <p className="text-[8px] font-black text-slate-600 uppercase mt-8 tracking-widest">
           Admin: 1111 // Tech: 1234 // Service: 2222
         </p>
       </div>
    </div>
  );
};

const CoreApp = () => {
  // 1. FIRST-RUN GATE
  const [onboardingDone, setOnboardingDone] = useState(() => {
    const policy = DataBridge.load('shop_policy');
    return policy?.onboarding_complete === true;
  });

  // 2. HOISTED STATE: Subscriptions & Active Job
  const [subscriptions, setSubscriptions] = useState(DataBridge.load('system_subscriptions') || {});
  const [activeJob, setActiveJob] = useState(DataBridge.load('active_job_context') || {
    id: 'JOB-1102',
    unit: 'Unit 1102',
    status: 'MOBILE_FIELD',
    inventory: { specialized: [], baseConfirmed: true },
    assigned_crew_size: 1,
    active_techs: [],
    tasks: [],
    labor_ledger: []
  });
  const [activeModule, setActiveModule] = useState('DASHBOARD');
  const [stokSearchQuery, setStokSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState(DataBridge.load('current_user') || null);
  const [allJobs, setAllJobs] = useState([]);
  const [userRole, setUserRole] = useState('ADMIN');
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [trialStatus, setTrialStatus] = useState(() => DataBridge.getShopTrialStatus());
  const [nudgeDismissed, setNudgeDismissed] = useState(false);

  // 2. REFRESH SUBSCRIPTIONS: Pull latest from DataBridge on module switch
  useEffect(() => {
    const latestSubs = DataBridge.load('system_subscriptions');
    if (latestSubs) setSubscriptions(latestSubs);
  }, [activeModule]);
  
  // REUSABLE SYNC FUNCTION
  const fetchCloudData = () => {
    DataBridge.pullCloudSync().then(serverJobs => {
      if (serverJobs && serverJobs.length > 0) {
        setAllJobs(serverJobs);
        const currentId = activeJob?.jobId || activeJob?.id;
        const updated = serverJobs.find(j => j.jobId === currentId || j.id === currentId);
        if (updated) {
          setActiveJob(updated);
        } else {
          // Automatically default to the newest job created on Mobile
          setActiveJob(serverJobs[serverJobs.length - 1]);
        }
      }
    });
  };

  // CLOUD SYNC: Pull latest jobs from Python backend on mount
  useEffect(() => {
    fetchCloudData();
  }, []); // Empty array ensures this only fires once when the web app loads

  // ONBOARDING GATE: First-run wizard before anything else
  if (!onboardingDone) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setOnboardingDone(true);
          setCurrentUser(DataBridge.load('current_user'));
        }}
      />
    );
  }

  // NATIVE ROUTING: Intercept enrollment tokens gracefully
  const urlParams = new URLSearchParams(window.location.search);
  const enrollToken = urlParams.get('enroll');
  if (enrollToken) {
     return <EnrollmentGate token={enrollToken} />;
  }

  // JOIN FLOW: Tech/staff scan owner's QR code to join the shop
  const joinShopId = urlParams.get('join');
  if (joinShopId) {
    return <JoinFlow shopId={joinShopId} />;
  }

  if (!currentUser) {
    return <IdentityMatrix onLogin={(user) => {
       DataBridge.save('current_user', user);
       setCurrentUser(user);
    }} />;
  }

  // 3. GATEKEEPER WRAPPER: Handles the "Blind Spot" Blur Logic
  const TrialGatekeeper = ({ children, moduleKey, moduleName }) => {
    // MASTER KEY: Admins automatically bypass all subscription locks
    if (currentUser?.permissions?.includes('ADMIN')) return children;

    const status = DataBridge.checkTrialStatus(moduleKey);
    const mod = subscriptions[moduleKey];

    // If not subscribed and no trial active, hard lock
    if (!mod || (!mod.active && !mod.trialActive)) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-950 text-slate-500 p-10">
          <Lock size={48} className="mb-4 opacity-20" />
          <h3 className="text-xl font-black italic uppercase">Module Locked</h3>
          <p className="text-xs mb-6">Subscription required to access {moduleName}.</p>
          <button onClick={() => setActiveModule('MARKETPLACE')} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">Visit Marketplace</button>
        </div>
      );
    }

    // If trial is expired, show the Blurred Preview
    if (status.isExpired) {
      return (
        <div className="relative h-full w-full">
          <div className="filter blur-xl opacity-20 pointer-events-none select-none h-full">
            {children}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-sm p-6 text-center z-50">
            <div className="max-w-md bg-slate-900 border border-blue-500/30 p-8 rounded-3xl shadow-2xl pointer-events-auto">
              <h3 className="text-2xl font-black text-white italic mb-2 uppercase tracking-tighter">Access Expired</h3>
              <p className="text-sm text-slate-400 mb-6">Your 30-day "Deep Integration" trial for {moduleName} has concluded. Your data is saved but currently hidden.</p>
              <button onClick={() => setActiveModule('MARKETPLACE')} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg shadow-blue-900/40 uppercase tracking-widest text-xs hover:bg-blue-500">Restore Full Access</button>
            </div>
          </div>
        </div>
      );
    }

    // Otherwise, render the functional module
    return children;
  };

  // KIOSK OVERRIDE RENDER
  if (isKioskMode) {
    return (
      <div className="flex flex-col h-screen bg-black text-slate-200 overflow-hidden">
         <IgnitionKosk 
           activeJob={activeJob} 
           onUpdateJob={(job) => {
             setActiveJob(job);
             DataBridge.save('active_job_context', job);
           }}
           onExitKiosk={() => setIsKioskMode(false)}
         />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-black text-slate-200 overflow-hidden relative">
      <header className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950">
        <div className="flex gap-4">
          <button 
            onClick={() => {
              if (allJobs.length < 2) return;
              const currentIndex = allJobs.findIndex(j => (j.jobId || j.id) === (activeJob?.jobId || activeJob?.id));
              const nextJob = allJobs[(currentIndex + 1) % allJobs.length];
              setActiveJob(nextJob);
              DataBridge.save('active_job_context', nextJob);
            }}
            className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-left hover:bg-slate-800 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <span className="block text-[8px] font-black text-slate-500 uppercase mb-0.5">Active Asset (Tap to Cycle)</span>
            <span className="block text-xs font-black text-emerald-500 uppercase">{activeJob?.jobId || activeJob?.id || 'NO JOB'} // {activeJob?.year || '????'} {activeJob?.make || 'Unknown'}</span>
          </button>
          
          <button 
             onClick={fetchCloudData}
             className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl flex flex-col items-center justify-center hover:bg-slate-800 active:scale-95 transition-all cursor-pointer shadow-md"
          >
             <RefreshCw size={14} className="text-blue-500 mb-0.5" />
             <span className="text-[8px] font-black text-slate-500 uppercase">Sync</span>
          </button>

          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-center flex items-center gap-3">
             <div>
               <span className="block text-[8px] font-black text-slate-500 uppercase">Identity Matrix</span>
               <span className="block text-xs font-black text-blue-500 uppercase">{currentUser.name}</span>
             </div>
             <button onClick={() => { DataBridge.save('current_user', null); setCurrentUser(null); }} className="p-2 bg-slate-950 rounded-lg text-slate-500 hover:text-white transition-colors">
               <Lock size={12} />
             </button>
          </div>
        </div>
      </header>

      {/* ── TRIAL BANNER ─────────────────────────────────────────────────────── */}
      {!trialStatus.isPaid && !isKioskMode && (() => {
        const { day, daysRemaining, isWarning, isBlurred, isArchived, showNudge, showReport } = trialStatus;

        if (isArchived) return (
          <div className="bg-slate-900 border-b border-red-500/30 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-red-400 font-black uppercase tracking-widest">Trial ended {day - 14} days ago — your data is archived</p>
            <button onClick={() => setActiveModule('MARKETPLACE')} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl flex-shrink-0 transition-colors">Restore Access</button>
          </div>
        );

        if (isBlurred) return (
          <div className="bg-slate-900 border-b border-orange-500/40 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-orange-400 font-black uppercase tracking-widest">Trial expired — your data is safe but locked</p>
              <p className="text-[10px] text-slate-500">Subscribe to unlock everything. Data archived in {30 - day} days.</p>
            </div>
            <button onClick={() => setActiveModule('MARKETPLACE')} className="bg-orange-500 hover:bg-orange-400 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl flex-shrink-0 transition-colors">Subscribe Now</button>
          </div>
        );

        if (showReport && !nudgeDismissed) return (
          <div className="bg-blue-950 border-b border-blue-500/40 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-blue-300 font-black uppercase tracking-widest">⚡ {daysRemaining} days left — your savings report is ready</p>
              <p className="text-[10px] text-slate-400">Review what Ignition flagged this trial before access ends.</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={() => { setActiveModule('OMNI'); setNudgeDismissed(true); }} className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors">View Report</button>
              <button onClick={() => setNudgeDismissed(true)} className="text-slate-600 hover:text-slate-400 text-[10px] font-black uppercase px-3 py-2 transition-colors">✕</button>
            </div>
          </div>
        );

        if (showNudge && !nudgeDismissed) return (
          <div className="bg-emerald-950 border-b border-emerald-500/30 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-xs text-emerald-400 font-black uppercase tracking-widest">Trial active — {daysRemaining} days remaining · Full PREMIER access</p>
            <button onClick={() => setNudgeDismissed(true)} className="text-slate-600 hover:text-slate-400 text-[10px] font-black uppercase px-3 py-2 transition-colors">✕</button>
          </div>
        );

        if (isWarning) return (
          <div className="bg-red-950 border-b border-red-500/40 px-4 py-3 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-red-400 font-black uppercase tracking-widest">⚠ {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left — trial ending soon</p>
              <p className="text-[10px] text-slate-400">Subscribe now to keep your jobs, customers, and AI features.</p>
            </div>
            <button onClick={() => setActiveModule('MARKETPLACE')} className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl flex-shrink-0 transition-colors">Subscribe</button>
          </div>
        );

        return null;
      })()}

      {/* ── DAY 15 BLUR GATE ─────────────────────────────────────────────────── */}
      {trialStatus.isBlurred && !trialStatus.isPaid && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-6 text-center">
          <div className="max-w-md bg-slate-900 border border-blue-500/20 p-10 rounded-3xl shadow-2xl">
            <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Lock size={32} className="text-blue-400" />
            </div>
            <h2 className="text-3xl font-black italic text-white uppercase tracking-tighter mb-2">Trial Complete</h2>
            <p className="text-slate-400 text-sm mb-2 leading-relaxed">
              Your 14-day PREMIER trial has ended.
            </p>
            <p className="text-slate-500 text-xs mb-8">
              Your data is safe. Subscribe to unlock full access. Data archived in {Math.max(0, 30 - trialStatus.day)} days.
            </p>
            <div className="space-y-3">
              <button onClick={() => setActiveModule('MARKETPLACE')} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-sm shadow-lg shadow-blue-900/40 transition-colors active:scale-95">
                Subscribe — From $149/mo
              </button>
              <p className="text-[10px] text-slate-600 uppercase tracking-widest">Cancel any time · Data restored instantly</p>
            </div>
          </div>
        </div>
      )}

      {/* MAIN VIEWPORT */}
      <main className="flex-1 overflow-y-auto">
        {activeModule === 'OMNI' && (
          <AccessGatekeeper requiredPermissions={['view_omni']}>
            <IgnitionOmni 
              activeJob={activeJob} 
              onEnterKiosk={() => setIsKioskMode(true)} 
            />
          </AccessGatekeeper>
        )}
        
        {activeModule === 'PORT' && (
          <AccessGatekeeper requiredPermissions={['view_port']}>
            <IgnitionPort 
              activeJob={activeJob} 
              allJobs={allJobs} 
              onUpdateJob={(j) => { setActiveJob(j); DataBridge.save('active_job_context', j); }} 
              onSelectJob={(j) => { setActiveJob(j); DataBridge.save('active_job_context', j); }} 
            />
          </AccessGatekeeper>
        )}

        {/* HUB handles its own internal blind-spot blur in code */}
        {activeModule === 'HUB' && (
          <AccessGatekeeper requiredPermissions={['view_hub']}>
            <IgnitionHub activeJob={activeJob} />
          </AccessGatekeeper>
        )}

        {activeModule === 'PROC' && (
          <AccessGatekeeper requiredPermissions={['view_proc']}>
            <TrialGatekeeper moduleKey="PROC" moduleName="PROC // Vendor Shadowing">
              <IgnitionProc />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

    {activeModule === 'CRM' && (
      <AccessGatekeeper requiredPermissions={['view_crm']}>
        <TrialGatekeeper moduleKey="CRM" moduleName="CRM // Client Directory">
          <IgnitionCRM />
        </TrialGatekeeper>
      </AccessGatekeeper>
    )}

        {activeModule === 'DASHBOARD' && (
          <div className="p-8 pb-32">
            <h1 className="text-4xl font-black italic mb-2 text-white">IGNITION OS</h1>
            <p className="text-slate-500 font-mono text-xs uppercase tracking-[0.2em] mb-12">Operational Command Grid // Leander, TX</p>
            
            <div className="grid grid-cols-4 gap-y-8 gap-x-4 md:grid-cols-6 lg:grid-cols-8 justify-items-center">
              {[
                { id: 'OMNI', label: 'Command', icon: BarChart3, color: 'text-amber-400', bg: 'bg-slate-800' },
                { id: 'HUB', label: 'Dispatch', icon: Map, color: 'text-blue-500', bg: 'bg-slate-800' },
                { id: 'FLUX', label: 'Workflow', icon: Truck, color: 'text-sky-400', bg: 'bg-slate-800' },
                { id: 'PREDICTIVE', label: 'Predict', icon: Activity, color: 'text-purple-500', bg: 'bg-slate-800' },
                { id: 'CIPHER', label: 'Cipher', icon: Search, color: 'text-indigo-400', bg: 'bg-slate-800' },
                { id: 'STOK', label: 'Inventory', icon: Package, color: 'text-emerald-500', bg: 'bg-slate-800' },
                { id: 'PROC', label: 'Vendors', icon: Store, color: 'text-orange-500', bg: 'bg-slate-800' },
                { id: 'CRM', label: 'Clients', icon: Users, color: 'text-indigo-400', bg: 'bg-slate-800' },
                { id: 'PROT', label: 'Margins', icon: ShieldCheck, color: 'text-teal-400', bg: 'bg-slate-800' },
                { id: 'PORT', label: 'Estimates', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-slate-800' },
                { id: 'COMPLIANCE', label: 'Compliance', icon: ClipboardCheck, color: 'text-red-500', bg: 'bg-slate-800' },
                { id: 'MARKETPLACE', label: 'Market', icon: ShoppingCart, color: 'text-pink-500', bg: 'bg-slate-800' },
                { id: 'AUDIT', label: 'Audit', icon: FileSearch, color: 'text-rose-400', bg: 'bg-slate-800' },
                { id: 'ADMIN', label: 'Admin', icon: Cog, color: 'text-slate-400', bg: 'bg-slate-800' },
              ].map(app => {
                 const { isExpired } = DataBridge.checkTrialStatus(app.id);
                 const mod = subscriptions[app.id];
                 const isAdmin = currentUser?.permissions?.includes('ADMIN');
                 const isLocked = !isAdmin && (!mod || (!mod.active && !mod.trialActive) || isExpired);
                 
                 return (
                   <button 
                     key={app.id}
                     onClick={() => setActiveModule(app.id)}
                     className="flex flex-col items-center gap-3 relative transition-transform active:scale-90 group w-16 md:w-20"
                   >
                     <div className={`w-[60px] h-[60px] md:w-[72px] md:h-[72px] rounded-[18px] md:rounded-[22px] flex items-center justify-center shadow-2xl border border-slate-700/80 bg-slate-800 ${isLocked ? 'opacity-40 grayscale' : 'group-hover:ring-2 ring-white/20 shadow-black'}`}>
                        {isLocked && (
                           <div className="absolute -top-1 -right-1 bg-slate-900 border border-slate-700 p-1.5 rounded-full z-10 shadow-black shadow-xl">
                             <Lock size={12} className="text-red-500" />
                           </div>
                        )}
                        <app.icon size={28} className={`${app.color} drop-shadow-md`} />
                     </div>
                     <span className="text-[10px] font-bold text-slate-300 group-hover:text-white uppercase tracking-wider">{app.label}</span>
                   </button>
                 );
              })}
            </div>
          </div>
        )}

        {activeModule === 'FLUX' && (
          <AccessGatekeeper requiredPermissions={['view_flux']}>
            <TrialGatekeeper moduleKey="FLUX" moduleName="Ignition Flux">
              <IgnitionFlux activeJob={activeJob} onUpdateJob={(job) => {
                setActiveJob(job);
                DataBridge.save('active_job_context', job);
              }} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'PREDICTIVE' && (
          <AccessGatekeeper requiredPermissions={['view_predictive']}>
            <TrialGatekeeper moduleKey="PREDICTIVE" moduleName="Predictive Fleet Key">
              <PredictiveKey clientTier={subscriptions['PREDICTIVE']?.tier || 'BASIC'} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'CIPHER' && (
          <AccessGatekeeper requiredPermissions={['view_cipher']}>
            <TrialGatekeeper moduleKey="CODE" moduleName="CODE // DTC Cipher">
              <IgnitionCipher 
                activeJob={activeJob} 
                onUpdateJob={(job) => { setActiveJob(job); DataBridge.save('active_job_context', job); }} 
                onNavigateToStok={(query) => {
                  setStokSearchQuery(query);
                  setActiveModule('STOK');
                }} 
              />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'STOK' && (
          <AccessGatekeeper requiredPermissions={['view_stok']}>
            <TrialGatekeeper moduleKey="STOK" moduleName="STOK // Inventory Matrix">
              <IgnitionStok initialSearchTerm={stokSearchQuery} />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'PROT' && (
          <AccessGatekeeper requiredPermissions={['view_prot']}>
            <TrialGatekeeper moduleKey="PROT" moduleName="PROT // Margin Matrix">
              <IgnitionProt />
            </TrialGatekeeper>
          </AccessGatekeeper>
        )}

        {activeModule === 'COMPLIANCE' && (
          <AccessGatekeeper requiredPermissions={[]}>
            <IgnitionCompliance onComplete={(payload) => {
              setActiveModule('DASHBOARD');
            }} />
          </AccessGatekeeper>
        )}

        {activeModule === 'MARKETPLACE' && (
          <AccessGatekeeper requiredPermissions={['view_marketplace']}>
            <AdminSubscription />
          </AccessGatekeeper>
        )}

        {activeModule === 'AUDIT' && (
          <AccessGatekeeper requiredPermissions={['view_omni']}>
            <IgnitionAudit />
          </AccessGatekeeper>
        )}

        {activeModule === 'ADMIN' && (
          <AccessGatekeeper requiredPermissions={['manage_users']}>
            <IgnitionAdmin />
          </AccessGatekeeper>
        )}
      </main>

      {/* GLOBAL FOOTER NAVIGATION */}
      <nav className="h-20 bg-slate-900 border-t border-slate-800 flex justify-around items-center px-4 overflow-x-auto relative z-50">
        <button onClick={() => setActiveModule('DASHBOARD')} className={`flex flex-col items-center gap-1 ${activeModule === 'DASHBOARD' ? 'text-blue-500' : 'text-slate-500'}`}>
          <LayoutDashboard size={20} />
          <span className="text-[9px] font-black uppercase">Home</span>
        </button>
        <button onClick={() => setActiveModule('FLUX')} className={`flex flex-col items-center gap-1 ${activeModule === 'FLUX' ? 'text-blue-500' : 'text-slate-500'}`}>
          <Truck size={20} />
          <span className="text-[9px] font-black uppercase">Flux</span>
        </button>
        <button onClick={() => setActiveModule('HUB')} className={`flex flex-col items-center gap-1 ${activeModule === 'HUB' ? 'text-blue-500' : 'text-slate-500'}`}>
          <Map size={20} />
          <span className="text-[9px] font-black uppercase">HUB</span>
        </button>
        <button onClick={() => setActiveModule('PORT')} className={`flex flex-col items-center gap-1 ${activeModule === 'PORT' ? 'text-sky-500' : 'text-slate-500'}`}>
          <DollarSign size={20} />
          <span className="text-[9px] font-black uppercase">Estimates</span>
        </button>
        <button onClick={() => setActiveModule('OMNI')} className={`flex flex-col items-center gap-1 ${activeModule === 'OMNI' ? 'text-yellow-500' : 'text-slate-500'}`}>
          <BarChart3 size={20} />
          <span className="text-[9px] font-black uppercase">Omni</span>
        </button>
      </nav>
    </div>
  );
};

export default CoreApp;
