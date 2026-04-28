/**
 * FILE: DataBridge.js
 * PLATFORM: Universal (Web & Mobile)
 * PURPOSE: Central storage and sync layer for Ignition OS. Handles Local-First persistence, Trial Clock synchronization, and Subscription metadata.
 * DEPENDENCIES: Vanilla JS (localStorage for Web, In-Memory for Mobile with async hooks prepared)
 */

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
      featureLevels: {
        hardware: 'number',
        leaderboard: 'number'
      },
      active_modules: 'array'
    },
    vendor_directory: 'array',
    customers_directory: 'array',
    available_blocks: 'array'
  },
  
  syncQueue: [],

  /**
   * CLOUD SYNC: Pulls the central job list from the Python backend
   */
  pullCloudSync: async () => {
    try {
      console.log("[DataBridge] Fetching latest jobs from cloud...");
      const res = await fetch(`${API_URL}/api/jobs`, {
        cache: 'no-store' // Force browser to bypass cache and always get fresh data
      });
      if (res.ok) {
        const serverJobs = await res.json();
        DataBridge.save('active_jobs', serverJobs, true); // true = skip push to avoid infinite loops
        return serverJobs;
      }
    } catch (err) {
      console.error("[DataBridge] Cloud sync failed! Is the Python server running?", err);
    }
    return DataBridge.load('active_jobs');
  },

  pushCloudSync: async (jobs) => {
    try {
      await fetch(`${API_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs)
      });
    } catch (err) {
      console.error("[DataBridge] Failed to push to cloud! Check API_URL IP address.", err);
    }
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
   * PRICING: Margin Matrix hooks for PROT -> CODE integration
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
    };
  },

  /**
   * SECURITY & LABOR REGISTRY
   */
  getProfiles: () => {
    return DataBridge.load('user_profiles') || {
      '1111': { id: '1111', name: 'A. MANAGER', role: 'ADMIN', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH"] },
      '1234': { id: '1234', name: 'T. OBRIEN', role: 'TECHNICIAN', allowed: ['queue', 'vin', 'voice', 'parts', 'tools'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'Displacement (L)'] }, hasSignedWaiver: false, permissions: ["TECH"] },
      '2222': { id: '2222', name: 'S. WRITER', role: 'SERVICE', allowed: ['intake', 'queue', 'vin', 'estimates', 'parts', 'procure'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] }, hasSignedWaiver: true, permissions: ["TECH"] },
      '3333': { id: '3333', name: 'L. PILOT', role: 'DEVELOPER', allowed: ['intake', 'queue', 'vin', 'voice', 'estimates', 'parts', 'procure', 'tools', 'inv', 'admin', 'fleet'], preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model', 'VIN'] }, hasSignedWaiver: true, permissions: ["ADMIN", "TECH"] }
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
    config.laborRates = newRates;
    DataBridge.save('system_config', config);

    // Audit log appending mapping
    const ledger = DataBridge.load('admin_audit_log') || [];
    ledger.push({
      action: 'UPDATE_LABOR_RATES',
      newRates,
      adminId: adminId || 'SYSTEM',
      timestamp: Date.now()
    });
    DataBridge.save('admin_audit_log', ledger);
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
