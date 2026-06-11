import React, { useState, useEffect } from 'react';
import { Printer, FileText, Receipt, Users } from 'lucide-react';
import { apiRequest } from '../api';
import logo from '../logo.png';
import * as XLSX from 'xlsx';

const AVAILABLE_CLASSES = [
  { id: '8th', label: '8th Class' },
  { id: '9th', label: '9th Class' },
  { id: '10th', label: '10th Class' },
  { id: '11th', label: '11th Class' },
  { id: '12th', label: '12th Class' },
  { id: 'MHTCET', label: 'MHT-CET' }
];

export default function Downloads({ user, setPrintLayoutContent }) {
  // Navigation State
  const [activeTab, setActiveTab] = useState('standard'); // 'standard' or 'roster'

  // General Student Data
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedReceiptStudentId, setSelectedReceiptStudentId] = useState('');
  const [receipts, setReceipts] = useState([]);
  const [selectedReceiptId, setSelectedReceiptId] = useState('');

  // Roster Configuration States
  const [selectedClasses, setSelectedClasses] = useState(['8th', '9th', '10th', '11th', '12th', 'MHTCET']);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [exams, setExams] = useState([]);
  const [studentMarks, setStudentMarks] = useState({}); // studentId -> marksObtained
  const [includeSignature, setIncludeSignature] = useState(true);
  const [signatureHeader, setSignatureHeader] = useState('Signature / Status');
  const [customSubject, setCustomSubject] = useState('');
  const [customExamName, setCustomExamName] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Checkbox column configurations
  const [columns, setColumns] = useState([
    { id: 'rollNumber', label: 'Roll Number', key: 'rollNumber', checked: true, compulsory: false },
    { id: 'fullName', label: 'Student Name', key: 'name', checked: true, compulsory: true },
    { id: 'whatsapp', label: 'WhatsApp Number', key: 'whatsapp', checked: true, compulsory: false },
    { id: 'marks', label: 'Marks', key: 'marks', checked: false, compulsory: false },
    { id: 'parentName', label: 'Parent\'s Name', key: 'parentName', checked: false, compulsory: false },
    { id: 'parentPhone', label: 'Parent\'s Phone', key: 'parentPhone', checked: false, compulsory: false },
    { id: 'schoolName', label: 'School Name', key: 'schoolName', checked: false, compulsory: false },
    { id: 'dob', label: 'Date of Birth', key: 'dob', checked: false, compulsory: false },
    { id: 'gender', label: 'Gender', key: 'gender', checked: false, compulsory: false },
    { id: 'bloodGroup', label: 'Blood Group', key: 'bloodGroup', checked: false, compulsory: false },
    { id: 'category', label: 'Category', key: 'category', checked: false, compulsory: false },
    { id: 'address', label: 'Address', key: 'address', checked: false, compulsory: false }
  ]);

  // Load students and exams on mount
  useEffect(() => {
    async function loadData() {
      try {
        const studentData = await apiRequest('/students');
        setStudents(studentData);
        
        const examData = await apiRequest('/exams');
        setExams(examData);
      } catch (err) {
        console.error('Failed to load initial data in Downloads:', err);
      }
    }
    loadData();
  }, []);

  // Fetch marks when exam selection changes
  useEffect(() => {
    async function loadMarks() {
      if (!selectedExamId) {
        setStudentMarks({});
        setCustomExamName('');
        setCustomSubject('');
        return;
      }
      try {
        const data = await apiRequest(`/exams/${selectedExamId}/marks`);
        const marksMap = {};
        if (data.sheet) {
          data.sheet.forEach(row => {
            marksMap[row.studentId] = row.marksObtained;
          });
        }
        setStudentMarks(marksMap);
        
        // Auto-enable Marks column in view
        setColumns(prev => prev.map(c => c.id === 'marks' ? { ...c, checked: true } : c));

        if (data.exam) {
          setCustomExamName(data.exam.name || '');
          setCustomSubject(data.exam.subject || '');
        }
      } catch (err) {
        console.error('Failed to load exam marks:', err);
      }
    }
    loadMarks();
  }, [selectedExamId]);

  const handleReceiptStudentChange = async (studentId) => {
    setSelectedReceiptStudentId(studentId);
    setSelectedReceiptId('');
    if (!studentId) {
      setReceipts([]);
      return;
    }
    try {
      const data = await apiRequest(`/fees/ledger/${studentId}`);
      setReceipts(data);
    } catch (e) {
      console.error(e);
    }
  };

  const triggerPrintWindow = () => {
    if (window.electronAPI && window.electronAPI.triggerPrint) {
      window.electronAPI.triggerPrint();
    } else {
      window.print();
    }
  };

  const handlePrintProspectus = () => {
    const layout = (
      <div className="print-page no-watermark print-container p-6 text-black bg-white min-h-[297mm] flex flex-col justify-start gap-6 text-xs leading-normal border border-dotted border-black m-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <div>
          {/* Institutional Header matches the scanned format layout */}
          <div className="flex justify-between items-center pb-2">
            <div className="flex flex-col items-center">
              <div className="border border-black p-1 w-14 h-14 flex items-center justify-center bg-white flex-shrink-0">
                <img src={logo} alt="Career Launcher Logo" className="w-12 h-12 object-contain" />
              </div>
              <span className="text-[5px] font-black tracking-tight mt-1 text-black font-sans leading-tight text-center uppercase">CAREER LAUNCHER<br/>TUITION CLASSES, TUMSAR</span>
            </div>
            
            <div className="text-center flex-1 mx-4">
              <h1 className="text-3xl font-black tracking-tight leading-none text-black font-sans uppercase">
                CAREER LAUNCHER
              </h1>
              <p className="text-xs font-bold tracking-widest text-black uppercase mt-1">
                TUITION CLASSES, TUMSAR
              </p>
            </div>
            
            <div className="w-24 h-24 border border-black flex flex-col items-center justify-center text-center p-1 text-[8px] font-bold bg-white leading-tight flex-shrink-0 text-black">
              <div>Affix Your</div>
              <div>Recent Passport</div>
              <div>Size Photograph</div>
              <div>Here</div>
            </div>
          </div>

          <div className="text-center mb-2 mt-2">
            <span className="bg-black text-white font-bold text-xs px-6 py-1 rounded-sm uppercase tracking-widest">
              ADMISSION FORM
            </span>
          </div>

          <div className="border-t border-dotted border-black my-2"></div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-black">
              <div>To,</div>
              <div className="flex justify-between items-baseline mt-1">
                <span>Career Launcher</span>
                <div className="flex items-baseline gap-1">
                  <span>Enrollment No.</span>
                  <div className="border-b border-dotted border-black w-48 pb-0.5 min-h-[16px]"></div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-black py-1 w-full">
              <span className="flex-shrink-0">COURSE APPLIED FOR</span>
              <div className="border border-black h-6 flex-1 bg-white"></div>
            </div>

            <div className="text-[9px] text-black leading-relaxed space-y-1">
              <p className="font-bold">Respected Sir,</p>
              <p className="text-justify">
                I want to take Admission in Career Launcher. I have read the 'Terms & Conditions' of the Institute mentioned in the Institute in the prospectus and given overleaf. I agree to abide by the same. My particulars are given below.
              </p>
              <p className="text-center font-bold text-[8px] uppercase tracking-wider pt-1">
                (It is Compulsory to fill the form clearly in CAPITAL LETTERS only)
              </p>
            </div>

            {/* Dotted lines use border-black for print contrast sharpness */}
            <div className="space-y-3 mt-3 text-xs font-bold text-black">
              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">First Name</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Last Name</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-[2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Father's / Guardian Name</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Occupation</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 ml-2 leading-none">(Please specify the post, if in Service)</span>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-[2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Mother's Name</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Occupation</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 ml-2 leading-none">(Please specify the post, if in Service)</span>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-[1.2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Date of Birth</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                </div>
                
                <div className="flex-[1.2] flex flex-col items-center">
                  <div className="flex items-center gap-1 w-full justify-center">
                    <span className="flex-shrink-0">Gender</span>
                    <span className="w-3.5 h-3.5 border border-black ml-2 flex-shrink-0"></span>
                    <span className="ml-1 text-[10px]">M</span>
                    <span className="w-3.5 h-3.5 border border-black ml-2 flex-shrink-0"></span>
                    <span className="ml-1 text-[10px]">F</span>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 leading-none">(Please Tick the relevant box)</span>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Blood Group</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                </div>

                <div className="flex-[1.2] flex flex-col items-center">
                  <div className="flex items-baseline w-full">
                    <span className="mr-2 flex-shrink-0">Category</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 leading-none">(GEN/SC/ST/OBC/PH)</span>
                </div>
              </div>

              {/* Exact spelling matched from scanned physical form */}
              <div className="flex flex-col w-full">
                <div className="flex items-baseline w-full">
                  <span className="mr-2 flex-shrink-0">Residenace Address</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
                <div className="flex items-baseline w-full mt-1">
                  <span className="mr-2 flex-shrink-0 text-[7px] font-semibold leading-none">(Permanent Address)</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">City</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">State</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Pincode</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Mobile [Student's Number]</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Mobile [Parent's Number]</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
              </div>

              <div className="flex items-baseline w-full">
                <span className="mr-2 flex-shrink-0">Mobile [Whatsapp Number]</span>
                <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
              </div>

              <div className="flex items-baseline w-full">
                <span className="mr-2 flex-shrink-0">School Name</span>
                <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
              </div>
            </div>

            {/* Signature Area matches alignment and spacing */}
            <div className="flex justify-between pt-10 pb-4 text-center font-bold text-xs text-black">
              <div className="w-48 text-[10px]">
                Parents / Guardian
              </div>
              <div className="w-48 text-[10px]">
                Sign of Applicant
              </div>
            </div>
          </div>
        </div>

        {/* Office Use Section uses black borders for printing contrast */}
        <div className="border border-black p-4 mt-2 bg-white relative">
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
            <span className="bg-black text-white font-bold text-[10px] px-5 py-1 rounded-sm uppercase tracking-widest border border-black">
              OFFICE USE ONLY
            </span>
          </div>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-6 text-[10px] font-bold text-black">
              <div className="flex items-center gap-2">
                <span>Total Fees</span>
                <div className="flex-1 border border-black h-6 bg-white"></div>
              </div>
              <div className="flex items-center gap-2">
                <span>Advance Paid</span>
                <div className="flex-1 border border-black h-6 bg-white"></div>
              </div>
              <div className="flex items-center gap-2">
                <span>Balance</span>
                <div className="flex-1 border border-black h-6 bg-white"></div>
              </div>
            </div>

            <div className="flex justify-between items-baseline text-[10px] font-bold text-black pt-4">
              <span>Date of Admission</span>
              <span>Sign of Director</span>
            </div>
          </div>
        </div>
      </div>
    );
    setPrintLayoutContent(layout);
    setTimeout(triggerPrintWindow, 300);
  };

  // 2. Student Record Print
  const handlePrintStudentRecord = () => {
    if (!selectedStudentId) {
      alert('Please select a student.');
      return;
    }
    const st = students.find(s => s.id === selectedStudentId);
    if (!st) return;

    const isMale = st.gender && (st.gender.toLowerCase().startsWith('m'));
    const isFemale = st.gender && (st.gender.toLowerCase().startsWith('f'));

    const layout = (
      <div className="print-page no-watermark print-container p-6 text-black bg-white min-h-[297mm] flex flex-col justify-start gap-6 text-xs leading-normal border border-dotted border-black m-1" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
        <div>
          {/* Institutional Header matches the scanned format layout */}
          <div className="flex justify-between items-center pb-2">
            <div className="flex flex-col items-center">
              <div className="border border-black p-1 w-14 h-14 flex items-center justify-center bg-white flex-shrink-0">
                <img src={logo} alt="Career Launcher Logo" className="w-12 h-12 object-contain" />
              </div>
              <span className="text-[5px] font-black tracking-tight mt-1 text-black font-sans leading-tight text-center uppercase">CAREER LAUNCHER<br/>TUITION CLASSES, TUMSAR</span>
            </div>
            
            <div className="text-center flex-1 mx-4">
              <h1 className="text-3xl font-black tracking-tight leading-none text-black font-sans uppercase">
                CAREER LAUNCHER
              </h1>
              <p className="text-xs font-bold tracking-widest text-black uppercase mt-1">
                TUITION CLASSES, TUMSAR
              </p>
            </div>
            
            <div className="w-24 h-24 border border-black flex flex-col items-center justify-center text-center p-1 text-[8px] font-bold bg-white overflow-hidden flex-shrink-0 text-black">
              {st.photo ? (
                <img src={st.photo} alt="Student" className="h-full w-full object-cover" />
              ) : (
                <>
                  <div>Affix Your</div>
                  <div>Recent Passport</div>
                  <div>Size Photograph</div>
                  <div>Here</div>
                </>
              )}
            </div>
          </div>

          <div className="text-center mb-2 mt-2">
            <span className="bg-black text-white font-bold text-xs px-6 py-1 rounded-sm uppercase tracking-widest">
              ADMISSION FORM
            </span>
          </div>

          <div className="border-t border-dotted border-black my-2"></div>

          <div className="space-y-3">
            <div className="text-xs font-bold text-black">
              <div>To,</div>
              <div className="flex justify-between items-baseline mt-1">
                <span>Career Launcher</span>
                <div className="flex items-baseline gap-1">
                  <span>Enrollment No.</span>
                  <div className="border-b border-dotted border-black w-48 pb-0.5 min-h-[16px] px-2 font-mono font-bold text-sky-900 text-sm uppercase">
                    {st.rollNumber}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-black py-1 w-full">
              <span className="flex-shrink-0">COURSE APPLIED FOR</span>
              <div className="border border-black h-6 flex-1 bg-white px-2 flex items-center font-bold text-xs uppercase text-sky-900">
                {st.batch?.name || 'General'}
              </div>
            </div>

            <div className="text-[9px] text-black leading-relaxed space-y-1">
              <p className="font-bold">Respected Sir,</p>
              <p className="text-justify">
                I want to take Admission in Career Launcher. I have read the 'Terms & Conditions' of the Institute mentioned in the Institute in the prospectus and given overleaf. I agree to abide by the same. My particulars are given below.
              </p>
              <p className="text-center font-bold text-[8px] uppercase tracking-wider pt-1">
                (It is Compulsory to fill the form clearly in CAPITAL LETTERS only)
              </p>
            </div>

            {/* Dotted lines use border-black for print contrast sharpness */}
            <div className="space-y-3 mt-3 text-xs font-bold text-black">
              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">First Name</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                    {st.name}
                  </div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Last Name</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                    {st.lastName || ''}
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-[2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Father's / Guardian Name</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.parentName}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Occupation</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.fatherOccupation || ''}
                    </div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 ml-2 leading-none">(Please specify the post, if in Service)</span>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-[2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Mother's Name</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.motherName || ''}
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Occupation</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.motherOccupation || ''}
                    </div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 ml-2 leading-none">(Please specify the post, if in Service)</span>
                </div>
              </div>

              <div className="flex gap-6 items-start">
                <div className="flex-[1.2] flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Date of Birth</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900">
                      {st.dob || ''}
                    </div>
                  </div>
                </div>
                
                <div className="flex-[1.2] flex flex-col items-center">
                  <div className="flex items-center gap-1 w-full justify-center">
                    <span className="flex-shrink-0">Gender</span>
                    <span className="w-3.5 h-3.5 border border-black ml-2 flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-sky-900">{isMale ? '✓' : ''}</span>
                    <span className="ml-1 text-[10px]">M</span>
                    <span className="w-3.5 h-3.5 border border-black ml-2 flex-shrink-0 flex items-center justify-center font-bold text-[10px] text-sky-900">{isFemale ? '✓' : ''}</span>
                    <span className="ml-1 text-[10px]">F</span>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 leading-none">(Please Tick the relevant box)</span>
                </div>

                <div className="flex-1 flex flex-col justify-end">
                  <div className="flex items-baseline">
                    <span className="mr-2 flex-shrink-0">Blood Group</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.bloodGroup || ''}
                    </div>
                  </div>
                </div>

                <div className="flex-[1.2] flex flex-col items-center">
                  <div className="flex items-baseline w-full">
                    <span className="mr-2 flex-shrink-0">Category</span>
                    <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                      {st.category || ''}
                    </div>
                  </div>
                  <span className="text-[7px] text-black font-semibold mt-0.5 leading-none">(GEN/SC/ST/OBC/PH)</span>
                </div>
              </div>

              {/* Exact spelling matched from scanned physical form */}
              <div className="flex flex-col w-full">
                <div className="flex items-baseline w-full">
                  <span className="mr-2 flex-shrink-0">Residenace Address</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                    {st.address || ''}
                  </div>
                </div>
                <div className="flex items-baseline w-full mt-1">
                  <span className="mr-2 flex-shrink-0 text-[7px] font-semibold leading-none">(Permanent Address)</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px]"></div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">City</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                    {st.city || ''}
                  </div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">State</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                    {st.state || ''}
                  </div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Pincode</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900">
                    {st.pincode || ''}
                  </div>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Mobile [Student's Number]</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900">
                    {st.phone || ''}
                  </div>
                </div>
                <div className="flex-1 flex items-baseline">
                  <span className="mr-2 flex-shrink-0">Mobile [Parent's Number]</span>
                  <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900">
                    {st.parentPhone || ''}
                  </div>
                </div>
              </div>

              <div className="flex items-baseline w-full">
                <span className="mr-2 flex-shrink-0">Mobile [Whatsapp Number]</span>
                <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900">
                  {st.whatsapp || ''}
                </div>
              </div>

              <div className="flex items-baseline w-full">
                <span className="mr-2 flex-shrink-0">School Name</span>
                <div className="flex-1 border-b border-dotted border-black pb-0.5 min-h-[16px] px-2 font-bold text-sky-900 uppercase">
                  {st.schoolName || ''}
                </div>
              </div>
            </div>

            {/* Signature Area matches alignment and spacing */}
            <div className="flex justify-between pt-10 pb-4 text-center font-bold text-xs text-black">
              <div className="w-48 text-[10px]">
                Parents / Guardian
              </div>
              <div className="w-48 text-[10px]">
                Sign of Applicant
              </div>
            </div>
          </div>
        </div>

        {/* Office Use Section uses black borders for printing contrast */}
        <div className="border border-black p-4 mt-2 bg-white relative">
          <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2">
            <span className="bg-black text-white font-bold text-[10px] px-5 py-1 rounded-sm uppercase tracking-widest border border-black">
              OFFICE USE ONLY
            </span>
          </div>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-3 gap-6 text-[10px] font-bold text-black">
              <div className="flex items-center gap-2">
                <span>Total Fees</span>
                <div className="flex-1 border border-black h-6 bg-white px-2 flex items-center font-bold text-sky-900">
                  ₹{st.totalCourseFee.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span>Advance Paid</span>
                <div className="flex-1 border border-black h-6 bg-white px-2 flex items-center font-bold text-sky-900">
                  ₹{st.advancePay.toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span>Balance</span>
                <div className="flex-1 border border-black h-6 bg-white px-2 flex items-center font-bold text-sky-900">
                  ₹{(st.totalCourseFee - st.advancePay).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-baseline text-[10px] font-bold text-black pt-4">
              <span>Date of Admission: <span className="font-bold text-sky-900 ml-1">{new Date(st.createdAt).toLocaleDateString()}</span></span>
              <span>Sign of Director</span>
            </div>
          </div>
        </div>
      </div>
    );
    setPrintLayoutContent(layout);
    setTimeout(triggerPrintWindow, 300);
  };

  // 3. Receipt Invoice Print
  const handlePrintReceipt = () => {
    if (!selectedReceiptId || !selectedReceiptStudentId) {
      alert('Please select student and receipt.');
      return;
    }
    const st = students.find(s => s.id === selectedReceiptStudentId);
    const rec = receipts.find(r => r.id === selectedReceiptId);
    
    if (!st || !rec) return;

    const renderReceiptSlip = (copyType) => (
      <div className="w-full max-w-[800px] mx-auto border-[10px] border-sky-400 bg-[#fbfdff] p-5 text-sky-950 relative rounded-sm shadow-sm" style={{ aspectRatio: '8/3.5' }}>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] z-0">
          <svg viewBox="0 0 24 24" className="w-64 h-64 fill-sky-500">
            <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,17 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.1,16.67C20.08,16.74 19.67,18.11 18.71,19.5M15.97,4.17C16.63,3.37 17.07,2.28 16.95,1C16,1.04 14.9,1.6 14.24,2.38C13.68,3.04 13.19,4.14 13.34,5.39C14.39,5.47 15.4,4.88 15.97,4.17Z" />
          </svg>
        </div>

        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-sky-100 text-sky-800 font-black text-[9px] px-2 py-0.5 rounded border border-sky-300 uppercase tracking-widest z-20">
          {copyType}
        </div>

        <div className="flex justify-between items-center relative z-10">
          <div className="flex flex-col items-center justify-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <img src={logo} alt="Career Launcher Logo" className="w-10 h-10 object-contain" />
            </div>
          </div>

          <div className="flex flex-col items-center justify-center text-center flex-1 mx-4">
            <h1 className="text-xl font-black tracking-wider text-sky-900 leading-none">CAREER LAUNCHER</h1>
            <p className="text-[9px] font-bold text-sky-700 tracking-tight mt-0.5">Near Lotan Pohewala, Tumsar - 441912</p>
            <div className="mt-1 bg-sky-600 text-white font-bold text-[9px] px-3 py-0.5 rounded-sm uppercase tracking-wider">
              FEES RECEIPT
            </div>
          </div>

          <div className="text-[8px] text-right font-bold text-sky-900 space-y-0.5 self-start">
            <p>Reg. No. -TU/CE/533/2014</p>
            <p className="font-extrabold text-sky-950">By Mr. Parag Sir</p>
            <p className="font-extrabold text-sky-950">9595723339</p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-3 text-xs font-bold text-sky-950 relative z-10">
          <div className="flex items-center gap-1">
            <span>No.</span>
            <span className="font-mono font-bold text-sky-600 text-sm">{rec.receiptNo.replace('REC-', '')}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>Date :-</span>
            <span className="border-b border-sky-300 pb-0.5 px-3 min-w-[100px] text-center font-mono text-sky-900">
              {new Date(rec.paymentDate).toLocaleDateString()}
            </span>
          </div>
        </div>

        <div className="space-y-2 mt-2 text-xs font-bold text-sky-950 relative z-10">
          <div className="flex items-baseline w-full">
            <span className="mr-2 flex-shrink-0">Name :-</span>
            <div className="flex-1 border-b border-sky-300 pb-0.5 font-outfit font-extrabold text-sm text-sky-900">
              {st.name} {st.lastName || ''}
            </div>
          </div>
          <div className="flex items-baseline w-full">
            <span className="mr-2 flex-shrink-0">Class :-</span>
            <div className="flex-1 border-b border-sky-300 pb-0.5 font-outfit font-extrabold text-sm text-sky-900">
              {st.batch?.name || 'General'}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-stretch mt-4 relative z-10">
          <div className="border border-sky-400 p-2 rounded bg-sky-50/10 w-44 font-bold text-sky-950 text-[9px] space-y-1 flex flex-col justify-center">
            <div className="flex justify-between items-center">
              <span>Paid :</span>
              <span className="font-mono font-bold text-xs border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">₹{rec.amountPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Balance :</span>
              <span className="font-mono font-bold text-xs border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">₹{rec.balance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Date :</span>
              <span className="font-mono border-b border-sky-200 px-1 text-right min-w-[70px] text-sky-900">{new Date(rec.paymentDate).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex-1 text-center self-end pb-1 text-[8px] font-black text-sky-700 italic">
            * Fees Once Paid is not Refundable
          </div>

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
        <div className="space-y-1">
          {renderReceiptSlip("PARENTS COPY")}
        </div>

        <div className="border-b-2 border-dashed border-sky-300 relative flex justify-center my-4">
          <span className="absolute -top-2.5 bg-white px-4 text-[9px] font-bold text-sky-500 uppercase tracking-widest">
            ✂ Tear Here (Office / Parents Divider) ✂
          </span>
        </div>

        <div className="space-y-1">
          {renderReceiptSlip("OFFICE COPY")}
        </div>
      </div>
    );

    setPrintLayoutContent(layout);
    setTimeout(triggerPrintWindow, 300);
  };

  // 4. Custom Roster Sheet Print
  const handlePrintRoster = () => {
    const layout = (
      <div className="print-page print-container font-outfit p-8 text-black bg-white min-h-[297mm] flex flex-col justify-between text-xs leading-normal">
        <div>
          <div className="text-center space-y-1 mb-6 pb-4 border-b-2 border-black relative z-10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <img 
                  src={logo} 
                  alt="Career Launcher Logo" 
                  className="w-14 h-14 object-contain" 
                />
                <div className="text-left">
                  <h1 className="text-2xl font-black tracking-tight leading-none text-blue-900 uppercase">
                    CAREER LAUNCHER
                  </h1>
                  <p className="text-[10px] text-amber-600 font-extrabold tracking-widest uppercase mt-1">
                    TUITION CLASSES, TUMSAR
                  </p>
                </div>
              </div>
              <div className="text-[8px] text-right font-bold text-slate-800 space-y-0.5 self-start">
                <p>Reg. No. -TU/CE/533/2014</p>
                <p>By Mr. Parag Sir</p>
                <p>9595723339</p>
              </div>
            </div>
            
            <div className="pt-4 flex justify-between items-center text-[10px] font-bold text-slate-650 uppercase">
              <span>Custom Sheet: Roster & Marks</span>
              <span className="px-3 py-1 bg-slate-100 rounded-md border border-slate-300">
                Classes: {getSelectedClassesName()}
              </span>
              {customSubject && (
                <span className="px-3 py-1 bg-slate-100 rounded-md border border-slate-300 text-blue-900 font-extrabold">
                  Subject: {customSubject}
                </span>
              )}
              {customExamName && (
                <span className="px-3 py-1 bg-slate-100 rounded-md border border-slate-300 text-amber-600 font-extrabold">
                  Exam: {customExamName}
                </span>
              )}
              <span>Date: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>

          <div className="relative z-10 w-full overflow-hidden">
            <table className="w-full text-xs text-left border-collapse border border-black">
              <thead>
                <tr className="border-b border-black font-extrabold uppercase bg-slate-100 text-black">
                  <th className="p-2 w-10 text-center border-r border-black">S.No</th>
                  {columns.filter(c => c.checked).map(col => (
                    <th key={col.id} className="p-2 border-r border-black">{col.label}</th>
                  ))}
                  {includeSignature && (
                    <th className="p-2 w-44 text-center">{signatureHeader}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-black text-black">
                {filteredStudents.map((student, index) => (
                  <tr key={student.id} className="border-b border-black">
                    <td className="p-2 text-center font-bold border-r border-black">{index + 1}</td>
                    {columns.filter(c => c.checked).map(col => (
                      <td key={col.id} className="p-2 border-r border-black font-medium">
                        {getCellValue(student, col.id)}
                      </td>
                    ))}
                    {includeSignature && (
                      <td className="p-2 h-10 w-44 text-center bg-slate-50/50" />
                    )}
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan={getActiveColumnsCount() + 1} className="text-center py-10 font-bold italic text-slate-500 border border-black">
                      No Students Found for Selection
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-12 flex justify-between items-center text-xs font-bold text-slate-700 relative z-10">
          <div className="space-y-4">
            <div className="w-40 border-b border-black" />
            <p>Generated By: {user?.name || 'Administrator'}</p>
          </div>
          {includeSignature && (
            <div className="space-y-4 text-right">
              <div className="w-40 border-b border-black inline-block" />
              <p>Authorized Signature / Seal</p>
            </div>
          )}
        </div>
      </div>
    );

    setPrintLayoutContent(layout);
    setTimeout(triggerPrintWindow, 300);
  };

  // Excel Spreadsheet Downloader
  const handleDownloadExcel = () => {
    try {
      setIsExporting(true);

      const dataRows = filteredStudents.map((student, index) => {
        const row = {
          'S.No': index + 1
        };
        
        columns.forEach(col => {
          if (col.checked) {
            row[col.label] = getCellValue(student, col.id);
          }
        });
        
        if (includeSignature) {
          row[signatureHeader] = '';
        }
        
        return row;
      });

      const ws = XLSX.utils.json_to_sheet([]);

      const titleAndHeaders = [
        ['CAREER LAUNCHER TUITION CLASSES, TUMSAR'],
        ['Custom Sheet: Roster & Marks Template'],
        [
          `Date: ${new Date().toLocaleDateString('en-IN')}`,
          `Classes: ${getSelectedClassesName()}`,
          `Subject: ${customSubject || 'N/A'}`,
          `Exam Name: ${customExamName || 'N/A'}`
        ],
        [] // Empty spacer
      ];

      XLSX.utils.sheet_add_aoa(ws, titleAndHeaders, { origin: 'A1' });
      XLSX.utils.sheet_add_json(ws, dataRows, { origin: 'A5', skipHeader: false });

      // Apply merging to Title Banner
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Roster Sheet');

      const cleanExamLabel = customExamName ? customExamName.replace(/\s+/g, '_') : 'Roster';
      XLSX.writeFile(wb, `${cleanExamLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      alert(`Excel export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const getCellValue = (student, colId) => {
    if (colId === 'marks') {
      const mark = studentMarks[student.id];
      if (mark !== undefined && mark !== null && mark !== '') {
        return mark.toString();
      }
      return '';
    }
    if (colId === 'fullName') {
      const last = student.lastName ? ` ${student.lastName}` : '';
      return `${student.name}${last}`;
    }
    if (colId === 'address') {
      const items = [student.address, student.city, student.pincode].filter(Boolean);
      return items.join(', ') || 'N/A';
    }
    if (colId === 'whatsapp') {
      return student.whatsapp || student.phone || 'N/A';
    }
    if (colId === 'parentName') {
      return student.parentName || 'N/A';
    }
    if (colId === 'parentPhone') {
      return student.parentPhone || 'N/A';
    }
    if (colId === 'schoolName') {
      return student.schoolName || 'N/A';
    }
    return student[colId] || 'N/A';
  };

  const filteredStudents = students.filter(student => {
    const cls = student.batch?.name || student.selectedClasses?.currentActiveClass;
    return cls && selectedClasses.includes(cls);
  });

  const getSelectedClassesName = () => {
    if (selectedClasses.length === AVAILABLE_CLASSES.length) return 'All Classes';
    if (selectedClasses.length === 0) return 'No Class Selected';
    const sorted = [...selectedClasses].sort((a, b) => {
      const aIdx = AVAILABLE_CLASSES.findIndex(c => c.id === a);
      const bIdx = AVAILABLE_CLASSES.findIndex(c => c.id === b);
      return aIdx - bIdx;
    });
    return sorted.map(c => {
      const clsObj = AVAILABLE_CLASSES.find(item => item.id === c);
      return clsObj ? clsObj.label : c;
    }).join(', ');
  };

  const getActiveColumnsCount = () => {
    return columns.filter(c => c.checked).length + (includeSignature ? 1 : 0);
  };

  const filteredExams = exams.filter(e => {
    return e.batch?.name && selectedClasses.includes(e.batch.name);
  });

  return (
    <div className="space-y-6">
      {/* Page Title & Tab Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white font-outfit">Print & Download Center</h1>
          <p className="text-slate-400 text-sm mt-0.5">Generate A4 layouts for prospectus sheets, admissions files, invoice receipts, and custom rosters</p>
        </div>

        <div className="flex gap-1.5 p-1 bg-slate-900/60 border border-slate-800/80 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('standard')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'standard'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850/40'
            }`}
          >
            Standard Forms
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === 'roster'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-850/40'
            }`}
          >
            Roster & Exam Sheets
          </button>
        </div>
      </div>

      {activeTab === 'standard' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
          
          {/* Card 1: Print Prospectus */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 bg-orange-500/10 rounded-xl text-orange-400 border border-orange-500/25 w-fit">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white text-lg font-outfit">Blank Admission Prospectus</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Print a clean, blank admission prospectus registration form for walkthrough physical registrations at the tuition center.
              </p>
            </div>
            <button
              onClick={handlePrintProspectus}
              className="w-full flex items-center justify-center gap-2 py-2.5 mt-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors"
            >
              <Printer className="h-4 w-4" />
              Print Blank Prospectus
            </button>
          </div>

          {/* Card 2: Print Student Admission File */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400 border border-blue-500/25 w-fit">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white text-lg font-outfit">Student Admission File</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Compile and print pre-filled details of a registered student, including category details, addresses, and fee plans.
              </p>
              
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="">-- Choose Student Profile --</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.name} {s.lastName || ''} ({s.rollNumber})</option>
                ))}
              </select>
            </div>
            <button
              onClick={handlePrintStudentRecord}
              disabled={!selectedStudentId}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              Print Student File
            </button>
          </div>

          {/* Card 3: Print Receipt Invoice */}
          <div className="glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-4 hover-glow-cyan flex flex-col justify-between">
            <div className="space-y-3">
              <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/25 w-fit">
                <Receipt className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white text-lg font-outfit">Payment Receipt Invoice</h3>
              <p className="text-xs text-slate-400 leading-normal">
                Choose a student and print a specific invoice receipt voucher for paid installments or deposits.
              </p>
              
              <div className="space-y-2">
                <select
                  value={selectedReceiptStudentId}
                  onChange={(e) => handleReceiptStudentChange(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">-- Choose Student Profile --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.lastName || ''} ({s.rollNumber})</option>
                  ))}
                </select>

                <select
                  value={selectedReceiptId}
                  onChange={(e) => setSelectedReceiptId(e.target.value)}
                  disabled={!selectedReceiptStudentId || receipts.length === 0}
                  className="w-full bg-[#070d1e] border border-slate-700/60 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500 disabled:opacity-40"
                >
                  <option value="">-- Choose Receipt Voucher --</option>
                  {receipts.map(r => (
                    <option key={r.id} value={r.id}>{r.receiptNo} (₹{r.amountPaid.toLocaleString()} - {new Date(r.paymentDate).toLocaleDateString()})</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handlePrintReceipt}
              disabled={!selectedReceiptId}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-40"
            >
              <Printer className="h-4 w-4" />
              Print Receipt Voucher
            </button>
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 no-print">
          {/* Left Config Panel */}
          <div className="xl:col-span-1 glass-panel p-6 rounded-2xl border border-blue-500/15 space-y-6 flex flex-col justify-between hover-glow-cyan text-white">
            <div className="space-y-5">
              
              {/* Target Classes checkbox list */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400">1. Target Classes</label>
                <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_CLASSES.map(cls => {
                      const isChecked = selectedClasses.includes(cls.id);
                      return (
                        <label
                          key={cls.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer select-none transition-all duration-150 text-xs font-semibold ${
                            isChecked
                              ? 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold shadow-[0_0_12px_rgba(37,99,235,0.1)]'
                              : 'border-slate-850 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClasses(prev => [...prev, cls.id]);
                              } else {
                                setSelectedClasses(prev => prev.filter(c => c !== cls.id));
                                if (selectedExamId) {
                                  const examObj = exams.find(ex => ex.id === selectedExamId);
                                  if (examObj && examObj.batch?.name === cls.id) {
                                    setSelectedExamId('');
                                  }
                                }
                              }
                            }}
                            className="rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-blue-500/20"
                          />
                          <span>{cls.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setSelectedClasses(AVAILABLE_CLASSES.map(c => c.id))}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedClasses([]);
                        setSelectedExamId('');
                      }}
                      className="text-slate-500 hover:text-slate-400 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              </div>

              {/* Exam reference selector */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400">2. Exam Reference (Optional)</label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500"
                >
                  <option value="">-- No Exam (Blank Marks Sheet) --</option>
                  {filteredExams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      [{ex.batch?.name}] {ex.name} - {ex.subject} ({ex.date})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Selecting an exam dynamically populates the Marks column from student test grades.
                </p>
              </div>

              {/* Custom Subject & Exam Title */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">Exam Title / Label</span>
                  <input
                    type="text"
                    value={customExamName}
                    onChange={(e) => setCustomExamName(e.target.value)}
                    disabled={!!selectedExamId}
                    placeholder="e.g. Test Name"
                    className="w-full bg-[#070d1e] border border-slate-850 disabled:opacity-40 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <span className="block text-[10px] text-slate-500 font-bold uppercase">Subject Name</span>
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    disabled={!!selectedExamId}
                    placeholder="e.g. Math"
                    className="w-full bg-[#070d1e] border border-slate-850 disabled:opacity-40 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Columns checklist */}
              <div className="space-y-2">
                <label className="block text-xs font-extrabold uppercase tracking-wide text-slate-400">3. Active Columns</label>
                <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl max-h-[160px] overflow-y-auto space-y-1">
                  {columns.map(col => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => {
                        if (!col.compulsory) {
                          setColumns(prev => prev.map(c => c.id === col.id ? { ...c, checked: !c.checked } : c));
                        }
                      }}
                      disabled={col.compulsory}
                      className={`w-full flex items-center gap-2 py-1 text-xs text-left font-semibold transition-colors ${
                        col.compulsory ? 'cursor-not-allowed opacity-80' : 'hover:text-blue-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={col.checked}
                        readOnly
                        disabled={col.compulsory}
                        className="rounded border-slate-800 text-blue-600 bg-slate-950 focus:ring-blue-500/20"
                      />
                      <span className="text-slate-350">{col.label} {col.compulsory && <span className="text-orange-500">*</span>}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Signature / Status Column configuration */}
              <div className="space-y-2 pt-2 border-t border-slate-850">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none text-slate-300">
                  <input
                    type="checkbox"
                    checked={includeSignature}
                    onChange={(e) => setIncludeSignature(e.target.checked)}
                    className="rounded border-slate-800 text-blue-500 bg-slate-950 focus:ring-blue-500/20"
                  />
                  <span>Include Sign / Notes Column</span>
                </label>
                {includeSignature && (
                  <div className="space-y-1">
                    <span className="block text-[10px] text-slate-500 font-bold uppercase">Header Column Text</span>
                    <input
                      type="text"
                      value={signatureHeader}
                      onChange={(e) => setSignatureHeader(e.target.value)}
                      placeholder="e.g. Signature"
                      className="w-full bg-[#070d1e] border border-slate-800 rounded-xl p-2 px-3 text-xs text-white outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={handlePrintRoster}
                disabled={filteredStudents.length === 0}
                className="py-2.5 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Print A4
              </button>
              <button
                onClick={handleDownloadExcel}
                disabled={filteredStudents.length === 0 || isExporting}
                className="py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {isExporting ? 'Exporting...' : 'Excel Sheet'}
              </button>
            </div>

          </div>

          {/* Right Preview Panel */}
          <div className="xl:col-span-3 glass-panel p-6 rounded-2xl border border-blue-500/15 flex flex-col justify-between hover-glow-cyan">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-850 pb-3">
                <h3 className="font-bold text-white text-lg font-outfit flex items-center gap-2">
                  Real-time Sheet Preview 
                  {customExamName && <span className="text-blue-400 font-normal">({customExamName})</span>}
                </h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/25 font-bold">
                  {filteredStudents.length} Students Loaded
                </span>
              </div>

              {/* Roster Table Preview */}
              <div className="overflow-x-auto rounded-xl border border-slate-850 max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 font-extrabold text-slate-400 uppercase tracking-wider bg-slate-900/40">
                      <th className="p-3 w-10 text-center">S.No</th>
                      {columns.filter(c => c.checked).map(col => (
                        <th key={col.id} className="p-3">{col.label}</th>
                      ))}
                      {includeSignature && (
                        <th className="p-3 w-40 text-center border-l border-slate-800">{signatureHeader}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredStudents.map((student, index) => (
                      <tr key={student.id} className="hover:bg-slate-900/35 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{index + 1}</td>
                        {columns.filter(c => c.checked).map(col => (
                          <td key={col.id} className="p-3">
                            {getCellValue(student, col.id)}
                          </td>
                        ))}
                        {includeSignature && (
                          <td className="p-3 border-l border-slate-800 bg-slate-950/20" />
                        )}
                      </tr>
                    ))}
                    {filteredStudents.length === 0 && (
                      <tr>
                        <td colSpan={getActiveColumnsCount() + 1} className="text-center py-12 text-slate-500 italic">
                          No students found matching class selection filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center justify-between border-t border-slate-850/60 pt-3">
              <span>Career Launcher Tuition Classes, Tumsar</span>
              <span>Roster Classes: {getSelectedClassesName()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
