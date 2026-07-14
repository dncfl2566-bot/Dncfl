import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Database,
  CheckSquare, 
  Download, 
  Trash2, 
  Edit, 
  Plus, 
  Search, 
  Link2, 
  FileSpreadsheet, 
  Save, 
  Award, 
  X, 
  ExternalLink, 
  FileText, 
  Eraser, 
  LogOut,
  AlertOctagon,
  RefreshCw,
  BarChart2,
  Image as ImageIcon
} from 'lucide-react';
import { Student, Question, Submission, QuestionType } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import MathRenderer from './MathRenderer';

// Initialize Firebase App and Auth once
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const firebaseAuth = getAuth(firebaseApp);

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'questions' | 'submissions' | 'summary' | 'exam-settings'>('submissions');
  
  // Data lists
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncingQuestions, setIsSyncingQuestions] = useState(false);
  
  // --- ตัวแปรและฟังก์ชันควบคุมเปิด-ปิดระบบสอบ ---
  const [examSettings, setExamSettings] = useState<Record<string, boolean>>({
    '3': true,
    '5': true,
    '6': true,
    '6/8': true
  });

  const fetchExamSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        setExamSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch exam settings:', err);
    }
  };

  // 🔥 ฟังก์ชันดึงข้อมูลจาก Google Sheets (Pull)
  const handlePullFromSheet = async () => {
    if (!confirm("⚠️ คำเตือน!\nคุณครูแน่ใจใช่หรือไม่ว่าต้องการดึงข้อมูลจาก Google Sheets?\nการทำงานนี้จะนำข้อสอบและรายชื่อนักเรียนจากในสเปรดชีตมา 'เขียนทับ' ข้อมูลปัจจุบันบนระบบทั้งหมด!")) return;
    try {
      const res = await fetch("/api/admin/google-sheets/pull", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 เชื่อมโยงสำเร็จ!\n- อัปเดตข้อสอบแล้ว: ${data.questionsCount} ข้อ\n- อัปเดตรายชื่อนักเรียนแล้ว: ${data.studentsCount} คน`);
        window.location.reload(); // รีเฟรชหน้าจอเพื่อดึงข้อมูลใหม่มาแสดงผล
      } else {
        alert(`❌ ไม่สามารถดึงข้อมูลได้: ${data.message}`);
      }
    } catch (e) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };

  // 🔥 ฟังก์ชันส่งข้อมูลขึ้น Google Sheets (Push)
  const handlePushToSheet = async () => {
    if (!confirm("คุณครูต้องการส่งข้อมูลข้อสอบและรายชื่อนักเรียนปัจจุบันขึ้นไปบันทึกบน Google Sheets ใช่หรือไม่?")) return;
    try {
      const res = await fetch("/api/admin/google-sheets/push-manual", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 บันทึกสำเร็จ!\n${data.message}`);
      } else {
        alert(`❌ เกิดข้อผิดพลาด: ${data.message}`);
      }
    } catch (e) {
      alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    }
  };
  
  const handleToggleExam = async (gradeLevel: string, isOpen: boolean) => {
    const updatedSettings = { ...examSettings, [gradeLevel]: isOpen };
    setExamSettings(updatedSettings);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updatedSettings })
      });
      const data = await res.json();
      if (data.success) {
        alert(`บันทึกการตั้งค่าระบบสอบ ม.${gradeLevel} สำเร็จ`);
      } else {
        alert(data.message || 'บันทึกสถานะไม่สำเร็จ');
        fetchExamSettings();
      }
    } catch (err) {
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
      fetchExamSettings();
    }
  };
 
  // Bulk Questions select state & ref
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const questionTextRef = useRef<HTMLTextAreaElement | null>(null);

  // Forms / Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({ id: '', name: '', class: '3/2', number: 1 });
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string, type: 'student' | 'question' | 'submission' | 'bulk-questions', name: string } | null>(null);

  const [sheetUrl, setSheetUrl] = useState('https://docs.google.com/spreadsheets/d/1apYsiVmw8e_zIPTUgAwl47uLXQaTEg7PbuqiqVf4Ods/edit?gid=0#gid=0');

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState<{
    gradeLevel: '3' | '5' | '6' | '6/8';
    set: 'A' | 'B' | 'BOTH';
    type: QuestionType;
    questionNumber: number;
    text: string;
    image: string;
    choices: string[];
    choiceImages: string[];
    correctAnswer: string;
  }>({
    gradeLevel: '3',
    set: 'A',
    type: 'multiple-choice',
    questionNumber: 1,
    text: '',
    image: '',
    choices: ['', '', '', ''],
    choiceImages: ['', '', '', ''],
    correctAnswer: ''
  });

  const [focusedInputId, setFocusedInputId] = useState<string>('form-q-text');

  const insertMathSymbol = (symValue: string) => {
    const inputEl = document.getElementById(focusedInputId) as HTMLInputElement | HTMLTextAreaElement;
    if (!inputEl) return;

    const start = inputEl.selectionStart || 0;
    const end = inputEl.selectionEnd || 0;
    const currentVal = inputEl.value;
    const newVal = currentVal.substring(0, start) + symValue + currentVal.substring(end);

    // Update the state
    if (focusedInputId === 'form-q-text') {
      setQuestionForm(prev => ({ ...prev, text: newVal }));
    } else if (focusedInputId === 'form-q-ans') {
      setQuestionForm(prev => ({ ...prev, correctAnswer: newVal }));
    } else if (focusedInputId.startsWith('form-q-choice-')) {
      const choiceIdx = parseInt(focusedInputId.replace('form-q-choice-', ''), 10);
      if (!isNaN(choiceIdx)) {
        const updatedChoices = [...questionForm.choices];
        updatedChoices[choiceIdx] = newVal;
        setQuestionForm(prev => ({ ...prev, choices: updatedChoices }));
      }
    }

    // Set cursor position back
    setTimeout(() => {
      inputEl.focus();
      const nextPos = start + symValue.length;
      inputEl.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradingForm, setGradingForm] = useState<{
    shortAnswerScores: Record<string, number>;
    writtenScore: number;
    feedback: string;
    editedMultipleChoiceAnswers?: Record<string, string>;
    editedShortAnswers?: Record<string, string>;
    cheated: boolean;
  }>({
    shortAnswerScores: {},
    writtenScore: 0,
    feedback: '',
    cheated: false
  });

  // Google OAuth & Workspace Integration States
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('google_access_token');
  });
  const [googleUser, setGoogleUser] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);

  // Fetch initial collections
  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, questionsRes, submissionsRes] = await Promise.all([
        fetch('/api/admin/students'),
        fetch('/api/admin/questions'),
        fetch('/api/admin/submissions')
      ]);

      const studentsData = await studentsRes.json();
      const questionsData = await questionsRes.json();
      const submissionsData = await submissionsRes.json();

      if (studentsData.success) setStudents(studentsData.students);
      if (questionsData.success) setQuestions(questionsData.questions);
      if (submissionsData.success) setSubmissions(submissionsData.submissions);
      // เรียกใช้เพื่อโหลดข้อมูลสถานะการเปิดสอบด้วย
      fetchExamSettings();
    } catch (err) {
      showMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดข้อมูลได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const connectServerToGoogleSheets = async (token: string) => {
    try {
      const res = await fetch('/api/admin/google-sheets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token })
      });
      const data = await res.json();
      if (data.success && data.url) {
        setSheetUrl(data.url);
        localStorage.setItem('google_spreadsheet_url', data.url);
        showMsg(`เชื่อมต่อ Google Sheet เพื่อซิงก์ข้อสอบ รายชื่อนักเรียน และผลคะแนนสอบแบบเรียลไทม์สำเร็จแล้ว!`, 'success');
        fetchData();
      }
    } catch (err) {
      console.error('Error connecting Google Sheets on server:', err);
    }
  };

  const getCurrentSpreadsheetId = (): string => {
    const matches = sheetUrl.trim().match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      return matches[1];
    }
    return '1apYsiVmw8e_zIPTUgAwl47uLXQaTEg7PbuqiqVf4Ods'; // Fallback
  };

  const handleSyncQuestionsFromSheet = async () => {
    const spreadsheetId = getCurrentSpreadsheetId();
    if (!spreadsheetId) {
      alert("กรุณาเชื่อมต่อและติดตั้ง Google Sheets ก่อนทำการดึงข้อมูลข้อสอบครับ");
      return;
    }
    
    if (!confirm("คุณต้องการดึงข้อมูลข้อสอบทั้งหมดจาก Google Sheets มาทับบนระบบใช่หรือไม่? (ข้อสอบเดิมในระบบจะถูกเปลี่ยนตามหน้าชีตปัจจุบัน)")) {
      return;
    }

    setIsSyncingQuestions(true);
    try {
      const response = await fetch("/api/admin/google-sheets/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      if (data.success) {
        alert(`ซิงค์สำเร็จ! ระบบตรวจพบข้อสอบทั้งหมดจำนวน ${data.questionsCount} ข้อ และรายชื่อนักเรียน ${data.studentsCount} คน จาก Google Sheets เรียบร้อยแล้วครับ`);
        fetchData(); // ดึงข้อมูลชุดใหม่ทั้งหมดมาแสดงผล
      } else {
        alert(`การซิงค์ล้มเหลว: ${data.message}`);
      }
    } catch (error) {
      console.error("Error syncing from sheets:", error);
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อเพื่อดึงข้อมูลจาก Google Sheets");
    } finally {
      setIsSyncingQuestions(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Check Google Sheets status on mount
    const checkGoogleSheetsStatus = async () => {
      try {
        const res = await fetch('/api/admin/google-sheets/status');
        const data = await res.json();
        if (data.success && data.url) {
          setSheetUrl(data.url);
          localStorage.setItem('google_spreadsheet_url', data.url);
        }
      } catch (err) {
        console.error('Error fetching Google Sheets status:', err);
      }
    };
    
    checkGoogleSheetsStatus();

    // Listen for postMessage from the popup window
    const handleGoogleAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data && event.data.type === 'GOOGLE_AUTH_SUCCESS' && event.data.hash) {
        const hash = event.data.hash;
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        if (token) {
          setGoogleAccessToken(token);
          localStorage.setItem('google_access_token', token);
          showMsg('เชื่อมต่อบัญชี Google สำเร็จเรียบร้อยแล้ว!', 'success');
          fetchGoogleProfile(token);
          connectServerToGoogleSheets(token);
        }
      }
    };
    window.addEventListener('message', handleGoogleAuthMessage);

    // Check Google Auth redirection hash parameters
    const hash = window.location.hash;
    if (hash && hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem('google_access_token', token);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        showMsg('เชื่อมต่อบัญชี Google สำเร็จเรียบร้อยแล้ว!', 'success');
        fetchGoogleProfile(token);
        connectServerToGoogleSheets(token);
      }
    } else {
      const savedToken = localStorage.getItem('google_access_token');
      if (savedToken) {
        fetchGoogleProfile(savedToken);
        connectServerToGoogleSheets(savedToken);
      }
    }

    return () => {
      window.removeEventListener('message', handleGoogleAuthMessage);
    };
  }, []);

  const fetchGoogleProfile = async (token: string) => {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleUser({
          email: data.email,
          name: data.name,
          picture: data.picture
        });
      } else {
        handleGoogleLogout();
      }
    } catch (err) {
      console.error('Error fetching Google profile:', err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/spreadsheets');
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      provider.addScope('https://www.googleapis.com/auth/drive');
      
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      showMsg('กำลังเปิดหน้าต่างลงชื่อเข้าใช้ Google...', 'info');
      const result = await signInWithPopup(firebaseAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (token) {
        setGoogleAccessToken(token);
        localStorage.setItem('google_access_token', token);
        showMsg('เชื่อมต่อบัญชี Google สำเร็จเรียบร้อยแล้ว!', 'success');
        fetchGoogleProfile(token);
        connectServerToGoogleSheets(token);
      } else {
        showMsg('ไม่ได้รับสิทธิ์การเข้าถึงจากบัญชี Google ของคุณ', 'error');
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.code === 'auth/popup-blocked') {
        alert('กรุณาเปิดการอนุญาตใช้งาน ป๊อปอัป (Pop-ups) ในตัวจัดการบราวเซอร์ของคุณ เพื่อเชื่อมต่อบัญชี Google!');
      } else {
        showMsg(`การลงชื่อเข้าใช้ล้มเหลว: ${err.message || err}`, 'error');
      }
    }
  };

  const handleGoogleLogout = async () => {
    setGoogleAccessToken(null);
    setGoogleUser(null);
    localStorage.removeItem('google_access_token');
    localStorage.removeItem('google_drive_folder_id');
    localStorage.removeItem('google_spreadsheet_url');
    try {
      await firebaseAuth.signOut();
    } catch (_) {}
    try {
      await fetch('/api/admin/google-sheets/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: '' })
      });
    } catch (_) {}
    showMsg('ยกเลิกการเชื่อมต่อบัญชี Google เรียบร้อย', 'info');
  };

  const getOrCreateDriveFolder = async (token: string): Promise<string> => {
    const savedFolderId = localStorage.getItem('google_drive_folder_id');
    if (savedFolderId) {
      return savedFolderId;
    }

    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Math Exam Images' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          const folderId = searchData.files[0].id;
          localStorage.setItem('google_drive_folder_id', folderId);
          return folderId;
        }
      }

      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Math Exam Images',
          mimeType: 'application/vnd.google-apps.folder'
        })
      });

      if (createRes.ok) {
        const folderData = await createRes.json();
        localStorage.setItem('google_drive_folder_id', folderData.id);
        return folderData.id;
      }
    } catch (e) {
      console.error('Error getting or creating Google Drive folder:', e);
    }

    return 'root';
  };

  const handleUploadImageFile = async (file: File): Promise<string> => {
    if (googleAccessToken) {
      try {
        const folderId = await getOrCreateDriveFolder(googleAccessToken);
        const metadata = {
          name: `${Date.now()}-${file.name}`,
          mimeType: file.type,
          parents: [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`
          },
          body: form
        });

        if (res.ok) {
          const fileData = await res.json();
          const fileId = fileData.id;

          await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              role: 'reader',
              type: 'anyone'
            })
          });

          return `https://docs.google.com/uc?export=view&id=${fileId}`;
        }
      } catch (err) {
        console.error('Google Drive upload failed, falling back to server local uploads:', err);
      }
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const res = await fetch('/api/admin/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: reader.result as string,
              filename: file.name
            })
          });
          const data = await res.json();
          if (data.success) {
            resolve(data.url);
          } else {
            reject(new Error(data.message || 'Server upload failed'));
          }
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const syncStudentsToGoogleSheet = async (listToSync = students) => {
    if (!googleAccessToken) {
      return;
    }

    setGoogleSyncing(true);
    try {
      const spreadsheetId = getCurrentSpreadsheetId();
      const clearRange = 'Sheet1!A:E';
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const values = [
        ['รหัสนักเรียน (ID)', 'ชื่อ-นามสกุล', 'ชั้นเรียน', 'เลขที่', 'วันที่เพิ่มเข้าชีต']
      ];

      listToSync.forEach(s => {
        values.push([
          s.id,
          s.name,
          `ม.${s.class}`,
          s.number.toString(),
          new Date().toLocaleDateString('th-TH')
        ]);
      });

      const updateRange = 'Sheet1!A1';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });

      if (res.ok) {
        showMsg('ซิงก์ข้อมูลนักเรียนทั้งหมดขึ้น Google Sheet ของคุณสำเร็จแล้ว!', 'success');
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to update sheet');
      }
    } catch (err: any) {
      console.error('Sheet sync error:', err);
      showMsg(`ซิงก์ขึ้น Google Sheet ล้มเหลว: ${err.message}`, 'error');
    } finally {
      setGoogleSyncing(false);
    }
  };

  const syncSubmissionsToGoogleSheet = async () => {
    if (!googleAccessToken) {
      showMsg('กรุณาลงชื่อเข้าใช้ Google เพื่อซิงก์ข้อมูลรายงานคะแนน', 'error');
      return;
    }

    setGoogleSyncing(true);
    try {
      const spreadsheetId = getCurrentSpreadsheetId();
      try {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'รายงานคะแนนสอบ'
                  }
                }
              }
            ]
          })
        });
      } catch (err) {
        // Ignored if sheet already exists
      }

      const clearRange = 'รายงานคะแนนสอบ!A:K';
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      const values = [
        [
          'รหัสนักเรียน',
          'ชื่อ-นามสกุล',
          'ชั้นเรียน',
          'เลขที่',
          'ข้อสอบชุด',
          'คะแนนปรนัย (MC)',
          'คะแนนอัตนัย (SA)',
          'คะแนนวิธีทำ (Written)',
          'คะแนนรวมทั้งหมด',
          'เวลาที่ส่ง (Thailand Time)',
          'สถานะทุจริต'
        ]
      ];

      submissions.forEach(s => {
        let formattedTime = s.submittedAt;
        try {
          formattedTime = new Date(s.submittedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
        } catch (_) {}

        let saSum = 0;
        if (s.shortAnswerScores) {
          Object.values(s.shortAnswerScores).forEach(score => {
            saSum += Number(score) || 0;
          });
        }

        values.push([
          s.studentId,
          s.name,
          `ม.${s.class}`,
          s.number.toString(),
          s.set,
          s.multipleChoiceScore.toString(),
          saSum.toString(),
          s.writtenScore.toString(),
          s.totalScore.toString(),
          formattedTime,
          s.cheated ? '⚠️ ทุจริต' : 'ปกติ'
        ]);
      });

      const updateRange = 'รายงานคะแนนสอบ!A1';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;

      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ values })
      });

      if (res.ok) {
        showMsg('ซิงก์ข้อมูลรายงานผลสอบขึ้น Google Sheet แท็บ "รายงานคะแนนสอบ" สำเร็จ!', 'success');
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error?.message || 'Failed to update submissions sheet');
      }
    } catch (err: any) {
      console.error('Submissions sheet sync error:', err);
      showMsg(`ซิงก์ผลคะแนนล้มเหลว: ${err.message}`, 'error');
    } finally {
      setGoogleSyncing(false);
    }
  };

  const handleDeleteSubmission = (subId: string, name: string) => {
    setDeleteConfirmInfo({
      id: subId,
      type: 'submission',
      name: `กระดาษคำตอบของนักเรียน: ${name} (รหัสกระดาษคำตอบ: ${subId})`
    });
  };

  const proceedDeleteSubmission = async (subId: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/submissions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: subId })
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(submissions.filter(s => s.id !== subId));
        showMsg('ลบกระดาษคำตอบของนักเรียนสำเร็จเรียบร้อยแล้ว', 'success');
      } else {
        showMsg(data.message || 'ลบไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showMsg('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMsg = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: 'info' }), 6000);
  };

  const handleFetchGoogleSheet = async () => {
    if (!sheetUrl.trim()) {
      showMsg('กรุณากรอกลิงก์ Google Sheet', 'error');
      return;
    }

    setLoading(true);
    showMsg('กำลังดึงข้อมูลและวิเคราะห์รายชื่อจาก Google Sheet...', 'info');

    try {
      const response = await fetch('/api/admin/students/fetch-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetUrl: sheetUrl.trim() })
      });
      const data = await response.json();

      if (data.success) {
        setStudents(data.students);
        showMsg(`ดึงข้อมูลรายชื่อสำเร็จ! นำเข้าข้อมูลนักเรียนจำนวนทั้งสิ้น ${data.count} คน`, 'success');
        if (googleAccessToken) {
          syncStudentsToGoogleSheet(data.students);
        }
      } else {
        showMsg(data.message || 'ดึงข้อมูลไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showMsg('เกิดข้อผิดพลาดในการนำเข้าไฟล์', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.id.trim() || !studentForm.name.trim()) {
      showMsg('กรุณากรอกข้อมูลนักเรียนให้ครบถ้วน', 'error');
      return;
    }

    const newStudent: Student = {
      id: studentForm.id.trim(),
      name: studentForm.name.trim(),
      class: studentForm.class,
      number: Number(studentForm.number)
    };

    let updatedList = [...students];
    if (editingStudent) {
      updatedList = updatedList.map(s => s.id === editingStudent.id ? newStudent : s);
    } else {
      if (students.some(s => s.id === newStudent.id)) {
        showMsg('รหัสนักเรียนนี้มีอยู่ในฐานข้อมูลแล้ว', 'error');
        return;
      }
      updatedList.push(newStudent);
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: updatedList })
      });
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        setIsStudentModalOpen(false);
        setEditingStudent(null);
        showMsg('บันทึกข้อมูลนักเรียนสำเร็จ', 'success');
        if (googleAccessToken) {
          syncStudentsToGoogleSheet(data.students);
        }
      } else {
        showMsg('บันทึกไม่สำเร็จ', 'error');
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStudent = (student: Student) => {
    setDeleteConfirmInfo({
      id: student.id,
      type: 'student',
      name: `นักเรียน: ${student.name} (เลขที่ ${student.number} ห้อง ${student.class})`
    });
  };

  const proceedDeleteStudent = async (studentId: string) => {
    const updatedList = students.filter(s => s.id !== studentId);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: updatedList })
      });
      const data = await res.json();
      if (data.success) {
        setStudents(data.students);
        showMsg('ลบนักเรียนเรียบร้อยแล้ว', 'success');
        if (googleAccessToken) {
          syncStudentsToGoogleSheet(data.students);
        }
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.text.trim() || !questionForm.correctAnswer.trim()) {
      showMsg('กรุณากรอกโจทย์และระบุเฉลยคำตอบ', 'error');
      return;
    }

    setLoading(true);
    try {
      let bodyData: any = {};

      if (questionForm.set === 'BOTH') {
        const baseId = editingQuestion?.id || `q-g${questionForm.gradeLevel.replace("/", "_")}-setA-${questionForm.type === 'multiple-choice' ? 'mc' : questionForm.type === 'short-answer' ? 'sa' : 'wr'}-${questionForm.questionNumber}`;
        const idA = baseId.includes('-setB-') ? baseId.replace('-setB-', '-setA-') : (baseId.includes('-setA-') ? baseId : baseId + '-setA');
        const idB = baseId.includes('-setA-') ? baseId.replace('-setA-', '-setB-') : (baseId.includes('-setB-') ? baseId : baseId + '-setB');

        const newQuestionA: Question = {
          id: idA,
          gradeLevel: questionForm.gradeLevel,
          set: 'A',
          type: questionForm.type,
          questionNumber: Number(questionForm.questionNumber),
          text: questionForm.text.trim(),
          image: questionForm.image.trim() || undefined,
          choices: questionForm.type === 'multiple-choice' ? questionForm.choices.filter(c => c.trim()) : undefined,
          choiceImages: questionForm.type === 'multiple-choice' ? questionForm.choiceImages : undefined,
          correctAnswer: questionForm.correctAnswer.trim()
        };

        const newQuestionB: Question = {
          id: idB,
          gradeLevel: questionForm.gradeLevel,
          set: 'B',
          type: questionForm.type,
          questionNumber: Number(questionForm.questionNumber),
          text: questionForm.text.trim(),
          image: questionForm.image.trim() || undefined,
          choices: questionForm.type === 'multiple-choice' ? questionForm.choices.filter(c => c.trim()) : undefined,
          choiceImages: questionForm.type === 'multiple-choice' ? questionForm.choiceImages : undefined,
          correctAnswer: questionForm.correctAnswer.trim()
        };

        bodyData = {
          questions: [newQuestionA, newQuestionB]
        };
      } else {
        const baseId = editingQuestion?.id || `q-g${questionForm.gradeLevel.replace("/", "_")}-set${questionForm.set}-${questionForm.type === 'multiple-choice' ? 'mc' : questionForm.type === 'short-answer' ? 'sa' : 'wr'}-${questionForm.questionNumber}`;
        
        let questionId = baseId;
        if (questionForm.set === 'A' && baseId.includes('-setB-')) {
          questionId = baseId.replace('-setB-', '-setA-');
        } else if (questionForm.set === 'B' && baseId.includes('-setA-')) {
          questionId = baseId.replace('-setA-', '-setB-');
        }

        const newQuestion: Question = {
          id: questionId,
          gradeLevel: questionForm.gradeLevel,
          set: questionForm.set,
          type: questionForm.type,
          questionNumber: Number(questionForm.questionNumber),
          text: questionForm.text.trim(),
          image: questionForm.image.trim() || undefined,
          choices: questionForm.type === 'multiple-choice' ? questionForm.choices.filter(c => c.trim()) : undefined,
          choiceImages: questionForm.type === 'multiple-choice' ? questionForm.choiceImages : undefined,
          correctAnswer: questionForm.correctAnswer.trim()
        };

        bodyData = {
          question: newQuestion
        };

        if (editingQuestion && editingQuestion.id !== questionId) {
          bodyData.deleteId = editingQuestion.id;
        }
      }

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();
      if (data.success) {
        const refreshedRes = await fetch('/api/admin/questions');
        const refreshedData = await refreshedRes.json();
        if (refreshedData.success) setQuestions(refreshedData.questions);
        
        setIsQuestionModalOpen(false);
        setEditingQuestion(null);
        showMsg('บันทึกข้อสอบสำเร็จ', 'success');
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteQuestion = (q: Question) => {
    setDeleteConfirmInfo({
      id: q.id,
      type: 'question',
      name: `ข้อสอบ ID: ${q.id} (ม.${q.gradeLevel} ชุด ${q.set} - ${q.text.substring(0, 40)}...)`
    });
  };

  const proceedDeleteQuestion = async (qId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/questions/${qId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(questions.filter(q => q.id !== qId));
        setSelectedQuestionIds(prev => prev.filter(id => id !== qId));
        showMsg('ลบข้อสอบสำเร็จ', 'success');
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteQuestions = () => {
    if (selectedQuestionIds.length === 0) return;
    setDeleteConfirmInfo({
      id: 'bulk',
      type: 'bulk-questions',
      name: `ข้อสอบที่เลือกทั้งหมดจำนวน ${selectedQuestionIds.length} ข้อ`
    });
  };

  const proceedBulkDeleteQuestions = async () => {
    if (selectedQuestionIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/questions/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedQuestionIds })
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(questions.filter(q => !selectedQuestionIds.includes(q.id)));
        setSelectedQuestionIds([]);
        showMsg('ลบข้อสอบที่เลือกสำเร็จเรียบร้อยแล้ว!', 'success');
      } else {
        showMsg(data.message || 'เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดในการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredQuestions = () => {
    return questions.filter(q => {
      const s = searchQuery.toLowerCase().trim();
      if (!s) return true;
      const typeTh = q.type === 'multiple-choice' ? 'ปรนัย' : q.type === 'short-answer' ? 'อัตนัยเติมคำ' : 'วิธีทำ';
      return q.text.toLowerCase().includes(s) || 
             q.id.toLowerCase().includes(s) || 
             `ม.${q.gradeLevel}`.toLowerCase().includes(s) ||
             q.gradeLevel.toLowerCase().includes(s) ||
             q.set.toLowerCase().includes(s) ||
             typeTh.includes(s);
    });
  };

  const isAllFilteredSelected = () => {
    const filtered = getFilteredQuestions();
    if (filtered.length === 0) return false;
    return filtered.every(q => selectedQuestionIds.includes(q.id));
  };

  const handleToggleSelectAllQuestions = () => {
    const filtered = getFilteredQuestions();
    if (isAllFilteredSelected()) {
      const filteredIds = filtered.map(q => q.id);
      setSelectedQuestionIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const newSelections = [...selectedQuestionIds];
      filtered.forEach(q => {
        if (!newSelections.includes(q.id)) {
          newSelections.push(q.id);
        }
      });
      setSelectedQuestionIds(newSelections);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setLoading(true);
    try {
      const response = await fetch('/api/admin/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: gradingSubmission.id,
          shortAnswerScores: gradingForm.shortAnswerScores,
          writtenScore: Number(gradingForm.writtenScore),
          feedback: gradingForm.feedback,
          editedMultipleChoiceAnswers: gradingForm.editedMultipleChoiceAnswers,
          editedShortAnswers: gradingForm.editedShortAnswers,
          cheated: gradingForm.cheated
        })
      });
      const data = await response.json();

      if (data.success) {
        setSubmissions(submissions.map(s => s.id === gradingSubmission.id ? data.submission : s));
        setGradingSubmission(null);
        showMsg('ตรวจและให้คะแนนกระดาษคำตอบพร้อมบันทึกคำตอบที่แก้ไขสำเร็จเรียบร้อย', 'success');
      }
    } catch (err) {
      showMsg('เกิดข้อผิดพลาดในการเซฟเกรด', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (submissions.length === 0) {
      showMsg('ไม่มีข้อมูลผลการสอบเพื่อส่งออกในขณะนี้', 'error');
      return;
    }

    const csvRows = [
      [
        'รหัสนักเรียน',
        'ชื่อ-สกุล',
        'ชั้นเรียน',
        'เลขที่',
        'ข้อสอบชุด',
        'คะแนนปรนัย (เต็ม 15)',
        'คะแนนอัตนัย (เต็ม 10)',
        'คะแนนวิธีทำ (เต็ม 5)',
        'คะแนนรวม (เต็ม 30)',
        'เวลาที่ใช้ (นาที)',
        'จำนวนสลับจอ (ครั้ง)',
        'สถานะการคุมสอบ',
        'สถานะการตรวจ'
      ].join(',')
    ];

    submissions.forEach(sub => {
      let saSum = 0;
      Object.keys(sub.shortAnswerScores).forEach(qId => {
        saSum += sub.shortAnswerScores[qId] || 0;
      });

      const cheatingState = sub.cheated ? 'ทุจริต (0 คะแนน)' : sub.cheatingWarningsCount > 0 ? `พบความเสี่ยง ${sub.cheatingWarningsCount} ครั้ง` : 'ปกติ';
      const gradingState = sub.graded ? 'ตรวจเสร็จแล้ว' : 'รอการตรวจ';

      csvRows.push([
        `"${sub.studentId}"`,
        `"${sub.name}"`,
        `"${sub.class}"`,
        sub.number,
        `"${sub.set}"`,
        sub.multipleChoiceScore,
        saSum,
        sub.writtenScore,
        sub.totalScore,
        sub.timeTaken,
        sub.cheatingWarningsCount,
        `"${cheatingState}"`,
        `"${gradingState}"`
      ].join(','));
    });

    const csvContent = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `คะแนนวิชาคณิตศาสตร์_ม_${new Date().toLocaleDateString('th-TH').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openEditStudent = (s: Student) => {
    setEditingStudent(s);
    setStudentForm({
      id: s.id,
      name: s.name,
      class: s.class,
      number: s.number
    });
    setIsStudentModalOpen(true);
  };

  const openAddStudent = () => {
    setEditingStudent(null);
    setStudentForm({
      id: '',
      name: '',
      class: '3/2',
      number: students.length > 0 ? Math.max(...students.map(s => s.number)) + 1 : 1
    });
    setIsStudentModalOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setQuestionForm({
      gradeLevel: q.gradeLevel,
      set: q.set,
      type: q.type,
      questionNumber: q.questionNumber,
      text: q.text,
      image: q.image || '',
      choices: q.choices ? [...q.choices] : ['', '', '', ''],
      choiceImages: q.choiceImages ? [...q.choiceImages] : (q.choices ? q.choices.map(() => '') : ['', '', '', '']),
      correctAnswer: q.correctAnswer
    });
    setIsQuestionModalOpen(true);
  };

  const openAddQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      gradeLevel: '3',
      set: 'A',
      type: 'multiple-choice',
      questionNumber: questions.length + 1,
      text: '',
      image: '',
      choices: ['', '', '', ''],
      choiceImages: ['', '', '', ''],
      correctAnswer: ''
    });
    setIsQuestionModalOpen(true);
  };

  const openGradingSheet = (sub: Submission) => {
    setGradingSubmission(sub);
    setGradingForm({
      shortAnswerScores: { ...sub.shortAnswerScores },
      writtenScore: sub.writtenScore,
      feedback: sub.feedback || '',
      editedMultipleChoiceAnswers: { ...sub.multipleChoiceAnswers },
      editedShortAnswers: { ...sub.shortAnswers },
      cheated: !!sub.cheated
    });
  };

  const filteredStudents = students.filter(s => 
    s.name.includes(searchQuery) || s.id.includes(searchQuery) || s.class.includes(searchQuery)
  );

  const filteredSubmissions = submissions.filter(s => 
    s.name.includes(searchQuery) || s.studentId.includes(searchQuery) || s.class.includes(searchQuery)
  );

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans" id="admin-panel-root">
      
      {/* Admin header */}
      <header className="bg-blue-900 text-white shadow-md border-b-4 border-red-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl">
              <Database size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold">แผงควบคุมคุณครูวิชาคณิตศาสตร์ (Admin Panel)</h1>
              <p className="text-xs text-white/80">ระบบวิเคราะห์ข้อมูล ตรวจสอบคำตอบ และจัดการคลังข้อสอบ</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-admin-logout"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors"
          >
            <LogOut size={14} />
            <span>ออกจากระบบแอดมิน</span>
          </button>
        </div>
      </header>

      {/* Main interface tab controls */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 flex-grow flex flex-col gap-6">
        
        {/* Alerts and messages banner */}
        {message.text && (
          <div className={`p-4 rounded-xl text-xs font-semibold border ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' :
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Google Workspace Integration Dashboard Widget */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${googleAccessToken ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              <Database size={20} />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span>เชื่อมต่อระบบ Google Workspace</span>
                {googleAccessToken ? (
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                ) : (
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500" />
                )}
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {googleAccessToken 
                  ? `เชื่อมต่อกับบัญชี: ${googleUser?.email || googleUser?.name || 'กำลังดึงข้อมูล...'} (Drive Folder & Sheets พร้อมใช้งาน)` 
                  : 'กรุณาเชื่อมต่อ Google สำหรับจัดเก็บรูปภาพข้อสอบใน Drive และซิงก์ข้อมูลนักเรียนลง Google Sheet'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {googleAccessToken ? (
              <>
                <button
                  type="button"
                  onClick={() => syncStudentsToGoogleSheet()}
                  disabled={googleSyncing}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {googleSyncing ? 'กำลังซิงก์ข้อมูล...' : 'ซิงก์นักเรียนลง Sheet'}
                </button>
                <button
                  onClick={handleSyncQuestionsFromSheet}
                  disabled={isSyncingQuestions}
                  className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isSyncingQuestions 
                      ? 'bg-slate-400 cursor-not-allowed' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <RefreshCw size={14} className={isSyncingQuestions ? 'animate-spin' : ''} />
                  <span>{isSyncingQuestions ? 'กำลังซิงค์ข้อสอบ...' : 'ซิงค์ข้อสอบจาก Sheet'}</span>
                </button>
                <button
                  type="button"
                  onClick={syncSubmissionsToGoogleSheet}
                  disabled={googleSyncing}
                  className="px-3.5 py-2 bg-[#002B49] hover:bg-[#002B49]/90 disabled:bg-blue-400 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {googleSyncing ? 'กำลังซิงก์ข้อมูล...' : 'ซิงก์รายงานคะแนนลง Sheet'}
                </button>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิกเชื่อมต่อ
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full md:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                เชื่อมต่อบัญชี Google
              </button>
            )}
          </div>
        </div>

        {/* Tab Buttons & Search bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            <button
              onClick={() => { setActiveTab('submissions'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'submissions' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <CheckSquare size={16} />
              <span>ตรวจข้อสอบ ({submissions.length})</span>
            </button>
            <button
              onClick={() => { setActiveTab('students'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'students' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Users size={16} />
              <span>รายชื่อนักเรียน ({students.length})</span>
            </button>
            <button
              onClick={() => { setActiveTab('exam-settings'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'exam-settings' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Award size={14} />
              <span>ตั้งค่าเปิด-ปิดข้อสอบ</span>
            </button>
            <button
              onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'questions' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Database size={16} />
              <span>คลังข้อสอบ ({questions.length})</span>
            </button>
            <button
              onClick={() => { setActiveTab('summary'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'summary' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <BarChart2 size={16} />
              <span>ภาพรวมรายห้อง ({Array.from(new Set(students.map(s => s.class))).length} ห้อง)</span>
            </button>
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="ค้นหาข้อมูลในตาราง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3.5 py-2 pl-9 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002B49]"
            />
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          </div>
        </div>

        {/* LOADING SHIM */}
        {loading && (
          <div className="w-full bg-blue-50 text-blue-700 p-3 rounded-lg border border-blue-200 text-xs font-medium flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>กำลังประมวลผลคำสั่ง โปรดรอสักครู่...</span>
          </div>
        )}

        {/* TAB VIEW 1: SUBMISSIONS & GRADING */}
        {activeTab === 'submissions' && (
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden flex-grow flex flex-col" id="tab-submissions">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">การส่งข้อสอบและคะแนนนักเรียน</h2>
                <p className="text-xs text-slate-500">ข้อมูลและผลคะแนนรวมของนักเรียนทุกคนที่ส่งกระดาษคำตอบเสร็จแล้ว</p>
              </div>
              <button
                type="button"
                id="btn-export-csv"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors self-end"
              >
                <Download size={14} />
                <span>ดาวน์โหลดรายงานคะแนน (CSV)</span>
              </button>
            </div>

            <div className="overflow-x-auto flex-grow">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  ไม่พบข้อมูลกระดาษคำตอบที่ต้องการค้นหา หรือยังไม่มีนักเรียนส่งสอบ
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">นักเรียน</th>
                      <th className="py-3 px-4">ชั้น/ห้อง</th>
                      <th className="py-3 px-4">ชุด</th>
                      <th className="py-3 px-4 text-center">ปรนัย (15)</th>
                      <th className="py-3 px-4 text-center">อัตนัย (10)</th>
                      <th className="py-3 px-4 text-center">แสดงวิธีทำ (5)</th>
                      <th className="py-3 px-4 text-center">คะแนนรวม (30)</th>
                      <th className="py-3 px-4 text-center">สลับหน้าต่าง</th>
                      <th className="py-3 px-4 text-center">สถานะ</th>
                      <th className="py-3 px-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map(sub => {
                      let saScore = 0;
                      if (sub.shortAnswerScores) {
                        Object.keys(sub.shortAnswerScores).forEach(qId => {
                          saScore += sub.shortAnswerScores[qId] || 0;
                        });
                      }

                      const studentSubs = submissions
                        .filter(s => s.studentId === sub.studentId)
                        .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
                      const attemptNumber = studentSubs.findIndex(s => s.id === sub.id) + 1;
                      const totalAttempts = studentSubs.length;

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 font-medium">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                              <span>{sub.name}</span>
                              {totalAttempts > 1 && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-200 shrink-0">
                                  รอบที่ {attemptNumber}/{totalAttempts}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {sub.studentId} | เลขที่: {sub.number}</div>
                            <div className="text-[10px] text-blue-700 font-bold mt-1 flex items-center gap-1 flex-wrap">
                              <span className="text-slate-400 font-normal">ส่งเมื่อ:</span>
                              <span>{sub.submittedAt}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">ม.{sub.class}</td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                              {sub.set}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {(sub.cheated && !sub.graded) ? <span className="text-red-500">0</span> : sub.multipleChoiceScore}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">{saScore}</td>
                          <td className="py-3 px-4 text-center text-slate-500">{sub.writtenScore}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded">
                              {(sub.cheated && !sub.graded) ? 0 : sub.totalScore} / 30
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded font-bold ${
                              sub.cheatingWarningsCount >= 3 ? 'bg-red-100 text-red-700' :
                              sub.cheatingWarningsCount > 0 ? 'bg-amber-100 text-amber-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {sub.cheatingWarningsCount} ครั้ง {sub.cheated && '(ทุจริต)'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sub.graded ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sub.graded ? 'ตรวจเสร็จสิ้น' : 'รอรับการตรวจ'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                type="button"
                                id={`btn-grade-sub-${sub.id}`}
                                onClick={() => openGradingSheet(sub)}
                                className="px-3 py-1.5 bg-[#002B49] hover:bg-blue-950 text-white rounded font-bold text-[11px] transition-all cursor-pointer"
                              >
                                ตรวจและให้คะแนน
                              </button>
                              <button
                                type="button"
                                id={`btn-delete-sub-${sub.id}`}
                                onClick={() => handleDeleteSubmission(sub.id, sub.name)}
                                className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded font-bold text-[11px] transition-all cursor-pointer"
                                title="ลบข้อมูลกระดาษคำตอบของนักเรียนคนนี้"
                              >
                                ลบคำตอบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB VIEW: SUMMARY STATISTICS */}
        {activeTab === 'summary' && (
          <div className="space-y-6" id="tab-summary">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-slate-400 font-bold text-[10px] uppercase">นักเรียนทั้งหมด</div>
                <div className="text-3xl font-black text-[#002B49] mt-1">{students.length} <span className="text-xs font-semibold text-slate-400">คน</span></div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-green-600 font-bold text-[10px] uppercase">เข้าสอบแล้ว</div>
                <div className="text-3xl font-black text-green-700 mt-1">
                  {(() => {
                    const uniqueSubmitters = new Set(submissions.map(s => s.studentId));
                    return uniqueSubmitters.size;
                  })()} <span className="text-xs font-semibold text-slate-400">คน</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-red-500 font-bold text-[10px] uppercase">ขาดสอบ</div>
                <div className="text-3xl font-black text-red-600 mt-1">
                  {(() => {
                    const uniqueSubmitters = new Set(submissions.map(s => s.studentId));
                    return students.filter(s => !uniqueSubmitters.has(s.id)).length;
                  })()} <span className="text-xs font-semibold text-slate-400">คน</span>
                </div>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-blue-600 font-bold text-[10px] uppercase">อัตราการเข้าสอบรวม</div>
                <div className="text-3xl font-black text-blue-700 mt-1">
                  {(() => {
                    const uniqueSubmitters = new Set(submissions.map(s => s.studentId));
                    const rate = students.length > 0 ? Math.round((uniqueSubmitters.size / students.length) * 100) : 0;
                    return `${rate}%`;
                  })()}
                </div>
              </div>
            </div>

            {/* Classroom Breakdown Grid */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BarChart2 className="text-[#002B49]" size={20} />
                <h2 className="font-bold text-[#002B49] text-sm">สถิติการเข้าสอบจำแนกรายห้องเรียน</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(() => {
                  const uniqueClasses = Array.from(new Set(students.map(s => s.class))).sort();
                  const uniqueSubmitters = new Set(submissions.map(s => s.studentId));

                  if (uniqueClasses.length === 0) {
                    return (
                      <div className="col-span-full text-center py-12 text-slate-400 text-xs font-bold">
                        ไม่มีข้อมูลห้องเรียนในระบบ กรุณานำเข้ารายชื่อนักเรียนก่อน
                      </div>
                    );
                  }

                  return uniqueClasses.map(cls => {
                    const classStudents = students.filter(s => s.class === cls);
                    const classSubmissions = classStudents.filter(s => uniqueSubmitters.has(s.id));
                    const absentStudents = classStudents.filter(s => !uniqueSubmitters.has(s.id));

                    const totalCount = classStudents.length;
                    const submittedCount = classSubmissions.length;
                    const absentCount = absentStudents.length;
                    const percent = totalCount > 0 ? Math.round((submittedCount / totalCount) * 100) : 0;

                    return (
                      <div key={cls} className="bg-slate-50 rounded-xl p-5 border border-slate-200 shadow-2xs space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-800 text-sm">ห้อง ม.{cls}</span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                            percent >= 80 ? 'bg-green-100 text-green-800' :
                            percent >= 50 ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {percent}% เข้าสอบ
                          </span>
                        </div>

                        <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden border border-slate-300">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${
                              percent >= 80 ? 'bg-green-600' :
                              percent >= 50 ? 'bg-amber-500' :
                              'bg-red-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="block text-[10px] text-slate-400 font-bold">ทั้งหมด</span>
                            <span className="text-sm font-black text-slate-700">{totalCount} คน</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="block text-[10px] text-green-500 font-bold">ส่งแล้ว</span>
                            <span className="text-sm font-black text-green-700">{submittedCount} คน</span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-slate-200">
                            <span className="block text-[10px] text-red-400 font-bold">ขาดสอบ</span>
                            <span className="text-sm font-black text-red-600">{absentCount} คน</span>
                          </div>
                        </div>

                        {submittedCount > 0 && (
                          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200 mb-2">
                            <div className="text-[11px] font-bold text-green-700 flex items-center gap-1">
                              <span>🟢 รายชื่อผู้เข้าสอบแล้ว ({submittedCount} คน):</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                              {classStudents
                                .filter(s => uniqueSubmitters.has(s.id))
                                .map(student => {
                                  const sub = submissions.find(s => s.studentId === student.id);
                                  const scoreText = sub ? (sub.graded ? `${sub.totalScore} คะแนน` : 'รอตรวจ') : '';
                                  const setLabel = sub ? `ชุด ${sub.set}` : '';
                                  const cheatLabel = sub?.cheated ? '⚠️ ทุจริต' : '';

                                  return (
                                    <span
                                      key={student.id}
                                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                                        sub?.cheated ? 'bg-red-50 text-red-800 border-red-200' : 'bg-green-50 text-green-700 border-green-200'
                                      }`}
                                    >
                                      เลขที่ {student.number}. {student.name} ({setLabel} {scoreText ? `| ${scoreText}` : ''} {cheatLabel ? ` ${cheatLabel}` : ''})
                                    </span>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {absentCount > 0 ? (
                          <div className="space-y-2 bg-white p-3.5 rounded-lg border border-slate-200">
                            <div className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                              <span>🔴 รายชื่อผู้ขาดสอบ ({absentCount} คน):</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {absentStudents.map(student => (
                                <span
                                  key={student.id}
                                  className="inline-block bg-red-50 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200"
                                >
                                  เลขที่ {student.number}. {student.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-2 bg-green-50 rounded-lg text-green-700 text-[10px] font-bold border border-green-200">
                            🎉 ยอดเยี่ยม! ทุกคนในห้องนี้ทำข้อสอบครบแล้ว
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* TAB VIEW 2: STUDENT MANAGEMENT & GOOGLE SHEETS IMPORT */}
        {activeTab === 'students' && (
          <div className="space-y-6" id="tab-students">
            {/* Google Sheets Fetch Form */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileSpreadsheet className="text-[#002B49]" size={20} />
                <h2 className="font-bold text-[#002B49] text-sm">นำเข้ารายชื่อนักเรียนจาก Google Sheet</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                กรอกลิงก์ Google Sheet ที่มีรายชื่อนักเรียน จากนั้นคลิก "ดึงข้อมูล" เพื่อทำการอัปเดตและเขียนทับฐานข้อมูลนักเรียนในระบบทันที
                <br />
                <strong className="text-red-600">ข้อกำหนด:</strong> ต้องแชร์ลิงก์ Google Sheet ให้สิทธิ์เข้าถึงเป็น <strong className="underline">"ทุกคนที่มีลิงก์มีสิทธิ์อ่าน"</strong> เท่านั้นเพื่อความสำเร็จ
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={sheetUrl}
                  id="sheet-url-input"
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="ลิงก์แชร์ของ Google Sheets"
                  className="flex-grow px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002B49]"
                />
                <button
                  type="button"
                  id="btn-fetch-sheet"
                  onClick={handleFetchGoogleSheet}
                  disabled={loading}
                  className="px-6 py-2.5 bg-[#002B49] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>ดึงข้อมูลจาก Google Sheet</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
                <span>ลิงก์ตัวอย่างชีตเป้าหมาย: <a href="https://docs.google.com/spreadsheets/d/1apYsiVmw8e_zIPTUgAwl47uLXQaTEg7PbuqiqVf4Ods/edit?gid=0#gid=0" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium inline-flex items-center gap-0.5">เปิดดูตัวอย่างชีต <ExternalLink size={10} /></a></span>
                <span>* ตารางควรมีคอลัมน์: รหัสนักเรียน, ชื่อ-นามสกุล, ชั้น, เลขที่</span>
              </div>
            </div>

            {/* Students List Table */}
            <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">รายชื่อนักเรียนที่ลงทะเบียนสำเร็จ ({students.length} คน)</h2>
                  <p className="text-xs text-slate-500">นักเรียนที่มีรหัสในตารางนี้จะสามารถเข้าสู่ระบบและทำข้อสอบวิชาคณิตศาสตร์ได้</p>
                </div>
                <button
                  type="button"
                  id="btn-add-student-modal"
                  onClick={openAddStudent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors self-end cursor-pointer"
                >
                  <Plus size={14} />
                  <span>เพิ่มนักเรียนใหม่</span>
                </button>
              </div>

              <div className="overflow-x-auto flex-grow">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs">
                    ไม่พบข้อมูลรายชื่อนักเรียนในระบบ
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-600 font-sans">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-6">รหัสนักเรียน (ID)</th>
                        <th className="py-3 px-6">ชื่อ-นามสกุล</th>
                        <th className="py-3 px-6">ห้องเรียน</th>
                        <th className="py-3 px-6">เลขที่</th>
                        <th className="py-3 px-6 text-right">ดำเนินการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredStudents.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-3 px-6 font-mono text-slate-800 font-bold">{s.id}</td>
                          <td className="py-3 px-6 text-slate-700 font-bold">{s.name}</td>
                          <td className="py-3 px-6">
                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded font-mono text-[10px] font-bold">
                              ม.{s.class}
                            </span>
                          </td>
                          <td className="py-3 px-6 font-mono">{s.number}</td>
                          <td className="py-3 px-6 text-right flex justify-end gap-1.5 pt-3">
                            <button
                              type="button"
                              onClick={() => openEditStudent(s)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB VIEW 3: QUESTION MANAGEMENT */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden flex-grow flex flex-col" id="tab-questions">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center flex-wrap gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">คลังและสุ่มข้อสอบ (Question Bank)</h2>
                <p className="text-xs text-slate-500">จัดการ เพิ่ม แก้ไขตัวเลือก และคำตอบของโจทย์ข้อสอบทั้งหมดในระบบ</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {selectedQuestionIds.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkDeleteQuestions}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors self-end animate-fade-in cursor-pointer"
                  >
                    <Trash2 size={14} />
                    <span>ลบที่เลือก ({selectedQuestionIds.length} ข้อ)</span>
                  </button>
                )}
                <button
                  type="button"
                  id="btn-add-question-modal"
                  onClick={openAddQuestion}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors self-end cursor-pointer"
                >
                  <Plus size={14} />
                  <span>เพิ่มข้อสอบใหม่</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 leading-relaxed font-semibold">
              💡 แนะนำรูปภาพข้อสอบ: คุณครูสามารถนำไฟล์รูปภาพไปเก็บในโฟลเดอร์ Google Drive <a href="https://drive.google.com/drive/folders/1EbKMnX8twSAStZxjJXidlv_1D5G5u6GR" target="_blank" rel="noreferrer" className="text-[#002B49] underline inline-flex items-center gap-0.5">คลังภาพไดรฟ์ <ExternalLink size={10} /></a> จากนั้นคัดลอก 'ลิงก์รูปภาพ' มาวางใส่ช่องที่ระบุในข้อสอบเพื่อแสดงผลภาพประกอบได้อย่างสวยงาม
            </div>

            <div className="overflow-x-auto flex-grow">
              {questions.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs">
                  ไม่พบข้อมูลข้อสอบในระบบ
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-600 font-sans">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4 w-12 text-center select-none">
                        <input
                          type="checkbox"
                          checked={isAllFilteredSelected()}
                          onChange={handleToggleSelectAllQuestions}
                          className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4">ID / ระดับชั้น</th>
                      <th className="py-3 px-4">ข้อสอบชุด</th>
                      <th className="py-3 px-4">ประเภท</th>
                      <th className="py-3 px-4 w-1/3">โจทย์คำถาม</th>
                      <th className="py-3 px-4">คำตอบเฉลย</th>
                      <th className="py-3 px-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {getFilteredQuestions().map(q => {
                      const isSelected = selectedQuestionIds.includes(q.id);
                      return (
                        <tr key={q.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-blue-50/70 hover:bg-blue-50' : ''}`}>
                          <td className="py-3 px-4 text-center select-none">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedQuestionIds(prev =>
                                  prev.includes(q.id)
                                    ? prev.filter(id => id !== q.id)
                                    : [...prev, q.id]
                                );
                              }}
                              className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800 font-sans">ม.{q.gradeLevel}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {q.id}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded font-mono text-[10px] font-bold">
                              ชุด {q.set}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              q.type === 'multiple-choice' ? 'bg-purple-100 text-purple-800' :
                              q.type === 'short-answer' ? 'bg-amber-100 text-amber-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {q.type === 'multiple-choice' ? 'ปรนัย' : q.type === 'short-answer' ? 'อัตนัยเติมคำ' : 'วิธีทำ'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="line-clamp-2 text-slate-700 font-sans" title={q.text}>
                              ข้อที่ {q.questionNumber}. <MathRenderer text={q.text} />
                            </div>
                            {q.image && (
                              <span className="inline-flex items-center gap-1.5 text-[10px] text-blue-600 font-semibold mt-1">
                                <ImageIcon size={10} /> มีรูปประกอบ
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-blue-800">
                            {q.correctAnswer.length > 35 ? `${q.correctAnswer.substring(0, 35)}...` : q.correctAnswer}
                          </td>
                          <td className="py-3 px-4 text-right flex justify-end gap-1.5 pt-4">
                            <button
                              type="button"
                              onClick={() => openEditQuestion(q)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteQuestion(q)}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB VIEW 5: EXAM SYSTEM SETTINGS */}
        {activeTab === 'exam-settings' && (
          <div className="bg-white rounded-2xl shadow border border-slate-200 p-6 space-y-6" id="tab-exam-settings">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="font-bold text-[#002B49] text-sm flex items-center gap-2">
                <CheckSquare size={18} />
                <span>ควบคุมการเปิด-ปิดระบบข้อสอบ (รายระดับชั้น)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                คุณครูสามารถควบคุมการเปิดหรือปิดห้องสอบของแต่ละระดับชั้นได้ที่นี่ นักเรียนในระดับชั้นที่ถูก "ปิด" จะไม่สามารถเข้าไปทำข้อสอบหรือล็อกอินได้
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: '3', label: 'มัธยมศึกษาปีที่ 3 (ม.3/2)', desc: 'ควบคุมสิทธิ์การเข้าทำข้อสอบห้อง ม.3' },
                { key: '5', label: 'มัธยมศึกษาปีที่ 5 (ม.5/3, ม.5/5)', desc: 'ควบคุมสิทธิ์การเข้าทำข้อสอบห้อง ม.5' },
                { key: '6', label: 'มัธยมศึกษาปีที่ 6 (ม.6/3, ม.6/5)', desc: 'ควบคุมสิทธิ์การเข้าทำข้อสอบห้อง ม.6 ปกติ' },
                { key: '6/8', label: 'มัธยมศึกษาปีที่ 6 (ม.6/8)', desc: 'ควบคุมสิทธิ์การเข้าทำข้อสอบห้อง ม.6/8 (เรียนเฉพาะทาง)' },
              ].map((exam) => (
                <div key={exam.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center transition-all hover:shadow-xs">
                  <div>
                    <h3 className="font-bold text-slate-800 text-xs">{exam.label}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">{exam.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                      examSettings[exam.key] ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {examSettings[exam.key] ? '🟢 กำลังเปิดสอบ' : '🔴 ปิดระบบสอบ'}
                    </span>
                    
                    <button
                      type="button"
                      onClick={() => handleToggleExam(exam.key, !examSettings[exam.key])}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        examSettings[exam.key] ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          examSettings[exam.key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL 1: ADD / EDIT STUDENT */}
      {isStudentModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#002B49] to-[#003c66] text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Users size={18} />
                <span>{editingStudent ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มข้อมูลนักเรียนใหม่'}</span>
              </h3>
              <button onClick={() => setIsStudentModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveStudent} className="p-6 space-y-4 text-xs font-semibold">
              <div className="space-y-1.5">
                <label className="block text-slate-700">รหัสนักเรียน (ID สำหรับ Login)</label>
                <input
                  type="text"
                  value={studentForm.id}
                  id="form-student-id"
                  onChange={(e) => setStudentForm({ ...studentForm, id: e.target.value })}
                  placeholder="เช่น 30201"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  disabled={!!editingStudent}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-slate-700">ชื่อ-นามสกุลจริง</label>
                <input
                  type="text"
                  value={studentForm.name}
                  id="form-student-name"
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  placeholder="เด็กชายสมรักษ์ ทรหด"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-700">ชั้นเรียน (ห้อง)</label>
                  <select
                    value={studentForm.class}
                    id="form-student-class"
                    onChange={(e) => setStudentForm({ ...studentForm, class: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none"
                  >
                    <option value="3/2">3/2</option>
                    <option value="5/3">5/3</option>
                    <option value="5/5">5/5</option>
                    <option value="6/3">6/3</option>
                    <option value="6/5">6/5</option>
                    <option value="6/8">6/8</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-700">เลขที่</label>
                  <input
                    type="number"
                    value={studentForm.number}
                    id="form-student-number"
                    onChange={(e) => setStudentForm({ ...studentForm, number: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-4">
                <button
                  type="button"
                  id="btn-cancel-student"
                  onClick={() => setIsStudentModalOpen(false)}
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  id="btn-submit-student"
                  className="w-2/3 py-2 bg-[#002B49] text-white rounded font-bold transition-colors shadow hover:bg-blue-950 cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT QUESTION */}
      {isQuestionModalOpen && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-8">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white p-5 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Database size={18} />
                <span>{editingQuestion ? 'แก้ไขข้อมูลข้อสอบ' : 'เพิ่มข้อสอบใหม่'}</span>
              </h3>
              <button onClick={() => setIsQuestionModalOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion} className="p-6 space-y-4 text-xs font-semibold max-h-[80vh] overflow-y-auto">
              
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-slate-700">ระดับชั้น</label>
                  <select
                    value={questionForm.gradeLevel}
                    id="form-q-grade"
                    onChange={(e) => setQuestionForm({ ...questionForm, gradeLevel: e.target.value as '3' | '5' | '6' | '6/8' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none"
                  >
                    <option value="3">ม.3 (3/2)</option>
                    <option value="5">ม.5 (5/3, 5/5)</option>
                    <option value="6">ม.6 (6/3, 6/5)</option>
                    <option value="6/8">ม.6/8 (เรียนคนละรหัส)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-700">ข้อสอบชุด</label>
                  <select
                    value={questionForm.set}
                    id="form-q-set"
                    onChange={(e) => setQuestionForm({ ...questionForm, set: e.target.value as 'A' | 'B' | 'BOTH' })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none"
                  >
                    <option value="A">ชุด A (เลขคี่)</option>
                    <option value="B">ชุด B (เลขคู่)</option>
                    <option value="BOTH">ทั้งสองชุด (ชุด A และ B)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-slate-700">ประเภทข้อสอบ</label>
                  <select
                    value={questionForm.type}
                    id="form-q-type"
                    onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value as QuestionType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none"
                  >
                    <option value="multiple-choice">ปรนัย (เลือกตอบ)</option>
                    <option value="short-answer">อัตนัยเติมคำ</option>
                    <option value="written">อัตนัยแสดงวิธีทำ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-700">ข้อที่ (ลำดับในชุด)</label>
                <input
                  type="number"
                  value={questionForm.questionNumber}
                  id="form-q-no"
                  onChange={(e) => setQuestionForm({ ...questionForm, questionNumber: Number(e.target.value) })}
                  className="w-24 px-3 py-2 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-700 font-semibold">โจทย์คำถาม (พิมพ์ข้อความ)</label>
                <div className="flex flex-wrap gap-1 bg-slate-50 p-2.5 rounded-t border border-b-0 border-slate-300">
                  <span className="text-[10px] text-[#002B49] font-bold w-full mb-1">💡 เครื่องหมายคณิตศาสตร์ & เทมเพลต LaTeX (คลิกพิมพ์ใส่ช่องที่กำลังเลือก - โจทย์, ตัวเลือก หรือเฉลย):</span>
                  {[
                    { label: '+', value: '+' },
                    { label: '−', value: '−' },
                    { label: '×', value: '\\times ' },
                    { label: '÷', value: '\\div ' },
                    { label: '=', value: '=' },
                    { label: '≠', value: '\\ne ' },
                    { label: '√', value: '\\sqrt{x}' },
                    { label: 'π', value: '\\pi ' },
                    { label: '²', value: '^{2}' },
                    { label: '³', value: '^{3}' },
                    { label: '°', value: '^{\\circ}' },
                    { label: '≈', value: '\\approx ' },
                    { label: '≤', value: '\\le ' },
                    { label: '≥', value: '\\ge ' },
                    { label: 'เศษส่วน 🖩', value: '\\frac{a}{b}' },
                    { label: 'ยกกำลัง 🖩', value: 'x^{y}' },
                    { label: 'รากที่สอง 🖩', value: '\\sqrt{x}' },
                    { label: 'สูตรบล็อก 🖩', value: '$$y = ax + b$$' },
                  ].map((sym) => (
                    <button
                      key={sym.label}
                      type="button"
                      onClick={() => insertMathSymbol(sym.value)}
                      className="px-2 py-0.5 bg-white hover:bg-blue-50 text-slate-700 rounded text-[10px] font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                    >
                      {sym.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={questionForm.text}
                  id="form-q-text"
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  onFocus={() => setFocusedInputId('form-q-text')}
                  rows={3}
                  placeholder="พิมพ์คำถามข้อสอบวิชาคณิตศาสตร์ที่นี่..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-b focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs font-semibold"
                />

                {questionForm.text && (
                  <div className="mt-1.5 bg-slate-50 p-2 border border-slate-200 rounded text-xs">
                    <span className="text-slate-400 block text-[9px] font-bold">พรีวิวการแสดงผลตัวโจทย์ (Live Preview):</span>
                    <div className="mt-1 p-2 bg-white rounded border min-h-[32px] flex items-center justify-start text-xs font-semibold">
                      <MathRenderer text={questionForm.text} />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-slate-700">รูปภาพประกอบข้อสอบ (ถ้ามี)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={questionForm.image}
                    id="form-q-image"
                    onChange={(e) => setQuestionForm({ ...questionForm, image: e.target.value })}
                    placeholder="ใส่ URL รูปภาพ หรือแนบไฟล์รูปจากคอมพิวเตอร์เพื่ออัปโหลด..."
                    className="flex-grow px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none text-xs font-mono"
                  />
                  <label className="cursor-pointer px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold text-xs flex items-center justify-center shrink-0">
                    <span>แนบรูป</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          showMsg('กำลังอัปโหลดรูปภาพไปยัง Google Drive / เซิร์ฟเวอร์...', 'info');
                          try {
                            const uploadedUrl = await handleUploadImageFile(file);
                            setQuestionForm(prev => ({ ...prev, image: uploadedUrl }));
                            showMsg('อัปโหลดและใส่รูปประกอบสำเร็จเรียบร้อย!', 'success');
                          } catch (err: any) {
                            showMsg('อัปโหลดรูปภาพล้มเหลว: ' + err.message, 'error');
                          }
                        }
                      }}
                    />
                  </label>
                </div>
                {questionForm.image && (
                  <div className="mt-2 relative inline-block">
                    <img src={questionForm.image} alt="Preview" className="max-h-24 object-contain rounded border bg-slate-100 p-1" />
                    <button
                      type="button"
                      onClick={() => setQuestionForm(prev => ({ ...prev, image: '' }))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center hover:bg-red-700 shadow-sm cursor-pointer"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>

              {questionForm.type === 'multiple-choice' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3.5">
                  <p className="text-[11px] text-[#002B49] font-bold">กำหนดตัวเลือกตอบ ก ข ค ง (และ จ ถ้าต้องการ) พร้อมรูปภาพตัวเลือก:</p>
                  
                  {questionForm.choices.map((choiceText, cIdx) => (
                    <div key={cIdx} className="space-y-1.5 p-3 bg-white border border-slate-200 rounded-lg shadow-2xs">
                      <div className="flex gap-2 items-center">
                        <span className="w-16 shrink-0 text-slate-500 text-center font-bold">ตัวเลือก {['ก', 'ข', 'ค', 'ง', 'จ'][cIdx]}</span>
                        <input
                          type="text"
                          value={choiceText}
                          id={`form-q-choice-${cIdx}`}
                          onChange={(e) => {
                            const updated = [...questionForm.choices];
                            updated[cIdx] = e.target.value;
                            setQuestionForm({ ...questionForm, choices: updated });
                          }}
                          onFocus={() => setFocusedInputId(`form-q-choice-${cIdx}`)}
                          placeholder={`พิมพ์รายละเอียดตัวเลือกที่ ${cIdx + 1}`}
                          className="flex-grow px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold focus:outline-none"
                        />
                        <div className="relative shrink-0">
                          <input
                            type="file"
                            accept="image/*"
                            id={`file-upload-choice-${cIdx}`}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  showMsg('กำลังอัปโหลดรูปภาพตัวเลือก...', 'info');
                                  const uploadedUrl = await handleUploadImageFile(file);
                                  const updatedImages = [...(questionForm.choiceImages || ['', '', '', ''])];
                                  updatedImages[cIdx] = uploadedUrl;
                                  setQuestionForm({ ...questionForm, choiceImages: updatedImages });
                                  showMsg('อัปโหลดรูปภาพตัวเลือกสำเร็จ!', 'success');
                                } catch (err) {
                                  showMsg('อัปโหลดล้มเหลว: ' + (err as Error).message, 'error');
                                }
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor={`file-upload-choice-${cIdx}`}
                            className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold cursor-pointer transition-colors flex items-center gap-1 border border-slate-300 shrink-0"
                          >
                            📷 อัปรูป
                          </label>
                        </div>
                      </div>

                      {choiceText && (
                        <div className="ml-16 mt-1 bg-slate-50/50 p-1.5 border border-slate-200 rounded text-[10px] flex items-center gap-2">
                          <span className="text-slate-400 font-bold shrink-0">พรีวิวคณิตศาสตร์:</span>
                          <span className="font-semibold text-slate-800">
                            <MathRenderer text={choiceText} />
                          </span>
                        </div>
                      )}

                      {questionForm.choiceImages?.[cIdx] && (
                        <div className="ml-16 flex items-center gap-3 bg-slate-50 p-2 rounded border border-slate-200 max-w-md">
                          <img
                            src={questionForm.choiceImages[cIdx]}
                            alt={`รูปตัวเลือก ${['ก', 'ข', 'ค', 'ง', 'จ'][cIdx]}`}
                            className="h-12 object-contain rounded border bg-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updatedImages = [...(questionForm.choiceImages || ['', '', '', ''])];
                              updatedImages[cIdx] = '';
                              setQuestionForm({ ...questionForm, choiceImages: updatedImages });
                            }}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            ❌
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[#D22630]">ระบุเฉลยคำตอบ (ต้องตรงกับค่าเฉลยที่ต้องการ)</label>
                <input
                  type="text"
                  value={questionForm.correctAnswer}
                  id="form-q-ans"
                  onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                  onFocus={() => setFocusedInputId('form-q-ans')}
                  placeholder="ระบุเฉลยคำตอบที่ถูกต้อง..."
                  className="w-full px-3 py-2 bg-red-50/50 border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors shadow"
                >
                  บันทึกข้อสอบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: SUBMISSION GRADING VIEW */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8 flex flex-col max-h-[90vh]">
            <div className="bg-gradient-to-r from-red-800 to-[#D22630] text-white p-5 shrink-0 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">ตรวจและให้คะแนนกระดาษคำตอบวิชาคณิตศาสตร์</h3>
                <p className="text-[11px] text-white/80">นักเรียน: {gradingSubmission.name} (รหัส: {gradingSubmission.studentId})</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-white/80 hover:text-white cursor-pointer">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveGrade} className="p-6 overflow-y-auto space-y-6 text-xs font-semibold flex-grow">
              <div className="p-4 rounded-xl border bg-slate-50 flex justify-between items-center">
                <span>บังคับสถานะทุจริต (คะแนนเป็น 0)</span>
                <input 
                  type="checkbox" 
                  checked={gradingForm.cheated} 
                  onChange={(e) => setGradingForm({...gradingForm, cheated: e.target.checked})} 
                />
              </div>

              {/* ปิดท้ายด้วยปุ่ม Submit ของฟอร์ม */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="w-1/3 py-2.5 bg-slate-100 text-slate-700 rounded"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-2.5 bg-green-600 text-white rounded font-bold shadow"
                >
                  บันทึกผลการตรวจคะแนน
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deleteConfirmInfo && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center">
            <AlertOctagon size={40} className="mx-auto text-red-600 mb-2" />
            <h3 className="text-sm font-bold text-slate-900">ยืนยันการลบข้อมูล?</h3>
            <p className="text-xs text-slate-500 my-2 break-words">{deleteConfirmInfo.name}</p>
            <div className="flex gap-2 mt-4 text-xs font-bold">
              <button 
                type="button" 
                onClick={() => setDeleteConfirmInfo(null)} 
                className="w-1/2 py-2 bg-slate-100 rounded text-slate-700"
              >
                ยกเลิก
              </button>
              <button 
                type="button" 
                onClick={async () => {
                  if (deleteConfirmInfo.type === 'student') await proceedDeleteStudent(deleteConfirmInfo.id);
                  if (deleteConfirmInfo.type === 'question') await proceedDeleteQuestion(deleteConfirmInfo.id);
                  if (deleteConfirmInfo.type === 'submission') await proceedDeleteSubmission(deleteConfirmInfo.id);
                  if (deleteConfirmInfo.type === 'bulk-questions') await proceedBulkDeleteQuestions();
                  setDeleteConfirmInfo(null);
                }} 
                className="w-1/2 py-2 bg-red-600 text-white rounded"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
