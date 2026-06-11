import React, { useState } from 'react';
import { User, Mail, Shield, Save, KeyRound, AlertTriangle, CheckCircle2, ShieldCheck, Lock, Unlock } from 'lucide-react';
import { apiRequest } from '../api';

export default function Profile({ user, onProfileUpdate }) {
  // Profile fields state
  const [name, setName] = useState(user?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  
  // Password fields state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [savingMfa, setSavingMfa] = useState(false);
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaError, setMfaError] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const updatedUser = await apiRequest('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email, username })
      });

      setProfileSuccess('Profile details updated successfully!');
      
      // Update local storage and app state
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile details.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSavingPassword(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      setSavingPassword(false);
      return;
    }

    try {
      await apiRequest('/auth/profile/password', {
        method: 'PUT',
        body: JSON.stringify({ password })
      });

      setPasswordSuccess('Security password updated successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleMfa = async (newVal) => {
    setSavingMfa(true);
    setMfaSuccess('');
    setMfaError('');

    try {
      const res = await apiRequest('/auth/profile/mfa', {
        method: 'PUT',
        body: JSON.stringify({ mfaEnabled: newVal })
      });

      setMfaEnabled(res.mfaEnabled);
      setMfaSuccess(res.mfaEnabled 
        ? 'MFA security activated! You will be prompted for code "123456" during your next login.'
        : 'MFA security deactivated successfully.'
      );

      // Sync user object session
      const updatedUser = { ...user, mfaEnabled: res.mfaEnabled };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (onProfileUpdate) {
        onProfileUpdate(updatedUser);
      }
    } catch (err) {
      setMfaError(err.message || 'Failed to toggle MFA status.');
    } finally {
      setSavingMfa(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">My Profile Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">Manage your credentials, update your secure password, and configure MFA authentication options</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Card: Summary */}
        <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 flex flex-col items-center text-center space-y-4 hover-glow-cyan h-fit">
          <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/25 flex items-center justify-center font-black text-blue-400 text-3xl font-outfit">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-outfit">{user?.name}</h2>
            <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-400/20 uppercase tracking-wider mt-1.5 inline-block">
              {user?.role}
            </span>
          </div>

          <div className="w-full pt-4 border-t border-slate-800/60 space-y-3 text-xs text-left">
            <div className="flex items-center gap-2.5 text-slate-400">
              <User className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="truncate">Username: <strong className="text-white font-mono">{user?.username}</strong></span>
            </div>
            <div className="flex items-center gap-2.5 text-slate-400">
              <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="truncate">Email: <strong className="text-white font-mono">{user?.email}</strong></span>
            </div>
          </div>

          {user?.permissions && (
            <div className="w-full pt-4 border-t border-slate-800/60 text-left space-y-2">
              <p className="font-extrabold text-[9px] uppercase tracking-widest text-slate-500">Access Permissions</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {user.permissions.split(',').filter(Boolean).map((p) => (
                  <span key={p} className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/15 font-bold text-[8px] uppercase tracking-wide">
                    {p.replace(':', ' ')}
                  </span>
                ))}
                {user.role === 'ADMIN' && (
                  <span className="px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/15 font-bold text-[8px] uppercase tracking-wide">
                    Full System Access
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Content */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Card 1: Details */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan">
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2 border-b border-slate-850 pb-2">
              <User className="w-4.5 h-4.5 text-blue-400" /> Account Particulars
            </h3>

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> <span>{profileSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-450 font-bold mb-1">Full Name *</label>
                <input
                  type="text" required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-450 font-bold mb-1">Username *</label>
                <input
                  type="text" required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-slate-455 font-bold mb-1">Email Address *</label>
                <input
                  type="email" required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-500/10 transition-colors disabled:opacity-40"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Saving Details...' : 'Save Profile Details'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Password */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan">
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2 border-b border-slate-850 pb-2">
              <KeyRound className="w-4.5 h-4.5 text-blue-400" /> Update Password
            </h3>

            {passwordError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> <span>{passwordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-450 font-bold mb-1">New Secure Password *</label>
                <input
                  type="password" required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-455 font-bold mb-1">Confirm New Password *</label>
                <input
                  type="password" required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-white outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/10 transition-colors disabled:opacity-40"
                >
                  <KeyRound className="w-4 h-4" />
                  {savingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </form>
          </div>

          {/* Card 3: Multi-Factor Authentication */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan">
            <h3 className="text-base font-bold text-white font-outfit flex items-center gap-2 border-b border-slate-850 pb-2">
              <ShieldCheck className="w-4.5 h-4.5 text-blue-400" /> Multi-Factor Authentication (MFA)
            </h3>

            {mfaError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span>{mfaError}</span>
              </div>
            )}

            {mfaSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> <span>{mfaSuccess}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-white flex items-center gap-2">
                  {mfaEnabled ? (
                    <span className="flex items-center gap-1.5 text-emerald-400"><Lock className="w-4 h-4" /> Activated</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-500"><Unlock className="w-4 h-4" /> Deactivated</span>
                  )}
                </p>
                <p className="text-slate-400 leading-normal max-w-md">
                  Enabling MFA requires entering a simulated TOTP authentication code (mocked as <strong className="text-white">123456</strong>) during the login session.
                </p>
              </div>
              <button
                type="button"
                disabled={savingMfa}
                onClick={() => handleToggleMfa(!mfaEnabled)}
                className={`px-5 py-2.5 rounded-xl font-bold uppercase tracking-wider text-xs shadow-md transition-all ${
                  mfaEnabled
                    ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/10'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10'
                }`}
              >
                {savingMfa ? 'Syncing...' : mfaEnabled ? 'Deactivate MFA' : 'Activate MFA'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
