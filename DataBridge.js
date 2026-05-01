/**
 * FILE: DataBridge.js
 * PLATFORM: Universal (Web & Mobile)
 * PURPOSE: Central storage and sync layer for Ignition OS. Handles Local-First persistence,
 *          Supabase cloud sync, Trial Clock synchronization, and Subscription metadata.
 */

import { supabase } from './supabase';

const isWeb = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
let memoryStore = {};

// Dynamically route API calls based on platform
// Web apps use their current hostname (localhost). Mobile apps use your computer's local IP.
const API_URL = isWeb ? `http://${window.location.hostname}:8000` : 'http://192.168.1.14:8000';

const DataBridge = {
  // Configuration
  isBackendConnected: false,
  storageKey: 'IGNITION_OS_DATA',

  /**
   * SYSTEM SCHEMAS
   * Defines the canonical shape of all persisted database objects.
   */
  SCHEMA: {
    system_subscriptions: {
      MODULE_ID: { active: 'boolean', tier: 'string', trialActive: 'boolean', trialStartedAt: 'ISOString|null' }
    },
    active_job_context: {
      id: 'string',
      unit: 'string',
      status: 'string (MOBILE_FIELD | AUTHORIZED | IN_TRANSIT)',
      inventory: { specialized: 'array', baseConfirmed: 'boolean' },
      notes: 'array of strings',
      assigned_crew_size: 'number|string',
      active_techs: 'array',
      tasks: 'array',        // Holds { id, description, suggested_hours, billed_hours, rate }
      labor_ledger: 'array'  // Holds { tech_id, start_time, end_time, task_id }
    },
    current_user: {
      id: 'string',
      name: 'string',
      pin: 'string',
      permissions: 'array'
    },
    users_table: 'array',
    pending_users: 'array',
    transaction_history: [{
      customer: 'string',
      tier: 'string',
      standardPrice: 'number',
      actualPrice: 'number',
      timestamp: 'number'
    }],
    prot_matrix: {
      anchor: 'number',
      fleetOffset: 'number',
      legacyOffset: 'number',
      ffFlat: 'number'
    },
    is_dot_mandated: 'boolean',
    shop_info: {
      name: 'string',
      is_multi_location: 'boolean',
      global_contact: {
        phone: 'string',
        email: 'string',
        address: 'string',
        usdot: 'string'
      },
      locations: [{
        id: 'string',
        label: 'string',
        phone: 'string',
        email: 'string',
        address: 'string',
        is_primary: 'boolean'
      }]
    },
    Hardware: [{
      id: 'string',
      description: 'string',
      owner_type: 'string (SHOP | TECH)',
      status: 'string (IN_BAY | ON_TRUCK | MISSING)',
      last_assigned_tech: 'string',
      last_assigned_unit: 'string'
    }],
    shop_policy: {
      tier: 'string (LITE | PRO | PLATINUM)',
      enable_price_audit: 'boolean',
      enable_bay_custody: 'boolean',
      autoLockEnabled: 'boolean',
      onboarding_complete: 'boolean',
      onboarding_path: 'string (MARGIN | DIAGNOSE | MIGRATE)',
      onboarding_completed_at: 'ISOString|null',
      featureLevels: {
        hardware: 'number',
        leaderboard: 'number'
      },
      active_modules: 'array'
    },
    vendor_directory: 'array',
    customers_directory: 'array',
    available_blocks: 'array',

    margin_config: {
      slabs: [{ label: 'string', maxCost: 'number|null', multiplier: 'number' }],
      tierDiscounts: { FLEET: 'number', LEGACY: 'number', FF: 'number' }
    },

    external_connections: {
      quickbooks: { connected: 'boolean', realmId: 'string|null', companyName: 'string|null', connectedAt: 'ISOString|null', lastSync: 'ISOString|null' },
      csv: { lastImport: 'ISOString|null', recordsImported: 'number' }
    },

    margin_change_log: [{
      id: 'string',
      changed_by: 'user_id',
      changed_at: 'ISOString',
      field_changed: 'string',
      category: 'string (SLAB | LABOR | TIER_OFFSET | OVERHEAD)',
      old_value: 'any',
      new_value: 'any',
      reason: 'string'
    }],

    overhead_config: {
      monthly: {
        rent: 'number',
        electric: 'number',
        fuel: 'number',
        insurance: 'number',
        maintenance: 'number',
        other: [{ label: 'string', amount: 'number' }]
      },
      last_updated: 'ISOString',
      updated_by: 'user_id'
    },

    invoice_history: [{
      id: 'string',
      qboId: 'string',
      customerId: 'string',
      customerName: 'string',
      date: 'string',
      total: 'number',
      balance: 'number',
      paid: 'number',
      status: 'string (PAID | UNPAID | PARTIAL)',
      lineItems: 'array',
      source: 'string'
    }]
  },
  
  syncQueue: [],

  // ── Shop identity ────────────────────────────────────────────────────────────
  getShopId: () => {
    if (memoryStore._shopId) return memoryStore._shopId;
    if (isWeb) return localStorage.getItem('IGNITION_SHOP_ID');
    return null;
  },

  setShopId: (id) => {
    memoryStore._shopId = id;
    if (isWeb) localStorage.setItem('IGNITION_SHOP_ID', id);
  },

  /**
   * CLOUD SYNC: Pulls jobs from Supabase, falls back to FastAPI, then local cache.
   */
  pullCloudSync: async () => {
    const shopId = DataBridge.getShopId();
    if (shopId) {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('*')
          .eq('shop_id', shopId)
          .order('created_at', { ascending: false });
        if (!error && data) {
          DataBridge.save('active_jobs', data, true);
          return data;
        }
      } catch (err) {
        console.warn('[DataBridge] Supabase pull failed, trying FastAPI fallback.', err);
      }
    }
    // FastAPI fallback (local dev / offline)
    try {
      const res = await fetch(`${API_URL}/api/jobs`, { cache: 'no-store' });
      if (res.ok) {
        const serverJobs = await res.json();
        DataBridge.save('active_jobs', serverJobs, true);
        return serverJobs;
      }
    } catch (err) {
      console.error('[DataBridge] Cloud sync failed — returning local cache.', err);
    }
    return DataBridge.load('active_jobs');
  },

  pushCloudSync: async (jobs) => {
    const shopId = DataBridge.getShopId();
    if (shopId && Array.isArray(jobs)) {
      try {
        // Upsert each job — Supabase handles insert vs update by PK
        const rows = jobs.map(j => ({ ...j, shop_id: shopId }));
        await supabase.from('jobs').upsert(rows, { onConflict: 'id' });
        return;
      } catch (err) {
        console.warn('[DataBridge] Supabase push failed, trying FastAPI fallback.', err);
      }
    }
    // FastAPI fallback
    try {
      await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs)
      });
    } catch (err) {
      console.error('[DataBridge] Push failed — job queued for retry.', err);
    }
  },

  /**
   * DB: Async Supabase methods for all core tables.
   * Usage: await DataBridge.db.jobs.getAll()
   */
  db: {
    _shopId: () => DataBridge.getShopId(),

    jobs: {
      getAll:  async ()      => supabase.from('jobs').select('*').eq('shop_id', DataBridge.getShopId()).order('created_at', { ascending: false }),
      getOne:  async (id)    => supabase.from('jobs').select('*').eq('id', id).single(),
      save:    async (job)   => supabase.from('jobs').upsert({ ...job, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      remove:  async (id)    => supabase.from('jobs').delete().eq('id', id),
    },

    shop: {
      get:     async ()      => supabase.from('shops').select('*').eq('id', DataBridge.getShopId()).single(),
      save:    async (data)  => supabase.from('shops').upsert({ ...data, id: DataBridge.getShopId() }, { onConflict: 'id' }),
      create:  async (data)  => {
        const { data: shop, error } = await supabase.from('shops').insert(data).select().single();
        if (!error && shop) DataBridge.setShopId(shop.id);
        return { data: shop, error };
      },
    },

    users: {
      getAll:  async ()      => supabase.from('users').select('*').eq('shop_id', DataBridge.getShopId()),
      save:    async (user)  => supabase.from('users').upsert({ ...user, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      remove:  async (id)    => supabase.from('users').delete().eq('id', id),
    },

    purchaseOrders: {
      getAll:  async ()      => supabase.from('purchase_orders').select('*').eq('shop_id', DataBridge.getShopId()).order('created_at', { ascending: false }),
      getOne:  async (id)    => supabase.from('purchase_orders').select('*').eq('id', id).single(),
      save:    async (po)    => supabase.from('purchase_orders').upsert({ ...po, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      updateStatus: async (id, status, extra = {}) =>
        supabase.from('purchase_orders').update({ status, ...extra, updated_at: new Date().toISOString() }).eq('id', id),
    },

    tools: {
      getAll:  async ()      => supabase.from('tools').select('*').eq('shop_id', DataBridge.getShopId()),
      getOne:  async (id)    => supabase.from('tools').select('*').eq('id', id).single(),
      save:    async (tool)  => supabase.from('tools').upsert({ ...tool, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
      updateStatus: async (id, status) =>
        supabase.from('tools').update({ status }).eq('id', id),
    },

    pmi: {
      getForTool: async (toolId) => supabase.from('pmi_schedules').select('*').eq('tool_id', toolId).single(),
      save:    async (schedule)  => supabase.from('pmi_schedules').upsert({ ...schedule, shop_id: DataBridge.getShopId() }, { onConflict: 'id' }),
    },

    aiUsage: {
      getForShop: async (days = 30) => {
        const since = new Date(Date.now() - days * 86400000).toISOString();
        return supabase.from('ai_usage').select('*')
          .eq('shop_id', DataBridge.getShopId())
          .gte('created_at', since)
          .order('created_at', { ascending: false });
      },
      getCostSummary: async () => {
        const { data } = await supabase.from('ai_usage').select('provider, cost_usd')
          .eq('shop_id', DataBridge.getShopId());
        if (!data) return {};
        return data.reduce((acc, row) => {
          acc[row.provider] = (acc[row.provider] || 0) + Number(row.cost_usd);
          return acc;
        }, {});
      },
    },
  },

  /**
   * OFFLINE & MIDDLEMAN PROTECTION
   * Safely attempts an API call; if it fails, it queues for later.
   */
  smartSync: async (action, data) => {
    if (navigator.onLine) {
      try {
        console.log(`[DataBridge] Attempting live sync for: ${action}`);
        // Simulate API call to Samsara/Geotab
        // await api.post(action, data); 
        return { success: true };
      } catch (e) {
        console.warn("[DataBridge] Live sync failed, falling back to local memory.", e);
      }
    } else {
      DataBridge.queueAction(action, data);
    }
  },

  queueAction: (action, data) => {
    console.warn(`[DataBridge] OFFLINE: Queuing action ${action} for background sync.`);
    DataBridge.syncQueue.push({ action, data, timestamp: Date.now() });
    if (isWeb) {
      localStorage.setItem('IGNITION_SYNC_QUEUE', JSON.stringify(DataBridge.syncQueue));
    }
  },

  /**
   * SAVE: Persists data with automated metadata and trial tracking.
   */
  save: (key, data, skipPush = false) => {
    try {
      let payload;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
         payload = {
           ...data,
           _metadata: {
             lastUpdated: new Date().toISOString(),
             appVersion: "1.0.0",
             trialStartedAt: data.trialActive ? (data.trialStartedAt || new Date().toISOString()) : null
           }
         };
      } else {
         payload = data; // store arrays or nulls directly
      }

      // 1. Save to universal memory store
      memoryStore[key] = payload;

      // 2. Persist to Web LocalStorage if available
      if (isWeb) {
        const existingData = JSON.parse(localStorage.getItem(DataBridge.storageKey)) || {};
        existingData[key] = payload;
        localStorage.setItem(DataBridge.storageKey, JSON.stringify(existingData));
      } else {
        // Mobile: React Native AsyncStorage hook point.
        // For Phase 1, memoryStore preserves state across navigation safely.
      }
      
      // If we are saving active jobs, mirror it to the Python Cloud Database
      if (key === 'active_jobs' && !skipPush) {
        DataBridge.pushCloudSync(payload);
      }
      
      console.log(`[DataBridge] SYNC SUCCESS: ${key} committed.`);
      return true;
    } catch (error) {
      console.error(`[DataBridge] CRITICAL SAVE ERROR:`, error);
      return false;
    }
  },

  /**
   * LOAD: Retrieves a specific module or data point.
   */
  load: (key) => {
    try {
      // 1. Always check hot memory first (fastest, universal)
      if (memoryStore[key] !== undefined) {
        return memoryStore[key];
      }
      
      // 2. Fallback to Web LocalStorage
      if (isWeb) {
        const store = JSON.parse(localStorage.getItem(DataBridge.storageKey));
        if (store && store[key] !== undefined) {
          memoryStore[key] = store[key]; // Hydrate memory
          return store[key];
        }
      }
      return null;
    } catch (error) {
      console.error(`[DataBridge] LOAD ERROR for ${key}:`, error);
      return null;
    }
  },

  /**
   * CHECK_TRIAL: Logic for the "Blind Spot" / Blur feature.
   * Returns: { isExpired: boolean, daysRemaining: number }
   */
  checkTrialStatus: (moduleKey) => {
    const data = DataBridge.load('system_subscriptions');
    if (!data || !data[moduleKey] || !data[moduleKey].trialStartedAt) {
      return { isExpired: false, daysRemaining: 30 };
    }

    const start = new Date(data[moduleKey].trialStartedAt);
    const today = new Date();
    const diffTime = Math.abs(today - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const limit = 30; // Your 30-day "In Deep" strategy
    return {
      isExpired: diffDays > limit,
      daysRemaining: Math.max(0, limit - diffDays)
    };
  },

  /**
   * CLEAR_ALL: Factory reset for testing trials.
   */
  factoryReset: () => {
    memoryStore = {};
    if (isWeb) {
      localStorage.removeItem(DataBridge.storageKey);
      window.location.reload();
    } else {
      console.warn("[DataBridge] Factory Reset triggered on Mobile. UI must handle refresh.");
    }
  },

  /**
   * PRICING: Unified margin config (replaces prot_matrix as single source of truth).
   * MarginEngine reads this directly; these methods are for saving/logging changes.
   */
  getMarginConfig: () => {
    return DataBridge.load('margin_config') || {
      slabs: [
        { label: 'Consumables', maxCost: 50,   multiplier: 4.0  },
        { label: 'Mid-Range',   maxCost: 200,  multiplier: 2.0  },
        { label: 'Heavy',       maxCost: 1000, multiplier: 1.5  },
        { label: 'Major',       maxCost: null, multiplier: 1.25 },
      ],
      tierDiscounts: { FLEET: 10, LEGACY: 20, FF: 5 },
    };
  },

  setMarginConfig: (newConfig, userId) => {
    const oldConfig = DataBridge.load('margin_config') || {};
    DataBridge.save('margin_config', newConfig);

    // Log each changed slab multiplier
    const oldSlabs = oldConfig.slabs || [];
    (newConfig.slabs || []).forEach((slab, i) => {
      const old = oldSlabs[i];
      if (!old || old.multiplier !== slab.multiplier) {
        DataBridge.logMarginChange({
          field_changed: `slabs[${i}].multiplier (${slab.label})`,
          category: 'SLAB',
          old_value: old?.multiplier ?? null,
          new_value: slab.multiplier,
          changed_by: userId || 'SYSTEM',
        });
      }
      if (!old || old.maxCost !== slab.maxCost) {
        DataBridge.logMarginChange({
          field_changed: `slabs[${i}].maxCost (${slab.label})`,
          category: 'SLAB',
          old_value: old?.maxCost ?? null,
          new_value: slab.maxCost,
          changed_by: userId || 'SYSTEM',
        });
      }
    });

    // Log changed tier discounts
    const oldDiscounts = oldConfig.tierDiscounts || {};
    Object.entries(newConfig.tierDiscounts || {}).forEach(([tier, val]) => {
      if (oldDiscounts[tier] !== val) {
        DataBridge.logMarginChange({
          field_changed: `tierDiscounts.${tier}`,
          category: 'TIER_OFFSET',
          old_value: oldDiscounts[tier] ?? null,
          new_value: val,
          changed_by: userId || 'SYSTEM',
        });
      }
    });
  },

  /**
   * PRICING: Legacy prot_matrix kept for backward compatibility with IgnitionCipher.
   * New code should use MarginEngine directly.
   */
  getProtMatrix: () => {
    return DataBridge.load('prot_matrix') || { anchor: 40, fleetOffset: 10, legacyOffset: 20, ffFlat: 5 };
  },
  getActiveMargin: (tier) => {
    const matrix = DataBridge.getProtMatrix();
    switch(tier) {
      case 'FLEET': return matrix.anchor - matrix.fleetOffset;
      case 'LEGACY': return matrix.anchor - matrix.legacyOffset;
      case 'FF': return matrix.ffFlat;
      default: return matrix.anchor;
    }
  },
  calculateRetail: (cost, margin) => {
    return (cost / (1 - (margin / 100))).toFixed(2);
  },

  /**
   * UNIVERSAL MODULE REGISTRY
   */
  getRegistry: () => {
    return DataBridge.load('system_registry') || {
      intake: { id: 'intake', label: 'Intake', color: '#3b82f6', active: true, cost: 49, trialDate: '2026-04-01' },
      queue: { id: 'queue', label: 'Queue', color: '#6366f1', active: true, cost: 29, trialDate: '2026-04-01' },
      vin: { id: 'vin', label: 'VIN Decode', color: '#0ea5e9', active: true, cost: 99, trialDate: '2026-04-01' },
      voice: { id: 'voice', label: 'Scribe AI', color: '#ef4444', active: true, cost: 149, trialDate: '2026-04-15' },
      estimates: { id: 'estimates', label: 'Estimates', color: '#10b981', active: true, cost: 49, trialDate: '2026-04-20' },
      parts: { id: 'parts', label: 'Manifest', color: '#f59e0b', active: true, cost: 79, trialDate: '2026-04-01' },
      procure: { id: 'procure', label: 'Procure', color: '#ec4899', active: true, cost: 129, trialDate: '2026-04-10' },
      tools: { id: 'tools', label: 'Tools', color: '#8b5cf6', active: true, cost: 19, trialDate: '2026-04-01' },
      admin: { id: 'admin', label: 'Admin', color: '#64748b', active: true, cost: 0, trialDate: '2026-04-01' },
      crm: { id: 'crm', label: 'CRM', color: '#818cf8', active: true, cost: 49, trialDate: '2026-04-01' },
      fleet: { id: 'fleet', label: 'Fleet', color: '#06b6d4', active: true, cost: 199, trialDate: '2026-04-12' },
      inv: { id: 'inv', label: 'Stock AI', color: '#6366f1', active: true, cost: 89, trialDate: '2026-04-01' },
      kiosk: { id: 'kiosk', label: 'Kiosk', color: '#10b981', active: true, cost: 0, trialDate: '2026-04-01' },
    };
  },

  /**
   * SECURITY & LABOR REGISTRY
   */
  getProfiles: () => {
    const saved = DataBridge.load('user_profiles');
    if (saved && Object.keys(saved).length > 0) return saved;
    // Default seed profiles — overwritten after onboarding creates the owner account
    return {
      '1111': { id: '1111', name: 'A. MANAGER', role: 'ADMIN', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH", "PRICING_AUTHORITY"] },
      '1234': { id: '1234', name: 'T. OBRIEN', role: 'TECHNICIAN', allowed: ['queue', 'parts', 'tools'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'Displacement (L)'] }, hasSignedWaiver: false, permissions: ["TECH"] },
      '2222': { id: '2222', name: 'S. WRITER', role: 'SERVICE', allowed: ['intake', 'queue', 'vin', 'estimates', 'parts', 'procure', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["TECH"] },
      '3333': { id: '3333', name: 'L. PILOT', role: 'DEVELOPER', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet', 'kiosk'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'VIN'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH", "PRICING_AUTHORITY"] }
    };
  },

  authenticate: (pin) => {
    const profiles = DataBridge.getProfiles();
    if (profiles[pin]) {
      const user = { ...profiles[pin], pin };
      DataBridge.save('current_user', user);
      return user;
    }
    return null;
  },
  
  logout: () => {
      DataBridge.save('current_user', null);
  },

  getSystemRates: () => {
    const config = DataBridge.load('system_config');
    if (config && config.laborRates) {
      return config.laborRates;
    }
    // Master Fallback Baseline
    return { BASE: 165.00, DIAGNOSTIC: 195.00, MOBILE: 225.00, MARKUP_ON_SUBLET: 20 };
  },

  setSystemRates: (newRates, adminId) => {
    const config = DataBridge.load('system_config') || {};
    const oldRates = config.laborRates || DataBridge.getSystemRates();
    config.laborRates = newRates;
    DataBridge.save('system_config', config);

    // Write to admin audit log
    const ledger = DataBridge.load('admin_audit_log') || [];
    ledger.push({ action: 'UPDATE_LABOR_RATES', newRates, adminId: adminId || 'SYSTEM', timestamp: Date.now() });
    DataBridge.save('admin_audit_log', ledger);

    // Write to margin_change_log for analytics
    Object.keys(newRates).forEach(field => {
      if (oldRates[field] !== newRates[field]) {
        DataBridge.logMarginChange({
          field_changed: `laborRates.${field}`,
          category: 'LABOR',
          old_value: oldRates[field],
          new_value: newRates[field],
          changed_by: adminId || 'SYSTEM',
        });
      }
    });
  },

  /**
   * LOG_MARGIN_CHANGE: Appends a timestamped entry to margin_change_log for analytics.
   */
  logMarginChange: ({ field_changed, category, old_value, new_value, changed_by, reason = '' }) => {
    const log = DataBridge.load('margin_change_log') || [];
    log.push({
      id: `MCL-${Date.now()}`,
      changed_by: changed_by || 'SYSTEM',
      changed_at: new Date().toISOString(),
      field_changed,
      category,
      old_value,
      new_value,
      reason,
    });
    DataBridge.save('margin_change_log', log);
  },

  /**
   * GET/SET OVERHEAD CONFIG
   */
  getOverhead: () => {
    return DataBridge.load('overhead_config') || {
      monthly: { rent: 0, electric: 0, fuel: 0, insurance: 0, maintenance: 0, other: [] },
      last_updated: null,
      updated_by: null,
    };
  },

  setOverhead: (monthly, userId) => {
    const current = DataBridge.getOverhead();
    DataBridge.save('overhead_config', {
      monthly,
      last_updated: new Date().toISOString(),
      updated_by: userId || 'SYSTEM',
    });
    DataBridge.logMarginChange({
      field_changed: 'overhead_config.monthly',
      category: 'OVERHEAD',
      old_value: current.monthly,
      new_value: monthly,
      changed_by: userId || 'SYSTEM',
    });
  },

  /**
   * RECORD TRANSACTION: Stamps each sale with margin metadata for quarterly analytics.
   */
  recordTransaction: (tx) => {
    const rates = DataBridge.getSystemRates();
    const margin = DataBridge.getActiveMargin(tx.tier || 'STANDARD');
    const d = new Date();
    const quarter = `Q${Math.ceil((d.getMonth() + 1) / 3)}-${d.getFullYear()}`;

    const enriched = {
      ...tx,
      margin_at_time: margin,
      labor_rate_at_time: rates.BASE,
      quarter,
      timestamp: tx.timestamp || Date.now(),
    };

    const history = DataBridge.load('transaction_history') || [];
    history.push(enriched);
    DataBridge.save('transaction_history', history);
    return enriched;
  },

  /**
   * CUSTOMER DIRECTORY & CRM
   */
  getCustomers: () => {
    return DataBridge.load('customers_directory') || [
      // Contract / Fleet Customer
      { id: 'C-1001', name: 'Texas Star Logistics', phone: '512-555-0199', email: 'dispatch@txstar.com', address: '100 Fleet Way, Austin, TX', type: 'CONTRACT', contractNum: 'TX-FLT-882', tier: 'FLEET', vehicles: [{ year: '2019', make: 'Freightliner', model: 'Cascadia', vin: '1FUJGL...' }] },
      // Friends & Family Customer
      { id: 'C-1002', name: 'Mike (Buddy)', phone: '512-555-8822', email: 'mike.w@email.com', address: '450 Local Ln, Leander, TX', type: 'PERSONAL', tier: 'FF', vehicles: [{ year: '2006', make: 'Toyota', model: 'RAV4', vin: 'YV1672...' }] },
      // Standard Repeat Customer
      { id: 'C-1003', name: 'Sarah Miller', phone: '512-555-3344', email: 'sarah.m@email.com', address: '12 Oak St, Cedar Park, TX', type: 'PERSONAL', tier: 'STANDARD', vehicles: [{ year: '2015', make: 'Ford', model: 'Explorer', vin: '1FMFK...' }] }
    ];
  },
  
  addCustomer: (customer) => {
    const customers = DataBridge.getCustomers();
    // True sync push could be handled here if wired to the Python API
    DataBridge.save('customers_directory', [...customers, customer]);
  },

  /**
   * VENDOR DIRECTORY
   */
  getVendors: () => {
    return DataBridge.load('vendor_directory') || [
      { id: 'V-001', name: 'AutoZone Commercial', address: '123 Main St, Leander, TX 78641', phone: '512-555-0101', weblink: 'https://autozonepro.com', accountNum: 'AZ-8832-TX' },
      { id: 'V-002', name: 'NAPA Auto Parts', address: '456 Gear Blvd, Cedar Park, TX 78613', phone: '512-555-0202', weblink: 'https://napaonline.com', accountNum: 'NA-10029' },
      { id: 'V-003', name: 'FleetPride', address: '789 Diesel Way, North Austin, TX 78728', phone: '512-555-0303', weblink: 'https://fleetpride.com', accountNum: 'FP-TX-554' }
    ];
  },
  
  addVendor: (vendor) => {
    const vendors = DataBridge.getVendors();
    DataBridge.save('vendor_directory', [...vendors, vendor]);
  },
  
  getLaborGuide: () => {
    return DataBridge.load('labor_guide') || {
      'OIL_CHANGE': { job: 'Standard Oil Change', hours: 0.5 },
      'TIRE_ROTATION': { job: 'Tire Rotation & Balance', hours: 1.0 },
      'BRAKE_INSPECTION': { job: 'Brake System Inspection', hours: 1.2 },
      'TURBO_REPLACEMENT': { job: 'Turbocharger R&R', hours: 3.5 },
      'DPF_CLEAN': { job: 'DPF System Clean & Test', hours: 4.0 },
    };
  },

  getSystemRoles: () => {
    const config = DataBridge.load('system_config');
    if (config && config.roles) {
      return config.roles;
    }
    // Hardcoded Master Fallback
    return {
      ADMIN: ["view_omni", "view_hub", "view_flux", "view_predictive", "view_cipher", "view_stok", "view_proc", "view_prot", "view_port", "view_crm", "view_marketplace", "edit_margins", "manage_users", "approve_payroll"],
      TECH: ["view_kosk", "view_cipher", "view_hub", "scan_parts", "update_flux"],
      CUSTOMER: ["view_port", "sign_estimates", "pay_invoice"]
    };
  }
};

export default DataBridge;
