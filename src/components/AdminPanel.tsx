import React, { useState, useEffect } from 'react';
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
  Image as ImageIcon
} from 'lucide-react';
import { Student, Question, Submission, QuestionType } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

interface AdminPanelProps {
  onLogout: () => void;
}

export default function AdminPanel({ onLogout }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'questions' | 'submissions'>('submissions');
  
  // Data lists
  const [students, setStudents] = useState<Student[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: 'info' });
  const [searchQuery, setSearchQuery] = useState('');

  // Forms / Modals
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentForm, setStudentForm] = useState({ id: '', name: '', class: '3/2', number: 1 });
  const [deleteConfirmInfo, setDeleteConfirmInfo] = useState<{ id: string, type: 'student' | 'question', name: string } | null>(null);

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
    correctAnswer: string;
  }>({
    gradeLevel: '3',
    set: 'A',
    type: 'multiple-choice',
    questionNumber: 1,
    text: '',
    image: '',
    choices: ['', '', '', ''],
    correctAnswer: ''
  });

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
    } catch (err) {
      showMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อโหลดข้อมูลได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

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
      }
    } else {
      const savedToken = localStorage.getItem('google_access_token');
      if (savedToken) {
        fetchGoogleProfile(savedToken);
      }
    }
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

  const handleGoogleLogin = () => {
    // Standard Google Client ID configured via Cloud Console
    // Admin is allowed to paste custom client ID in UI settings or use the default
    const clientId = localStorage.getItem('google_client_id') || firebaseConfig.oAuthClientId || "691304662156-7qds6j1or1fpeo7r5pj8mvaimoa07382.apps.googleusercontent.com";
    const redirectUri = window.location.origin + '/';
    const scope = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive'
    ].join(' ');

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(clientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=token&` +
      `scope=${encodeURIComponent(scope)}&` +
      `prompt=select_account`;

    window.location.href = authUrl;
  };

  const handleGoogleLogout = () => {
    setGoogleAccessToken(null);
    setGoogleUser(null);
    localStorage.removeItem('google_access_token');
    showMsg('ยกเลิกการเชื่อมต่อบัญชี Google เรียบร้อย', 'info');
  };

  // Upload image logic (Supports Google Drive Folder & Local backup)
  const handleUploadImageFile = async (file: File): Promise<string> => {
    if (googleAccessToken) {
      try {
        const folderId = '1EbKMnX8twSAStZxjJXidlv_1D5G5u6GR';
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

          // Set anyone permissions to read image URL in exams
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

    // Local server upload fallback
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

  // Sync Students to Google Sheet
  const syncStudentsToGoogleSheet = async (listToSync = students) => {
    if (!googleAccessToken) {
      return; // Skip if not logged in
    }

    setGoogleSyncing(true);
    try {
      const spreadsheetId = '1apYsiVmw8e_zIPTUgAwl47uLXQaTEg7PbuqiqVf4Ods';
      
      // Clear current contents of A:E
      const clearRange = 'Sheet1!A:E';
      await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        }
      });

      // Prepare data
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
      const url = `https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;

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

  // Delete submission
  const handleDeleteSubmission = async (subId: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ที่จะลบกระดาษคำตอบของนักเรียนรายนี้? ข้อมูลคำตอบและผลคะแนนจะถูกลบถาวรทันที')) {
      return;
    }

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
        showMsg('ลบกระดาษคำตอบของนักเรียนสำเร็จ', 'success');
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

  // Google Sheet fetcher API
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

  // Student Save manual
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
      // Check if student id already exists
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

  // Question save
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
        // Refresh question list
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
        showMsg('ลบข้อสอบสำเร็จ', 'success');
      }
    } catch (err) {
      showMsg('ข้อผิดพลาดการเชื่อมต่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Grade save
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

  // Export to CSV helper
  const handleExportCSV = () => {
    if (submissions.length === 0) {
      showMsg('ไม่มีข้อมูลผลการสอบเพื่อส่งออกในขณะนี้', 'error');
      return;
    }

    // Build headers
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

    // Add student results
    submissions.forEach(sub => {
      // Calculate short answer sum
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

    const csvContent = "\uFEFF" + csvRows.join('\n'); // Add BOM for excel Thai font support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `คะแนนวิชาคณิตศาสตร์_ม_${new Date().toLocaleDateString('th-TH').replace(/\//g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Edit student form
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

  // Open edit question form
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
      correctAnswer: ''
    });
    setIsQuestionModalOpen(true);
  };

  // Open grading sheet
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

  // Filters for lists
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
          <div className="flex gap-2 w-full md:w-auto">
            {googleAccessToken ? (
              <>
                <button
                  type="button"
                  onClick={() => syncStudentsToGoogleSheet()}
                  disabled={googleSyncing}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {googleSyncing ? 'กำลังซิงก์ข้อมูล...' : 'ซิงก์นักเรียนลง Google Sheet'}
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
          <div className="flex gap-2 w-full md:w-auto">
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
              onClick={() => { setActiveTab('questions'); setSearchQuery(''); }}
              className={`flex-1 md:flex-initial px-4 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                activeTab === 'questions' ? 'bg-[#002B49] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Database size={16} />
              <span>คลังข้อสอบ ({questions.length})</span>
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
                      // Sum short answer score manually
                      let saScore = 0;
                      Object.keys(sub.shortAnswerScores).forEach(qId => {
                        saScore += sub.shortAnswerScores[qId] || 0;
                      });

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 font-medium">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-800">{sub.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {sub.studentId} | เลขที่: {sub.number}</div>
                          </td>
                          <td className="py-3 px-4">ม.{sub.class}</td>
                          <td className="py-3 px-4">
                            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                              {sub.set}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-slate-700">
                            {sub.cheated ? <span className="text-red-500">0</span> : sub.multipleChoiceScore}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">{saScore}</td>
                          <td className="py-3 px-4 text-center text-slate-500">{sub.writtenScore}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded">
                              {sub.cheated ? 0 : sub.totalScore} / 30
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
                                className="px-3 py-1.5 bg-[#002B49] hover:bg-blue-950 text-white rounded font-bold text-[11px] transition-all"
                              >
                                ตรวจและให้คะแนน
                              </button>
                              <button
                                type="button"
                                id={`btn-delete-sub-${sub.id}`}
                                onClick={() => handleDeleteSubmission(sub.id)}
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
                  className="px-6 py-2.5 bg-[#002B49] hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
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
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">รายชื่อนักเรียนที่ลงทะเบียนสำเร็จ ({students.length} คน)</h2>
                  <p className="text-xs text-slate-500">นักเรียนที่มีรหัสในตารางนี้จะสามารถเข้าสู่ระบบทำข้อสอบได้ตามลำดับ</p>
                </div>
                <button
                  type="button"
                  id="btn-add-student-modal"
                  onClick={openAddStudent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Plus size={14} />
                  <span>เพิ่มนักเรียนรายคน</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-xs">
                    ไม่พบข้อมูลรายชื่อนักเรียนในตาราง ค้นหาใหม่อีกครั้ง
                  </div>
                ) : (
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">รหัสนักเรียน (Username)</th>
                        <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                        <th className="py-3 px-4">ห้องเรียน</th>
                        <th className="py-3 px-4">เลขที่</th>
                        <th className="py-3 px-4 text-right">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredStudents.map(s => (
                        <tr key={s.id} className="hover:bg-slate-50 font-medium">
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">{s.id}</td>
                          <td className="py-3 px-4 text-slate-700">{s.name}</td>
                          <td className="py-3 px-4">ม.{s.class}</td>
                          <td className="py-3 px-4">เลขที่ {s.number}</td>
                          <td className="py-3 px-4 text-right flex justify-end gap-1.5">
                            <button
                              type="button"
                              id={`btn-edit-student-${s.id}`}
                              onClick={() => openEditStudent(s)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              id={`btn-delete-student-${s.id}`}
                              onClick={() => handleDeleteStudent(s)}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
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

        {/* TAB VIEW 3: QUESTION BANK MANAGEMENT */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-2xl shadow border border-slate-200 overflow-hidden flex flex-col" id="tab-questions">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-sm">คลังและสุ่มข้อสอบ (Question Bank)</h2>
                <p className="text-xs text-slate-500">จัดการ เพิ่ม แก้ไขตัวเลือก และคำตอบของโจทย์ข้อสอบทั้งหมดในระบบ</p>
              </div>
              <button
                type="button"
                id="btn-add-question-modal"
                onClick={openAddQuestion}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors self-end"
              >
                <Plus size={14} />
                <span>เพิ่มข้อสอบใหม่</span>
              </button>
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
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">ID / ระดับชั้น</th>
                      <th className="py-3 px-4">ข้อสอบชุด</th>
                      <th className="py-3 px-4">ประเภท</th>
                      <th className="py-3 px-4 w-1/3">โจทย์คำถาม</th>
                      <th className="py-3 px-4">คำตอบเฉลย</th>
                      <th className="py-3 px-4 text-right">ดำเนินการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {questions
                      .filter(q => {
                        const s = searchQuery.toLowerCase().trim();
                        if (!s) return true;
                        const typeTh = q.type === 'multiple-choice' ? 'ปรนัย' : q.type === 'short-answer' ? 'อัตนัยเติมคำ' : 'วิธีทำ';
                        return q.text.toLowerCase().includes(s) || 
                               q.id.toLowerCase().includes(s) || 
                               `ม.${q.gradeLevel}`.toLowerCase().includes(s) ||
                               q.gradeLevel.toLowerCase().includes(s) ||
                               q.set.toLowerCase().includes(s) ||
                               typeTh.includes(s);
                      })
                      .map(q => (
                        <tr key={q.id} className="hover:bg-slate-50">
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
                              ข้อที่ {q.questionNumber}. {q.text}
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
                          <td className="py-3 px-4 text-right flex justify-end gap-1 pt-4">
                            <button
                              type="button"
                              id={`btn-edit-q-${q.id}`}
                              onClick={() => openEditQuestion(q)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded transition-colors"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              type="button"
                              id={`btn-delete-q-${q.id}`}
                              onClick={() => handleDeleteQuestion(q)}
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded transition-colors"
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
              <button onClick={() => setIsStudentModalOpen(false)} className="text-white/80 hover:text-white">
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
                  className="w-1/3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  id="btn-submit-student"
                  className="w-2/3 py-2 bg-[#002B49] text-white rounded font-bold transition-colors shadow hover:bg-blue-950"
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
              <button onClick={() => setIsQuestionModalOpen(false)} className="text-white/80 hover:text-white">
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
                <label className="block text-slate-700">โจทย์คำถาม (พิมพ์ข้อความ)</label>
                <textarea
                  value={questionForm.text}
                  id="form-q-text"
                  onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  rows={3}
                  placeholder="พิมพ์คำถามข้อสอบวิชาคณิตศาสตร์ที่นี่..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs"
                />
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
                {!googleAccessToken && (
                  <p className="text-[10px] text-slate-400 font-medium">
                    💡 แนะนำให้กดปุ่ม "เชื่อมต่อบัญชี Google" ในแผงควบคุมก่อน เพื่อให้รูปเซฟตรงลง Google Drive ของคุณทันที! (หากไม่ต่อระบบจะเซฟในเซิร์ฟเวอร์สำรอง)
                  </p>
                )}
              </div>

              {/* Multiple Choice specific input */}
              {questionForm.type === 'multiple-choice' && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3.5">
                  <p className="text-[11px] text-[#002B49] font-bold">กำหนดตัวเลือกตอบ ก ข ค ง (และ จ ถ้าต้องการ):</p>
                  
                  {questionForm.choices.map((choiceText, cIdx) => (
                    <div key={cIdx} className="flex gap-2 items-center">
                      <span className="w-8 shrink-0 text-slate-500 text-center font-bold">ตัวเลือก {['ก', 'ข', 'ค', 'ง', 'จ'][cIdx]}</span>
                      <input
                        type="text"
                        value={choiceText}
                        id={`form-q-choice-${cIdx}`}
                        onChange={(e) => {
                          const updated = [...questionForm.choices];
                          updated[cIdx] = e.target.value;
                          setQuestionForm({ ...questionForm, choices: updated });
                        }}
                        placeholder={`พิมพ์รายละเอียดตัวเลือกที่ ${cIdx + 1}`}
                        className="flex-grow px-3 py-1.5 bg-white border border-slate-300 rounded text-xs font-medium focus:outline-none"
                      />
                    </div>
                  ))}

                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      id="btn-remove-choice"
                      onClick={() => {
                        if (questionForm.choices.length > 4) {
                          setQuestionForm({ ...questionForm, choices: questionForm.choices.slice(0, -1) });
                        }
                      }}
                      disabled={questionForm.choices.length <= 4}
                      className="px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold disabled:opacity-40"
                    >
                      - ลบตัวเลือก จ
                    </button>
                    <button
                      type="button"
                      id="btn-add-choice"
                      onClick={() => {
                        if (questionForm.choices.length < 5) {
                          setQuestionForm({ ...questionForm, choices: [...questionForm.choices, ''] });
                        }
                      }}
                      disabled={questionForm.choices.length >= 5}
                      className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-[10px] font-bold disabled:opacity-40"
                    >
                      + เพิ่มตัวเลือก จ (5 ตัวเลือก)
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[#D22630]">ระบุเฉลยคำตอบ (ต้องตรงกับค่าเฉลยที่ต้องการ)</label>
                <input
                  type="text"
                  value={questionForm.correctAnswer}
                  id="form-q-ans"
                  onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                  placeholder={questionForm.type === 'multiple-choice' ? 'พิมพ์ข้อความตัวเลือกที่ถูกต้องเป๊ะๆ (เช่น 30 หรือ ตารางเซนติเมตร)' : 'พิมพ์เฉลยตัวเลข'}
                  className="w-full px-3 py-2 bg-red-50/50 border border-red-200 rounded focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                />
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-cancel-q"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  id="btn-submit-q"
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
            
            {/* Header */}
            <div className="bg-gradient-to-r from-red-800 to-[#D22630] text-white p-5 shrink-0 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">ตรวจและให้คะแนนกระดาษคำตอบวิชาคณิตศาสตร์</h3>
                <p className="text-[11px] text-white/80">นักเรียน: {gradingSubmission.name} (รหัส: {gradingSubmission.studentId}) | ม.{gradingSubmission.class} เลขที่ {gradingSubmission.number}</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-white/80 hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Grading Form Content */}
            <form onSubmit={handleSaveGrade} className="p-6 overflow-y-auto space-y-6 text-xs font-semibold flex-grow">
              
              {/* Cheat warning block / Control */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${gradingForm.cheated ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                <div className="flex gap-2.5 items-start">
                  <AlertOctagon size={18} className={`${gradingForm.cheated ? 'text-red-600' : 'text-green-600'} mt-0.5 shrink-0`} />
                  <div>
                    <h4 className="font-bold">{gradingForm.cheated ? '⚠️ ตรวจพบการออกจากหน้าระบบข้อสอบเกินกำหนด (ระบบล็อกคะแนนเป็น 0)' : '✅ ตรวจสอบสถานะการทุจริต: ปกติ'}</h4>
                    <p className={`font-medium mt-1 text-[11px] ${gradingForm.cheated ? 'text-red-600' : 'text-green-700'}`}>
                      {gradingForm.cheated 
                        ? `นักเรียนสลับหน้าจอหรือสลับแท็บครบ ${gradingSubmission.cheatingWarningsCount} ครั้ง (คุณครูสามารถเอาเครื่องหมายถูกออกเพื่อยกเลิกการปรับเป็น 0 คะแนนและคืนสิทธิ์ให้ระบบคำนวณตามจริงได้)` 
                        : `นักเรียนสอบตามกฎกติกาปกติ มีการเตือนสลับหน้าต่าง ${gradingSubmission.cheatingWarningsCount} ครั้ง (คุณครูสามารถทำเครื่องหมายถูกเพื่อปรับเป็นทุจริตได้ตามดุลยพินิจ)`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shrink-0 self-start sm:self-center">
                  <input
                    type="checkbox"
                    id="grading-cheated-toggle"
                    checked={gradingForm.cheated}
                    onChange={(e) => {
                      setGradingForm(prev => ({ ...prev, cheated: e.target.checked }));
                    }}
                    className="w-4 h-4 text-red-600 border-slate-300 rounded focus:ring-red-500 cursor-pointer"
                  />
                  <label htmlFor="grading-cheated-toggle" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                    บังคับสิทธิ์ทุจริต (ปรับคะแนนเป็น 0)
                  </label>
                </div>
              </div>

              {/* Multiple Choice Review */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between">
                  <span>ส่วนที่ 1: ตรวจคะแนนปรนัยเลือกตอบ (15 ข้อ)</span>
                  <span className="text-[#002B49]">ประเมินแล้ว: {gradingForm.cheated ? 0 : gradingSubmission.multipleChoiceScore} / 15 คะแนน</span>
                </div>
                <div className="p-4 bg-slate-50 space-y-4">
                  <p className="text-[11px] text-slate-500 font-medium">
                    * ตรวจคะแนนปรนัยแบบเรียลไทม์ {gradingForm.cheated ? '(ทุจริตเป็น 0 คะแนน)' : `นักเรียนทำถูกต้อง ${gradingSubmission.multipleChoiceScore} ข้อ`} (คุณครูสามารถคลิกแก้ไขคำตอบเพื่อช่วยเหลือนักเรียนได้)
                  </p>
                  
                  <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
                    <p className="text-xs font-bold text-slate-700 border-b pb-1">รายละเอียดคำตอบและการขอแก้ไขคำตอบ:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {questions
                        .filter(q => q.gradeLevel === gradingSubmission.gradeLevel && q.set === gradingSubmission.set && q.type === 'multiple-choice')
                        .map((q, idx) => {
                          const originalAns = gradingSubmission.originalMultipleChoiceAnswers?.[q.id] || gradingSubmission.multipleChoiceAnswers[q.id] || '';
                          const currentAns = gradingForm.editedMultipleChoiceAnswers?.[q.id] || '';
                          const isCorrect = currentAns.toString().trim() === q.correctAnswer.toString().trim();

                          return (
                            <div key={q.id} className="p-2.5 rounded bg-slate-50 border border-slate-200 flex flex-col justify-between gap-1 text-[11px]">
                              <div className="flex justify-between items-start">
                                <span className="font-bold text-slate-800">ข้อที่ {idx + 1}: {q.text.substring(0, 45)}...</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                  {isCorrect ? 'ถูกต้อง' : 'ผิด'}
                                </span>
                              </div>
                              <p className="text-[10px] text-blue-800 font-semibold">เฉลยคีย์หลัก: {q.correctAnswer}</p>
                              <p className="text-[10px] text-slate-400">คำตอบแรกเริ่มที่นักเรียนส่ง: <span className="font-bold font-mono text-slate-600">"{originalAns || '(ไม่ได้ตอบ)'}"</span></p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-slate-500 shrink-0 font-bold">แก้ไขคำตอบปัจจุบัน:</span>
                                <select
                                  value={currentAns}
                                  onChange={(e) => {
                                    const updated = { ...gradingForm.editedMultipleChoiceAnswers };
                                    updated[q.id] = e.target.value;
                                    setGradingForm(prev => ({
                                      ...prev,
                                      editedMultipleChoiceAnswers: updated
                                    }));
                                  }}
                                  className="text-[11px] px-1.5 py-0.5 bg-white border border-slate-300 rounded font-bold focus:outline-none cursor-pointer"
                                >
                                  <option value="">ไม่ได้ตอบ</option>
                                  <option value="ก">ก</option>
                                  <option value="ข">ข</option>
                                  <option value="ค">ค</option>
                                  <option value="ง">ง</option>
                                  {q.choices?.[4] && <option value="จ">จ</option>}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Short Answers Grading Module */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200">
                  ส่วนที่ 2: ให้คะแนนข้อสอบอัตนัยเติมคำตอบ (5 ข้อ - ข้อละ 2 คะแนน)
                </div>
                <div className="p-4 bg-white divide-y divide-slate-100 space-y-4">
                  {questions
                    .filter(q => q.gradeLevel === gradingSubmission.gradeLevel && q.set === gradingSubmission.set && q.type === 'short-answer')
                    .map((q, idx) => {
                      const originalAns = gradingSubmission.originalShortAnswers?.[q.id] || gradingSubmission.shortAnswers[q.id] || '';
                      const currentAns = gradingForm.editedShortAnswers?.[q.id] || '';
                      const isExactlyCorrect = currentAns.trim() === q.correctAnswer.trim();
                      const currentScore = gradingForm.shortAnswerScores[q.id] || 0;

                      return (
                        <div key={q.id} className="pt-3 first:pt-0 flex flex-col md:flex-row justify-between gap-4 font-medium">
                          <div className="space-y-1.5 w-2/3">
                            <p className="text-slate-800 font-bold">ข้อที่ {idx + 1}: {q.text}</p>
                            <p className="text-blue-800 font-bold">เฉลยระบบ: "{q.correctAnswer}"</p>
                            <p className="text-[10px] text-slate-400">คำตอบแรกเริ่มที่นักเรียนส่ง: <span className="font-bold font-mono text-slate-600">"{originalAns || '(ไม่ได้ตอบ)'}"</span></p>
                            <div className="flex items-center gap-1.5 text-slate-500 font-semibold mt-1">
                              <span className="text-[10px] font-bold">แก้ไขคำตอบปัจจุบัน:</span>
                              <input
                                type="text"
                                value={currentAns}
                                onChange={(e) => {
                                  const updated = { ...gradingForm.editedShortAnswers };
                                  updated[q.id] = e.target.value;
                                  setGradingForm(prev => ({
                                    ...prev,
                                    editedShortAnswers: updated
                                  }));
                                }}
                                className="px-2 py-1 border border-slate-300 rounded font-bold font-mono text-xs w-48 bg-slate-50 focus:bg-white focus:outline-none"
                                placeholder="พิมพ์แก้ไขคำตอบ..."
                              />
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isExactlyCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {isExactlyCorrect ? 'ตรงกับคีย์' : 'ไม่ตรงคีย์'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 self-end md:self-center">
                            <span className="text-xs text-slate-500">คะแนนเฉลย:</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                id={`btn-score-0-${q.id}`}
                                onClick={() => setGradingForm({
                                  ...gradingForm,
                                  shortAnswerScores: { ...gradingForm.shortAnswerScores, [q.id]: 0 }
                                })}
                                className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center transition-all ${
                                  currentScore === 0 ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                0
                              </button>
                              <button
                                type="button"
                                id={`btn-score-1-${q.id}`}
                                onClick={() => setGradingForm({
                                  ...gradingForm,
                                  shortAnswerScores: { ...gradingForm.shortAnswerScores, [q.id]: 1 }
                                })}
                                className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center transition-all ${
                                  currentScore === 1 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                1
                              </button>
                              <button
                                type="button"
                                id={`btn-score-2-${q.id}`}
                                onClick={() => setGradingForm({
                                  ...gradingForm,
                                  shortAnswerScores: { ...gradingForm.shortAnswerScores, [q.id]: 2 }
                                })}
                                className={`w-8 h-8 rounded-full border text-xs font-bold flex items-center justify-center transition-all ${
                                  currentScore === 2 ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                2
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Written Drawing Grade */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200">
                  ส่วนที่ 3: ตรวจกระดาษคำตอบแสดงวิธีทำ (1 ข้อ - เต็ม 5 คะแนน)
                </div>
                <div className="p-4 bg-white space-y-4">
                  {/* Problem statement */}
                  {questions
                    .filter(q => q.gradeLevel === gradingSubmission.gradeLevel && q.set === gradingSubmission.set && q.type === 'written')
                    .map(q => (
                      <div key={q.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4">
                        <p className="font-bold text-slate-800">โจทย์: {q.text}</p>
                        <p className="text-blue-800 font-bold mt-1">แนวเฉลยคีย์วิธีทำ: {q.correctAnswer}</p>
                      </div>
                    ))}

                  {/* Base64 canvas render */}
                  <div className="bg-slate-100 border rounded-lg p-4 flex flex-col items-center justify-center">
                    {gradingSubmission.writtenAnswer ? (
                      <img
                        src={gradingSubmission.writtenAnswer}
                        alt="กระดาษทดแสดงวิธีทำของนักเรียน"
                        className="max-h-64 object-contain border-2 bg-white rounded shadow-sm"
                      />
                    ) : (
                      <p className="text-slate-400 italic font-medium py-6">ไม่มีข้อมูลกระดาษวาดภาพตอบของนักเรียน</p>
                    )}
                  </div>

                  {/* Input score written */}
                  <div className="flex items-center gap-3 justify-end pt-2">
                    <span className="text-xs text-slate-700 font-bold">กรอกคะแนนส่วนวิธีทำ (0-5):</span>
                    <input
                      type="number"
                      min={0}
                      max={5}
                      value={gradingForm.writtenScore}
                      id="grading-written-score"
                      onChange={(e) => setGradingForm({ ...gradingForm, writtenScore: Math.min(5, Math.max(0, Number(e.target.value))) })}
                      className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded font-bold font-mono text-center focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                    <span className="text-slate-400 font-bold">/ 5 คะแนน</span>
                  </div>
                </div>
              </div>

              {/* Feedback and comments */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold">ข้อคิดเห็นและข้อเสนอแนะสำหรับการสอบครั้งนี้ (Feedback):</label>
                <textarea
                  value={gradingForm.feedback}
                  id="grading-feedback"
                  onChange={(e) => setGradingForm({ ...gradingForm, feedback: e.target.value })}
                  placeholder="เขียนคำชี้แนะหรือข้อติติงให้นักเรียนรู้แนวทางแก้ไขปัญหา..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500 text-xs"
                />
              </div>

              {/* Final grading action controls */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-cancel-grading"
                  onClick={() => setGradingSubmission(null)}
                  className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
                >
                  ยกเลิกการตรวจ
                </button>
                <button
                  type="submit"
                  id="btn-submit-grading"
                  className="w-2/3 py-2.5 bg-[#D22630] hover:bg-red-800 text-white rounded font-bold transition-colors shadow flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  <span>บันทึกคะแนนรวมที่ประเมิน</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG MODAL */}
      {deleteConfirmInfo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-red-600 text-white p-4 font-bold flex items-center gap-2">
              <AlertOctagon size={20} />
              <span className="text-sm font-bold">ยืนยันการลบข้อมูล</span>
            </div>
            <div className="p-6 space-y-4 font-sans text-xs">
              <p className="text-slate-600 text-xs font-semibold">คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลนี้ออกจากระบบอย่างถาวร?</p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-700 break-words">
                {deleteConfirmInfo.name}
              </div>
              <p className="text-[10px] text-red-500 font-medium">* การดำเนินการนี้จะไม่สามารถดึงข้อมูลคืนกลับมาได้อีก</p>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteConfirmInfo(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { id, type } = deleteConfirmInfo;
                  setDeleteConfirmInfo(null);
                  if (type === 'student') {
                    await proceedDeleteStudent(id);
                  } else {
                    await proceedDeleteQuestion(id);
                  }
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm cursor-pointer"
              >
                <Trash2 size={13} />
                <span>ยืนยันการลบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
