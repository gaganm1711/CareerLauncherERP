import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, ShieldAlert, Check, X, Shield, Lock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '../api';

const SYSTEM_PERMISSIONS = [
  { id: 'students:view', label: 'View Students Roster', desc: 'Allows viewing student list and profile details' },
  { id: 'students:manage', label: 'Manage Students & Exams', desc: 'Allows registrations, promotions, and test marks entries' },
  { id: 'teachers:view', label: 'View Faculty Roster', desc: 'Allows viewing teacher list profiles' },
  { id: 'teachers:manage', label: 'Manage Faculty & Attendance', desc: 'Allows creating teacher profiles and marking attendance' },
  { id: 'fees:manage', label: 'Manage Fees & Reminders', desc: 'Allows fee collection registers, ledgers, and overdue reminders' },
  { id: 'settings:manage', label: 'System Configuration', desc: 'Allows backups, broadcaster SMS alerts, and user management' }
];

export default function Users({ user }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [form, setForm] = useState({
    name: '', username: '', email: '', role: 'TEACHER', permissions: [], password: ''
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load all users on mount
  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/users');
      setUsersList(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleTogglePermission = (permId) => {
    setForm(prev => {
      const exists = prev.permissions.includes(permId);
      return {
        ...prev,
        permissions: exists 
          ? prev.permissions.filter(p => p !== permId) 
          : [...prev.permissions, permId]
      };
    });
  };

  const handleOpenAdd = () => {
    setForm({
      name: '', username: '', email: '', role: 'TEACHER', permissions: [], password: ''
    });
    setError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (targetUser) => {
    setSelectedUser(targetUser);
    setForm({
      name: targetUser.name || '',
      username: targetUser.username || '',
      email: targetUser.email || '',
      role: targetUser.role || 'TEACHER',
      permissions: targetUser.permissions ? targetUser.permissions.split(',').filter(Boolean) : [],
      password: '' // Kept empty for optional password resets
    });
    setError('');
    setShowEditModal(true);
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      // In the backend, role connect and register endpoint is POST /auth/register
      const payload = {
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
        permissions: form.role === 'ADMIN' ? '' : form.permissions.join(',')
      };

      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setShowAddModal(false);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Registration failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: form.name,
        username: form.username,
        email: form.email,
        role: form.role,
        permissions: form.role === 'ADMIN' ? '' : form.permissions.join(',')
      };

      if (form.password) {
        payload.password = form.password;
      }

      await apiRequest(`/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });

      setShowEditModal(false);
      setSelectedUser(null);
      loadUsers();
    } catch (err) {
      setError(err.message || 'Updating user failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async (targetId, targetUsername) => {
    if (targetId === user.id) {
      alert('Security Alert: You cannot delete your own active administrator session!');
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to permanently delete user account "${targetUsername}"?`)) {
      return;
    }

    try {
      await apiRequest(`/users/${targetId}`, {
        method: 'DELETE'
      });
      loadUsers();
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Staff Accounts</h1>
          <p className="text-slate-400 text-sm mt-0.5">Register, manage, and configure access permissions for ERP system staff members</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/15 text-sm transition-all"
        >
          <UserPlus className="h-4.5 w-4.5" />
          Add Staff Account
        </button>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-2xl border border-blue-500/15 overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 text-xs font-semibold uppercase tracking-wider">
              <th className="p-4">Full Name</th>
              <th className="p-4">Username</th>
              <th className="p-4">Email</th>
              <th className="p-4">Role</th>
              <th className="p-4">MFA State</th>
              <th className="p-4">Created Date</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-350">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-slate-500 text-xs">
                  Loading staff registrations list...
                </td>
              </tr>
            ) : usersList.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-12 text-slate-500 text-xs">
                  No other staff accounts found.
                </td>
              </tr>
            ) : (
              usersList.map(item => (
                <tr key={item.id} className="hover:bg-slate-900/35 transition-colors">
                  <td className="p-4 font-bold text-white font-outfit">{item.name}</td>
                  <td className="p-4 font-mono text-cyan-400 text-xs font-bold">{item.username}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{item.email}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wide border ${
                      item.role === 'ADMIN'
                        ? 'bg-orange-500/10 text-orange-400 border-orange-500/15'
                        : item.role === 'SUBADMIN'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/15'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/15'
                    }`}>
                      {item.role}
                    </span>
                  </td>
                  <td className="p-4 text-xs font-semibold">
                    {item.mfaEnabled ? (
                      <span className="text-emerald-400 flex items-center gap-1"><Lock className="w-3.5 h-3.5" /> Enabled</span>
                    ) : (
                      <span className="text-slate-500">Disabled</span>
                    )}
                  </td>
                  <td className="p-4 text-xs font-mono text-slate-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-blue-400 rounded-xl transition-all"
                      title="Edit staff account details"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(item.id, item.username)}
                      disabled={item.id === user.id}
                      className="p-2 bg-slate-900 hover:bg-slate-850 hover:text-rose-400 border border-slate-800 text-slate-400 rounded-xl transition-all disabled:opacity-30 disabled:hover:text-slate-400"
                      title={item.id === user.id ? 'You cannot delete yourself' : 'Delete user account'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ADD ACCOUNT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-blue-500/25 relative flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">Register New Staff Account</h3>
            
            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Full Name *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
                    placeholder="E.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Username *</label>
                  <input
                    type="text" required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. johndoe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Email Address *</label>
                  <input
                    type="email" required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                    placeholder="e.g. johndoe@cl.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Initial Password *</label>
                  <input
                    type="password" required
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Role Type *</label>
                <div className="flex gap-4 p-1 bg-[#070d1e] border border-slate-800 rounded-xl w-fit">
                  {['TEACHER', 'SUBADMIN', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        form.role === r
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-450 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular permissions checklist (Hidden for ADMIN role as they bypass checks) */}
              {form.role !== 'ADMIN' && (
                <div className="space-y-2 border-t border-slate-850 pt-3">
                  <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400">Access Permissions Checklist</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {SYSTEM_PERMISSIONS.map(p => {
                      const isChecked = form.permissions.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTogglePermission(p.id)}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-xl border text-left transition-all ${
                            isChecked
                              ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold shadow-[0_0_12px_rgba(37,99,235,0.08)]'
                              : 'border-slate-850 bg-slate-900/40 text-slate-450 hover:border-slate-700'
                          }`}
                        >
                          <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                            isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-750 bg-slate-950'
                          }`}>
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="font-bold text-[10px] uppercase tracking-wide text-slate-200">{p.label}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">{p.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-850 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-600 text-slate-400 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-40"
                >
                  {saving ? 'Creating...' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ACCOUNT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-blue-500/25 relative flex flex-col max-h-[90vh]">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">Edit Staff Account</h3>
            
            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 flex-shrink-0" /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEditUser} className="space-y-4 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Full Name *</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Username *</label>
                  <input
                    type="text" required
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Email Address *</label>
                  <input
                    type="email" required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1">Reset Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="Enter to set a new password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Role Type *</label>
                <div className="flex gap-4 p-1 bg-[#070d1e] border border-slate-800 rounded-xl w-fit">
                  {['TEACHER', 'SUBADMIN', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r })}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                        form.role === r
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-450 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Granular permissions checklist (Hidden for ADMIN role as they bypass checks) */}
              {form.role !== 'ADMIN' && (
                <div className="space-y-2 border-t border-slate-850 pt-3">
                  <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400">Access Permissions Checklist</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {SYSTEM_PERMISSIONS.map(p => {
                      const isChecked = form.permissions.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => handleTogglePermission(p.id)}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-xl border text-left transition-all ${
                            isChecked
                              ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold shadow-[0_0_12px_rgba(37,99,235,0.08)]'
                              : 'border-slate-850 bg-slate-900/40 text-slate-450 hover:border-slate-700'
                          }`}
                        >
                          <div className={`mt-0.5 w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                            isChecked ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-750 bg-slate-950'
                          }`}>
                            {isChecked && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <p className="font-bold text-[10px] uppercase tracking-wide text-slate-200">{p.label}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5 leading-normal">{p.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 mt-6 border-t border-slate-850 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 border border-slate-800 hover:border-slate-600 text-slate-400 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
