import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckSquare, Calendar, UserCheck, AlertTriangle, Users } from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';

export default function Attendance({ user }) {
  const [activeTab, setActiveTab] = useState('students');
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Student Attendance states
  const [sheet, setSheet] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Faculty Attendance states
  const [facultySheet, setFacultySheet] = useState([]);
  const [facultyLoading, setFacultyLoading] = useState(false);
  const [facultySaving, setFacultySaving] = useState(false);

  useEffect(() => {
    async function loadBatches() {
      try {
        const data = await apiRequest('/batches');
        setBatches(data);

        // Check if there is an active redirection payload from dashboard quick action
        const redirectBatch = localStorage.getItem('redirect_batchId');
        const redirectDate = localStorage.getItem('redirect_date');
        
        if (redirectBatch) {
          setSelectedBatchId(redirectBatch);
          localStorage.removeItem('redirect_batchId');
        }
        if (redirectDate) {
          setSelectedDate(redirectDate);
          localStorage.removeItem('redirect_date');
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadBatches();
  }, []);

  const loadAttendanceSheet = async () => {
    if (!selectedBatchId) return;
    try {
      setLoading(true);
      const data = await apiRequest(`/attendance/sheet?batchId=${selectedBatchId}&date=${selectedDate}`);
      setSheet(data);
    } catch (err) {
      alert(`Failed to load attendance sheet: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFacultySheet = async () => {
    try {
      setFacultyLoading(true);
      const data = await apiRequest(`/attendance/teachers?date=${selectedDate}`);
      setFacultySheet(data);
    } catch (err) {
      alert(`Failed to load faculty sheet: ${err.message}`);
    } finally {
      setFacultyLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'students') {
      loadAttendanceSheet();
    } else {
      loadFacultySheet();
    }
  }, [selectedBatchId, selectedDate, activeTab]);

  useEffect(() => {
    const handleAttendanceUpdate = () => {
      console.log('[SOCKET] Attendance change event received. Reloading sheet...');
      if (activeTab === 'students') {
        loadAttendanceSheet();
      }
    };

    const handleTeacherUpdate = () => {
      console.log('[SOCKET] Teacher attendance change event received. Reloading sheet...');
      if (activeTab === 'teachers') {
        loadFacultySheet();
      }
    };

    socketService.on('attendance_change', handleAttendanceUpdate);
    socketService.on('teacher_change', handleTeacherUpdate);

    return () => {
      socketService.off('attendance_change', handleAttendanceUpdate);
      socketService.off('teacher_change', handleTeacherUpdate);
    };
  }, [selectedBatchId, selectedDate, activeTab]);

  const handleStatusChange = (studentId, newStatus) => {
    setSheet(prev => prev.map(item => {
      if (item.studentId === studentId) {
        return { ...item, status: newStatus };
      }
      return item;
    }));
  };

  const handleFacultyStatusChange = (teacherId, newStatus) => {
    setFacultySheet(prev => prev.map(item => {
      if (item.teacherId === teacherId) {
        return { ...item, status: newStatus };
      }
      return item;
    }));
  };

  const handleSaveAttendance = async () => {
    if (!selectedBatchId) return;
    try {
      setSaving(true);
      const records = sheet.map(item => ({
        studentId: item.studentId,
        status: item.status === 'UNMARKED' ? 'PRESENT' : item.status // Default to Present if unmarked
      }));

      await apiRequest('/attendance/mark', {
        method: 'POST',
        body: JSON.stringify({
          batchId: selectedBatchId,
          date: selectedDate,
          records
        })
      });

      alert('Attendance recorded successfully! Absent notifications triggered if configured.');
      loadAttendanceSheet();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveFacultyAttendance = async () => {
    try {
      setFacultySaving(true);
      const records = facultySheet.map(item => ({
        teacherId: item.teacherId,
        status: item.status === 'UNMARKED' ? 'PRESENT' : item.status
      }));

      await apiRequest('/attendance/teachers', {
        method: 'POST',
        body: JSON.stringify({
          date: selectedDate,
          records
        })
      });

      alert('Faculty attendance recorded successfully!');
      loadFacultySheet();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setFacultySaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Attendance Registry</h1>
          <p className="text-slate-400 text-sm mt-0.5">Record and monitor daily student and faculty attendance logs</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => setActiveTab('students')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
            activeTab === 'students'
              ? 'text-orange-500 border-orange-500'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Student Attendance
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          className={`pb-3 text-sm font-semibold tracking-wide border-b-2 transition-colors ${
            activeTab === 'faculty'
              ? 'text-orange-500 border-orange-500'
              : 'text-slate-400 border-transparent hover:text-slate-300'
          }`}
        >
          Faculty Attendance
        </button>
      </div>

      {/* Control selectors */}
      <div className="glass-panel p-4 rounded-xl flex flex-col sm:flex-row gap-4 border border-blue-500/15">
        {activeTab === 'students' && (
          <div className="flex-1">
            <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Class Batch</label>
            <select
              value={selectedBatchId}
              onChange={(e) => setSelectedBatchId(e.target.value)}
              className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500"
            >
              <option value="">-- Select Batch Class --</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name} ({b.timing})</option>
              ))}
            </select>
          </div>
        )}

        <div className={activeTab === 'students' ? 'sm:w-60' : 'flex-1'}>
          <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Registry Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Sheet view */}
      {activeTab === 'students' ? (
        selectedBatchId ? (
          loading ? (
            <div className="text-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Loading student attendance sheet...</p>
            </div>
          ) : sheet.length > 0 ? (
            <div className="space-y-4">
              <div className="glass-panel rounded-2xl border border-blue-500/15 overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 text-xs font-semibold uppercase tracking-wider">
                      <th className="p-4">Roll Number</th>
                      <th className="p-4">Student Name</th>
                      <th className="p-4 text-center">Mark Attendance Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {sheet.map(item => (
                      <tr key={item.studentId} className="hover:bg-slate-900/35 transition-colors">
                        <td className="p-4 font-mono text-cyan-400 text-xs font-bold">{item.rollNumber}</td>
                        <td className="p-4 font-bold text-white font-outfit">{item.name}</td>
                        <td className="p-4 text-center">
                          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.studentId, 'PRESENT')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                                item.status === 'PRESENT' || item.status === 'UNMARKED'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'text-slate-400 border border-transparent hover:text-slate-300'
                              }`}
                            >
                              Present
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.studentId, 'ABSENT')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                                item.status === 'ABSENT'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'text-slate-400 border border-transparent hover:text-slate-300'
                              }`}
                            >
                              Absent
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(item.studentId, 'LATE')}
                              className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                                item.status === 'LATE'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'text-slate-400 border border-transparent hover:text-slate-300'
                              }`}
                            >
                              Late
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Buttons */}
              {user.role !== 'TEACHER' && (
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/10 text-sm transition-all"
                  >
                    <UserCheck className="h-4.5 w-4.5" />
                    {saving ? 'Recording...' : 'Save Attendance Sheet'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
              <p className="text-slate-500 text-sm font-outfit">No active students registered in this batch.</p>
            </div>
          )
        ) : (
          <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800 flex flex-col items-center justify-center gap-2">
            <AlertTriangle className="h-8 w-8 text-slate-500" />
            <p className="text-slate-500 text-sm font-outfit">Please choose a Batch Class from the dropdown list to load attendance details.</p>
          </div>
        )
      ) : (
        // Faculty Attendance Registry View
        facultyLoading ? (
          <div className="text-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading faculty attendance registry...</p>
          </div>
        ) : facultySheet.length > 0 ? (
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl border border-blue-500/15 overflow-hidden">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 text-xs font-semibold uppercase tracking-wider">
                    <th className="p-4">Faculty Name</th>
                    <th className="p-4">Subject Specialty</th>
                    <th className="p-4 text-center">Mark Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {facultySheet.map(item => (
                    <tr key={item.teacherId} className="hover:bg-slate-900/35 transition-colors">
                      <td className="p-4 font-bold text-white font-outfit">{item.name}</td>
                      <td className="p-4 text-slate-400 font-medium">{item.subject || 'General'}</td>
                      <td className="p-4 text-center">
                        <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleFacultyStatusChange(item.teacherId, 'PRESENT')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                              item.status === 'PRESENT' || item.status === 'UNMARKED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'text-slate-400 border border-transparent hover:text-slate-300'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFacultyStatusChange(item.teacherId, 'ABSENT')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                              item.status === 'ABSENT'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                : 'text-slate-400 border border-transparent hover:text-slate-300'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFacultyStatusChange(item.teacherId, 'LATE')}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${
                              item.status === 'LATE'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'text-slate-400 border border-transparent hover:text-slate-300'
                            }`}
                          >
                            Late
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save Buttons */}
            {user.role !== 'TEACHER' && (
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleSaveFacultyAttendance}
                  disabled={facultySaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/10 text-sm transition-all"
                >
                  <UserCheck className="h-4.5 w-4.5" />
                  {facultySaving ? 'Recording...' : 'Save Faculty Registry'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
            <p className="text-slate-500 text-sm font-outfit">No faculty members registered in system roster.</p>
          </div>
        )
      )}
    </div>
  );
}
