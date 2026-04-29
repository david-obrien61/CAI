/**
 * FILE: IgnitionPort.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Customer portal view for presenting repair estimates and collecting digital signatures.
 * DEPENDENCIES: react, lucide-react
 */

import React, { useState } from 'react';
import { Check, ChevronRight, ArrowLeft, Database, Store, Lock, Unlock, Wrench, Plus, Zap, XCircle, Send } from 'lucide-react';
import DataBridge from '../DataBridge';
import { MarginEngine } from '../MarginEngine';

const IgnitionPort = ({ activeJob, allJobs = [], onUpdateJob, onSelectJob }) => {
  const [viewMode, setViewMode] = useState('LIST'); // 'LIST', 'BUILDER', 'SIGNATURE'
  const [pricingData, setPricingData] = useState({}); // Stores pricing/sourcing state for each part
  const [tasks, setTasks] = useState([]); // Stores { id, description, suggested_hours, billed_hours, rate }
  const [laborRate, setLaborRate] = useState('');
  const [incidentals, setIncidentals] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [legalConsent, setLegalConsent] = useState(false);
  const vendors = DataBridge.getVendors();

  const handleProceedToSignature = () => {
    // Map the locked pricing data into the job object
    const pricedParts = activeJob.suggestedParts?.map(part => {
      const pState = pricingData[part.id] || {};
      return {
        ...part,
        wholesaleCost: parseFloat(pState.cost) || 0,
        retailPrice: MarginEngine.calculateRetail(pState.cost) * part.qty,
        source: pState.source || 'INVENTORY',
        vendor: pState.vendor || 'SHOP_STOCK'
      };
    }) || [];
    
    const updatedJob = { ...activeJob, suggestedParts: pricedParts, tasks: tasks, incidentals: incidentals };
    if (onUpdateJob) onUpdateJob(updatedJob);
    setViewMode('SIGNATURE');
  };

  const handleSendSMS = () => {
    // Map the locked pricing data into the job object
    const pricedParts = activeJob.suggestedParts?.map(part => {
      const pState = pricingData[part.id] || {};
      return {
        ...part,
        wholesaleCost: parseFloat(pState.cost) || 0,
        retailPrice: MarginEngine.calculateRetail(pState.cost) * part.qty,
        source: pState.source || 'INVENTORY',
        vendor: pState.vendor || 'SHOP_STOCK'
      };
    }) || [];
    
    const updatedJob = { ...activeJob, suggestedParts: pricedParts, tasks: tasks, incidentals: incidentals, status: 'PENDING_CUSTOMER_APPROVAL' };
    if (onUpdateJob) onUpdateJob(updatedJob);
    
    alert(`SMS Sent to Customer! \nLink: ignition.os/approve/${updatedJob.id || updatedJob.jobId}`);
    setViewMode('LIST'); // Return to the queue while waiting for them to sign on their phone
  };

  // ==========================================
  // VIEW 1: THE ESTIMATE QUEUE
  // ==========================================
  if (viewMode === 'LIST') {
    // Filter for jobs that need attention or have been synced
    const pendingJobs = allJobs.filter(j => j.status === 'NEEDS_ESTIMATE' || j.status === 'READY' || j.status === 'SUSPENDED');
    
    return (
      <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
        <header className="mb-8 border-b border-slate-800 pb-4">
          <h2 className="text-2xl font-black italic text-white uppercase tracking-tighter text-emerald-500">Estimates // Builder</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Select a Work Order to price and send</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingJobs.map((job) => (
            <div 
              key={job.jobId || job.id} 
              onClick={() => {
                if (onSelectJob) onSelectJob(job);
                // Pull system rates and automatically apply Customer Tier discounts
                const rates = DataBridge.getSystemRates();
                const jobRate = job?.customerTier === 'FLEET' ? rates.BASE - 10 : (job?.customerTier === 'FF' ? rates.BASE - 25 : rates.BASE);
                setLaborRate(jobRate);
                
                // 1. Give AI-generated Parts a unique ID so React doesn't crash
                const enrichedParts = (job?.suggestedParts || []).map((p, idx) => ({
                  ...p,
                  id: p.id || `PART-${Date.now()}-${idx}`
                }));

                // 2. Give AI-generated Tasks a unique ID and map estimated hours to billed hours
                let initialTasks = (job?.tasks || []).map((t, idx) => ({
                  ...t,
                  id: t.id || `TASK-${Date.now()}-${idx}`,
                  description: t.description || 'General Labor',
                  suggested_hours: t.suggested_hours || 0,
                  billed_hours: t.billed_hours !== undefined ? t.billed_hours : (t.suggested_hours || 0),
                  rate: t.rate || jobRate
                }));

                if (initialTasks.length === 0) {
                  if (job?.transcription?.toLowerCase().includes('turbo')) {
                    initialTasks.push({ id: `TASK-${Date.now()}`, description: 'Turbocharger R&R', suggested_hours: 3.5, billed_hours: 3.5, rate: jobRate });
                  } else if (job?.transcription?.toLowerCase().includes('oil')) {
                    initialTasks.push({ id: `TASK-${Date.now()}`, description: 'Standard Oil Change', suggested_hours: 0.5, billed_hours: 0.5, rate: jobRate });
                  }
                }
                setTasks(initialTasks);
                setIncidentals(job?.incidentals || '35.00');

                // 3. Prepopulate part costs and vendors so the estimator doesn't start with blank fields
                const initialPricing = {};
                enrichedParts.forEach((p, idx) => {
                  let defaultCost = '45.00';
                  if (p.name.toLowerCase().includes('turbo')) defaultCost = '450.00';
                  if (p.name.toLowerCase().includes('oil')) defaultCost = '15.00';
                  if (p.name.toLowerCase().includes('gasket')) defaultCost = '28.50';
                  initialPricing[p.id] = { source: 'VENDOR', vendor: vendors[idx % vendors.length]?.name || 'NAPA Auto Parts', cost: defaultCost, locked: false };
                });
                setPricingData(initialPricing);

                // Pass the enriched data back into activeJob so the UI has the IDs
                const updatedJob = { ...job, suggestedParts: enrichedParts, tasks: initialTasks };
                if (onSelectJob) onSelectJob(updatedJob);

                setViewMode('BUILDER');
              }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] shadow-xl cursor-pointer hover:border-emerald-500/50 transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">{job.jobId || job.id}</h3>
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${job.status === 'NEEDS_ESTIMATE' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-400'}`}>
                    {job.status}
                  </span>
                </div>
                <div className="bg-slate-950 p-2 rounded-full border border-slate-800 group-hover:border-emerald-500/50">
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </div>
              <p className="text-sm font-bold text-slate-300">{job.year || '????'} {job.make || 'Unknown'} {job.model || 'Asset'}</p>
              <p className="text-[10px] text-slate-500 font-mono mt-1">VIN: {job.vin || 'N/A'}</p>
            </div>
          ))}
          {pendingJobs.length === 0 && (
            <div className="col-span-full p-10 text-center text-slate-500 font-black uppercase tracking-widest border-2 border-dashed border-slate-800 rounded-3xl">
              No Pending Estimates in Queue
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2 & 3: DATA MAPPING FOR BUILDER & SIGNATURE
  // ==========================================
  const data = {
    id: activeJob?.jobId || activeJob?.id || "WO-999",
    vehicle: activeJob ? `${activeJob.year || ''} ${activeJob.make || ''} ${activeJob.model || ''}`.trim().toUpperCase() : "Unknown Asset",
    items: activeJob?.suggestedParts?.map(part => ({
      desc: `${part.name} (x${part.qty})`,
      retail: part.retailPrice || 0
    })) || [],
  };
  // Add standard diag fee if parts exist
  if (data.items.length > 0 && !data.items.find(i => i.desc.includes('Diagnostic'))) {
     data.items.unshift({ desc: "Standard Diagnostic Fee", retail: 195.00 });
  }
  
  // Map the granular Labor Tasks to the final receipt
  if (activeJob?.tasks?.length > 0) {
    activeJob.tasks.forEach(task => {
      if (task.billed_hours > 0) {
        data.items.push({
          desc: `Labor: ${task.description} (${task.billed_hours} hrs @ $${task.rate}/hr)`,
          retail: task.billed_hours * task.rate
        });
      }
    });
  }
  if (activeJob?.incidentals > 0) {
    data.items.push({
      desc: "Shop Supplies & Env. Fees",
      retail: activeJob.incidentals
    });
  }

  data.total = data.items.reduce((sum, item) => sum + item.retail, 0);

  // ==========================================
  // VIEW 3: CUSTOMER SIGNATURE CANVAS
  // ==========================================
  const handleFinalApproval = () => {
    if (!isSigned || !legalConsent) {
      alert("Please tap to sign and check the consent box to authorize work.");
      return;
    }
    
    const signature = "DIGITAL_AUTOSIGN_" + (activeJob?.name || activeJob?.unit || "CUSTOMER");
    const updatedJob = { ...activeJob, status: 'AUTHORIZED' };
    if (onUpdateJob) onUpdateJob(updatedJob);
    
    DataBridge.smartSync('ESTIMATE_APPROVED', {
      wo_id: data.id,
      signature: signature,
      timestamp: new Date().toISOString(),
      status: 'AUTHORIZED'
    });

    setIsApproved(true);
  };

  if (isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 text-center">
        <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-emerald-900/20">
          <Check size={40} className="text-white" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase italic">Work Authorized</h2>
        <p className="text-slate-500 font-mono text-xs mt-2 uppercase">The shop has been notified. We're on it.</p>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: THE ESTIMATE BUILDER (PRE-PRICING)
  // ==========================================
  if (viewMode === 'BUILDER') {
    return (
      <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
        <button onClick={() => setViewMode('LIST')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mb-6 transition-colors">
          <ArrowLeft size={14} /> Back to Queue
        </button>

        <header className="mb-8 border-b border-slate-800 pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-black italic uppercase tracking-tighter text-emerald-500 mb-1">Estimate Builder</h2>
              <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{activeJob?.name || 'Unknown Customer'}</h3>
              <p className="text-lg font-bold text-slate-300 uppercase tracking-wide">{data.vehicle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">WO #{data.id}</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: AI TRANSCRIPTION & PARTS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-orange-500 uppercase tracking-widest mb-4">Reported Issue</h3>
              <p className="text-sm text-slate-300 italic leading-relaxed">"{activeJob?.problem || 'No specific problem reported during intake.'}"</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest mb-4">Tech Diagnostic Notes</h3>
              <p className="text-sm text-slate-300 italic leading-relaxed">"{activeJob?.transcription || 'No diagnostic notes provided.'}"</p>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4">AI Extracted Parts</h3>
              <ul className="space-y-3">
                {activeJob?.suggestedParts?.map((part, i) => (
                  <li key={i} className="flex justify-between items-center text-sm font-bold text-slate-300 border-b border-slate-800 pb-2">
                    <span>{part.name}</span>
                    <span className="text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded text-[10px]">QTY {part.qty}</span>
                  </li>
                ))}
                {(!activeJob?.suggestedParts || activeJob.suggestedParts.length === 0) && (
                  <li className="text-xs text-slate-500 italic">No parts extracted.</li>
                )}
              </ul>
            </div>
          </div>

          {/* RIGHT: PRICING ENGINE & SOURCING WORKFLOW */}
          <div className="lg:col-span-2">
             <div className="space-y-4 mb-6">
               <h3 className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                 <Database size={16} /> Asset Sourcing & Pricing Engine
               </h3>
               {activeJob?.suggestedParts?.map((part) => {
                  const pState = pricingData[part.id] || { source: 'INVENTORY', vendor: '', cost: '', locked: false };
                  const retail = MarginEngine.calculateRetail(pState.cost);
                  const isLocked = pState.locked;

                  return (
                    <div key={part.id} className={`bg-slate-900 border rounded-2xl p-5 transition-all ${isLocked ? 'border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'border-slate-800 shadow-xl'}`}>
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-black text-white uppercase">{part.name} <span className="text-emerald-500">x{part.qty}</span></h4>
                        {isLocked ? (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded flex items-center gap-1"><Lock size={12}/> LOCKED</span>
                        ) : (
                          <div className="flex gap-2">
                            <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'INVENTORY'}})} className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors flex items-center gap-1 ${pState.source === 'INVENTORY' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><Database size={12} /> Inventory</button>
                            <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, source: 'VENDOR'}})} className={`px-3 py-1 text-[10px] font-black uppercase rounded transition-colors flex items-center gap-1 ${pState.source === 'VENDOR' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}><Store size={12} /> Vendor</button>
                          </div>
                        )}
                      </div>

                      {!isLocked ? (
                        <div className="grid grid-cols-2 gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
                          {pState.source === 'VENDOR' ? (
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Query Vendor Network</label>
                              <select value={pState.vendor} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, vendor: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-bold text-xs outline-none focus:border-orange-500">
                                <option value="">-- Select Partner --</option>
                                {vendors.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                              </select>
                            </div>
                          ) : (
                            <div>
                              <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Stock Location</label>
                              <div className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-emerald-500 font-mono font-bold text-xs flex items-center gap-2">Aisle 4, Bin B</div>
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Unit Wholesale Cost ($)</label>
                            <input type="number" value={pState.cost} onChange={e => setPricingData({...pricingData, [part.id]: {...pState, cost: e.target.value}})} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white font-black text-sm outline-none focus:border-blue-500 transition-colors" placeholder="0.00" />
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-emerald-500/20">
                          <span className="text-xs text-slate-400 font-black uppercase">Source: <strong className={pState.source === 'INVENTORY' ? 'text-blue-400' : 'text-orange-400'}>{pState.source === 'INVENTORY' ? 'SHOP INVENTORY' : pState.vendor}</strong></span>
                          <span className="text-xs text-slate-400 font-black uppercase">Cost: <strong className="text-white">${parseFloat(pState.cost || 0).toFixed(2)}</strong></span>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Calculated Retail (x{part.qty})</span>
                          <span className="text-2xl font-black text-white tabular-nums">${(retail * part.qty).toFixed(2)}</span>
                        </div>
                        {!isLocked ? (
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: true}})} className={`text-[10px] font-black px-6 py-3 rounded-xl uppercase transition-all shadow-lg flex items-center gap-2 ${pState.cost ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`} disabled={!pState.cost}><Lock size={14} /> Lock Part</button>
                        ) : (
                          <button onClick={() => setPricingData({...pricingData, [part.id]: {...pState, locked: false}})} className="bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-black px-6 py-3 rounded-xl uppercase transition-all flex items-center gap-2"><Unlock size={14} /> Edit</button>
                        )}
                      </div>
                    </div>
                  );
               })}
             </div>
             
             {/* LABOR & INCIDENTALS */}
             <div className="space-y-4 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
                 <h3 className="text-xs font-black text-blue-500 uppercase tracking-widest flex items-center gap-2">
                   <Wrench size={16} /> Labor Tasks
                 </h3>
                 <select 
                   onChange={(e) => {
                     const guide = DataBridge.getLaborGuide()[e.target.value];
                     if (guide) {
                       setTasks([...tasks, {
                         id: `TASK-${Date.now()}`,
                         description: guide.job,
                         suggested_hours: guide.hours,
                         billed_hours: guide.hours,
                         rate: parseFloat(laborRate) || 0
                       }]);
                     }
                     e.target.value = ''; // Reset dropdown after selection
                   }}
                   className="bg-slate-950 border border-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                 >
                   <option value="">-- Add Standard Labor Task --</option>
                   {Object.entries(DataBridge.getLaborGuide()).map(([key, data]) => (
                     <option key={key} value={key}>{data.job} ({data.hours} hrs)</option>
                   ))}
                 </select>
               </div>
               
               <div className="space-y-3">
                 {tasks.map((task, idx) => (
                   <div key={task.id} className="grid grid-cols-12 gap-4 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                     <div className="col-span-6">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Task Description</label>
                       <input type="text" value={task.description} onChange={(e) => {
                         const newTasks = [...tasks];
                         newTasks[idx].description = e.target.value;
                         setTasks(newTasks);
                       }} className="w-full bg-transparent text-white font-bold text-xs outline-none" />
                     </div>
                     <div className="col-span-2">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Suggested</label>
                       <div className="text-slate-400 text-xs font-mono">{task.suggested_hours} hrs</div>
                     </div>
                     <div className="col-span-2">
                       <label className="text-[9px] font-black text-emerald-500 uppercase block mb-1">Billed</label>
                       <input type="number" value={task.billed_hours} onChange={(e) => {
                         const newTasks = [...tasks];
                         newTasks[idx].billed_hours = parseFloat(e.target.value) || 0;
                         setTasks(newTasks);
                       }} className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-black text-xs outline-none focus:border-emerald-500" />
                     </div>
                     <div className="col-span-2 text-right">
                       <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Task Total</label>
                       <div className="text-white font-black text-sm">${(task.billed_hours * task.rate).toFixed(2)}</div>
                     </div>
                   </div>
                 ))}
                 {tasks.length === 0 && (
                   <div className="text-center p-4 border border-dashed border-slate-800 rounded-xl text-[10px] text-slate-500 font-black uppercase">
                     No labor tasks added. Select from the guide above.
                   </div>
                 )}
               </div>

               {/* Global Rate & Incidentals */}
               <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-800">
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Global Hourly Rate {activeJob?.customerTier && <span className="text-emerald-500">({activeJob.customerTier})</span>}</label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                     <input type="number" value={laborRate} onChange={e => {
                         const newRate = parseFloat(e.target.value) || 0;
                         setLaborRate(newRate);
                         setTasks(tasks.map(t => ({...t, rate: newRate})));
                     }} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 transition-colors" placeholder="165" />
                   </div>
                 </div>
                 <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase block mb-2">Shop Supplies</label>
                   <div className="relative">
                     <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">$</span>
                     <input type="number" value={incidentals} onChange={e => setIncidentals(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-7 pr-3 py-3 text-white font-black outline-none focus:border-blue-500 transition-colors" placeholder="35.00" />
                   </div>
                 </div>
               </div>
             </div>

             <div className="flex gap-4">
               <button onClick={handleProceedToSignature} className="flex-1 bg-emerald-600 hover:bg-emerald-500 p-6 rounded-[2rem] text-white font-black uppercase text-sm shadow-xl shadow-emerald-900/40 active:scale-95 transition-all flex justify-center items-center gap-2">
                  In-Person Kiosk Sign
               </button>
               <button onClick={handleSendSMS} className="flex-1 bg-blue-600 hover:bg-blue-500 p-6 rounded-[2rem] text-white font-black uppercase text-sm shadow-xl shadow-blue-900/40 active:scale-95 transition-all flex justify-center items-center gap-2">
                  <Send size={18} /> Send via SMS
               </button>
             </div>
             <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest text-center mt-4">SMS delivery uses Twilio API integration.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-950 min-h-screen text-slate-200 pb-24">
      <button onClick={() => setViewMode('BUILDER')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white mb-6 transition-colors">
        <ArrowLeft size={14} /> Back to Builder
      </button>
      <header className="mb-8 border-b border-slate-800 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-sm font-black text-emerald-500 uppercase italic tracking-tighter mb-1">Customer Authorization</h1>
            <h3 className="text-3xl font-black text-white uppercase tracking-tighter">{activeJob?.name || 'Unknown Customer'}</h3>
            <p className="text-lg font-bold text-slate-300 uppercase tracking-wide">{data.vehicle}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mt-6">WO #{data.id}</p>
          </div>
        </div>
      </header>

      {/* ITEM SUMMARY */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden mb-6 shadow-2xl">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-800/50 text-slate-500 uppercase font-black italic">
            <tr>
              <th className="p-4">Description</th>
              <th className="p-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {data.items.map((item, i) => (
              <tr key={i} className="border-t border-slate-800/50">
                <td className="p-4 font-bold">{item.desc}</td>
                <td className="p-4 text-right font-mono">${item.retail ? item.retail.toFixed(2) : "0.00"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 bg-blue-600/10 border-t border-blue-500/20 flex justify-between items-center">
          <span className="text-xs font-black text-blue-400 uppercase italic">Grand Total</span>
          <span className="text-2xl font-black text-white font-mono">${data.total ? data.total.toFixed(2) : "0.00"}</span>
        </div>
      </div>

      {/* THE CLOSER: SIGNATURE BOX */}
      <div className="bg-white rounded-[2.5rem] p-6 shadow-2xl">
        <p className="text-center text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">Tap to Authorize Repair</p>
        
        {/* TAP TO SIGN BOX */}
        <div 
          onClick={() => setIsSigned(true)}
          className={`border-2 ${isSigned ? 'border-emerald-500 bg-emerald-50' : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'} rounded-2xl mb-6 h-32 flex items-center justify-center cursor-pointer transition-colors`}
        >
          {isSigned ? (
            <span className="text-4xl text-emerald-700" style={{ fontFamily: "'Brush Script MT', 'Caveat', cursive" }}>
              {activeJob?.name || activeJob?.unit || 'Customer Authorized'}
            </span>
          ) : (
            <span className="text-slate-400 font-bold uppercase tracking-widest">Tap Here to Sign</span>
          )}
        </div>

        {/* LEGAL CONSENT */}
        {isSigned && (
          <div className="mb-6 flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <input 
              type="checkbox" 
              id="legalConsent" 
              checked={legalConsent} 
              onChange={(e) => setLegalConsent(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label htmlFor="legalConsent" className="text-xs font-bold text-slate-600 leading-tight cursor-pointer select-none">
              By checking this box, you are approving the estimate and legally authorizing the shop to perform the listed repairs.
            </label>
          </div>
        )}

        <button 
          onClick={handleFinalApproval}
          disabled={!isSigned || !legalConsent}
          className={`w-full p-6 rounded-[2rem] font-black uppercase text-lg shadow-xl transition-all ${
            (isSigned && legalConsent) 
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/40 active:scale-95' 
              : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
          }`}
        >
          Authorize Work
        </button>
      </div>
    </div>
  );
};

export default IgnitionPort;
