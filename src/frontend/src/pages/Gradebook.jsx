import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Award, Plus, Sparkles, AlertCircle, Save, Trash2, Search, ArrowLeft, TrendingUp, BarChart2, BookOpen, X, Edit2 } from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';

export default function Gradebook({ user }) {
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [examSheet, setExamSheet] = useState(null);
  const [editingExam, setEditingExam] = useState(null);
  
  // Create Test Form
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [testForm, setTestForm] = useState({
    name: '', subject: '', date: new Date().toISOString().split('T')[0], totalMarks: '', batchId: ''
  });

  // Grade Entry Form State
  const [grades, setGrades] = useState([]);
  const [saving, setSaving] = useState(false);

  // Tab State
  const [activeTab, setActiveTab] = useState('grades'); // 'grades' | 'progress'

  // Student progress state
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [performanceData, setPerformanceData] = useState([]);
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const loadInitialData = async () => {
    try {
      const batchesData = await apiRequest('/batches');
      setBatches(batchesData);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStudents = async () => {
    try {
      const data = await apiRequest('/students?status=ACTIVE');
      setStudents(data);
    } catch (err) {
      console.error('Failed to load students:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'progress' && students.length === 0) {
      loadStudents();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleExamUpdate = (data) => {
      console.log('[SOCKET] Exam change event received. Reloading exams...');
      if (activeTab === 'grades') {
        loadExamsForBatch();
        loadExamSheet();
      } else if (activeTab === 'progress' && selectedStudent) {
        apiRequest(`/students/${selectedStudent.id}/performance`)
          .then(res => setPerformanceData(res.performance || []))
          .catch(console.error);
      }
    };

    const handleStudentUpdate = () => {
      if (activeTab === 'progress') {
        loadStudents();
      }
    };

    socketService.on('exam_change', handleExamUpdate);
    socketService.on('student_change', handleStudentUpdate);

    return () => {
      socketService.off('exam_change', handleExamUpdate);
      socketService.off('student_change', handleStudentUpdate);
    };
  }, [selectedBatchId, selectedExamId, selectedStudent, activeTab]);

  const handleSelectStudent = async (student) => {
    setLoadingProgress(true);
    setSelectedStudent(student);
    try {
      const res = await apiRequest(`/students/${student.id}/performance`);
      setPerformanceData(res.performance || []);
    } catch (err) {
      alert(`Failed to load student performance: ${err.message}`);
      setSelectedStudent(null);
    } finally {
      setLoadingProgress(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!selectedExamId) return;
    const examName = exams.find(e => e.id === selectedExamId)?.name || 'this examination';
    if (!window.confirm(`Are you sure you want to delete "${examName}"? This will permanently delete all student marks associated with this exam. This action cannot be undone.`)) {
      return;
    }
    try {
      await apiRequest(`/exams/${selectedExamId}`, {
        method: 'DELETE'
      });
      alert('Examination deleted successfully!');
      setSelectedExamId('');
      setExamSheet(null);
      loadExamsForBatch();
    } catch (err) {
      alert(`Failed to delete examination: ${err.message}`);
    }
  };

  const loadExamsForBatch = async () => {
    if (!selectedBatchId) return;
    try {
      const data = await apiRequest(`/exams?batchId=${selectedBatchId}`);
      setExams(data);
      setSelectedExamId('');
      setExamSheet(null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadExamsForBatch();
  }, [selectedBatchId]);

  const loadExamSheet = async () => {
    if (!selectedExamId) return;
    try {
      const data = await apiRequest(`/exams/${selectedExamId}/marks`);
      setExamSheet(data.exam);
      setGrades(data.sheet);
    } catch (err) {
      alert(`Failed to load grades: ${err.message}`);
    }
  };

  useEffect(() => {
    loadExamSheet();
  }, [selectedExamId]);

  const handleOpenEditExam = () => {
    const selectedExam = exams.find(e => e.id === selectedExamId);
    if (!selectedExam) return;
    setEditingExam(selectedExam);
    setTestForm({
      name: selectedExam.name,
      subject: selectedExam.subject,
      date: selectedExam.date,
      totalMarks: selectedExam.totalMarks.toString(),
      batchId: selectedExam.batchId
    });
    setShowCreateTest(true);
  };

  const handleCreateTest = async (e) => {
    e.preventDefault();
    try {
      if (editingExam) {
        await apiRequest(`/exams/${editingExam.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...testForm,
            batchId: selectedBatchId
          })
        });
        alert('Test updated successfully!');
      } else {
        await apiRequest('/exams', {
          method: 'POST',
          body: JSON.stringify({
            ...testForm,
            batchId: selectedBatchId
          })
        });
        alert('Test registered successfully!');
      }
      setShowCreateTest(false);
      setEditingExam(null);
      setTestForm({
        name: '', subject: '', date: new Date().toISOString().split('T')[0], totalMarks: '', batchId: ''
      });
      loadExamsForBatch();
      if (editingExam) {
        loadExamSheet();
      }
    } catch (err) {
      alert(`Operation failed: ${err.message}`);
    }
  };

  const handleGradeChange = (studentId, value) => {
    // Allow empty string, numbers, and a single decimal point
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      // Don't allow entering a value higher than the exam's total maximum marks
      const floatVal = parseFloat(value);
      if (!isNaN(floatVal) && examSheet?.totalMarks && floatVal > examSheet.totalMarks) {
        return;
      }
      setGrades(prev => prev.map(g => {
        if (g.studentId === studentId) {
          return { ...g, marksObtained: value };
        }
        return g;
      }));
    }
  };

  const handleRemarksChange = (studentId, remarks) => {
    setGrades(prev => prev.map(g => {
      if (g.studentId === studentId) {
        return { ...g, remarks };
      }
      return g;
    }));
  };

  const handleSaveGrades = async () => {
    if (!selectedExamId) return;
    try {
      setSaving(true);
      
      // Filter out empty rows
      const payload = grades.map(g => ({
        studentId: g.studentId,
        marksObtained: g.marksObtained === '' ? '' : parseFloat(g.marksObtained),
        remarks: g.remarks
      }));

      await apiRequest(`/exams/${selectedExamId}/marks`, {
        method: 'POST',
        body: JSON.stringify({ marks: payload })
      });

      alert('Grades saved successfully!');
      loadExamSheet();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const calculatePerformanceMetrics = () => {
    if (grades.length === 0 || !examSheet) return { average: 0, highest: 0, lowest: 0 };
    
    const scores = grades
      .map(g => parseFloat(g.marksObtained))
      .filter(val => !isNaN(val));
      
    if (scores.length === 0) return { average: 0, highest: 0, lowest: 0 };

    const sum = scores.reduce((s, v) => s + v, 0);
    const average = sum / scores.length;
    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    
    return {
      average: parseFloat(average.toFixed(1)),
      highest,
      lowest
    };
  };

  const totalExams = performanceData.length;
  const overallAvg = totalExams > 0 ? parseFloat((performanceData.reduce((sum, p) => sum + p.percentage, 0) / totalExams).toFixed(1)) : 0;
  const highestScore = totalExams > 0 ? Math.max(...performanceData.map(p => p.percentage)) : 0;
  const outperformedCount = performanceData.filter(p => p.percentage > p.classAverage).length;

  const getX = (index) => {
    if (performanceData.length <= 1) return 40 + (500 - 40 - 20) / 2;
    return 40 + (index / (performanceData.length - 1)) * (500 - 40 - 20);
  };
  
  const getY = (percentage) => {
    return 20 + (1 - percentage / 100) * (220 - 20 - 30);
  };

  const studentPathD = performanceData.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(d.percentage)}`).join(' ');
  const classPathD = performanceData.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(d.classAverage)}`).join(' ');

  const getSubjectAverages = () => {
    const subjects = {};
    performanceData.forEach(p => {
      const subj = p.subject || 'General';
      if (!subjects[subj]) {
        subjects[subj] = { sum: 0, count: 0 };
      }
      subjects[subj].sum += p.percentage;
      subjects[subj].count += 1;
    });

    return Object.keys(subjects).map(name => ({
      name,
      average: parseFloat((subjects[name].sum / subjects[name].count).toFixed(1))
    }));
  };

  const subjectAverages = getSubjectAverages();
  const subjectColors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  const getDonutPath = (cx, cy, rx, ry, startPercent, endPercent, innerRadiusFraction) => {
    const adjustedEndPercent = endPercent >= 0.9999 ? 0.9999 : endPercent;
    const startAngle = (startPercent - 0.25) * 2 * Math.PI;
    const endAngle = (adjustedEndPercent - 0.25) * 2 * Math.PI;
    
    const x1 = cx + rx * Math.cos(startAngle);
    const y1 = cy + ry * Math.sin(startAngle);
    const x2 = cx + rx * Math.cos(endAngle);
    const y2 = cy + ry * Math.sin(endAngle);
    
    const innerR = rx * innerRadiusFraction;
    const ix1 = cx + innerR * Math.cos(startAngle);
    const iy1 = cy + innerR * Math.sin(startAngle);
    const ix2 = cx + innerR * Math.cos(endAngle);
    const iy2 = cy + innerR * Math.sin(endAngle);
    
    const largeArcFlag = adjustedEndPercent - startPercent > 0.5 ? 1 : 0;
    
    return `
      M ${x1} ${y1}
      A ${rx} ${ry} 0 ${largeArcFlag} 1 ${x2} ${y2}
      L ${ix2} ${iy2}
      A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${ix1} ${iy1}
      Z
    `;
  };

  let currentPercent = 0;
  const donutSlices = subjectAverages.map((sub, idx) => {
    const val = sub.average;
    const total = subjectAverages.reduce((sum, s) => sum + s.average, 0) || 1;
    const slicePercent = val / total;
    const start = currentPercent;
    const end = currentPercent + slicePercent;
    currentPercent = end;

    const pathD = getDonutPath(100, 100, 70, 70, start, end, 0.65);
    const color = subjectColors[idx % subjectColors.length];
    
    return {
      name: sub.name,
      average: sub.average,
      pathD,
      color,
      percent: Math.round(slicePercent * 100)
    };
  });

  const filteredStudents = students.filter(st => {
    const fullName = `${st.name} ${st.lastName || ''}`.toLowerCase();
    const roll = (st.rollNumber || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return fullName.includes(query) || roll.includes(query);
  });

  const metrics = calculatePerformanceMetrics();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Grade Book</h1>
          <p className="text-slate-400 text-sm mt-0.5">Register tests and track individual student grade performance</p>
        </div>
        {activeTab === 'grades' && selectedBatchId && user.role !== 'TEACHER' && (
          <button
            onClick={() => {
              setEditingExam(null);
              setTestForm({
                name: '', subject: '', date: new Date().toISOString().split('T')[0], totalMarks: '', batchId: ''
              });
              setShowCreateTest(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/15 text-sm transition-all"
          >
            <Plus className="h-4.5 w-4.5" />
            Register New Test
          </button>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-800/80 gap-6">
        <button
          onClick={() => setActiveTab('grades')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'grades' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Grade Entry & Sheets
          {activeTab === 'grades' && (
            <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === 'progress' ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Student Progress Dashboard
          {activeTab === 'progress' && (
            <motion.div layoutId="activeTabLine" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
          )}
        </button>
      </div>

      {activeTab === 'grades' ? (
        <>
          {/* Control Panel */}
          <div className="glass-panel p-4 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 border border-blue-500/15">
            <div>
              <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Class Batch</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500"
              >
                <option value="">-- Select Batch Class --</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Choose Examination</label>
              <div className="flex gap-2">
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  disabled={!selectedBatchId}
                  className="flex-1 bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2 px-4 text-white text-sm outline-none focus:border-blue-500 disabled:opacity-50"
                >
                  <option value="">-- Choose Registered Exam --</option>
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.subject}) - {e.date}</option>
                  ))}
                </select>
                {selectedExamId && user.role !== 'TEACHER' && (
                  <>
                    <button
                      onClick={handleOpenEditExam}
                      title="Edit this examination details"
                      className="px-3 bg-blue-500/20 hover:bg-blue-500 text-blue-400 hover:text-white rounded-xl border border-blue-500/35 transition-all flex items-center justify-center"
                    >
                      <Edit2 className="h-4.5 w-4.5" />
                    </button>
                    <button
                      onClick={handleDeleteExam}
                      title="Delete this examination"
                      className="px-3 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/35 transition-all flex items-center justify-center"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Performance Summary analytics */}
          {examSheet && grades.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="glass-panel p-4 rounded-2xl border border-blue-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Class Average</p>
                  <h4 className="text-2xl font-black text-white mt-1 font-outfit">
                    {metrics.average} <span className="text-xs text-slate-400 font-normal">/ {examSheet.totalMarks}M</span>
                  </h4>
                </div>
                <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
              </div>
              
              <div className="glass-panel p-4 rounded-2xl border border-blue-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Highest Marks</p>
                  <h4 className="text-2xl font-black text-emerald-400 mt-1 font-outfit">
                    {metrics.highest} <span className="text-xs text-slate-400 font-normal">/ {examSheet.totalMarks}M</span>
                  </h4>
                </div>
                <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                  <Award className="h-6 w-6" />
                </div>
              </div>

              <div className="glass-panel p-4 rounded-2xl border border-blue-500/10 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lowest Score</p>
                  <h4 className="text-2xl font-black text-rose-400 mt-1 font-outfit">
                    {metrics.lowest} <span className="text-xs text-slate-400 font-normal">/ {examSheet.totalMarks}M</span>
                  </h4>
                </div>
                <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400">
                  <AlertCircle className="h-6 w-6" />
                </div>
              </div>
            </div>
          )}

          {/* Grade entry sheet */}
          {selectedExamId ? (
            grades.length > 0 ? (
              <div className="space-y-4">
                <div className="glass-panel rounded-2xl border border-blue-500/15 overflow-hidden">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-4">Roll Number</th>
                        <th className="p-4">Student Name</th>
                        <th className="p-4 text-center w-40">Marks Obtained (Max: {examSheet?.totalMarks})</th>
                        <th className="p-4">Remarks / Grading Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {grades.map(row => (
                        <tr key={row.studentId} className="hover:bg-slate-900/35 transition-colors">
                          <td className="p-4 font-mono text-cyan-400 text-xs font-bold">{row.rollNumber}</td>
                          <td className="p-4 font-bold text-white font-outfit">{row.name}</td>
                          <td className="p-4 text-center">
                            <input
                              type="text"
                              value={row.marksObtained}
                              onChange={(e) => handleGradeChange(row.studentId, e.target.value)}
                              className="w-24 bg-slate-950 border border-slate-850 rounded-lg p-1.5 text-center text-white font-bold"
                              placeholder="Marks"
                            />
                          </td>
                          <td className="p-4">
                            <input
                              type="text"
                              value={row.remarks}
                              onChange={(e) => handleRemarksChange(row.studentId, e.target.value)}
                              className="w-full bg-[#070d1e] border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                              placeholder="Grade comments..."
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {user.role !== 'TEACHER' && (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={handleSaveGrades}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/10 text-sm transition-all"
                    >
                      <Save className="h-4.5 w-4.5" />
                      {saving ? 'Saving...' : 'Save Student Grades'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-xs text-center py-12">No active students registered in this class.</p>
            )
          ) : (
            <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800 flex flex-col items-center justify-center gap-2">
              <AlertCircle className="h-8 w-8 text-slate-500" />
              <p className="text-slate-500 text-sm font-outfit">Please choose a Class Batch and Examination to record test grades.</p>
            </div>
          )}
        </>
      ) : (
        /* Student Academic Progress View */
        selectedStudent ? (
          loadingProgress ? (
            <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800 flex flex-col items-center justify-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="text-slate-400 text-sm">Computing student performance telemetry...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Back & Profile Header */}
              <div>
                <button
                  onClick={() => setSelectedStudent(null)}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 rounded-xl text-xs font-semibold border border-slate-700/50 transition-all mb-4"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Search
                </button>
                <div className="glass-panel p-5 rounded-2xl border border-blue-500/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-[#0d1527] to-[#070d1e]">
                  <div>
                    <h2 className="text-xl font-bold text-white font-outfit">{selectedStudent.name} {selectedStudent.lastName || ''}</h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Roll Number: <span className="font-mono text-cyan-400 font-bold">{selectedStudent.rollNumber}</span>
                      <span className="mx-2 text-slate-600">|</span>
                      Batch: <span className="text-blue-400 font-semibold">{selectedStudent.batch ? selectedStudent.batch.name : 'General'}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                    <BookOpen className="h-4.5 w-4.5" />
                    <span className="text-xs font-bold font-outfit tracking-wide uppercase">Academic Progress Report</span>
                  </div>
                </div>
              </div>

              {/* Performance Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between bg-slate-900/10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Exams Attempted</p>
                    <h4 className="text-2xl font-black text-white mt-1 font-outfit">{totalExams}</h4>
                  </div>
                  <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between bg-slate-900/10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Academic Avg %</p>
                    <h4 className="text-2xl font-black text-cyan-400 mt-1 font-outfit">{overallAvg}%</h4>
                  </div>
                  <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between bg-slate-900/10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Highest Score</p>
                    <h4 className="text-2xl font-black text-emerald-400 mt-1 font-outfit">{highestScore}%</h4>
                  </div>
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                    <Award className="h-5 w-5" />
                  </div>
                </div>

                <div className="glass-panel p-4 rounded-xl border border-slate-800/80 flex items-center justify-between bg-slate-900/10">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">vs. Class Average</p>
                    <h4 className="text-xl font-black text-amber-400 mt-1.5 font-outfit">
                      {totalExams > 0 ? `${outperformedCount} / ${totalExams} Tests` : '0 / 0 Tests'}
                    </h4>
                    <p className="text-[8px] text-slate-400 mt-0.5">Outperformed overall class avg</p>
                  </div>
                  <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-400">
                    <BarChart2 className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {totalExams === 0 ? (
                <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800 flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-8 w-8 text-slate-500" />
                  <p className="text-slate-500 text-sm font-outfit">No examination records or grades found for this student.</p>
                </div>
              ) : (
                <>
                  {/* Interactive SVG Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Line Chart */}
                    <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 relative overflow-hidden bg-slate-900/5">
                      <div>
                        <h3 className="text-sm font-bold text-white font-outfit tracking-wide">Academic Score Trend</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Comparison of student test percentage with class averages</p>
                      </div>
                      <div className="relative h-60 w-full flex items-center justify-center">
                        <svg className="w-full h-full" viewBox="0 0 500 240" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="studentGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                            </linearGradient>
                          </defs>
                          
                          {/* Grid lines */}
                          {[0, 25, 50, 75, 100].map(p => (
                            <g key={p}>
                              <line
                                x1="40"
                                y1={getY(p)}
                                x2="480"
                                y2={getY(p)}
                                stroke="#1e293b"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />
                              <text x="30" y={getY(p) + 4} fill="#64748b" className="text-[9px] font-mono fill-slate-500" textAnchor="end">
                                {p}%
                              </text>
                            </g>
                          ))}

                          {/* Filled Area for Student */}
                          {performanceData.length > 1 && (
                            <path
                              d={`${studentPathD} L ${getX(performanceData.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`}
                              fill="url(#studentGrad)"
                            />
                          )}

                          {/* Class Average Line */}
                          <path
                            d={classPathD}
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="2"
                            strokeDasharray="4 4"
                          />

                          {/* Student Score Line */}
                          <path
                            d={studentPathD}
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="3"
                          />

                          {/* Interactive data points */}
                          {performanceData.map((pt, idx) => {
                            const cx = getX(idx);
                            const cyStudent = getY(pt.percentage);
                            const cyClass = getY(pt.classAverage);

                            return (
                              <g key={pt.examId}>
                                {/* Invisible hover zone */}
                                <rect
                                  x={cx - 15}
                                  y={0}
                                  width="30"
                                  height="240"
                                  fill="transparent"
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPoint(idx)}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />

                                {/* Class Point */}
                                <circle
                                  cx={cx}
                                  cy={cyClass}
                                  r="3.5"
                                  fill="#f59e0b"
                                />

                                {/* Student Point */}
                                <circle
                                  cx={cx}
                                  cy={cyStudent}
                                  r={hoveredPoint === idx ? "6" : "4.5"}
                                  fill="#3b82f6"
                                  stroke="#0f172a"
                                  strokeWidth="2"
                                  className="transition-all"
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Hover Tooltip Overlay */}
                        {hoveredPoint !== null && performanceData[hoveredPoint] && (
                          <div className="absolute top-2 right-2 bg-slate-950/95 border border-blue-500/30 rounded-xl p-3 text-xs shadow-2xl backdrop-blur-md max-w-[200px] z-10">
                            <p className="font-bold text-white font-outfit truncate">{performanceData[hoveredPoint].examName}</p>
                            <p className="text-[10px] text-slate-400">{performanceData[hoveredPoint].date} | {performanceData[hoveredPoint].subject}</p>
                            <div className="mt-2 space-y-1 pt-1 border-t border-slate-800">
                              <div className="flex justify-between gap-4">
                                <span className="text-blue-400 font-medium">Your Score:</span>
                                <span className="font-mono font-bold text-white">
                                  {performanceData[hoveredPoint].marksObtained}/{performanceData[hoveredPoint].totalMarks} ({performanceData[hoveredPoint].percentage}%)
                                </span>
                              </div>
                              <div className="flex justify-between gap-4">
                                <span className="text-amber-400 font-medium">Class Avg:</span>
                                <span className="font-mono font-bold text-white">{performanceData[hoveredPoint].classAverage}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Legend */}
                      <div className="flex justify-center items-center gap-6 mt-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full bg-blue-500 block" />
                          <span className="text-slate-300 font-medium">Student Performance</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="h-0.5 w-4 bg-amber-500 border-t border-dashed border-amber-500 block" />
                          <span className="text-slate-300 font-medium">Class Average</span>
                        </div>
                      </div>
                    </div>

                    {/* Donut Chart */}
                    <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col gap-4 bg-slate-900/5">
                      <div>
                        <h3 className="text-sm font-bold text-white font-outfit tracking-wide">Subject Performance</h3>
                        <p className="text-[10px] text-slate-400 mt-0.5">Average academic grade breakdown grouped by subject</p>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
                        {/* Donut Chart SVG */}
                        <div className="relative w-44 h-44 flex items-center justify-center">
                          <svg className="w-full h-full" viewBox="0 0 200 200">
                            {subjectAverages.length === 0 ? (
                              <circle cx="100" cy="100" r="70" fill="none" stroke="#1e293b" strokeWidth="20" />
                            ) : donutSlices.length === 1 ? (
                              <circle
                                cx="100"
                                cy="100"
                                r="70"
                                fill="none"
                                stroke={donutSlices[0].color}
                                strokeWidth="26"
                              />
                            ) : (
                              donutSlices.map((slice, idx) => (
                                <path
                                  key={idx}
                                  d={slice.pathD}
                                  fill={slice.color}
                                  className="hover:opacity-90 transition-opacity cursor-pointer"
                                >
                                  <title>{slice.name}: {slice.average}%</title>
                                </path>
                              ))
                            )}
                            
                            {/* Center Label */}
                            <circle cx="100" cy="100" r="55" className="fill-[#080d1a]" />
                            <text x="100" y="96" textAnchor="middle" className="text-[20px] font-black text-white font-outfit fill-white">
                              {overallAvg}%
                            </text>
                            <text x="100" y="114" textAnchor="middle" className="text-[9px] font-bold text-slate-400 uppercase tracking-widest fill-slate-400">
                              OVERALL
                            </text>
                          </svg>
                        </div>

                        {/* Legend List */}
                        <div className="flex-1 space-y-3">
                          {donutSlices.map((slice, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-md block" style={{ backgroundColor: slice.color }} />
                                <span className="text-slate-300 font-bold font-outfit">{slice.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-mono text-white font-bold">{slice.average}%</span>
                                <span className="text-[9px] text-slate-500 ml-1">avg</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transcript Table */}
                  <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/5">
                    <div className="p-4 border-b border-slate-800/80 bg-slate-900/10">
                      <h3 className="text-sm font-bold text-white font-outfit">Detailed Academic Ledger</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Chronological record of all examination transcripts</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/30 text-xs font-semibold uppercase tracking-wider">
                            <th className="p-4">Date</th>
                            <th className="p-4">Exam Name</th>
                            <th className="p-4">Subject</th>
                            <th className="p-4 text-center">Marks Obtained</th>
                            <th className="p-4 text-center">Percentage</th>
                            <th className="p-4 text-center">Class Average</th>
                            <th className="p-4">Status / Comments</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40 text-slate-300">
                          {performanceData.map(row => {
                            const diff = row.percentage - row.classAverage;
                            let badgeColor = "bg-slate-500/10 text-slate-400 border border-slate-500/20";
                            let statusText = "Avg Performance";
                            
                            if (diff > 5) {
                              badgeColor = "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
                              statusText = "Above Class Avg";
                            } else if (diff < -5) {
                              badgeColor = "bg-rose-500/10 text-rose-400 border border-rose-500/20";
                              statusText = "Below Class Avg";
                            }
                            
                            return (
                              <tr key={row.examId} className="hover:bg-slate-900/20 transition-colors">
                                <td className="p-4 text-slate-400 text-xs font-medium">{row.date}</td>
                                <td className="p-4 font-bold text-white font-outfit">{row.examName}</td>
                                <td className="p-4 text-slate-300 font-semibold">{row.subject}</td>
                                <td className="p-4 text-center font-bold text-white">
                                  {row.marksObtained} <span className="text-slate-500 font-normal">/ {row.totalMarks}</span>
                                </td>
                                <td className="p-4 text-center font-mono font-bold text-cyan-400">{row.percentage}%</td>
                                <td className="p-4 text-center font-mono text-slate-400">{row.classAverage}%</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${badgeColor}`}>
                                      {statusText}
                                    </span>
                                    {row.remarks && (
                                      <span className="text-xs text-slate-400 italic">
                                        "{row.remarks}"
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        ) : (
          /* Search Interface */
          <div className="space-y-4">
            <div className="glass-panel p-5 rounded-2xl border border-blue-500/10 space-y-4">
              <h3 className="text-lg font-bold text-white font-outfit">Search Student Progress</h3>
              <p className="text-xs text-slate-400">Search for a student below and click on their name to view detailed statistics and charts regarding their academic progress across all registered exams.</p>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-5 w-5" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student by name or roll number..."
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {searchQuery.trim().length > 0 ? (
              filteredStudents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredStudents.map(st => (
                    <div
                      key={st.id}
                      onClick={() => handleSelectStudent(st)}
                      className="glass-panel p-4 rounded-xl border border-slate-800 hover:border-blue-500/40 cursor-pointer hover:bg-slate-900/20 transition-all flex flex-col gap-2 group"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="text-white font-bold font-outfit group-hover:text-blue-400 transition-colors">
                            {st.name} {st.lastName || ''}
                          </h4>
                          <p className="text-xs text-slate-400">Roll Number: {st.rollNumber}</p>
                        </div>
                        <span className="text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 rounded-full font-semibold">
                          {st.batch ? st.batch.name : 'General'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="glass-panel p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-sm">
                  No matching students found for "{searchQuery}".
                </div>
              )
            ) : (
              <div className="glass-panel p-8 rounded-xl border border-slate-800 text-center text-slate-500 text-sm">
                Please enter a student name or roll number to begin.
              </div>
            )}
          </div>
        )
      )}

      {/* REGISTER NEW EXAM/TEST MODAL */}
      {showCreateTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-blue-500/25 relative">
            <button
              onClick={() => setShowCreateTest(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              type="button"
            >
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-white font-outfit mb-4">{editingExam ? 'Edit Examination Details' : 'Register New Examination'}</h3>
            <form onSubmit={handleCreateTest} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Test Name / Code</label>
                <input
                  type="text" required
                  value={testForm.name}
                  onChange={(e) => setTestForm({ ...testForm, name: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. Unit Test 1, Term Exam"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Subject</label>
                <input
                  type="text" required
                  value={testForm.subject}
                  onChange={(e) => setTestForm({ ...testForm, subject: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. Mathematics"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Total Maximum Marks</label>
                <input
                  type="number" required
                  value={testForm.totalMarks}
                  onChange={(e) => setTestForm({ ...testForm, totalMarks: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="E.g. 50"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Examination Date</label>
                <input
                  type="date" required
                  value={testForm.date}
                  onChange={(e) => setTestForm({ ...testForm, date: e.target.value })}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateTest(false)}
                  className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold rounded-xl"
                >
                  {editingExam ? 'Save Changes' : 'Register Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
