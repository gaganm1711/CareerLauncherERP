import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, BookOpen, Users, Plus, Trash2, Edit2, Columns } from 'lucide-react';
import { apiRequest } from '../api';

const DEFAULT_TIMETABLE = {
  Monday: '', Tuesday: '', Wednesday: '', Thursday: '', Friday: '', Saturday: '', Sunday: ''
};

export default function Batches({ user }) {
  const [batches, setBatches] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  const [form, setForm] = useState({
    name: '', timing: '', fees: '', subjects: '', teacherIds: []
  });
  const [timetable, setTimetable] = useState(DEFAULT_TIMETABLE);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/batches');
      setBatches(data);

      const teachersData = await apiRequest('/teachers');
      setTeachers(teachersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setEditingBatch(null);
    setForm({ name: '', timing: '', fees: '', subjects: '', teacherIds: [] });
    setTimetable(DEFAULT_TIMETABLE);
    setShowModal(true);
  };

  const handleOpenEdit = (batch) => {
    setEditingBatch(batch);
    setForm({
      name: batch.name,
      timing: batch.timing,
      fees: batch.fees.toString(),
      subjects: batch.subjects,
      teacherIds: batch.teachers?.map(t => t.id) || []
    });
    try {
      setTimetable({
        ...DEFAULT_TIMETABLE,
        ...JSON.parse(batch.timetableJson || '{}')
      });
    } catch (err) {
      setTimetable(DEFAULT_TIMETABLE);
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        fees: parseFloat(form.fees) || 0.0,
        timetableJson: JSON.stringify(timetable)
      };

      if (editingBatch) {
        await apiRequest(`/batches/${editingBatch.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/batches', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to delete batch "${name}"?`)) {
      try {
        await apiRequest(`/batches/${id}`, {
          method: 'DELETE'
        });
        loadData();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  const handleTeacherToggle = (teacherId) => {
    setForm(prev => {
      const ids = [...prev.teacherIds];
      const index = ids.indexOf(teacherId);
      if (index > -1) {
        ids.splice(index, 1);
      } else {
        ids.push(teacherId);
      }
      return { ...prev, teacherIds: ids };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Class & Batch Scheduler</h1>
          <p className="text-slate-400 text-sm mt-0.5">Define student batch timetable, timing, and assign teachers</p>
        </div>
        {user.role !== 'TEACHER' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/15 text-sm transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            Add New Batch Class
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading timetables...</p>
        </div>
      ) : batches.length > 0 ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {batches.map(bt => {
            let parsedTimetable = {};
            try {
              parsedTimetable = JSON.parse(bt.timetableJson || '{}');
            } catch (e) {}

            return (
              <motion.div
                whileHover={{ y: -3 }}
                key={bt.id}
                className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-6 hover-glow-cyan flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/25">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg font-outfit">{bt.name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Timings: <span className="text-cyan-400 font-semibold">{bt.timing}</span></p>
                      </div>
                    </div>
                    {user.role !== 'TEACHER' && (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20">
                        ₹{bt.fees.toLocaleString()}/yr
                      </span>
                    )}
                  </div>

                  {/* Subjects / Teachers info */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 border border-slate-900 rounded-xl p-3.5">
                    <div>
                      <p className="text-slate-500 font-semibold uppercase tracking-wider mb-1">Subjects Covered</p>
                      <p className="text-slate-200">{bt.subjects || 'None specified'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 font-semibold uppercase tracking-wider mb-1">Assigned Teachers</p>
                      <p className="text-slate-200">
                        {bt.teachers && bt.teachers.length > 0
                          ? bt.teachers.map(t => t.name).join(', ')
                          : 'None assigned'}
                      </p>
                    </div>
                  </div>

                  {/* Timetable Display */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-cyan-400" />
                      Timetable Schedule
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {Object.keys(DEFAULT_TIMETABLE).map(day => (
                        <div key={day} className="p-2 bg-slate-900/60 border border-slate-800/80 rounded-lg text-center">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">{day.slice(0, 3)}</p>
                          <p className="text-[11px] text-slate-200 truncate mt-1">
                            {parsedTimetable[day] || 'Off'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {user.role !== 'TEACHER' && (
                  <div className="flex gap-2 pt-4 border-t border-slate-800/60 mt-4">
                    <button
                      onClick={() => handleOpenEdit(bt)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-lg text-xs text-blue-400 font-semibold"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit Timetable
                    </button>
                    <button
                      onClick={() => handleDelete(bt.id, bt.name)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-xs text-rose-400 font-semibold ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Batch
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
          <p className="text-slate-500 text-sm font-outfit">No batch schedules exist yet.</p>
        </div>
      )}

      {/* CREATE & EDIT SCHEDULER MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl p-6 rounded-2xl border border-blue-500/25 max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">
              {editingBatch ? 'Modify Class Schedule' : 'Schedule New Batch Class'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6 text-sm">
              
              {/* Core Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Batch Name (E.g. 10th Tuition Classes)</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. 10th Tuition"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Timing Description</label>
                  <input
                    type="text" required
                    value={form.timing}
                    onChange={(e) => setForm({ ...form, timing: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. 4:00 PM - 6:00 PM"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Subjects List (Comma Separated)</label>
                  <input
                    type="text" required
                    value={form.subjects}
                    onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="Maths, Science, English"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Annual Standard Fee (₹)</label>
                  <input
                    type="number" required
                    value={form.fees}
                    onChange={(e) => setForm({ ...form, fees: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    placeholder="E.g. 35000"
                  />
                </div>
              </div>

              {/* Assign Teachers */}
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-2">Assign Subject Faculty Members</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-xl">
                  {teachers.map(t => {
                    const isChecked = form.teacherIds.includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer p-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTeacherToggle(t.id)}
                          className="rounded bg-slate-950 border-slate-700 text-orange-500 focus:ring-0"
                        />
                        <span>{t.name} ({t.subject})</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Timetable schedule input */}
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-2">Timetable slot timings</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {Object.keys(DEFAULT_TIMETABLE).map(day => (
                    <div key={day} className="flex items-center gap-2">
                      <span className="w-16 text-xs text-slate-400 font-semibold uppercase">{day.slice(0, 3)}:</span>
                      <input
                        type="text"
                        value={timetable[day]}
                        onChange={(e) => setTimetable({ ...timetable, [day]: e.target.value })}
                        className="flex-1 bg-[#070d1e] border border-slate-700/60 rounded-lg p-1.5 text-xs text-white"
                        placeholder="E.g. Maths (4PM) or Off"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl"
                >
                  {editingBatch ? 'Save Timetable' : 'Create Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
