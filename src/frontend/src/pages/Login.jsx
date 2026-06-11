import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, User, Lock, KeyRound } from 'lucide-react';
import { apiRequest } from '../api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });

      if (data.mfaRequired) {
        setMfaRequired(true);
        setMfaUserId(data.userId);
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setError(err.message || 'Login failed. Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiRequest('/auth/verify-mfa', {
        method: 'POST',
        body: JSON.stringify({ userId: mfaUserId, code: mfaCode })
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'MFA validation failed. (Simulated code is 123456)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0a1128] px-4 py-12 overflow-hidden">
      {/* Dynamic backdrop glows */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-orange-600/10 blur-[110px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="z-10 w-full max-w-md glass-panel p-8 rounded-2xl border border-blue-500/20 shadow-[0_12px_40px_-12px_rgba(2,4,15,0.9)]"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 mb-4">
            <ShieldCheck className="h-9 w-9 animate-pulse" />
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white font-outfit">Career Launcher</h2>
          <p className="mt-1 text-slate-400 text-sm">Tuition Classes ERP • Tumsar</p>
        </div>

        <AnimatePresence mode="wait">
          {!mfaRequired ? (
            <motion.form
              key="credentials"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onSubmit={handleCredentialsSubmit}
              className="space-y-5"
            >
              {error && (
                <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors text-sm"
                    placeholder="Enter your username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors text-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 focus:outline-none transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </motion.button>
            </motion.form>
          ) : (
            <motion.form
              key="mfa"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onSubmit={handleMfaSubmit}
              className="space-y-6"
            >
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white">MFA Authentication Required</h3>
                <p className="mt-2 text-xs text-slate-400">
                  Please enter the code to verify your identity.
                </p>
                <div className="mt-4 p-2 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg text-xs">
                  Tip: For simulation, please enter code <strong className="text-orange-400">123456</strong>
                </div>
              </div>

              {error && (
                <div className="p-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">TOTP Verification Code</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2.5 pl-11 pr-4 text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors text-center text-lg tracking-[0.5em] font-mono"
                    placeholder="000000"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMfaRequired(false)}
                  className="w-1/3 py-3 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-sm font-semibold transition-colors uppercase tracking-wider"
                >
                  Back
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-2/3 py-3 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/15 focus:outline-none transition-all text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifying...' : 'Verify Code'}
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
