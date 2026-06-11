import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MessageSquare, 
  Send, 
  Users, 
  GraduationCap, 
  BookOpen, 
  Smartphone, 
  RotateCw, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Calendar 
} from 'lucide-react';
import { apiRequest } from '../api';

export default function Broadcaster({ user }) {
  // Config & Data States
  const [status, setStatus] = useState({ connected: false, fromNumber: null });
  const [stats, setStats] = useState({ total: 0, delivered: 0, failed: 0, pending: 0 });
  const [logs, setLogs] = useState([]);
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  
  // Selection States
  const [audienceType, setAudienceType] = useState('all_parents'); // 'single', 'class', 'all_parents', 'all_faculty'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  
  // Message Broadcast States
  const [messageText, setMessageText] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);
  
  // Test Message States
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Hello! This is a test SMS from Career Launcher Tuition Classes, Tumsar ERP system.');
  const [sendingTest, setSendingTest] = useState(false);

  // Load status, stats, logs, students, batches
  const loadData = async () => {
    try {
      const statusData = await apiRequest('/broadcaster/status');
      setStatus(statusData);
      
      const statsData = await apiRequest('/broadcaster/stats');
      setStats(statsData);
      
      const logsData = await apiRequest('/broadcaster/logs');
      setLogs(logsData);
      
      const studentsData = await apiRequest('/students');
      setStudents(studentsData.filter(s => s.status === 'ACTIVE'));
      
      const batchesData = await apiRequest('/batches');
      setBatches(batchesData);
    } catch (err) {
      console.error('Failed to load Broadcaster data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = async () => {
    try {
      const statsData = await apiRequest('/broadcaster/stats');
      setStats(statsData);
      
      const logsData = await apiRequest('/broadcaster/logs');
      setLogs(logsData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all SMS dispatch logs?')) return;
    try {
      await apiRequest('/broadcaster/clear-logs', { method: 'POST' });
      handleRefresh();
    } catch (err) {
      alert(`Failed to clear logs: ${err.message}`);
    }
  };

  // Quick template trigger
  const applyTemplate = (templateType) => {
    const templates = {
      holiday: 'Dear Parent, Career Launcher Tuition Classes, Tumsar will remain CLOSED tomorrow on account of a public holiday. Classes will resume as per regular schedule. Regards, Career Launcher Tuition Classes, Tumsar.',
      results: 'Dear Parent, your child\'s exam marks have been declared. Please check the ERP panel for detailed scorecard. Regards, Career Launcher Tuition Classes.',
      ptm: 'Dear Parent, please attend the Parent Teacher Meeting scheduled for this Sunday at 10:00 AM to discuss your child\'s academic progress. Regards, Career Launcher.',
      fee: 'Dear Parent, this is a friendly reminder to clear the outstanding tuition fee installments for this month. Please ignore if already paid. Regards, Career Launcher.',
      closure: 'Dear Parent, due to heavy rains and local weather advisories, classes are cancelled for today. Stay safe. Regards, Career Launcher.',
      schedule: 'Dear Parent, please note that class timings for the batch have been updated. Please check the scheduler tab for new slots. Regards, Career Launcher.'
    };
    setMessageText(templates[templateType] || '');
  };

  // Handle test dispatch
  const handleSendTest = async (e) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      alert('Please enter a phone number.');
      return;
    }
    if (!testMessage.trim()) {
      alert('Please enter a test message.');
      return;
    }

    try {
      setSendingTest(true);
      await apiRequest('/broadcaster/send-test', {
        method: 'POST',
        body: JSON.stringify({
          phone: testPhone,
          messageText: testMessage
        })
      });
      alert('Test SMS dispatched successfully!');
      handleRefresh();
    } catch (err) {
      alert(`Test SMS dispatch failed: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  // Handle broadcast dispatch
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) {
      alert('Please type a message to broadcast.');
      return;
    }
    if (audienceType === 'single' && !selectedStudentId) {
      alert('Please select a student.');
      return;
    }
    if (audienceType === 'class' && !selectedBatchId) {
      alert('Please select a batch.');
      return;
    }

    try {
      setBroadcasting(true);
      const res = await apiRequest('/broadcaster/send-broadcast', {
        method: 'POST',
        body: JSON.stringify({
          audienceType,
          batchId: selectedBatchId,
          studentId: selectedStudentId,
          messageText
        })
      });
      alert(`Broadcast complete! Sent: ${res.sentCount}, Failed: ${res.failedCount}`);
      setMessageText('');
      handleRefresh();
    } catch (err) {
      alert(`Broadcast failed: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-blue-500" />
            SMS Notifications
          </h1>
          <p className="text-slate-400 text-sm mt-0.5 uppercase tracking-wider font-semibold text-[10px]">
            POWERED BY TWILIO — INSTANT SMS DELIVERY TO PARENTS & FACULTY
          </p>
        </div>

        {/* Status Badge */}
        {status.connected ? (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/35 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-bold shadow-lg shadow-emerald-500/5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Twilio Connected</span>
            <span className="opacity-60">|</span>
            <span className="font-mono">{status.fromNumber}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/35 px-4 py-1.5 rounded-full text-rose-400 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>Twilio Offline</span>
          </div>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-blue-500/10 bg-slate-900/20">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Total Messages</p>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-emerald-500/10 bg-slate-900/20">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Delivered</p>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.delivered}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-rose-500/10 bg-slate-900/20">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Failed</p>
          <p className="text-2xl font-black text-rose-400 mt-1">{stats.failed}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-amber-500/10 bg-slate-900/20">
          <p className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Pending</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.pending}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Columns: Broadcast and Test Controls */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Broadcast Console */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-5">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <MessageSquare className="h-5 w-5 text-blue-400" />
              <div>
                <h3 className="font-bold text-base">Broadcast SMS</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Send an SMS to students' parents, faculty, or the entire institute via Twilio.</p>
              </div>
            </div>

            {/* Target Audience selection buttons */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">Select Audience *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'single', label: 'Single Student', icon: Smartphone },
                  { id: 'class', label: 'Class Stream', icon: BookOpen },
                  { id: 'all_parents', label: 'All Parents', icon: Users },
                  { id: 'all_faculty', label: 'All Faculty', icon: GraduationCap }
                ].map(item => {
                  const Icon = item.icon;
                  const isActive = audienceType === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setAudienceType(item.id)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        isActive
                          ? 'border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
                          : 'border-slate-800 bg-slate-950/20 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Audience Inputs */}
            {audienceType === 'single' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Target Student Profile</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">-- Search & Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.lastName || ''} ({s.rollNumber}) - Parent: {s.parentPhone || s.phone || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audienceType === 'class' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="block text-[10px] text-slate-400 font-bold uppercase">Target Batch / Class Stream</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Target Batch --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.timing})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Templates List */}
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick Templates</label>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'holiday', label: 'Holiday Notice' },
                  { id: 'results', label: 'Exam Results' },
                  { id: 'ptm', label: 'PTM Reminder' },
                  { id: 'fee', label: 'Fee Reminder' },
                  { id: 'closure', label: 'Emergency Closure' },
                  { id: 'schedule', label: 'Schedule Change' }
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    className="text-[9px] font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 px-3 py-1 rounded-md transition-all uppercase tracking-wide"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Input Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-350 uppercase tracking-wide">Message *</label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your SMS message here..."
                rows={5}
                className="w-full bg-[#070d1e] border border-slate-850 rounded-xl p-3 text-xs text-white outline-none focus:border-blue-500 leading-relaxed font-sans"
              />
              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span>Keep under 160 chars for a single SMS segment</span>
                <span className="font-semibold text-slate-400">{messageText.length} chars ({Math.ceil(messageText.length / 160)} segment)</span>
              </div>
            </div>

            {/* Send Broadcast Button */}
            <button
              onClick={handleSendBroadcast}
              disabled={broadcasting || !messageText.trim()}
              className="w-full py-3 mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10"
            >
              <Send className="h-4 w-4" />
              {broadcasting ? 'Broadcasting Messages...' : 'Send SMS Broadcast'}
            </button>
          </div>

          {/* Test SMS Console */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
              <Smartphone className="h-5 w-5 text-cyan-400" />
              <div>
                <h3 className="font-bold text-base">Send Test SMS</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Verify your Twilio connection is working by sending a test SMS to any verified number.</p>
              </div>
            </div>

            <form onSubmit={handleSendTest} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase">Phone Number *</label>
                <input
                  type="text"
                  placeholder="10-digit mobile number"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-850 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-450 uppercase">Test Message *</label>
                <input
                  type="text"
                  value={testMessage}
                  onChange={(e) => setTestMessage(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-850 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest || !testPhone.trim()}
                className="md:col-span-2 w-fit px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center gap-2"
              >
                <Send className="h-4.5 w-4.5" />
                {sendingTest ? 'Sending Test...' : 'Send Test SMS'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Dispatch Logs */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-5 rounded-2xl border border-blue-500/15 h-full flex flex-col justify-between">
            <div className="space-y-4 flex-1 flex flex-col">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                  SMS Dispatch Logs
                </h3>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleRefresh}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                    title="Refresh logs"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={handleClearLogs}
                    className="p-1.5 bg-slate-900 hover:bg-slate-800 rounded-lg text-rose-400 hover:text-rose-300 transition-colors"
                    title="Clear dispatch logs"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Logs scrolling panel */}
              <div className="flex-1 overflow-y-auto max-h-[560px] pr-1 space-y-2">
                {logs.length > 0 ? (
                  logs.map(log => {
                    const isSent = log.status === 'SENT';
                    return (
                      <div key={log.id} className="p-3 bg-[#060c21]/80 border border-slate-800 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white capitalize">{log.recipientName}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                            isSent 
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                          }`}>
                            {log.status}
                          </span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-normal">{log.body}</p>
                        <div className="flex justify-between items-center text-[9px] text-slate-500">
                          <span>{log.phone}</span>
                          <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="bg-slate-950/40 p-1.5 rounded border border-slate-900/60 font-mono text-[8px] text-slate-400 break-all">
                          SID: {log.sid}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                    <MessageSquare className="h-8 w-8 opacity-30" />
                    <p className="text-xs italic">No SMS dispatches logged yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
