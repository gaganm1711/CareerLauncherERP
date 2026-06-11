import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, Edit2, Trash2, Camera, User, FileSpreadsheet, GraduationCap } from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';


export default function Students({ user }) {
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filters
  const [search, setSearch] = useState('');
  const [batchId, setBatchId] = useState('');
  const [status, setStatus] = useState('');

  // Form Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [form, setForm] = useState({
    name: '', lastName: '', email: '', phone: '', parentName: '', parentPhone: '',
    batchId: '', batchIds: [], totalCourseFee: '', advancePay: '', emiMonths: '6', status: 'ACTIVE',
    fatherOccupation: '', motherName: '', motherOccupation: '', dob: '', gender: '',
    bloodGroup: '', category: '', address: '', city: '', state: '', pincode: '', whatsapp: '', schoolName: ''
  });

  // Promotion States
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promotingStudent, setPromotingStudent] = useState(null);
  const [promoteForm, setPromoteForm] = useState({
    targetBatchId: '',
    promotionStatus: 'ACTIVE'
  });

  const handleOpenPromote = (student) => {
    setPromotingStudent(student);
    setPromoteForm({
      targetBatchId: '',
      promotionStatus: 'ACTIVE'
    });
    setShowPromoteModal(true);
  };

  const handlePromoteSubmit = async (e) => {
    e.preventDefault();
    try {
      await apiRequest(`/students/${promotingStudent.id}/promote`, {
        method: 'POST',
        body: JSON.stringify(promoteForm)
      });
      setShowPromoteModal(false);
      loadData();
    } catch (err) {
      alert(`Promotion failed: ${err.message}`);
    }
  };


  const loadData = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({
        search,
        batchId,
        status
      }).toString();
      
      const data = await apiRequest(`/students?${query}`);
      setStudents(data);
      
      const batchesData = await apiRequest('/batches');
      setBatches(batchesData);
    } catch (err) {
      setError(err.message || 'Failed to load directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, batchId, status]);

  useEffect(() => {
    const handleUpdate = () => {
      console.log('[SOCKET] Students reloading due to student change event...');
      loadData();
    };
    socketService.on('student_change', handleUpdate);
    return () => {
      socketService.off('student_change', handleUpdate);
    };
  }, [search, batchId, status]);

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setPhotoBase64(null);
    setForm({
      name: '', lastName: '', email: '', phone: '', parentName: '', parentPhone: '',
      batchId: '', batchIds: [], totalCourseFee: '', advancePay: '', emiMonths: '6', status: 'ACTIVE',
      fatherOccupation: '', motherName: '', motherOccupation: '', dob: '', gender: '',
      bloodGroup: '', category: '', address: '', city: '', state: '', pincode: '', whatsapp: '', schoolName: ''
    });
    setShowFormModal(true);
  };

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setPhotoBase64(student.photo);
    setForm({
      name: student.name,
      lastName: student.lastName || '',
      email: student.email || '',
      phone: student.phone || '',
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      batchId: student.batchId || '',
      batchIds: student.batchMappings ? student.batchMappings.map(m => m.batchId) : (student.batchId ? [student.batchId] : []),
      totalCourseFee: student.totalCourseFee.toString(),
      advancePay: student.advancePay.toString(),
      emiMonths: student.emiMonths.toString(),
      status: student.status,
      fatherOccupation: student.fatherOccupation || '',
      motherName: student.motherName || '',
      motherOccupation: student.motherOccupation || '',
      dob: student.dob || '',
      gender: student.gender || '',
      bloodGroup: student.bloodGroup || '',
      category: student.category || '',
      address: student.address || '',
      city: student.city || '',
      state: student.state || '',
      pincode: student.pincode || '',
      whatsapp: student.whatsapp || '',
      schoolName: student.schoolName || ''
    });
    setShowFormModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!form.batchIds || form.batchIds.length === 0) {
        alert('Please select at least one batch class.');
        return;
      }
      const payload = {
        ...form,
        photo: photoBase64,
        batchId: form.batchIds[0], // primary batch for fallback compatibility
        totalCourseFee: parseFloat(form.totalCourseFee) || 0,
        advancePay: parseFloat(form.advancePay) || 0,
        emiMonths: parseInt(form.emiMonths, 10) || 6
      };

      if (editingStudent) {
        await apiRequest(`/students/${editingStudent.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        await apiRequest('/students', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      setShowFormModal(false);
      loadData();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to delete student "${name}"?`)) {
      try {
        await apiRequest(`/students/${id}`, {
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
      {/* Header and Add button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Student Directory</h1>
          <p className="text-slate-400 text-sm mt-0.5">Search and manage coaching center student enrollments</p>
        </div>
        {user.role !== 'TEACHER' && (
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/15 text-sm transition-all"
          >
            <UserPlus className="h-4.5 w-4.5" />
            Add Student
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 border border-blue-500/15">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search by student name or roll number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 pl-10 pr-4 text-white text-sm outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <div className="grid grid-cols-2 md:flex gap-4">
          <select
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500"
          >
            <option value="">All Batches</option>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Student List View */}
      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Filtering student records...</p>
        </div>
      ) : students.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {students.map(st => (
            <motion.div
              whileHover={{ y: -3 }}
              key={st.id}
              className="glass-panel p-5 rounded-2xl border border-blue-500/15 flex gap-4 hover-glow-cyan"
            >
              {/* Profile Image (base64 or default) */}
              <div className="h-16 w-16 rounded-xl bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                {st.photo ? (
                  <img src={st.photo} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-7 w-7 text-slate-600" />
                )}
              </div>

              {/* Text Info */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">
                    {st.rollNumber}
                  </span>
                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${
                    st.status === 'ACTIVE' ? 'text-emerald-400 bg-emerald-400/10 border border-emerald-400/20' : 'text-slate-400 bg-slate-400/10 border border-slate-400/20'
                  }`}>
                    {st.status}
                  </span>
                </div>
                <h3 className="font-bold text-white text-base truncate font-outfit">
                  {st.name} {st.lastName || ''}
                </h3>
                <p className="text-xs text-slate-400 truncate">Class Batch: <span className="text-slate-200">
                  {st.batchMappings && st.batchMappings.length > 0 
                    ? st.batchMappings.map(m => m.batch?.name).join(', ') 
                    : (st.batch?.name || 'Unassigned')}
                </span></p>
                <p className="text-xs text-slate-400 truncate">Parent Phone: <span className="text-slate-200">{st.parentPhone}</span></p>
                
                {/* Actions */}
                {user.role !== 'TEACHER' && (
                  <div className="flex gap-2 pt-3 border-t border-slate-800/60 mt-3">
                    <button
                      onClick={() => handleOpenEdit(st)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 rounded-lg text-xs text-blue-400 font-semibold transition-colors"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleOpenPromote(st)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg text-xs text-emerald-400 font-semibold transition-colors"
                    >
                      <GraduationCap className="h-3.5 w-3.5" />
                      Promote
                    </button>
                    <button
                      onClick={() => handleDelete(st.id, `${st.name} ${st.lastName || ''}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 rounded-lg text-xs text-rose-400 font-semibold transition-colors ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
          <p className="text-slate-500 text-sm font-outfit">No students found matching filters.</p>
        </div>
      )}

      {/* CREATE & EDIT FORM MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-3xl p-6 rounded-2xl border border-blue-500/25 max-h-[90vh] overflow-y-auto relative">
            <h3 className="text-xl font-bold text-white font-outfit mb-4">
              {editingStudent ? 'Edit Student Details' : 'New Admission Registration'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-6 text-sm">
              {/* Photo Upload Row */}
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center relative group">
                  {photoBase64 ? (
                    <img src={photoBase64} alt="Upload Preview" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-8 w-8 text-slate-700" />
                  )}
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="h-5 w-5 text-white" />
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
                <div>
                  <h4 className="font-semibold text-white">Profile Photo</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Upload student profile portrait (Base64 encoding)</p>
                  <label className="inline-block mt-2 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 rounded-lg cursor-pointer transition-colors">
                    Choose File
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">First Name</label>
                  <input
                    type="text" required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Last Name</label>
                  <input
                    type="text" required
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-300 font-semibold mb-2">Class Batches (Select multiple if applicable)</label>
                  <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto p-3 bg-[#070d1e]/80 border border-slate-700/60 rounded-xl">
                    {batches.map(b => {
                      const isChecked = form.batchIds?.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 cursor-pointer text-xs text-slate-300 hover:text-white transition-colors">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updatedBatchIds = e.target.checked
                                ? [...(form.batchIds || []), b.id]
                                : (form.batchIds || []).filter(id => id !== b.id);
                              setForm({ ...form, batchIds: updatedBatchIds });
                            }}
                            className="accent-orange-500 rounded border-slate-700 bg-slate-800"
                          />
                          <span>{b.name} <span className="text-slate-500 text-[10px]">({b.timing})</span></span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Parent Contact Name</label>
                  <input
                    type="text" required
                    value={form.parentName}
                    onChange={(e) => setForm({ ...form, parentName: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Parent Phone Number</label>
                  <input
                    type="text" required
                    value={form.parentPhone}
                    onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Student Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">WhatsApp No</label>
                  <input
                    type="text"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm({ ...form, gender: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  >
                    <option value="">Select Gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Blood Group</label>
                  <input
                    type="text"
                    placeholder="E.g. A+"
                    value={form.bloodGroup}
                    onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="General, OBC, SC, ST"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">School Name</label>
                  <input
                    type="text"
                    value={form.schoolName}
                    onChange={(e) => setForm({ ...form, schoolName: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Total Course Fee (₹)</label>
                  <input
                    type="number" required
                    disabled={!!editingStudent}
                    value={form.totalCourseFee}
                    onChange={(e) => setForm({ ...form, totalCourseFee: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white disabled:opacity-50"
                  />
                </div>
                {!editingStudent && (
                  <>
                    <div>
                      <label className="block text-xs text-slate-300 font-semibold mb-1">Advance Deposit (₹)</label>
                      <input
                        type="number" required
                        value={form.advancePay}
                        onChange={(e) => setForm({ ...form, advancePay: e.target.value })}
                        className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 font-semibold mb-1">EMI tenure duration (Months)</label>
                      <select
                        value={form.emiMonths}
                        onChange={(e) => setForm({ ...form, emiMonths: e.target.value })}
                        className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                      >
                        <option value="6">6 Months</option>
                        <option value="12">1 Year (12 Months)</option>
                        <option value="24">2 Years (24 Months)</option>
                        <option value="36">3 Years (36 Months)</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Extended Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Father's Occupation</label>
                  <input
                    type="text"
                    value={form.fatherOccupation}
                    onChange={(e) => setForm({ ...form, fatherOccupation: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Mother's Name & Occupation</label>
                  <div className="flex gap-2">
                    <input
                      type="text" placeholder="Mother Name"
                      value={form.motherName}
                      onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                      className="w-1/2 bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    />
                    <input
                      type="text" placeholder="Occupation"
                      value={form.motherOccupation}
                      onChange={(e) => setForm({ ...form, motherOccupation: e.target.value })}
                      className="w-1/2 bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-slate-300 font-semibold mb-1">Address Location</label>
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 md:col-span-2">
                  <div>
                    <input
                      type="text" placeholder="City"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text" placeholder="State"
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text" placeholder="Pincode"
                      value={form.pincode}
                      onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                      className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl"
                >
                  {editingStudent ? 'Save Details' : 'Register Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROMOTION FORM MODAL */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-emerald-500/25 relative animate-fade-in">
            <h3 className="text-xl font-bold text-white font-outfit mb-2 flex items-center gap-2">
              <GraduationCap className="text-emerald-400 h-6 w-6" />
              Promote / Graduate Student
            </h3>
            <p className="text-slate-400 text-xs mb-4">
              Promote <span className="text-white font-semibold">{promotingStudent?.name} {promotingStudent?.lastName}</span> ({promotingStudent?.rollNumber}) to a new batch/class tier.
            </p>
            
            <form onSubmit={handlePromoteSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Target Batch Class</label>
                <select
                  required
                  value={promoteForm.targetBatchId}
                  onChange={(e) => setPromoteForm({ ...promoteForm, targetBatchId: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="">-- Choose Target Batch --</option>
                  {batches
                    .filter(b => b.id !== promotingStudent?.batchId)
                    .map(b => (
                      <option key={b.id} value={b.id}>{b.name} ({b.timing})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Promotion Status</label>
                <select
                  value={promoteForm.promotionStatus}
                  onChange={(e) => setPromoteForm({ ...promoteForm, promotionStatus: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="ACTIVE">ACTIVE (Remains Active in ERP)</option>
                  <option value="PROMOTED">PROMOTED (Graduated from current batch)</option>
                  <option value="COMPLETED">COMPLETED (Course Finished)</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl text-xs flex items-center gap-1"
                >
                  Confirm Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
