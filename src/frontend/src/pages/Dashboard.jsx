import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  IndianRupee, 
  TrendingUp, 
  Award, 
  Calendar, 
  ClipboardList, 
  UserPlus, 
  CheckSquare,
  Activity,
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';

export default function Dashboard({ user, onTabChange }) {
  const [stats, setStats] = useState(null);
  const [exams, setExams] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quick Action Dialog States
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  
  // Admission Form Fields
  const [admissionForm, setAdmissionForm] = useState({
    name: '', lastName: '', email: '', phone: '', parentName: '', parentPhone: '',
    batchId: '', totalCourseFee: '', advancePay: '', emiMonths: '1'
  });
  const [batches, setBatches] = useState([]);

  // Attendance Form Fields
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      const statsData = await apiRequest('/dashboard/stats');
      setStats(statsData);
      
      const examsData = await apiRequest('/dashboard/upcoming-exams');
      setExams(examsData);
      
      const logsData = await apiRequest('/dashboard/audit-logs');
      setLogs(logsData);

      const batchesData = await apiRequest('/batches');
      setBatches(batchesData);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleUpdate = () => {
      console.log('[SOCKET] Dashboard reloading due to real-time updates...');
      loadData();
    };

    socketService.on('student_change', handleUpdate);
    socketService.on('fee_change', handleUpdate);
    socketService.on('attendance_change', handleUpdate);
    socketService.on('exam_change', handleUpdate);

    return () => {
      socketService.off('student_change', handleUpdate);
      socketService.off('fee_change', handleUpdate);
      socketService.off('attendance_change', handleUpdate);
      socketService.off('exam_change', handleUpdate);
    };
  }, []);

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest('/students', {
        method: 'POST',
        body: JSON.stringify(admissionForm)
      });
      alert('Student registered and fee plan initialized successfully!');
      setShowAdmissionModal(false);
      // Reset form
      setAdmissionForm({
        name: '', lastName: '', email: '', phone: '', parentName: '', parentPhone: '',
        batchId: '', totalCourseFee: '', advancePay: '', emiMonths: '1'
      });
      // Refresh stats
      const statsData = await apiRequest('/dashboard/stats');
      setStats(statsData);
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    }
  };

  const handleAttendanceRedirect = (e) => {
    e.preventDefault();
    if (!selectedBatchId) {
      alert('Please select a batch.');
      return;
    }
    localStorage.setItem('redirect_batchId', selectedBatchId);
    localStorage.setItem('redirect_date', selectedDate);
    onTabChange('attendance');
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 font-outfit text-sm">Loading operations metrics...</p>
        </div>
      </div>
    );
  }

  const formatFinancial = (val) => {
    if (val === null) return '••••••';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-blue-500/15">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">
            Welcome Back, {user.name}!
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Role: <span className="text-orange-400 font-semibold">{user.role}</span> • You have active access to Career Launcher Management Console.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex h-3.5 w-3.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
          </span>
          <span className="text-xs text-emerald-400 font-semibold tracking-wider uppercase bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Database Sync Engine Active
          </span>
        </div>
      </div>

      {/* 5-Column Responsive KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
        {/* Active Students */}
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel p-5 rounded-2xl hover-glow-cyan cursor-pointer transition-all border border-blue-500/20"
          onClick={() => onTabChange('students')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-cyan-500/10 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Users className="h-6 w-6" />
            </div>
            <span className="text-xs text-cyan-400 font-semibold uppercase tracking-widest bg-cyan-500/5 px-2 py-0.5 rounded">Active</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Students</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-outfit">{stats?.activeStudents}</h3>
        </motion.div>

        {/* Monthly Revenue */}
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel p-5 rounded-2xl hover-glow-orange cursor-pointer transition-all border border-blue-500/20"
          onClick={() => user.role !== 'TEACHER' && onTabChange('ledger')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-500/10 rounded-xl border border-orange-500/20 text-orange-400">
              <IndianRupee className="h-6 w-6" />
            </div>
            <span className="text-xs text-orange-400 font-semibold uppercase tracking-widest bg-orange-500/5 px-2 py-0.5 rounded">Month</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Monthly Revenue</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-outfit">{formatFinancial(stats?.monthlyRevenue)}</h3>
        </motion.div>

        {/* Total Outstanding */}
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel p-5 rounded-2xl hover-glow-rose cursor-pointer transition-all border border-blue-500/20"
          onClick={() => user.role !== 'TEACHER' && onTabChange('reminders')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
              <IndianRupee className="h-6 w-6" />
            </div>
            <span className="text-xs text-rose-400 font-semibold uppercase tracking-widest bg-rose-500/5 px-2 py-0.5 rounded">Ledger</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Outstanding Dues</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-outfit">{formatFinancial(stats?.totalOutstanding)}</h3>
        </motion.div>

        {/* EMI Due Students */}
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel p-5 rounded-2xl hover-glow-indigo cursor-pointer transition-all border border-blue-500/20"
          onClick={() => onTabChange('reminders')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20 text-indigo-400">
              <TrendingUp className="h-6 w-6" />
            </div>
            <span className="text-xs text-indigo-400 font-semibold uppercase tracking-widest bg-indigo-500/5 px-2 py-0.5 rounded">EMI Dues</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">EMI Due Students</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-outfit">{stats?.emiDueStudents}</h3>
        </motion.div>

        {/* Upcoming Promotions */}
        <motion.div
          whileHover={{ y: -3 }}
          className="glass-panel p-5 rounded-2xl hover-glow-emerald cursor-pointer transition-all border border-blue-500/20"
          onClick={() => onTabChange('students')}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Award className="h-6 w-6" />
            </div>
            <span className="text-xs text-emerald-400 font-semibold uppercase tracking-widest bg-emerald-500/5 px-2 py-0.5 rounded">Promos</span>
          </div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Upcoming Promos</p>
          <h3 className="text-3xl font-extrabold text-white mt-1 font-outfit">{stats?.upcomingPromotions}</h3>
        </motion.div>
      </div>

      {/* Main Grid: Quick Actions, Upcoming Exams, Audit Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Quick Actions & Alerts */}
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15">
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-4">
              <ClipboardList className="h-5 w-5 text-orange-400" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setShowAdmissionModal(true)}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 hover:border-orange-500/40 rounded-xl text-left text-sm text-white font-semibold transition-all group"
              >
                <div className="p-2 bg-orange-500/20 rounded-lg group-hover:scale-105 transition-transform text-orange-400">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">New Admission Form</p>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Enroll new student & generate fee plan</p>
                </div>
              </button>

              <button
                onClick={() => setShowAttendanceModal(true)}
                className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-xl text-left text-sm text-white font-semibold transition-all group"
              >
                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:scale-105 transition-transform text-blue-400">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">Mark Attendance</p>
                  <p className="text-xs text-slate-400 font-normal mt-0.5">Record daily batch registry</p>
                </div>
              </button>
            </div>
          </div>

          {/* Quick Notice Panel */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15">
            <h2 className="text-sm font-bold text-white font-outfit uppercase tracking-widest flex items-center gap-2 mb-3">
              <AlertCircle className="h-4.5 w-4.5 text-blue-400" />
              System Status
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Tuition center classes and timetable sync engine replicates to PostgreSQL Neon cloud instance automatically. Connect a DB URL via Settings to enable cloud synchronization.
            </p>
          </div>
        </div>

        {/* Column 2: Upcoming Examinations */}
        <div className="glass-panel p-6 rounded-2xl border border-blue-500/15">
          <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-cyan-400" />
            Upcoming Examinations
          </h2>
          <div className="space-y-3">
            {exams.length > 0 ? (
              exams.map((ex) => (
                <div key={ex.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-sm">
                  <div>
                    <h4 className="font-semibold text-white">{ex.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{ex.subject} • {ex.batch?.name}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                      {ex.date}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">Total: {ex.totalMarks}M</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs text-center py-8">No examinations scheduled.</p>
            )}
          </div>
        </div>

        {/* Column 3: Operations Audit Log */}
        <div className="glass-panel p-6 rounded-2xl border border-blue-500/15">
          <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-emerald-400" />
            Operations Audit Log
          </h2>
          <div className="space-y-3">
            {logs.length > 0 ? (
              logs.map((log) => (
                <div key={log.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{log.user?.name}</span>
                    <span className="text-[10px] text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-[11px] text-orange-400 font-semibold">{log.action}</p>
                  <p className="text-slate-400 leading-normal">{log.details}</p>
                </div>
              ))
            ) : (
              <p className="text-slate-500 text-xs text-center py-8">No logs available.</p>
            )}
          </div>
        </div>

      </div>

      {/* QUICK ACTION: ADMISSION FORM MODAL */}
      {showAdmissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-blue-500/25 max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">New Admission Form</h3>
            <form onSubmit={handleAdmissionSubmit} className="space-y-4 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">First Name</label>
                  <input
                    type="text" required
                    value={admissionForm.name}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, name: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. Rahul"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Last Name</label>
                  <input
                    type="text" required
                    value={admissionForm.lastName}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, lastName: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Parent Contact Name</label>
                  <input
                    type="text" required
                    value={admissionForm.parentName}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, parentName: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. Anil Sharma"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Parent Phone Number</label>
                  <input
                    type="text" required
                    value={admissionForm.parentPhone}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, parentPhone: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="10-digit number"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Student Phone (Optional)</label>
                  <input
                    type="text"
                    value={admissionForm.phone}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, phone: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Email (Optional)</label>
                  <input
                    type="email"
                    value={admissionForm.email}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, email: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Batch Class</label>
                  <select
                    required
                    value={admissionForm.batchId}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, batchId: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  >
                    <option value="">-- Choose Batch --</option>
                    {batches.map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.timing})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Total Package Course Fee (₹)</label>
                  <input
                    type="number" required
                    value={admissionForm.totalCourseFee}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, totalCourseFee: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="₹50000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Advance Deposit Paid (₹)</label>
                  <input
                    type="number" required
                    value={admissionForm.advancePay}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, advancePay: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="₹10000"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">EMI Tenure duration (Months)</label>
                  <select
                    value={admissionForm.emiMonths}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, emiMonths: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  >
                    <option value="1">1 Month</option>
                    <option value="3">3 Months</option>
                    <option value="6">6 Months</option>
                    <option value="9">9 Months</option>
                    <option value="12">12 Months</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAdmissionModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl"
                >
                  Confirm Admission
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QUICK ACTION: ATTENDANCE MODAL */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-blue-500/25 relative">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">Launch Attendance Registry</h3>
            <form onSubmit={handleAttendanceRedirect} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Select Batch</label>
                <select
                  required
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="">-- Choose Batch --</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.timing})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold rounded-xl"
                >
                  Launch Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
