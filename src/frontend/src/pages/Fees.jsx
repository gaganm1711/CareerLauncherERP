import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Search, Plus, Printer, IndianRupee, HelpCircle, FileText } from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';

export default function Fees({ user, onPrintReceipt }) {
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state for dropdown
  const [searchStudent, setSearchStudent] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Form
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [remarks, setRemarks] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const studentsData = await apiRequest('/students');
      setStudents(studentsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleFeeUpdate = (data) => {
      console.log('[SOCKET] Fee/student change event received. Reloading fee structures...');
      loadData();
      if (selectedStudent) {
        const matchingStudentId = data?.studentId;
        if (!matchingStudentId || matchingStudentId === selectedStudent.id) {
          apiRequest(`/fees/ledger/${selectedStudent.id}`)
            .then(setLedger)
            .catch(console.error);
            
          apiRequest('/students')
            .then(list => {
              const updatedSt = list.find(s => s.id === selectedStudent.id);
              if (updatedSt) {
                setSelectedStudent(updatedSt);
              }
            })
            .catch(console.error);
        }
      }
    };

    socketService.on('fee_change', handleFeeUpdate);
    socketService.on('student_change', handleFeeUpdate);

    return () => {
      socketService.off('fee_change', handleFeeUpdate);
      socketService.off('student_change', handleFeeUpdate);
    };
  }, [selectedStudent]);

  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSearchStudent(`${student.name} ${student.lastName || ''} (${student.rollNumber})`);
    setIsDropdownOpen(false);
    
    // Fetch ledger for this student
    try {
      const ledgerData = await apiRequest(`/fees/ledger/${student.id}`);
      setLedger(ledgerData);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Please select a student first.');
      return;
    }
    if (!amountPaid || parseFloat(amountPaid) <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    try {
      const record = await apiRequest('/fees/record', {
        method: 'POST',
        body: JSON.stringify({
          studentId: selectedStudent.id,
          amountPaid: parseFloat(amountPaid),
          paymentMethod,
          remarks
        })
      });

      alert('Payment receipt recorded successfully!');
      
      // Reset payment fields
      setAmountPaid('');
      setRemarks('');
      
      // Reload details
      const ledgerData = await apiRequest(`/fees/ledger/${selectedStudent.id}`);
      setLedger(ledgerData);
      
      // Refresh student list
      const studentsData = await apiRequest('/students');
      setStudents(studentsData);
      
      const updatedSt = studentsData.find(s => s.id === selectedStudent.id);
      if (updatedSt) {
        setSelectedStudent(updatedSt);
      }
    } catch (err) {
      alert(`Payment recording failed: ${err.message}`);
    }
  };

  const calculateOutstanding = (student) => {
    if (!student) return 0;
    const paid = student.feeRecords?.reduce((sum, r) => sum + r.amountPaid, 0) || 0;
    return Math.max(0, student.totalCourseFee - paid);
  };

  const calculateTotalPaid = (student) => {
    if (!student) return 0;
    return student.feeRecords?.reduce((sum, r) => sum + r.amountPaid, 0) || 0;
  };

  // Filter students based on dropdown search input
  const filteredStudents = students.filter(s => {
    const fullName = `${s.name} ${s.lastName || ''}`.toLowerCase();
    const roll = s.rollNumber.toLowerCase();
    const q = searchStudent.toLowerCase();
    return fullName.includes(q) || roll.includes(q);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Fee Ledger & Cashier Registry</h1>
        <p className="text-slate-400 text-sm mt-0.5">Record client tuition payments and compile receipt vouchers</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Choose Student and Stats */}
        <div className="space-y-6 lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4">
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-2">
              <Search className="h-5 w-5 text-orange-400" />
              Find Student Profile
            </h2>
            
            {/* Search Dropdown Selector */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or roll number..."
                value={searchStudent}
                onChange={(e) => {
                  setSearchStudent(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                className="w-full bg-[#070d1e]/80 border border-slate-700/60 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-blue-500"
              />
              
              <AnimatePresence>
                {isDropdownOpen && filteredStudents.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute z-20 w-full bg-slate-900 border border-slate-800 rounded-xl mt-1.5 max-h-60 overflow-y-auto shadow-2xl p-1.5 space-y-0.5"
                  >
                    {filteredStudents.map(s => (
                      <button
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className="w-full text-left p-2 hover:bg-blue-600/20 hover:text-white rounded-lg text-xs text-slate-300 flex justify-between items-center"
                      >
                        <span className="font-semibold">{s.name} {s.lastName || ''}</span>
                        <span className="font-mono text-cyan-400 text-[10px] bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">{s.rollNumber}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Selected Student Balance Previews */}
            {selectedStudent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-slate-950/50 border border-slate-850 rounded-2xl space-y-3.5"
              >
                <div className="text-center pb-3 border-b border-slate-800">
                  <h4 className="font-bold text-white text-base font-outfit">{selectedStudent.name} {selectedStudent.lastName || ''}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Roll No: {selectedStudent.rollNumber}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Fee</p>
                    <p className="text-base font-extrabold text-white mt-0.5">₹{selectedStudent.totalCourseFee.toLocaleString()}</p>
                  </div>
                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Total Paid</p>
                    <p className="text-base font-extrabold text-emerald-400 mt-0.5">₹{calculateTotalPaid(selectedStudent).toLocaleString()}</p>
                  </div>
                </div>

                <div className="p-3 bg-rose-500/5 border border-rose-500/15 text-center rounded-xl">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Outstanding Remaining Balance</p>
                  <p className="text-2xl font-black text-rose-400 mt-1">₹{calculateOutstanding(selectedStudent).toLocaleString()}</p>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Middle Column: Record Payment Form */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 h-full">
            <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-cyan-400" />
              Record Receipt Transaction
            </h2>
            
            <form onSubmit={handleRecordPayment} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Receipt Date</label>
                <input
                  type="text"
                  disabled
                  value={new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  className="w-full bg-[#070d1e]/40 border border-slate-800 rounded-xl p-2.5 text-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                >
                  <option value="CASH">CASH</option>
                  <option value="UPI">UPI (GooglePay/PhonePe)</option>
                  <option value="BANK_TRANSFER">BANK TRANSFER (IMPS/NEFT)</option>
                  <option value="CARD">DEBIT/CREDIT CARD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Amount Paid (₹)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-bold">₹</span>
                  <input
                    type="number"
                    required
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl py-2.5 pl-8 pr-4 text-white font-bold"
                    placeholder="Enter amount"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Remarks / Note</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2.5 text-white"
                  placeholder="Receipt transaction details..."
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={!selectedStudent}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl shadow-lg shadow-orange-500/10 transition-all text-xs uppercase tracking-wider disabled:opacity-40"
              >
                Generate Receipt Voucher
              </motion.button>
            </form>
          </div>
        </div>

        {/* Right Column: Transaction History Ledger */}
        <div className="lg:col-span-1">
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-bold text-white font-outfit flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-emerald-400" />
                Ledger History Receipts
              </h2>
              
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {selectedStudent ? (
                  ledger.length > 0 ? (
                    ledger.map(rec => (
                      <div key={rec.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl text-xs flex items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                        <div>
                          <p className="font-mono text-cyan-400 font-bold">{rec.receiptNo}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Method: {rec.paymentMethod} • {new Date(rec.paymentDate).toLocaleDateString()}</p>
                          <p className="text-slate-400 mt-1 italic">"{rec.remarks || 'No remarks'}"</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="font-extrabold text-white">₹{rec.amountPaid.toLocaleString()}</span>
                          <button
                            onClick={() => onPrintReceipt(rec, selectedStudent)}
                            className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                            title="Print invoice receipt"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500 text-xs text-center py-12">No transactions recorded for this student.</p>
                  )
                ) : (
                  <p className="text-slate-500 text-xs text-center py-12">Select a student profile to view transaction history.</p>
                )}
              </div>
            </div>
            
            <div className="pt-4 border-t border-slate-850 mt-4 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />
              Receipts can be compiled and printed into A4 layout invoices.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
