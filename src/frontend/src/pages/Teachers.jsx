import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { UserCheck, Phone, Mail, Award, DollarSign, Plus, Trash2, Edit } from 'lucide-react';
import { apiRequest } from '../api';

export default function Teachers({ user }) {
  const [teachers, setTeachers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  
  const [form, setForm] = useState({
    name: '', email: '', phone: '', salary: '', subject: '', userId: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/teachers');
      setTeachers(data);
      
      // Load users so they can be optionally mapped to teacher profiles
      const settingsConfig = await apiRequest('/settings'); // settings handles it or we query a user list
      // Let's create a query if we have subadmins/teachers. Actually, to list users we can get audit log users or simply have select fields.
      // To bypass users listing issue, we can just allow raw string input or a preset list. Let's list users from backend if available, or just omit/load mock.
      // Wait, we can fetch all users if the backend has users. Let's check: in backend routes we don't have a specific get all users route, but we can write one or just query it.
      // Since it's not strictly necessary, we can just write an option for User Account connection or select from predefined roles.
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
    setEditingTeacher(null);
    setForm({ name: '', email: '', phone: '', salary: '', subject: '', userId: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (teacher) => {
    setEditingTeacher(teacher);
    setForm({
      name: teacher.name,
      email: teacher.email,
      phone: teacher.phone,
      salary: teacher.salary.toString(),
      subject: teacher.subject,
      userId: teacher.userId || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        salary: parseFloat(form.salary) || 0.0,
        userId: form.userId || null
      };

      if (editingTeacher) {
        await apiRequest(`/teachers/${editingTeacher.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/teachers', {
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
    if (confirm(`Are you sure you want to delete teacher "${name}"?`)) {
      try {
        await apiRequest(`/teachers/${id}`, {
          method: 'DELETE'
        });
        loadData();
      } catch (err) {
        alert(`Delete failed: ${err.message}`);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Faculty Roster</h1>
          <p className="text-slate-400 text-sm mt-0.5">Manage teachers list, subject experts, and salaries</p>
        </div>
        {user.role !== 'TEACHER' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/15 text-sm transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            Add Faculty Member
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Fetching faculty roster...</p>
        </div>
      ) : teachers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map(tc => (
            <motion.div
              whileHover={{ y: -3 }}
              key={tc.id}
              className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/25">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg font-outfit">{tc.name}</h3>
                  <span className="text-[10px] font-bold text-cyan-400 uppercase bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                    {tc.subject} Expert
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-500" />
                  <span>{tc.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-500" />
                  <span>{tc.email}</span>
                </div>
                {user.role !== 'TEACHER' && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-slate-500" />
                    <span>Monthly Salary: <strong className="text-white">₹{tc.salary.toLocaleString()}</strong></span>
                  </div>
                )}
              </div>

              {user.role !== 'TEACHER' && (
                <div className="flex gap-2 pt-4 border-t border-slate-800/60">
                  <button
                    onClick={() => handleOpenEdit(tc)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-lg text-xs text-blue-400 font-semibold"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tc.id, tc.name)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-xs text-rose-400 font-semibold ml-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
          <p className="text-slate-500 text-sm font-outfit">No faculty members registered.</p>
        </div>
      )}

      {/* CREATE & EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-blue-500/25 relative">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">
              {editingTeacher ? 'Edit Faculty Member' : 'Register Faculty Member'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Full Name</label>
                <input
                  type="text" required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. Prof. Rajesh Kumar"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Subject Expertise</label>
                <input
                  type="text" required
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. Physics, Mathematics"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Contact Phone</label>
                <input
                  type="text" required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="10 digit number"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Email Address</label>
                <input
                  type="email" required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. rajesh@email.com"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Monthly Salary (₹)</label>
                <input
                  type="number" required
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. 45000"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl"
                >
                  {editingTeacher ? 'Save Details' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
