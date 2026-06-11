import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, MessageSquare, Database, RefreshCw, Save } from 'lucide-react';
import { apiRequest } from '../api';

export default function SettingsPage({ user }) {
  const [form, setForm] = useState({
    JWT_SECRET: '',
    MFA_ENABLED: 'false',
    TWILIO_ACCOUNT_SID: '',
    TWILIO_AUTH_TOKEN: '',
    TWILIO_FROM_NUMBER: '',
    AUTO_ABSENT_SMS: 'false',
    DATABASE_URL: ''
  });

  const [syncState, setSyncState] = useState({ status: 'idle', lastSyncAt: null });
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Database Maintenance States
  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    batches: 0,
    feeRecords: 0,
    exams: 0,
    auditLogs: 0,
    syncDeletes: 0
  });
  const [backups, setBackups] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const loadSettings = async () => {
    try {
      const settings = await apiRequest('/settings');
      setForm({
        JWT_SECRET: settings.JWT_SECRET || 'career-launcher-default-secret-key-123',
        MFA_ENABLED: settings.MFA_ENABLED || 'false',
        TWILIO_ACCOUNT_SID: settings.TWILIO_ACCOUNT_SID || '',
        TWILIO_AUTH_TOKEN: settings.TWILIO_AUTH_TOKEN || '',
        TWILIO_FROM_NUMBER: settings.TWILIO_FROM_NUMBER || '',
        AUTO_ABSENT_SMS: settings.AUTO_ABSENT_SMS || 'false',
        DATABASE_URL: settings.DATABASE_URL || ''
      });

      const sync = await apiRequest('/sync/status');
      setSyncState(sync);
    } catch (err) {
      console.error(err);
    }
  };

  const loadMaintenanceData = async () => {
    try {
      setLoadingBackups(true);
      const dbStats = await apiRequest('/settings/stats');
      setStats(dbStats);
      
      const dbBackups = await apiRequest('/settings/backups');
      setBackups(dbBackups);
    } catch (err) {
      console.error('Failed to load database maintenance data:', err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadMaintenanceData();
    // Poll sync status every 5 seconds
    const interval = setInterval(async () => {
      try {
        const sync = await apiRequest('/sync/status');
        setSyncState(sync);
      } catch (e) {}
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiRequest('/settings', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      alert('Settings saved successfully!');
      loadSettings();
    } catch (err) {
      alert(`Failed to save settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      const sync = await apiRequest('/sync/trigger', { method: 'POST' });
      setSyncState(sync);
      alert('Manual sync cycle triggered successfully!');
    } catch (err) {
      alert(`Sync trigger failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setBackingUp(true);
      const res = await apiRequest('/settings/backup', { method: 'POST' });
      alert(res.message || 'Backup created successfully!');
      loadMaintenanceData();
    } catch (err) {
      alert(`Backup failed: ${err.message}`);
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (confirm(`WARNING: Restoring the database from "${filename}" will overwrite all current local data and disconnect active connections. The application will need to be reloaded/restarted. Are you sure you want to proceed?`)) {
      try {
        setRestoring(true);
        const res = await apiRequest('/settings/restore', {
          method: 'POST',
          body: JSON.stringify({ filename })
        });
        alert(res.message || 'Database restored successfully! Please reload/restart the application.');
        loadMaintenanceData();
      } catch (err) {
        alert(`Restoration failed: ${err.message}`);
      } finally {
        setRestoring(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">System Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure authentication security, Twilio SMS settings, and Cloud synchronization</p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
        
        {/* Left Column: Security and Twilio */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Security Box */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4">
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-orange-400" />
              Security & Session Security
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">JWT Session Secret</label>
                <input
                  type="password"
                  value={form.JWT_SECRET}
                  onChange={(e) => setForm({ ...form, JWT_SECRET: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Multi-Factor Authentication (MFA)</label>
                <select
                  value={form.MFA_ENABLED}
                  onChange={(e) => setForm({ ...form, MFA_ENABLED: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="false">Disabled (No TOTP on login)</option>
                  <option value="true">Enabled (TOTP Verification required)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Twilio Config Box */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4">
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-cyan-400" />
              Twilio SMS API Credentials
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Twilio Account SID</label>
                <input
                  type="text"
                  value={form.TWILIO_ACCOUNT_SID}
                  onChange={(e) => setForm({ ...form, TWILIO_ACCOUNT_SID: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Twilio Auth Token</label>
                <input
                  type="password"
                  value={form.TWILIO_AUTH_TOKEN}
                  onChange={(e) => setForm({ ...form, TWILIO_AUTH_TOKEN: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Twilio Sender Number (From)</label>
                <input
                  type="text"
                  value={form.TWILIO_FROM_NUMBER}
                  onChange={(e) => setForm({ ...form, TWILIO_FROM_NUMBER: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. +14155552671"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Automatic Absence Alerts</label>
                <select
                  value={form.AUTO_ABSENT_SMS}
                  onChange={(e) => setForm({ ...form, AUTO_ABSENT_SMS: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="false">Off (Do not auto-SMS parents)</option>
                  <option value="true">On (Auto-SMS parent on ABSENT attendance)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Database Connection & Manual Sync */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-2">
                <Database className="h-5 w-5 text-emerald-400" />
                Neon Postgres Connection
              </h2>
              
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">PostgreSQL DATABASE_URL</label>
                <textarea
                  rows={4}
                  value={form.DATABASE_URL}
                  onChange={(e) => setForm({ ...form, DATABASE_URL: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-xs text-white leading-relaxed"
                  placeholder="postgres://user:password@neon-domain/dbname?sslmode=require"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Connecting to cloud starts background sync loop replicating local SQLite changes.
                </p>
              </div>

              {/* Sync Status Box */}
              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-2.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Replication Engine Status</p>
                <div className="flex items-center justify-between text-xs">
                  <span>Sync Status:</span>
                  <span className={`font-bold uppercase tracking-wider ${
                    syncState.status === 'idle' ? 'text-cyan-400' :
                    syncState.status === 'syncing' ? 'text-orange-400' :
                    syncState.status === 'offline' ? 'text-slate-400' : 'text-rose-400'
                  }`}>
                    {syncState.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span>Last Replicated At:</span>
                  <span className="font-mono text-slate-300">
                    {syncState.lastSyncAt ? new Date(syncState.lastSyncAt).toLocaleTimeString() : 'Never'}
                  </span>
                </div>
                {syncState.status !== 'offline' && (
                  <button
                    type="button"
                    onClick={handleTriggerSync}
                    disabled={syncing || syncState.status === 'syncing'}
                    className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold rounded-lg border border-blue-500/20 text-xs transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    Sync Database Now
                  </button>
                )}
              </div>
            </div>

            {/* Save Button */}
            {user.role !== 'TEACHER' && (
              <div className="pt-6 border-t border-slate-850 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={saving}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Save className="h-4.5 w-4.5" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </motion.button>
              </div>
            )}
          </div>
        </div>

      </form>

      {/* Database Maintenance Card */}
      <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-400" />
              Local Database Maintenance & Backups
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage local SQLite database backups, restores, and inspect record row counts</p>
          </div>
          {user.role !== 'TEACHER' && (
            <button
              type="button"
              onClick={handleCreateBackup}
              disabled={backingUp}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/15 text-xs transition-all"
            >
              <Database className="h-4 w-4" />
              {backingUp ? 'Creating Backup...' : 'Backup Database Now'}
            </button>
          )}
        </div>

        {/* Database Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
          {[
            { label: 'Students', value: stats.students, color: 'text-cyan-400 bg-cyan-400/5 border-cyan-400/20' },
            { label: 'Teachers', value: stats.teachers, color: 'text-orange-400 bg-orange-400/5 border-orange-400/20' },
            { label: 'Batches', value: stats.batches, color: 'text-indigo-400 bg-indigo-400/5 border-indigo-400/20' },
            { label: 'Fee Records', value: stats.feeRecords, color: 'text-emerald-400 bg-emerald-400/5 border-emerald-400/20' },
            { label: 'Exams', value: stats.exams, color: 'text-rose-400 bg-rose-400/5 border-rose-400/20' },
            { label: 'Audit Logs', value: stats.auditLogs, color: 'text-amber-400 bg-amber-400/5 border-amber-400/20' },
            { label: 'Sync Deletes', value: stats.syncDeletes, color: 'text-slate-400 bg-slate-400/5 border-slate-400/20' }
          ].map((stat, idx) => (
            <div key={idx} className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center ${stat.color}`}>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</span>
              <span className="text-xl font-bold font-mono">{stat.value}</span>
            </div>
          ))}
        </div>

        {/* Backups List */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white font-outfit uppercase tracking-wider">Historical Backups</h3>
          {loadingBackups ? (
            <p className="text-xs text-slate-400">Loading backups...</p>
          ) : backups.length > 0 ? (
            <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 font-semibold uppercase tracking-wider">
                    <th className="p-3">Filename</th>
                    <th className="p-3">File Size</th>
                    <th className="p-3">Created Date</th>
                    {user.role !== 'TEACHER' && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {backups.map((bk, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                      <td className="p-3 font-mono text-slate-200">{bk.filename}</td>
                      <td className="p-3 font-mono text-slate-400">{(bk.size / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="p-3 text-slate-400">{new Date(bk.createdAt).toLocaleString()}</td>
                      {user.role !== 'TEACHER' && (
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(bk.filename)}
                            disabled={restoring}
                            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-rose-400 font-bold transition-all"
                          >
                            Restore
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 bg-slate-950/20 border border-slate-850 rounded-xl text-center">
              <p className="text-xs text-slate-500 font-outfit">No database backups generated yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
