/**
 * FILE: DataBridge.js
 * PLATFORM: Web (React DOM)
 * PURPOSE: Central storage and sync layer for Ignition OS. Handles Local-First persistence, Trial Clock synchronization, and Subscription metadata.
 * DEPENDENCIES: Vanilla JS (localStorage)
 */

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
      active_techs: 'array'
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
    available_blocks: 'array'
  },
  
  syncQueue: [],

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
        setInitialData('system_subscriptions', systemContext);
        
        const mockUsers = [
          { id: "E-101", name: "Owner Admin", pin: "0000", permissions: ["ADMIN"] },
          { id: "E-102", name: "Sarah Miller (Front)", pin: "1234", permissions: ["ADMIN"] },
          { id: "E-103", name: "Dispatch Dan", pin: "5678", permissions: ["TECH"] },
          { id: "E-104", name: "Terry (Tech)", pin: "1111", permissions: ["TECH"] },
          { id: "E-199", name: "Shop Manager", pin: "9999", permissions: ["ADMIN", "TECH"] }
        ];
        setInitialData('users_table', mockUsers);
      }
    } else {
      DataBridge.queueAction(action, data);
    }
  },

  queueAction: (action, data) => {
    console.warn(`[DataBridge] OFFLINE: Queuing action ${action} for background sync.`);
    DataBridge.syncQueue.push({ action, data, timestamp: Date.now() });
    localStorage.setItem('IGNITION_SYNC_QUEUE', JSON.stringify(DataBridge.syncQueue));
  },

  /**
   * SAVE: Persists data with automated metadata and trial tracking.
   */
  save: (key, data) => {
    try {
      const existingData = JSON.parse(localStorage.getItem(DataBridge.storageKey)) || {};
      
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

      existingData[key] = payload;
      localStorage.setItem(DataBridge.storageKey, JSON.stringify(existingData));
      
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
      const store = JSON.parse(localStorage.getItem(DataBridge.storageKey));
      return store ? store[key] : null;
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
    localStorage.removeItem(DataBridge.storageKey);
    window.location.reload();
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
   * SECURITY & LABOR REGISTRY
   */
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

  getSystemRoles: () => {
    const config = DataBridge.load('system_config');
    if (config && config.roles) {
      return config.roles;
    }
    // Hardcoded Master Fallback
    return {
      ADMIN: ["view_omni", "view_hub", "view_flux", "view_predictive", "view_cipher", "view_stok", "view_proc", "view_prot", "view_port", "view_marketplace", "edit_margins", "manage_users", "approve_payroll"],
      TECH: ["view_kosk", "view_cipher", "view_hub", "scan_parts", "update_flux"],
      CUSTOMER: ["view_port", "sign_estimates", "pay_invoice"]
    };
  }
};

export default DataBridge;
