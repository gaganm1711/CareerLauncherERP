import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Bell, FileSpreadsheet, MessageSquare, Phone, IndianRupee } from 'lucide-react';
import { apiRequest } from '../api';
import { socketService } from '../socketService';
import * as XLSX from 'xlsx';

export default function Reminders({ user }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingSms, setSendingSms] = useState({});

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest('/fees/reminders');
      setReminders(data);
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
    const handleUpdate = () => {
      console.log('[SOCKET] Reminders reloading due to fee/student change event...');
      loadData();
    };

    socketService.on('fee_change', handleUpdate);
    socketService.on('student_change', handleUpdate);

    return () => {
      socketService.off('fee_change', handleUpdate);
      socketService.off('student_change', handleUpdate);
    };
  }, []);

  const handleExportExcel = () => {
    if (reminders.length === 0) {
      alert('No outstanding balances to export.');
      return;
    }

    const data = reminders.map(r => ({
      'Roll Number': r.rollNumber,
      'Student Name': r.name,
      'Batch Class': r.batchName,
      'Parent Name': r.parentName,
      'Parent Phone': r.parentPhone,
      'Total Package Fee (INR)': r.totalFee,
      'Total Paid (INR)': r.totalPaid,
      'Outstanding Dues (INR)': r.outstanding
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Balances");
    
    // Auto-fit column widths
    const max_width = data.reduce((w, r) => Math.max(w, Object.values(r).join('').length / 8), 10);
    worksheet["!cols"] = [{ wch: 12 }, { wch: 25 }, { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 20 }];

    XLSX.writeFile(workbook, "Career_Launcher_Outstanding_Balances.xlsx");
  };

  const handleSendReminderSms = async (student) => {
    setSendingSms(prev => ({ ...prev, [student.id]: true }));
    
    const messageBody = `Dear Parent, this is a reminder from Career Launcher Tuition Classes. The outstanding fee installment of Rs. ${student.outstanding} is pending for your ward ${student.name}. Please settle at your earliest convenience.`;
    
    try {
      const res = await apiRequest('/fees/broadcast-reminder', {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          messageBody
        })
      });
      if (res.success) {
        alert(`SMS Alert sent successfully to parent of ${student.name}!`);
      } else {
        alert(`Failed to send SMS: ${res.error}`);
      }
    } catch (err) {
      alert(`Error sending alert: ${err.message}`);
    } finally {
      setSendingSms(prev => ({ ...prev, [student.id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Fee Reminders Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">Review active students with pending balances and dispatch alerts</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-600/10"
          >
            <FileSpreadsheet className="h-4.5 w-4.5" />
            Export Roster (Excel)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-orange-500 border-r-transparent border-slate-700 mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Scanning ledgers for outstanding balances...</p>
        </div>
      ) : reminders.length > 0 ? (
        <div className="glass-panel rounded-2xl border border-blue-500/15 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/40 text-xs font-semibold uppercase tracking-wider">
                  <th className="p-4">Roll Number</th>
                  <th className="p-4">Student Name</th>
                  <th className="p-4">Batch Class</th>
                  <th className="p-4">Parent Details</th>
                  <th className="p-4 text-right">Total Fees</th>
                  <th className="p-4 text-right">Paid Fees</th>
                  <th className="p-4 text-right">Outstanding</th>
                  <th className="p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {reminders.map(rem => (
                  <tr key={rem.id} className="hover:bg-slate-900/35 transition-colors">
                    <td className="p-4 font-mono text-cyan-400 text-xs font-bold">{rem.rollNumber}</td>
                    <td className="p-4 font-bold text-white font-outfit">{rem.name}</td>
                    <td className="p-4">{rem.batchName}</td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5 text-xs text-slate-400">
                        <span className="text-slate-200">{rem.parentName}</span>
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-600" /> {rem.parentPhone}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">₹{rem.totalFee.toLocaleString()}</td>
                    <td className="p-4 text-right text-emerald-400 font-semibold">₹{rem.totalPaid.toLocaleString()}</td>
                    <td className="p-4 text-right text-rose-400 font-black">₹{rem.outstanding.toLocaleString()}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleSendReminderSms(rem)}
                        disabled={sendingSms[rem.id]}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 hover:border-orange-500/40 text-orange-400 hover:text-orange-300 font-semibold rounded-lg text-xs transition-colors disabled:opacity-40"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        {sendingSms[rem.id] ? 'Sending...' : 'SMS Alert'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-12 rounded-2xl text-center border border-slate-800">
          <p className="text-slate-500 text-sm font-outfit">Excellent! No outstanding balances found in the system.</p>
        </div>
      )}
    </div>
  );
}
