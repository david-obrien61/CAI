/**
 * FILE: modules/IgnitionAdmin.jsx
 * PLATFORM: Web (React DOM)
 * PURPOSE: Full staff management, role editor, and shop settings.
 *          Gated to ADMIN permission. Replaces the React Native placeholder.
 */

import React, { useState } from 'react';
import {
  Users, ShieldCheck, Settings, Plus, Trash2, Save, Lock,
  AlertTriangle, CheckCircle, Eye, EyeOff, ChevronDown,
  ChevronUp, UserMinus, UserPlus, Edit3, X
} from 'lucide-react';
import DataBridge from '../DataBridge';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ALL_PERMISSIONS = [
  { id: 'view_omni',        label: 'View OMNI (Command)',      group: 'Modules' },
  { id: 'view_hub',         label: 'View HUB (Dispatch)',      group: 'Modules' },
  { id: 'view_flux',        label: 'View FLUX (Workflow)',      group: 'Modules' },
  { id: 'view_cipher',      label: 'View CIPHER (DTC)',        group: 'Modules' },
  { id: 'view_stok',        label: 'View STOK (Inventory)',    group: 'Modules' },
  { id: 'view_proc',        label: 'View PROC (Vendors)',      group: 'Modules' },
  { id: 'view_prot',        label: 'View PROT (Margins)',      group: 'Modules' },
  { id: 'view_port',        label: 'View PORT (Estimates)',    group: 'Modules' },
  { id: 'view_crm',         label: 'View CRM (Clients)',       group: 'Modules' },
  { id: 'view_predictive',  label: 'View PREDICTIVE',          group: 'Modules' },
  { id: 'view_marketplace', label: 'View Marketplace',         group: 'Modules' },
  { id: 'PRICING_AUTHORITY',label: 'Edit Pricing Slabs',       group: 'Financial' },
  { id: 'edit_margins',     label: 'Edit Margins (Legacy)',    group: 'Financial' },
  { id: 'approve_payroll',  label: 'Approve Payroll',          group: 'Financial' },
  { id: 'manage_users',     label: 'Manage Staff',             group: 'Admin' },
  { id: 'scan_parts',       label: 'Scan Parts',               group: 'Tech Ops' },
  { id: 'update_flux',      label: 'Update Job Status',        group: 'Tech Ops' },
  { id: 'sign_estimates',   label: 'Sign Estimates',           group: 'Customer' },
  { id: 'pay_invoice',      label: 'Pay Invoice',              group: 'Customer' },
];

const PERM_GROUPS = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

const ROLE_PRESETS = {
  ADMIN:      ['view_omni','view_hub','view_flux','view_predictive','view_cipher','view_stok','view_proc','view_prot','view_port','view_crm','view_marketplace','edit_margins','PRICING_AUTHORITY','manage_users','approve_payroll','scan_parts','update_flux'],
  TECH:       ['view_hub','view_flux','view_cipher','view_stok','scan_parts','update_flux'],
  SERVICE:    ['view_port','view_crm','view_cipher','view_stok','sign_estimates'],
  CUSTOMER:   ['view_port','sign_estimates','pay_invoice'],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const Tab = ({ id, label, icon: Icon, active, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${
      active
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
        : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-white hover:border-slate-600'
    }`}
  >
    <Icon size={13} />
    {label}
  </button>
);

const Badge = ({ label, color = 'slate' }) => {
  const colors = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    orange: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
    slate: 'bg-slate-800 text-slate-400 border-slate-700',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${colors[color] || colors.slate}`}>
      {label}
    </span>
  );
};

const roleColor = (role) => {
  if (role === 'ADMIN' || role === 'OWNER') return 'blue';
  if (role === 'TECH' || role === 'TECHNICIAN') return 'emerald';
  if (role === 'SERVICE') return 'orange';
  if (role === 'DEVELOPER') return 'purple';
  return 'slate';
};

const SaveBanner = ({ saved }) =>
  saved ? (
    <div className="flex items-center gap-2 bg-emerald-600/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4">
      <CheckCircle size={14} className="text-emerald-400" />
      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">Changes saved</span>
    </div>
  ) : null;

// ─── ADD STAFF MODAL ─────────────────────────────────────────────────────────

const AddStaffModal = ({ onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', role: 'TECH', pin: '', permissions: [...ROLE_PRESETS.TECH] });
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const applyPreset = (role) => {
    setForm(f => ({ ...f, role, permissions: [...(ROLE_PRESETS[role] || [])] }));
  };

  const togglePerm = (permId) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId]
    }));
  };

  const save = () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (form.pin.length !== 4 || !/^\d{4}$/.test(form.pin)) return setError('PIN must be exactly 4 digits.');
    const profiles = DataBridge.getProfiles();
    if (profiles[form.pin]) return setError(`PIN ${form.pin} is already in use by ${profiles[form.pin].name}.`);

    const newProfile = {
      id: form.pin,
      name: form.name.toUpperCase().trim(),
      role: form.role,
      permissions: form.permissions,
      allowed: form.permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')),
      hasSignedWaiver: false,
      preferences: { pinnedSpecs: ['Model Year', 'Make', 'Model'] },
      createdAt: new Date().toISOString(),
    };

    const allProfiles = { ...profiles, [form.pin]: newProfile };
    DataBridge.save('user_profiles', allProfiles);
    onSaved(newProfile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-sm font-black text-white uppercase tracking-widest">Add Staff Member</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertTriangle size={13} className="text-red-400" />
              <p className="text-[10px] font-black text-red-400">{error}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Full Name</label>
            <input
              value={form.name}
              onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError(''); }}
              placeholder="J. SMITH"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* Role + PIN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role</label>
              <select
                value={form.role}
                onChange={e => applyPreset(e.target.value)}
                className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                {Object.keys(ROLE_PRESETS).map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">4-Digit PIN</label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  value={form.pin}
                  onChange={e => { setForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, '').slice(0, 4) })); setError(''); }}
                  placeholder="----"
                  maxLength={4}
                  className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 pr-10 text-white font-black text-xl tracking-[0.4em] text-center focus:outline-none focus:border-blue-500 transition-colors"
                />
                <button onClick={() => setShowPin(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPin ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Permissions</label>
              <p className="text-[9px] text-slate-600">{form.permissions.length} active</p>
            </div>
            {PERM_GROUPS.map(group => (
              <div key={group} className="mb-3">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = form.permissions.includes(perm.id);
                    return (
                      <button
                        key={perm.id}
                        onClick={() => togglePerm(perm.id)}
                        className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${
                          on
                            ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                            : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'
                        }`}
                      >
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
            <UserPlus size={13} /> Add Member
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── REVOKE MODAL ─────────────────────────────────────────────────────────────

const RevokeModal = ({ user, onClose, onRevoked }) => {
  const [confirm, setConfirm] = useState('');
  const ready = confirm === 'REVOKE';

  const revoke = () => {
    if (!ready) return;
    const profiles = DataBridge.getProfiles();
    const { [user.id]: removed, ...rest } = profiles;
    DataBridge.save('user_profiles', rest);

    // Log the revocation
    const log = DataBridge.load('admin_audit_log') || [];
    log.push({ action: 'USER_REVOKED', userId: user.id, userName: user.name, timestamp: Date.now() });
    DataBridge.save('admin_audit_log', log);

    // Force logout if they're the active user
    const current = DataBridge.load('current_user');
    if (current?.id === user.id) DataBridge.save('current_user', null);

    onRevoked(user.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-red-500/30 rounded-[2rem] shadow-2xl w-full max-w-sm">
        <div className="p-6 text-center">
          <UserMinus size={40} className="text-red-500 mx-auto mb-4" />
          <h3 className="text-sm font-black text-white uppercase tracking-widest mb-1">Revoke Access</h3>
          <p className="text-[10px] text-slate-400 mb-6">
            This will permanently remove <span className="text-white font-black">{user.name}</span>'s identity from the system. They will be logged out immediately.
          </p>

          <div className="mb-4">
            <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Type <span className="text-red-400 font-black">REVOKE</span> to confirm</p>
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value.toUpperCase())}
              placeholder="REVOKE"
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-black text-center focus:outline-none focus:border-red-500 transition-colors tracking-widest uppercase"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
              Cancel
            </button>
            <button
              onClick={revoke}
              disabled={!ready}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <UserMinus size={13} /> Revoke
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── EDIT PERMISSIONS MODAL ───────────────────────────────────────────────────

const EditPermissionsModal = ({ user, onClose, onSaved }) => {
  const [permissions, setPermissions] = useState([...(user.permissions || [])]);
  const [role, setRole] = useState(user.role || 'TECH');

  const applyPreset = (r) => {
    setRole(r);
    setPermissions([...(ROLE_PRESETS[r] || [])]);
  };

  const togglePerm = (permId) => {
    setPermissions(p =>
      p.includes(permId) ? p.filter(x => x !== permId) : [...p, permId]
    );
  };

  const save = () => {
    const profiles = DataBridge.getProfiles();
    const updated = { ...profiles[user.id], role, permissions, allowed: permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', '')) };
    DataBridge.save('user_profiles', { ...profiles, [user.id]: updated });
    onSaved(updated);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-950 border border-slate-800 rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Edit: {user.name}</h3>
            <p className="text-[9px] text-slate-500 mt-0.5">PIN {user.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Role Template</label>
            <div className="flex gap-2 flex-wrap">
              {Object.keys(ROLE_PRESETS).map(r => (
                <button key={r} onClick={() => applyPreset(r)}
                  className={`text-[9px] font-black px-4 py-2 rounded-xl border transition-all uppercase ${role === r ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-3">
              Permissions <span className="text-slate-600">({permissions.length} active)</span>
            </label>
            {PERM_GROUPS.map(group => (
              <div key={group} className="mb-3">
                <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                    const on = permissions.includes(perm.id);
                    return (
                      <button key={perm.id} onClick={() => togglePerm(perm.id)}
                        className={`text-[9px] font-black px-3 py-1.5 rounded-lg border transition-all ${on ? 'bg-blue-600/20 border-blue-500/40 text-blue-400' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600'}`}>
                        {perm.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-900 border border-slate-700 text-slate-300 font-black py-3 rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
            Cancel
          </button>
          <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
            <Save size={13} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── TAB 1: STAFF ─────────────────────────────────────────────────────────────

const StaffTab = () => {
  const [profiles, setProfiles] = useState(() => DataBridge.getProfiles());
  const [showAdd, setShowAdd] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const currentUser = DataBridge.load('current_user');
  const users = Object.entries(profiles).map(([pin, p]) => ({ ...p, id: p.id || pin }));

  const refresh = () => setProfiles(DataBridge.getProfiles());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{users.length} registered identities</p>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors"
        >
          <Plus size={13} /> Add Staff
        </button>
      </div>

      <div className="space-y-3">
        {users.map(user => {
          const isOpen = expandedId === user.id;
          const isSelf = currentUser?.id === user.id;

          return (
            <div key={user.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpandedId(isOpen ? null : user.id)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-black text-slate-400 uppercase">
                    {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-white uppercase tracking-tight">{user.name}</p>
                    <Badge label={user.role || 'STAFF'} color={roleColor(user.role)} />
                    {isSelf && <Badge label="You" color="emerald" />}
                    <span className="text-[8px] font-mono text-slate-700">PIN: ****</span>
                  </div>
                  <p className="text-[9px] text-slate-600 mt-0.5">
                    {(user.permissions || []).length} permissions · {(user.allowed || []).length} modules
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditTarget(user); }}
                    className="p-2 bg-slate-800 rounded-lg text-slate-500 hover:text-blue-400 transition-colors"
                    title="Edit permissions"
                  >
                    <Edit3 size={13} />
                  </button>
                  {!isSelf && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setRevokeTarget(user); }}
                      className="p-2 bg-slate-800 rounded-lg text-slate-500 hover:text-red-400 transition-colors"
                      title="Revoke access"
                    >
                      <UserMinus size={13} />
                    </button>
                  )}
                  {isOpen ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
                </div>
              </div>

              {isOpen && (
                <div className="px-5 pb-5 border-t border-slate-800 pt-4">
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">Active Permissions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(user.permissions || []).map(p => {
                      const meta = ALL_PERMISSIONS.find(a => a.id === p);
                      return (
                        <span key={p} className="text-[8px] font-black bg-slate-800 border border-slate-700 text-slate-400 px-2 py-1 rounded-lg uppercase">
                          {meta?.label || p}
                        </span>
                      );
                    })}
                    {(!user.permissions || user.permissions.length === 0) && (
                      <span className="text-[9px] text-slate-700 italic">No permissions assigned</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onSaved={() => refresh()}
        />
      )}
      {revokeTarget && (
        <RevokeModal
          user={revokeTarget}
          onClose={() => setRevokeTarget(null)}
          onRevoked={() => { setRevokeTarget(null); refresh(); }}
        />
      )}
      {editTarget && (
        <EditPermissionsModal
          user={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); refresh(); }}
        />
      )}
    </div>
  );
};

// ─── TAB 2: ROLES ─────────────────────────────────────────────────────────────

const RolesTab = () => {
  const [roles, setRoles] = useState(() => DataBridge.getSystemRoles());
  const [saved, setSaved] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');

  const togglePerm = (roleName, permId) => {
    setRoles(r => {
      const perms = r[roleName] || [];
      return {
        ...r,
        [roleName]: perms.includes(permId) ? perms.filter(p => p !== permId) : [...perms, permId]
      };
    });
    setSaved(false);
  };

  const addRole = () => {
    const name = newRoleName.trim().toUpperCase();
    if (!name || roles[name]) return;
    setRoles(r => ({ ...r, [name]: [] }));
    setNewRoleName('');
  };

  const removeRole = (name) => {
    if (['ADMIN', 'TECH', 'CUSTOMER'].includes(name)) return;
    setRoles(r => { const { [name]: _, ...rest } = r; return rest; });
    setSaved(false);
  };

  const save = () => {
    const config = DataBridge.load('system_config') || {};
    config.roles = roles;
    DataBridge.save('system_config', config);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Add Custom Role</p>
        <div className="flex gap-3">
          <input
            value={newRoleName}
            onChange={e => setNewRoleName(e.target.value.toUpperCase().replace(/\s/g, '_'))}
            placeholder="ROLE_NAME"
            className="flex-1 bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-black font-mono uppercase text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
          <button onClick={addRole} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black px-5 py-3 rounded-xl text-[10px] uppercase tracking-widest transition-colors">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(roles).map(([roleName, perms]) => {
          const isCore = ['ADMIN', 'TECH', 'CUSTOMER'].includes(roleName);
          return (
            <div key={roleName} className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <Badge label={roleName} color={roleColor(roleName)} />
                  <span className="text-[9px] text-slate-600">{perms.length} permissions</span>
                  {isCore && <span className="text-[8px] text-slate-700 uppercase">system role</span>}
                </div>
                {!isCore && (
                  <button onClick={() => removeRole(roleName)} className="text-slate-700 hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>

              {PERM_GROUPS.map(group => (
                <div key={group} className="mb-3">
                  <p className="text-[8px] font-black text-slate-700 uppercase tracking-widest mb-2">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => {
                      const on = perms.includes(perm.id);
                      return (
                        <button
                          key={perm.id}
                          onClick={() => togglePerm(roleName, perm.id)}
                          className={`text-[8px] font-black px-2.5 py-1 rounded-lg border transition-all ${
                            on
                              ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                              : 'bg-slate-950 border-slate-800 text-slate-700 hover:border-slate-600 hover:text-slate-500'
                          }`}
                        >
                          {perm.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <button
        onClick={save}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
      >
        <Save size={14} /> Save Role Definitions
      </button>
    </div>
  );
};

// ─── TAB 3: SHOP SETTINGS ────────────────────────────────────────────────────

const ShopTab = () => {
  const [info, setInfo] = useState(() => DataBridge.load('shop_info') || { name: '', global_contact: { phone: '', email: '', address: '' } });
  const [policy, setPolicy] = useState(() => DataBridge.load('shop_policy') || {});
  const [saved, setSaved] = useState(false);

  const saveAll = () => {
    DataBridge.save('shop_info', info);
    DataBridge.save('shop_policy', policy);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const setContact = (field, value) => {
    setInfo(i => ({ ...i, global_contact: { ...i.global_contact, [field]: value } }));
  };

  return (
    <div className="space-y-6">
      <SaveBanner saved={saved} />

      {/* Shop Identity */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">Shop Identity</h3>

        <div>
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Shop Name</label>
          <input
            value={info.name || ''}
            onChange={e => setInfo(i => ({ ...i, name: e.target.value }))}
            placeholder="Leander Diesel & Truck"
            className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {[
          { key: 'phone', label: 'Phone', placeholder: '512-555-0100' },
          { key: 'email', label: 'Email', placeholder: 'service@yourshop.com' },
          { key: 'address', label: 'Address', placeholder: '123 Main St, Leander, TX 78641' },
          { key: 'usdot', label: 'USDOT #', placeholder: 'Optional' },
        ].map(({ key, label, placeholder }) => (
          <div key={key}>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">{label}</label>
            <input
              value={info.global_contact?.[key] || ''}
              onChange={e => setContact(key, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-black border border-slate-800 rounded-xl px-4 py-3 text-white font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
      </div>

      {/* Policy Toggles */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
        <h3 className="text-xs font-black text-white uppercase tracking-widest">System Policy</h3>

        {[
          { key: 'enable_price_audit', label: 'Price Audit Mode', desc: 'Flag jobs where actual price is below engine suggestion' },
          { key: 'enable_bay_custody', label: 'Bay Custody Tracking', desc: 'Require tech check-in/out for each bay' },
          { key: 'autoLockEnabled', label: 'Auto-Lock Screen', desc: 'Lock the system after 10 minutes of inactivity' },
          { key: 'is_dot_mandated', label: 'DOT Mandated Shop', desc: 'Enforce DOT compliance gates before job completion' },
        ].map(({ key, label, desc }) => {
          const val = key === 'is_dot_mandated' ? DataBridge.load('is_dot_mandated') : policy[key];
          const toggle = () => {
            if (key === 'is_dot_mandated') {
              DataBridge.save('is_dot_mandated', !val);
            } else {
              setPolicy(p => ({ ...p, [key]: !p[key] }));
            }
          };

          return (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-[10px] font-black text-white uppercase tracking-widest">{label}</p>
                <p className="text-[9px] text-slate-600 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={toggle}
                className={`relative w-12 h-6 rounded-full border transition-colors flex-shrink-0 ${
                  val ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'
                }`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full transition-all ${val ? 'left-6 bg-white' : 'left-0.5 bg-slate-600'}`} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Danger Zone */}
      <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-6 shadow-2xl">
        <h3 className="text-xs font-black text-red-400 uppercase tracking-widest mb-4">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-white uppercase">Factory Reset</p>
            <p className="text-[9px] text-slate-600">Wipes all local data. Cannot be undone.</p>
          </div>
          <button
            onClick={() => {
              if (window.confirm('FACTORY RESET: This permanently deletes all data. Are you absolutely sure?')) {
                DataBridge.factoryReset();
              }
            }}
            className="flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-400 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest hover:bg-red-600/20 transition-colors"
          >
            <AlertTriangle size={12} /> Reset
          </button>
        </div>
      </div>

      <button
        onClick={saveAll}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-[10px] transition-colors shadow-xl shadow-blue-900/30 active:scale-95 flex items-center justify-center gap-2"
      >
        <Save size={14} /> Save Settings
      </button>
    </div>
  );
};

// ─── ROOT COMPONENT ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'STAFF', label: 'Staff',        icon: Users      },
  { id: 'ROLES', label: 'Roles',        icon: ShieldCheck },
  { id: 'SHOP',  label: 'Shop Settings', icon: Settings   },
];

const IgnitionAdmin = () => {
  const currentUser = DataBridge.load('current_user');
  const [activeTab, setActiveTab] = useState('STAFF');

  const isAdmin = currentUser?.permissions?.includes('ADMIN') || currentUser?.permissions?.includes('manage_users');

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <Lock size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Admin Access Required</h2>
        <p className="text-slate-500 text-xs max-w-xs">Your identity matrix does not have the manage_users permission.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 bg-black min-h-full text-slate-200">
      <header className="mb-8 border-b border-slate-800 pb-6">
        <h1 className="text-3xl sm:text-4xl font-black italic text-white uppercase tracking-tighter mb-1">
          Admin <span className="text-blue-500 border-l-4 border-blue-500 pl-4 ml-4">Command Center</span>
        </h1>
        <p className="text-[10px] sm:text-xs font-mono text-slate-500 uppercase tracking-[0.3em]">
          Staff Management · Role Configuration · Shop Policy
        </p>
      </header>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
        {TABS.map(t => (
          <Tab key={t.id} {...t} active={activeTab === t.id} onClick={setActiveTab} />
        ))}
      </div>

      {activeTab === 'STAFF' && <StaffTab />}
      {activeTab === 'ROLES' && <RolesTab />}
      {activeTab === 'SHOP'  && <ShopTab />}
    </div>
  );
};

export default IgnitionAdmin;
