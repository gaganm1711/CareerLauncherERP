import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Calendar, 
  CreditCard, 
  BellRing, 
  CheckSquare, 
  Award, 
  MessageSquare, 
  Settings as SettingsIcon, 
  Printer, 
  Sun, 
  Moon, 
  LogOut,
  UserPlus,
  User
} from 'lucide-react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Batches from './pages/Batches';
import Fees from './pages/Fees';
import Reminders from './pages/Reminders';
import Attendance from './pages/Attendance';
import Gradebook from './pages/Gradebook';
import Broadcaster from './pages/Broadcaster';
import SettingsPage from './pages/Settings';
import Downloads from './pages/Downloads';
import Profile from './pages/Profile';
import UsersPage from './pages/Users';
import logo from './logo.png';
import { socketService } from './socketService';

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [theme, setTheme] = useState('dark');
  const [printLayoutContent, setPrintLayoutContent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Connect to Socket.IO real-time server
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  // Load user session and theme settings on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setUser(JSON.parse(savedUser));
    }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('light', savedTheme === 'light');
  }, []);

  // Listen to Electron theme toggler shortcut Ctrl+T
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onToggleTheme) {
      const unsubscribe = window.electronAPI.onToggleTheme(() => {
        setTheme(prev => {
          const next = prev === 'dark' ? 'light' : 'dark';
          document.documentElement.classList.toggle('light', next === 'light');
          localStorage.setItem('theme', next);
          return next;
        });
      });
      return unsubscribe;
    }
  }, []);

  const handleToggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.classList.toggle('light', next === 'light');
      localStorage.setItem('theme', next);
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setActiveTab('dashboard');
  };

  // Helper print logic for voucher invoicing in Fees.jsx
  const handlePrintReceiptVoucher = (receipt, student) => {
    const renderReceiptSlip = (copyType) => (
      <div className="w-full max-w-[800px] mx-auto border-[10px] border-sky-400 bg-[#fbfdff] p-5 text-sky-950 relative rounded-sm shadow-sm" style={{ aspectRatio: '8/3.5' }}>
        {/* Apple Logo Watermark */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
          <svg viewBox="0 0 24 24" className="w-64 h-64 fill-sky-500">
            <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
          </svg>
        </div>

        {/* Copy Type Tag */}
        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-sky-100 text-sky-800 font-black text-[9px] px-2 py-0.5 rounded border border-sky-300 uppercase tracking-widest z-20">
          {copyType}
        </div>

        {/* Slip Header */}
        <div className="flex justify-between items-center relative z-10">
          {/* Logo */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <img src={logo} alt="Career Launcher Logo" className="w-10 h-10 object-contain" />
            </div>
          </div>

          {/* Institution Title */}
          <div className="flex flex-col items-center justify-center text-center flex-1 mx-4">
            <h1 className="text-xl font-black tracking-wider text-sky-900 leading-none">CAREER LAUNCHER</h1>
            <p className="text-[9px] font-bold text-sky-700 tracking-tight mt-0.5">Near Lotan Pohewala, Tumsar - 441912</p>
            <div className="mt-1 bg-sky-600 text-white font-bold text-[9px] px-3 py-0.5 rounded-sm uppercase tracking-wider">
              FEES RECEIPT
            </div>
          </div>

          {/* Reg No & Contact */}
          <div className="text-[8px] text-right font-bold text-sky-900 space-y-0.5 self-start">
            <p>Reg. No. -TU/CE/533/2014</p>
            <p className="font-extrabold text-sky-950">By Mr. Parag Sir</p>
            <p className="font-extrabold text-sky-950">9595723339</p>
          </div>
        </div>

        {/* No. and Date Row */}
        <div className="flex justify-between items-center mt-3 text-xs font-bold text-sky-950 relative z-10">
          <div className="flex items-center gap-1">
            <span>No.</span>
            <span className="font-mono font-bold text-sky-600 text-sm">{receipt.receiptNo.replace('REC-', '')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Date :-</span>
            <span className="border-b border-sky-300 pb-0.5 px-3 min-w-[100px] text-center font-mono text-sky-900">
              {new Date(receipt.paymentDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Student Fields */}
        <div className="space-y-2 mt-2 text-xs font-bold text-sky-950 relative z-10">
          <div className="flex items-baseline w-full">
            <span className="mr-2 flex-shrink-0">Name :-</span>
            <div className="flex-1 border-b border-sky-300 pb-0.5 font-outfit font-extrabold text-sm text-sky-900">
              {student.name} {student.lastName || ''}
            </div>
          </div>
          <div className="flex items-baseline w-full">
            <span className="mr-2 flex-shrink-0">Class :-</span>
            <div className="flex-1 border-b border-sky-300 pb-0.5 font-outfit font-extrabold text-sm text-sky-900">
              {student.batch?.name || 'General'}
            </div>
          </div>
        </div>

        {/* Account Box & Signatory Box */}
        <div className="flex justify-between items-stretch mt-4 relative z-10">
          {/* Account Info Box */}
          <div className="border border-sky-400 p-2 rounded bg-sky-50/10 w-44 font-bold text-sky-950 text-[9px] space-y-1 flex flex-col justify-center">
            <div className="flex justify-between items-center">
              <span>Paid :</span>
              <span className="font-mono font-bold text-xs border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">₹{receipt.amountPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Balance :</span>
              <span className="font-mono font-bold text-xs border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">₹{receipt.balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Date :</span>
              <span className="font-mono border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">{new Date(receipt.paymentDate).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Refund Warning */}
          <div className="flex-1 text-center self-end pb-1 text-[8px] font-black text-sky-700 italic">
            * Fees Once Paid is not Refundable
          </div>

          {/* Cashier/Center Sign Box */}
          <div className="w-48 border border-sky-400 p-2 rounded bg-sky-50/10 text-center flex flex-col justify-between">
            <p className="text-[8px] font-bold text-sky-900 leading-tight">For Career Launcher Tuition Classes, Tumsar</p>
            <div className="h-4"></div>
            <div className="border-t border-dashed border-sky-300 pt-1 text-[7px] text-sky-600 font-semibold uppercase tracking-wider">
              Authorized Signatory
            </div>
          </div>
        </div>
      </div>
    );

    const layout = (
      <div className="print-page print-container font-outfit p-4 text-black bg-white min-h-[297mm] flex flex-col justify-start gap-4 py-6">
        {/* Parents Copy */}
        <div className="space-y-1">
          {renderReceiptSlip("PARENTS COPY")}
        </div>

        {/* Dotted tear line */}
        <div className="border-b-2 border-dashed border-sky-300 relative flex justify-center my-4">
          <span className="absolute -top-2.5 bg-white px-4 text-[9px] font-bold text-sky-500 uppercase tracking-widest">
            ✂ Tear Here (Office / Parents Divider) ✂
          </span>
        </div>

        {/* Office Copy */}
        <div className="space-y-1">
          {renderReceiptSlip("OFFICE COPY")}
        </div>
      </div>
    );

    setPrintLayoutContent(layout);
    setTimeout(() => {
      if (window.electronAPI && window.electronAPI.triggerPrint) {
        window.electronAPI.triggerPrint();
      } else {
        window.print();
      }
    }, 300);
  };

  if (!user) {
    return <Login onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  // Sidebar navigation settings
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users, perm: 'students:view' },
    { id: 'teachers', label: 'Faculty', icon: GraduationCap, perm: 'teachers:view' },
    { id: 'batches', label: 'Batches', icon: Calendar },
    { id: 'ledger', label: 'Fees', icon: CreditCard, perm: 'fees:manage' },
    { id: 'reminders', label: 'Reminders', icon: BellRing, perm: 'fees:manage' },
    { id: 'attendance', label: 'Attendance', icon: CheckSquare },
    { id: 'downloads', label: 'Downloads', icon: Printer },
    { id: 'gradebook', label: 'Exams', icon: Award },
    { id: 'broadcaster', label: 'SMS', icon: MessageSquare, perm: 'settings:manage' },
    { id: 'users', label: 'Staff Accounts', icon: UserPlus, perm: 'settings:manage' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, perm: 'settings:manage' },
    { id: 'profile', label: 'My Profile', icon: User }
  ];

  // Check granular permissions for sidebar tabs display
  const hasPerm = (item) => {
    if (user.role === 'ADMIN') return true;
    if (!item.perm) return true;
    const userPerms = user.permissions.split(',').map(p => p.trim().toLowerCase());
    return userPerms.includes(item.perm.toLowerCase());
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard user={user} onTabChange={setActiveTab} />;
      case 'students':
        return <Students user={user} />;
      case 'teachers':
        return <Teachers user={user} />;
      case 'batches':
        return <Batches user={user} />;
      case 'ledger':
        return <Fees user={user} onPrintReceipt={handlePrintReceiptVoucher} />;
      case 'reminders':
        return <Reminders user={user} />;
      case 'attendance':
        return <Attendance user={user} />;
      case 'gradebook':
        return <Gradebook user={user} />;
      case 'broadcaster':
        return <Broadcaster user={user} />;
      case 'downloads':
        return <Downloads user={user} setPrintLayoutContent={setPrintLayoutContent} />;
      case 'users':
        return <UsersPage user={user} />;
      case 'profile':
        return <Profile user={user} onProfileUpdate={(updatedUser) => setUser(updatedUser)} />;
      case 'settings':
        return <SettingsPage user={user} />;
      default:
        return <Dashboard user={user} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100 overflow-hidden font-outfit relative">
      
      {/* 1. PRINT VOUCHER SECTION (Visible only in print media) */}
      <div className="print-only hidden">
        {printLayoutContent}
      </div>

      {/* Permanent Top Banner */}
      <div className="no-print h-20 bg-[#060c21] border-b border-slate-800/40 flex items-center justify-between px-6 z-20 flex-shrink-0 transition-colors duration-300 light:bg-white light:border-slate-200">
        <div className="flex items-center gap-4">
          <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0 bg-slate-900/60 rounded-xl border border-slate-800 shadow light:bg-slate-100 light:border-slate-200">
            <img src={logo} alt="Career Launcher Logo" className="w-10 h-10 object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent uppercase font-outfit leading-none">CAREER LAUNCHER</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 light:text-slate-500">TUITION CLASSES & SCHEDULER SYSTEM • TUMSAR</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveTab('profile')} title="Go to My Profile">
            <div className="text-right">
              <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-3 py-1 rounded-full border border-orange-400/20 uppercase tracking-wider">
                {user.role}: {user.name}
              </span>
            </div>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-800/60 light:bg-slate-200" />
          
          <button
            onClick={handleToggleTheme}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-xl border border-slate-800 transition-all light:bg-slate-100 light:border-slate-200 light:hover:bg-slate-200 light:text-slate-600"
            title="Toggle Theme (Ctrl+T)"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* 2. MAIN APPLICATION SHELL (Hidden in print media) */}
      <div className="no-print flex w-full flex-1 overflow-hidden relative">
        
        {/* Large rotating brand watermark backdrop */}
        <img src={logo} alt="Watermark Logo" className="watermark-bg" />

        {/* Sidebar Left Navigation */}
        <aside className="w-64 bg-[#060c21] border-r border-slate-800/40 flex flex-col justify-between flex-shrink-0 z-10 transition-colors duration-300 light:bg-white light:border-slate-200">
          <div>
            {/* Simplified Header branding info since top banner is there */}
            <div className="p-4 border-b border-slate-800/40 flex items-center gap-2 light:border-slate-200">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Workspace Navigation</span>
            </div>

            {/* Links List */}
            <nav className="p-4 space-y-1">
              {navItems.filter(hasPerm).map(item => {
                const Icon = item.icon;
                const isSelected = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      isSelected 
                        ? 'sidebar-active-pill' 
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/30 light:text-slate-500 light:hover:text-slate-900 light:hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User Sign-out footer */}
          <div className="p-4 border-t border-slate-800/40 flex items-center justify-between gap-3 light:border-slate-200">
            <div className="min-w-0 cursor-pointer" onClick={() => setActiveTab('profile')} title="Go to My Profile">
              <p className="text-xs font-bold text-white hover:text-blue-400 transition-colors truncate light:text-slate-900 light:hover:text-blue-600">{user.name}</p>
              <p className="text-[10px] text-slate-500 font-semibold truncate uppercase">{user.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-slate-900 hover:bg-slate-850 hover:text-rose-400 rounded-xl border border-slate-800 text-slate-400 transition-all light:bg-slate-100 light:border-slate-200 light:hover:bg-rose-500/10 light:hover:text-rose-500"
              title="Logout session"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </aside>

        {/* Center Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto z-10 relative">
          
          {/* Top Header bar controls */}
          <header className="h-14 border-b border-slate-800/40 px-6 flex items-center justify-between flex-shrink-0 bg-slate-950/20 backdrop-blur-sm z-10 light:border-slate-200 light:bg-white/40">
            <div className="flex items-center gap-2">
              <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0 bg-slate-900/40 rounded border border-slate-800 shadow-sm light:bg-slate-100 light:border-slate-200">
                <img src={logo} alt="Logo" className="w-5 h-5 object-contain" />
              </div>
              <div className="text-xs text-slate-400 font-semibold light:text-slate-500">
                Workspace / <span className="text-slate-200 capitalize font-bold light:text-slate-800">{activeTab}</span>
              </div>
            </div>
          </header>

          {/* Primary Viewport wrapped in slides */}
          <main className="flex-1 p-6 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
                className="w-full h-full"
              >
                {renderActiveView()}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

      </div>
    </div>
  );
}
