/**
 * AIEngine.js — Unified AI Router for Ignition OS
 *
 * All AI calls go through here. Callers never know which provider runs.
 * Keys live on the FastAPI backend — this file routes via your local API.
 *
 * Usage:
 *   import AIEngine from './AIEngine';
 *   const result = await AIEngine.call('dtc_decode', { codes: ['P0171'] });
 */

import DataBridge from './DataBridge';

const API_URL =
  import.meta.env?.VITE_API_URL ??
  process.env?.EXPO_PUBLIC_API_URL ??
  'http://localhost:8000';

// ── Task → Provider + Model routing table ─────────────────────────────────────
const TASK_ROUTING = {
  // Gemini Flash — vision / multimodal
  vin_decode:          { provider: 'gemini', model: 'gemini-2.0-flash',      type: 'vision' },
  invoice_scan:        { provider: 'gemini', model: 'gemini-2.0-flash',      type: 'vision' },
  label_read:          { provider: 'gemini', model: 'gemini-2.0-flash',      type: 'vision' },
  part_photo_id:       { provider: 'gemini', model: 'gemini-2.0-flash',      type: 'vision' },

  // Two-stage: Gemini OCR → Claude audit (handled entirely in backend)
  invoice_audit:       { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },

  // Claude Haiku — fast structured reasoning
  dtc_decode:          { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },
  estimate_draft:      { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },
  compliance_check:    { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },
  customer_summary:    { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },
  pmi_suggest:         { provider: 'claude', model: 'claude-haiku-4-5-20251001', type: 'text' },

  // Claude Sonnet — complex / long-context reasoning
  predictive_analysis: { provider: 'claude', model: 'claude-sonnet-4-6',     type: 'text' },
  savings_report:      { provider: 'claude', model: 'claude-sonnet-4-6',     type: 'text' },

  // OpenAI — voice and NLP
  voice_transcribe:    { provider: 'openai', model: 'whisper-1',             type: 'audio' },
  parts_nlp:           { provider: 'openai', model: 'gpt-4o-mini',           type: 'text' },
  intent_classify:     { provider: 'openai', model: 'gpt-4o-mini',           type: 'text' },
};

// ── Tier access gates — which tasks are available on each tier ────────────────
const TIER_TASKS = {
  TRIAL:        Object.keys(TASK_ROUTING),
  STARTER:      [],
  PROFESSIONAL: [
    'vin_decode', 'invoice_scan', 'invoice_audit', 'label_read', 'part_photo_id',
    'dtc_decode', 'estimate_draft', 'customer_summary', 'pmi_suggest',
    'voice_transcribe', 'parts_nlp', 'intent_classify',
  ],
  PREMIER: Object.keys(TASK_ROUTING),
};

// ── Main call interface ───────────────────────────────────────────────────────
const AIEngine = {
  /**
   * call(task, payload, options)
   *
   * task     — key from TASK_ROUTING above
   * payload  — { prompt, image_base64, audio_base64, shop_id, ... }
   * options  — { tier: 'PROFESSIONAL', fallback: true }
   */
  async call(task, payload = {}, options = {}) {
    const tier = options.tier ?? 'TRIAL';
    const allowed = TIER_TASKS[tier] ?? [];

    if (tier !== 'TRIAL' && !allowed.includes(task)) {
      return { ok: false, locked: true, task, tier,
               message: `${task} requires a higher tier. Current: ${tier}` };
    }

    const route = TASK_ROUTING[task];
    if (!route) {
      return { ok: false, error: `Unknown task: ${task}` };
    }

    try {
      const res = await fetch(`${API_URL}/ai/${task}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, _route: route }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? `HTTP ${res.status}`);
      }

      return { ok: true, ...(await res.json()) };

    } catch (e) {
      console.error(`[AIEngine] ${task} failed:`, e.message);

      // Fallback: try a cheaper model on the same provider if flagged
      if (options.fallback && route.model !== 'claude-haiku-4-5-20251001') {
        console.warn(`[AIEngine] Retrying ${task} with Haiku fallback`);
        return AIEngine.call(task, payload, { ...options, fallback: false,
          _override_model: 'claude-haiku-4-5-20251001' });
      }

      return { ok: false, error: e.message, task };
    }
  },

  // ── Convenience wrappers ────────────────────────────────────────────────────

  async decodeVIN(imageBase64, shopId, tier) {
    return AIEngine.call('vin_decode',
      { image_base64: imageBase64, shop_id: shopId },
      { tier });
  },

  async decodeDTC(codes, vehicleContext, shopId, tier) {
    return AIEngine.call('dtc_decode',
      { codes, vehicle: vehicleContext, shop_id: shopId },
      { tier });
  },

  async transcribeVoice(audioBase64, shopId, tier) {
    return AIEngine.call('voice_transcribe',
      { audio_base64: audioBase64, shop_id: shopId },
      { tier });
  },

  async extractParts(transcript, shopId, tier) {
    return AIEngine.call('parts_nlp',
      { transcript, shop_id: shopId },
      { tier });
  },

  async readToolLabel(imageBase64, shopId, tier) {
    return AIEngine.call('label_read',
      { image_base64: imageBase64, shop_id: shopId },
      { tier });
  },

  async suggestPMI(toolData, shopId, tier) {
    return AIEngine.call('pmi_suggest',
      { tool: toolData, shop_id: shopId },
      { tier });
  },

  async auditInvoice(imageBase64, shopId, tier, mediaType = 'image/jpeg') {
    const inventory = (
      (typeof DataBridge !== 'undefined' ? DataBridge.load('inventory_items') : null) || []
    ).slice(0, 60);
    return AIEngine.call('invoice_audit',
      { image_base64: imageBase64, shop_id: shopId, inventory, media_type: mediaType },
      { tier });
  },

  async draftEstimate(jobData, shopId, tier) {
    return AIEngine.call('estimate_draft',
      { job: jobData, shop_id: shopId },
      { tier });
  },

  async savingsReport(shopId, tier) {
    return AIEngine.call('savings_report',
      { shop_id: shopId },
      { tier });
  },

  // ── Tier check helper (use in UI to decide blur vs. active) ────────────────
  canUse(task, tier) {
    const allowed = TIER_TASKS[tier] ?? [];
    return allowed.includes(task);
  },
};

export default AIEngine;
