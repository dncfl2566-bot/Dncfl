import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  Timer, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  CheckCircle,
  Clock, 
  Eye, 
  Layers,
  HelpCircle,
  FileSpreadsheet,
  RefreshCw,
  XCircle,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student, Question, Submission } from '../types';
import CanvasDrawing from './CanvasDrawing';
import MathRenderer from './MathRenderer';

interface ExamEngineProps {
  student: Student;
  classroom: string;
  onExamSubmitted: (submission: Submission) => void;
  onForceLogout: () => void;
}

// Fisher-Yates shuffle helper
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Convert Google Drive view URLs to direct usercontent CDN URLs to bypass CORS/Cookie restrictions
export function getCleanImageUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
    const matchD = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const matchId = trimmed.match(/id=([a-zA-Z0-9-_]+)/);
    const fileId = (matchD && matchD[1]) || (matchId && matchId[1]);
    if (fileId) {
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  return trimmed;
}

interface ShuffledQuestion extends Question {
  shuffledChoicesList: string[];
}

export default function ExamEngine({ student, classroom, onExamSubmitted, onForceLogout }: ExamEngineProps) {
  const [questions, setQuestions] = useState<ShuffledQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active Exam Phase: 1 = Multiple Choice, 2 = Short Answer, 3 = Written Method, 4 = Confirmation / Submit
  const [examPhase, setExamPhase] = useState<1 | 2 | 3 | 4>(1);
  
  // Current multiple-choice question index (0 to 14)
  const [mcIndex, setMcIndex] = useState(0);

  // Student Answers State
  const [mcAnswers, setMcAnswers] = useState<Record<string, string>>({}); // questionId -> selected choice
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({}); // questionId -> text response
  const [writtenAnswer, setWrittenAnswer] = useState<string>(''); // base64 canvas URL

  // Timer: 60 minutes = 3600 seconds
  const [timeLeft, setTimeLeft] = useState(() => {
    try {
      const saved = localStorage.getItem(`exam_time_left_${student.id}`);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 3600;
  });
  const [isExamCompleted, setIsExamCompleted] = useState(false);

  // Anti-cheating states
  const [cheatingCount, setCheatingCount] = useState(0);
  const [showCheatingWarning, setShowCheatingWarning] = useState(false);
  const [isScreenResizedSmall, setIsScreenResizedSmall] = useState(false);
  const [isSplitScreen, setIsSplitScreen] = useState(false);
  const [isDismissedSizeWarning, setIsDismissedSizeWarning] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Auto-submit ref to avoid double submits
  const isSubmittingRef = useRef(false);

  // Keep refs of current answers and cheating count to prevent stale closures in focus-loss event handlers
  const mcAnswersRef = useRef(mcAnswers);
  const shortAnswersRef = useRef(shortAnswers);
  const writtenAnswerRef = useRef(writtenAnswer);
  const cheatingCountRef = useRef(cheatingCount);

  useEffect(() => {
    mcAnswersRef.current = mcAnswers;
  }, [mcAnswers]);

  useEffect(() => {
    shortAnswersRef.current = shortAnswers;
  }, [shortAnswers]);

  useEffect(() => {
    writtenAnswerRef.current = writtenAnswer;
  }, [writtenAnswer]);

  useEffect(() => {
    cheatingCountRef.current = cheatingCount;
  }, [cheatingCount]);

  // Keyboard and Context Menu protection
  useEffect(() => {
    // Disable right click
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenu);

    // Disable copy/paste, print screen, dev tools keys
    const preventKeys = (e: KeyboardEvent) => {
      // Prevent Copy (Ctrl+C, Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
      }
      // Prevent Paste (Ctrl+V, Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
      }
      // Prevent Select All (Ctrl+A, Cmd+A)
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
      }
      // Prevent F12 (Inspect Element)
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', preventKeys);

    return () => {
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventKeys);
    };
  }, []);

  // Window Resize Monitoring (Maximize Enforcement & Split Screen Detection)
  useEffect(() => {
    const checkWindowSize = () => {
      // On mobile phones, we shouldn't force them to have width > 640px, but they should have at least 320px
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (screen && screen.width < 768);
      const minWidth = isMobileDevice ? 320 : 640;
      const minHeight = isMobileDevice ? 400 : 450;
      const isSmall = window.innerWidth < minWidth || window.innerHeight < minHeight;
      setIsScreenResizedSmall(isSmall);

      // We bypass split-screen detection ONLY if embedded in an iframe (e.g. AI Studio Preview window)
      // so developers can test without being locked out.
      const isInIframe = window.self !== window.top;
      if (!isInIframe && screen && screen.width && screen.height) {
        const isMobileOrTabletDevice = isMobileDevice || screen.width < 1024;
        
        let isWidthSplit = false;
        let isHeightSplit = false;

        if (isMobileOrTabletDevice) {
          // On mobile/tablets, only alert width split if the width is extremely narrow relative to the screen width (e.g., width < screen.width * 0.55)
          // because portrait screens have window.innerWidth equal or almost equal to screen.width.
          // In landscape split screen on tablets, window.innerWidth is less than 60% of screen.width.
          isWidthSplit = window.innerWidth < screen.width * 0.55;
          // We completely bypass height split-screen detection on mobile/tablets to avoid false alarms from mobile address bars and software keyboards.
          isHeightSplit = false;
        } else {
          // On standard desktops, we can keep the robust checks
          isWidthSplit = window.innerWidth < screen.width * 0.85;
          isHeightSplit = window.innerHeight < screen.height * 0.55; // Lower height threshold to 55% to be safer against desktop bars/menus
        }

        setIsSplitScreen(isWidthSplit || isHeightSplit);
      } else {
        setIsSplitScreen(false);
      }
    };

    checkWindowSize();
    window.addEventListener('resize', checkWindowSize);

    return () => {
      window.removeEventListener('resize', checkWindowSize);
    };
  }, []);

  // Monitor transitions into split-screen or multi-window to count as cheating warning
  const lastSplitScreenRef = useRef(false);
  useEffect(() => {
    if (isExamCompleted) return;

    if (isSplitScreen && !lastSplitScreenRef.current) {
      // Transitioned into split-screen! Increment cheating count
      setCheatingCount((prevCount) => {
        const nextCount = prevCount + 1;
        if (nextCount >= 3) {
          triggerAutoSubmit(true);
        } else if (nextCount === 2) {
          setShowCheatingWarning(true);
        } else {
          console.log("First split-screen warning registered.");
        }
        return nextCount;
      });
    }
    lastSplitScreenRef.current = isSplitScreen;
  }, [isSplitScreen, isExamCompleted]);

  // Visibility / Tab Change Monitoring (Anti-cheat 3-strike system)
  useEffect(() => {
    const handleFocusLoss = () => {
      if (isExamCompleted) return;

      // When the tab is blurred, minimized, or they open another window
      setCheatingCount((prevCount) => {
        const nextCount = prevCount + 1;
        
        if (nextCount >= 3) {
          // 3rd Strike: Auto-Submit Immediately with 0 Score
          triggerAutoSubmit(true);
        } else if (nextCount === 2) {
          // 2nd Strike: Show warning modal
          setShowCheatingWarning(true);
        } else {
          // 1st Strike: Silent count (no popup) to prevent accidental warnings due to window out-of-sync
          console.log("Accidental/first focus loss ignored from immediate warning popup.");
        }
        return nextCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleFocusLoss();
      }
    };

    window.addEventListener('blur', handleFocusLoss);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleFocusLoss);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isExamCompleted]);

  // Load Exam Questions
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/questions?class=${encodeURIComponent(classroom)}&number=${student.number}`);
        const data = await res.json();
        
        if (data.success) {
          // Map and shuffle choices for multiple-choice questions once at load
          const mapped: ShuffledQuestion[] = data.questions.map((q: Question) => {
            if (q.type === 'multiple-choice' && q.choices) {
              return {
                ...q,
                shuffledChoicesList: shuffleArray(q.choices)
              };
            }
            return { ...q, shuffledChoicesList: [] };
          });

          // สลับลำดับข้อสอบเพื่อให้เรียงต่างกันในแต่ละชุดแยกกัน (แต่โครงสร้างปรนัย อัตนัย วิธีทำยังแยกส่วน)
          const mcQs = mapped.filter(q => q.type === 'multiple-choice');
          const saQs = mapped.filter(q => q.type === 'short-answer');
          const wrQs = mapped.filter(q => q.type === 'written');

          const shuffledMcQs = shuffleArray(mcQs);
          const shuffledSaQs = shuffleArray(saQs);

          const finalQuestions = [...shuffledMcQs, ...shuffledSaQs, ...wrQs];
          setQuestions(finalQuestions);
        } else {
          setError(data.message || 'ไม่สามารถดึงข้อมูลข้อสอบได้');
        }
      } catch (err) {
        setError('เกิดข้อผิดพลาดในการโหลดข้อสอบ โปรดรีเฟรชหน้าจอ');
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [classroom, student.number]);

  // 60-Minute Timer Countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      // Time is up! Auto submit
      try {
        localStorage.removeItem(`exam_time_left_${student.id}`);
      } catch (e) {}
      triggerAutoSubmit(false);
      return;
    }

    try {
      localStorage.setItem(`exam_time_left_${student.id}`, timeLeft.toString());
    } catch (e) {}

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, student.id]);

  const triggerAutoSubmit = async (cheated = false) => {
    if (isSubmittingRef.current || isExamCompleted) return;
    isSubmittingRef.current = true;
    setIsExamCompleted(true);
    setSubmitError('');

    try {
      localStorage.removeItem(`exam_time_left_${student.id}`);
    } catch (e) {}

    const timeTakenMin = Math.ceil((3600 - timeLeft) / 60);

    const payload = {
      studentId: student.id,
      class: classroom,
      number: student.number,
      gradeLevel: questions[0]?.gradeLevel || '3',
      set: student.number % 2 === 1 ? 'A' : 'B',
      multipleChoiceAnswers: mcAnswersRef.current,
      shortAnswers: shortAnswersRef.current,
      writtenAnswer: writtenAnswerRef.current,
      timeTaken: timeTakenMin === 0 ? 1 : timeTakenMin,
      cheatingWarningsCount: cheated ? 3 : cheatingCountRef.current
    };

    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        onExamSubmitted(data.submission);
      } else {
        setSubmitError('เกิดข้อผิดพลาดในการส่งข้อสอบ: ' + data.message);
        setIsExamCompleted(false);
      }
    } catch (err) {
      setSubmitError('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณากดส่งข้อสอบใหม่อีกครั้ง หรือติดต่ออาจารย์ผู้คุมสอบ');
      setIsExamCompleted(false);
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const handleManualSubmit = () => {
    const timeSpentSeconds = 3600 - timeLeft;
    const minRequiredSeconds = 1800; // 30 minutes

    if (timeSpentSeconds < minRequiredSeconds) {
      const remainingSecs = minRequiredSeconds - timeSpentSeconds;
      const remMins = Math.ceil(remainingSecs / 60);
      setSubmitError(`❌ ไม่สามารถส่งข้อสอบได้: นักเรียนต้องทำข้อสอบอย่างน้อย 30 นาที (ขณะนี้ทำไปได้ ${Math.floor(timeSpentSeconds / 60)} นาที ขาดอีกประมาณ ${remMins} นาที)`);
      return;
    }

    setSubmitError('');
    triggerAutoSubmit(false);
  };

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-600 font-bold">กำลังจัดเตรียมชุดข้อสอบเฉพาะตัวของท่าน โปรดรอสักครู่...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 text-center max-w-md shadow-md">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">เกิดข้อผิดพลาดในการโหลดข้อสอบ</h2>
          <p className="text-sm text-slate-500 mb-6">{error}</p>
          <button
            type="button"
            onClick={onForceLogout}
            className="px-6 py-2.5 bg-[#002B49] text-white rounded-lg font-bold text-sm shadow hover:bg-slate-800 transition-colors"
          >
            กลับหน้าล็อกอิน
          </button>
        </div>
      </div>
    );
  }

  // Get active lists
  const mcQuestions = questions.filter(q => q.type === 'multiple-choice');
  const saQuestions = questions.filter(q => q.type === 'short-answer');
  const writtenQuestion = questions.find(q => q.type === 'written');

  const currentMcQ = mcQuestions[mcIndex];

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none relative" id="exam-engine-root">
      {/* ⚠️ ENFORCED VIEWPORT FULL-SCREEN MAXIMIZE OVERLAY / SPLIT SCREEN LOCK */}
      {((isScreenResizedSmall && !isDismissedSizeWarning) || isSplitScreen) && (
        <div className="fixed inset-0 bg-slate-900/98 backdrop-blur-md z-[9999] flex flex-col justify-center items-center p-6 text-center text-white">
          <div className="bg-red-600 p-5 rounded-full mb-6 animate-pulse shadow-lg shadow-red-900/50">
            <Lock size={48} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-red-500 mb-3 tracking-tight">
            {isSplitScreen ? '⚠️ ตรวจพบการเปิดแบ่งหน้าจอ (Split Screen / Multi-Window)!' : '⚠️ ตรวจพบการย่อหน้าจอหรือขนาดหน้าจอขนาดเล็ก!'}
          </h1>
          <p className="max-w-xl text-sm text-slate-300 leading-relaxed mb-4 font-semibold">
            {isSplitScreen 
              ? 'ระบบตรวจพบว่าคุณกำลังแบ่งหน้าจอ เปิดใช้งานหน้าต่างคู่ หรือเปิดบราวเซอร์ขนาดเล็ก ซึ่งเป็นการฝ่าฝืนมาตรการป้องกันการทุจริตในการสอบวิชาคณิตศาสตร์'
              : 'นโยบายการสอบวิชาคณิตศาสตร์: เพื่อป้องกันการทุจริตในการสอบและให้การขีดเขียนวิธีทำมีความสะดวก แนะนำให้เปิดโปรแกรมเต็มจอ (Maximize)'
            }
          </p>
          <div className="bg-white/10 px-6 py-4 rounded-xl text-xs font-semibold text-white max-w-md border border-white/10 mb-6 leading-relaxed shadow-inner">
            {isSplitScreen
              ? 'กรุณาปิดโหมดแบ่งหน้าจอ ขยายบราวเซอร์ให้เต็มหน้าจอ (Maximize) หรือปิดแอปพลิเคชันอื่นที่เปิดคู่กันอยู่ เพื่อทำการทำข้อสอบต่อ'
              : 'โปรดขยายหน้าต่างบราวเซอร์ให้กว้างขึ้น เพื่อมุมมองข้อสอบที่เหมาะสมที่สุด'
            }
            <div className="mt-3 text-red-400 font-bold border-t border-white/5 pt-2">
              ⚠️ การพยายามแบ่งหน้าจอจะถูกนับเป็นพฤติกรรมทุจริตและบันทึกในระบบ! (บันทึกเตือน: {cheatingCount} ครั้ง)
            </div>
          </div>
          
          {/* We only show dismiss button for simple size warnings, NEVER for split-screen! */}
          {!isSplitScreen ? (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setIsDismissedSizeWarning(true)}
                className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                เข้าใจแล้ว ทำข้อสอบต่อเลย
              </button>
            </div>
          ) : (
            <div className="text-sm font-bold text-red-400 animate-pulse bg-red-950/40 border border-red-900/50 px-4 py-2 rounded-lg">
              🔒 หน้าจอถูกล็อกจนกว่าจะปิดโหมดแบ่งหน้าจอหรือขยายจอเป็นเต็มจอ
            </div>
          )}
          <p className="text-[10px] text-slate-500 font-mono italic mt-6">
            {isSplitScreen 
              ? `ความกว้างปัจจุบัน: ${window.innerWidth}px | ความกว้างหน้าจอจริง: ${screen.width}px`
              : '*ระบบต้องการความกว้างอย่างน้อย 640px, สูงอย่างน้อย 450px'
            }
          </p>
        </div>
      )}

      {/* ⚠️ CHEATING ALERT MODAL (Strike 1) */}
      <AnimatePresence>
        {showCheatingWarning && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-red-200"
            >
              <div className="bg-red-600 p-6 text-white text-center">
                <AlertTriangle size={48} className="mx-auto mb-2 animate-bounce" />
                <h2 className="text-xl font-bold">⚠️ ตรวจพบการพยายามออกจากระบบทำข้อสอบ!</h2>
              </div>
              <div className="p-8 text-center">
                <p className="text-slate-700 font-bold text-base mb-4 leading-relaxed">
                  ระบบตรวจพบว่าคุณสลับหน้าต่าง เปิดแท็บใหม่ หรือเปลี่ยนโฟกัสออกจากหน้าจอสอบ!
                </p>
                <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-sm font-semibold mb-6">
                  สถานะคำเตือนทุจริต: <span className="text-lg font-bold underline">{cheatingCount} / 3 ครั้ง</span>
                  <p className="text-xs font-normal text-red-600 mt-2">
                    *หากตรวจพบการออกจากหน้าจอสอบ ครบ 3 ครั้ง ระบบจะส่งคำตอบทันที และบันทึกคะแนนเป็น 0 คะแนนโดยอัตโนมัติ!
                  </p>
                </div>
                <button
                  type="button"
                  id="btn-close-cheat-warning"
                  onClick={() => setShowCheatingWarning(false)}
                  className="px-8 py-3 bg-[#002B49] text-white rounded-xl font-bold text-sm shadow hover:bg-[#001f35] transition-all"
                >
                  รับทราบและกลับไปทำข้อสอบ (ห้ามออกจากหน้านี้อีกเด็ดขาด)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOP ACADEMIC HEADER BAR */}
      <header className="bg-blue-900 text-white shadow-lg border-b-4 border-red-700 py-4 px-6 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          {/* Student details display */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
              <span className="font-bold text-lg text-amber-300">{student.number}</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">{student.name}</span>
                <span className="bg-blue-800 text-[10px] px-2.5 py-0.5 rounded-full font-bold border border-blue-700">
                  ห้อง ม.{classroom}
                </span>
              </div>
              <p className="text-xs text-white/70 font-mono mt-0.5">ID: {student.id} | เลขที่: {student.number}</p>
            </div>
          </div>

          {/* Exam Section/Step Indicator */}
          <div className="hidden lg:flex items-center gap-1.5 text-xs font-bold text-white bg-slate-950/30 p-1.5 rounded-xl border border-white/5">
            <button
              onClick={() => setExamPhase(1)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${examPhase === 1 ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-white/5 text-slate-200'}`}
            >
              ส่วนที่ 1: ปรนัย (15 ข้อ)
            </button>
            <button
              onClick={() => setExamPhase(2)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${examPhase === 2 ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-white/5 text-slate-200'}`}
            >
              ส่วนที่ 2: อัตนัย (5 ข้อ)
            </button>
            <button
              onClick={() => setExamPhase(3)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${examPhase === 3 ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-white/5 text-slate-200'}`}
            >
              ส่วนที่ 3: แสดงวิธีทำ (1 ข้อ)
            </button>
            <button
              onClick={() => setExamPhase(4)}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${examPhase === 4 ? 'bg-blue-800 text-white shadow-sm' : 'hover:bg-white/5 text-slate-200'}`}
            >
              ส่วนที่ 4: ตรวจทานคำตอบ
            </button>
          </div>

          {/* TIMER AND CHEATING COUNTER DISPLAY */}
          <div className="flex items-center gap-4">
            {/* Warning indicator */}
            <div className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
              cheatingCount > 0 
                ? 'bg-red-500/20 text-red-200 border-red-500/30' 
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            }`}>
              <AlertTriangle size={15} />
              <span>ความเสี่ยงทุจริต: {cheatingCount} / 3</span>
            </div>

            {/* Timer count */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-bold ${
              timeLeft < 300 
                ? 'bg-red-600 text-white border-red-700 animate-pulse' 
                : 'bg-white text-slate-800 border-slate-200 shadow-sm'
            }`}>
              <Timer size={18} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>

        </div>
      </header>

      {/* CORE EXAM PANEL CONTENT AREA */}
      <main className="flex-grow max-w-5xl w-full mx-auto p-4 md:p-6" id="exam-main-panel">
        
        {/* PHASE NAVIGATION BUTTONS FOR MOBILE/TABLET */}
        <div className="flex lg:hidden items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 mb-4 text-xs font-bold text-slate-700 shadow-sm">
          <span>สลับส่วนสอบ:</span>
          <div className="flex gap-1.5">
            <button 
              onClick={() => setExamPhase(1)} 
              className={`px-3 py-1.5 rounded-lg ${examPhase === 1 ? 'bg-[#002B49] text-white' : 'bg-slate-100'}`}
            >
              1. ปรนัย
            </button>
            <button 
              onClick={() => setExamPhase(2)} 
              className={`px-3 py-1.5 rounded-lg ${examPhase === 2 ? 'bg-[#002B49] text-white' : 'bg-slate-100'}`}
            >
              2. อัตนัย
            </button>
            <button 
              onClick={() => setExamPhase(3)} 
              className={`px-3 py-1.5 rounded-lg ${examPhase === 3 ? 'bg-[#002B49] text-white' : 'bg-slate-100'}`}
            >
              3. วิธีทำ
            </button>
            <button 
              onClick={() => setExamPhase(4)} 
              className={`px-3 py-1.5 rounded-lg ${examPhase === 4 ? 'bg-[#002B49] text-white' : 'bg-slate-100'}`}
            >
              4. ยืนยัน
            </button>
          </div>
        </div>

        {/* PHASE 1: MULTIPLE CHOICE (ปรนัย) */}
        {examPhase === 1 && currentMcQ && (
          <div className="bg-white rounded-xl shadow-md border border-slate-200 relative overflow-hidden p-6 md:p-8" id="phase-1-mc">
            <div className="absolute top-0 left-0 w-1 bg-red-600 h-full" />
            
            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                ส่วนที่ 1: ปรนัย (15 ข้อ)
              </span>
              <span className="text-slate-400 font-mono text-sm">
                ข้อที่ {mcIndex + 1} / {mcQuestions.length}
              </span>
            </div>

            <div>
              {/* Question Text */}
              <div className="text-base font-bold text-slate-800 mb-6 bg-slate-50/50 p-6 rounded-xl border border-slate-200/80 leading-relaxed">
                <span className="text-lg text-blue-600 mr-2">ข้อที่ {mcIndex + 1}.</span>
                <MathRenderer text={currentMcQ.text} />
              </div>

              {/* Question Image if available */}
              {currentMcQ.image && (
                <div className="mb-6 flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <img
                    src={getCleanImageUrl(currentMcQ.image)}
                    alt={`รูปภาพประกอบข้อที่ ${mcIndex + 1}`}
                    className="max-h-[300px] object-contain rounded-lg shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Shuffled Choices */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {currentMcQ.shuffledChoicesList.map((choiceValue, idx) => {
                  const letterPrefix = ['ก', 'ข', 'ค', 'ง', 'จ'][idx];
                  const isSelected = mcAnswers[currentMcQ.id] === choiceValue;
                  
                  // Map back to unshuffled index to get the correct choice image
                  const originalIdx = currentMcQ.choices ? currentMcQ.choices.indexOf(choiceValue) : -1;
                  const choiceImg = (originalIdx !== -1 && currentMcQ.choiceImages) ? currentMcQ.choiceImages[originalIdx] : undefined;
                  
                  return (
                    <button
                      key={idx}
                      type="button"
                      id={`btn-choice-${currentMcQ.id}-${idx}`}
                      onClick={() => {
                        setMcAnswers({
                          ...mcAnswers,
                          [currentMcQ.id]: choiceValue
                        });
                      }}
                      className={`p-4 rounded-xl border-2 text-left transition-all flex items-start gap-4 cursor-pointer ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-[#002B49] font-bold shadow-sm'
                          : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 text-slate-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 border transition-all mt-0.5 ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {letterPrefix}
                      </div>
                      <div className="flex-grow flex flex-col gap-2">
                        <span className="text-sm font-semibold">
                          <MathRenderer text={choiceValue} />
                        </span>
                        {choiceImg && (
                          <div className="mt-1 bg-white p-1 rounded border border-slate-100 flex justify-center max-h-[140px] overflow-hidden">
                            <img
                              src={getCleanImageUrl(choiceImg)}
                              alt={`รูปประกอบตัวเลือก ${letterPrefix}`}
                              className="max-h-[120px] object-contain rounded"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Navigation within MC Questions */}
              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-mc-prev"
                  onClick={() => setMcIndex(prev => Math.max(0, prev - 1))}
                  disabled={mcIndex === 0}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800 disabled:opacity-30 flex items-center gap-1.5"
                >
                  <ChevronLeft size={16} />
                  <span>ข้อก่อนหน้า</span>
                </button>

                <div className="flex gap-1.5 hidden md:flex overflow-x-auto max-w-[250px] md:max-w-none p-1">
                  {mcQuestions.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      id={`btn-mc-nav-${i}`}
                      onClick={() => setMcIndex(i)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center border transition-all ${
                        mcIndex === i
                          ? 'bg-[#002B49] text-white border-[#002B49]'
                          : mcAnswers[mcQuestions[i].id]
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-white text-slate-400 border-slate-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                {mcIndex < mcQuestions.length - 1 ? (
                  <button
                    type="button"
                    id="btn-mc-next"
                    onClick={() => setMcIndex(prev => Math.min(mcQuestions.length - 1, prev + 1))}
                    className="px-5 py-2.5 bg-[#002B49] text-white rounded-lg font-bold text-sm shadow hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                  >
                    <span>ข้อถัดไป</span>
                    <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    type="button"
                    id="btn-mc-finish-section"
                    onClick={() => setExamPhase(2)}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold text-sm shadow hover:shadow-md transition-all flex items-center gap-1.5 animate-pulse"
                  >
                    <span>ทำส่วนที่ 2: อัตนัยต่อ</span>
                    <ChevronRight size={16} />
                  </button>
                )}
              </div>

            </div>
          </div>
        )}

        {/* PHASE 2: SHORT ANSWER (อัตนัยเติมคำ) */}
        {examPhase === 2 && (
          <div className="bg-white rounded-xl shadow-md border border-slate-200 relative overflow-hidden p-6 md:p-8 animate-fadeIn" id="phase-2-sa">
            <div className="absolute top-0 left-0 w-1 bg-red-600 h-full" />

            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full">
                ส่วนที่ 2: อัตนัย (5 ข้อ)
              </span>
              <span className="text-slate-400 font-mono text-sm">
                เติมคำตอบสั้น
              </span>
            </div>

            <div className="space-y-8">
              <div className="bg-amber-50 text-amber-800 text-xs p-4 rounded-xl border border-amber-200 font-semibold shadow-sm">
                * คำแนะนำ: กรุณาคิดเลขอย่างรอบคอบและกรอกเฉพาะคำตอบในรูปแบบ ตัวเลข เท่านั้น เช่น "45" หรือทศนิยมตามระบุในแต่ละโจทย์
              </div>

              {saQuestions.map((q, index) => (
                <div key={q.id} className="p-6 border border-slate-200/80 rounded-xl bg-white space-y-4 shadow-sm">
                  <div className="text-sm font-bold text-slate-800 leading-relaxed">
                    <span className="text-amber-600 mr-1.5">ข้อที่ {index + 1}.</span>
                    <MathRenderer text={q.text} />
                  </div>
                  
                  {/* Question Image if available */}
                  {q.image && (
                    <div className="mt-2 mb-4 flex justify-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <img
                        src={q.image}
                        alt={`รูปภาพประกอบข้อที่ ${index + 1}`}
                        className="max-h-[250px] object-contain rounded-lg shadow-sm"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <div className="relative max-w-md w-full">
                    {/* Math Toolbar Helper for Student */}
                    <div className="bg-slate-50 p-2.5 rounded-t-lg border border-b-0 border-slate-200 w-full">
                      <p className="text-[10px] text-slate-500 font-bold mb-1">เครื่องมือพิมพ์สัญลักษณ์คณิตศาสตร์ (คลิกเพื่อใส่สัญลักษณ์):</p>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { label: 'เศษส่วน', value: '\\frac{เศษ}{ส่วน}', desc: 'เศษส่วน' },
                          { label: 'สแควรูท', value: '\\sqrt{x}', desc: 'รากที่สอง' },
                          { label: 'เลขยกกำลัง', value: 'x^{y}', desc: 'ยกกำลัง' },
                          { label: 'π (พาย)', value: '\\pi', desc: 'พาย' },
                          { label: '× (คูณ)', value: '\\times', desc: 'เครื่องหมายคูณ' },
                          { label: '÷ (หาร)', value: '\\div', desc: 'เครื่องหมายหาร' },
                          { label: '± (บวก/ลบ)', value: '\\pm', desc: 'บวกหรือลบ' },
                          { label: '≥ (มากกว่าเท่ากับ)', value: '\\ge', desc: 'มากกว่าเท่ากับ' },
                          { label: '≤ (น้อยกว่าเท่ากับ)', value: '\\le', desc: 'น้อยกว่าเท่ากับ' },
                          { label: '° (องศา)', value: '^{\\circ}', desc: 'องศา' },
                          { label: 'มุม', value: '\\angle', desc: 'มุม' },
                          { label: '≈ (ประมาณ)', value: '\\approx', desc: 'ประมาณ' },
                        ].map((sym) => (
                          <button
                            key={sym.label}
                            type="button"
                            title={sym.desc}
                            onClick={() => {
                              const currentVal = shortAnswers[q.id] || '';
                              const inputEl = document.getElementById(`input-sa-${q.id}`) as HTMLInputElement;
                              if (inputEl) {
                                const start = inputEl.selectionStart || 0;
                                const end = inputEl.selectionEnd || 0;
                                const newVal = currentVal.substring(0, start) + sym.value + currentVal.substring(end);
                                setShortAnswers({
                                  ...shortAnswers,
                                  [q.id]: newVal
                                });
                                // Set cursor position back after the inserted value
                                setTimeout(() => {
                                  inputEl.focus();
                                  const nextPos = start + sym.value.length;
                                  inputEl.setSelectionRange(nextPos, nextPos);
                                }, 50);
                              } else {
                                setShortAnswers({
                                  ...shortAnswers,
                                  [q.id]: currentVal + sym.value
                                });
                              }
                            }}
                            className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded text-[10px] font-bold border border-slate-200 shadow-3xs transition-colors cursor-pointer flex items-center gap-0.5"
                          >
                            <span>{sym.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      id={`input-sa-${q.id}`}
                      value={shortAnswers[q.id] || ''}
                      onChange={(e) => {
                        setShortAnswers({
                          ...shortAnswers,
                          [q.id]: e.target.value
                        });
                      }}
                      placeholder="พิมพ์คำตอบของท่านที่นี่ (สามารถพิมพ์หรือคลิกใช้ปุ่มคณิตศาสตร์ข้างบน)"
                      className="w-full px-4 py-2.5 rounded-b-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm font-semibold font-mono"
                    />

                    {/* Live math equations preview */}
                    {shortAnswers[q.id] && (
                      <div className="mt-2 bg-amber-50/50 p-2.5 border border-amber-200/60 rounded-lg">
                        <span className="text-slate-500 block text-[9px] font-bold">แสดงการแสดงผลทางคณิตศาสตร์แบบเรียลไทม์ (Math Live Preview):</span>
                        <div className="mt-1 py-1.5 px-3 bg-white rounded border border-slate-200/60 min-h-[36px] flex items-center justify-start text-sm text-slate-800">
                          <MathRenderer text={`$${shortAnswers[q.id]}$`} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-sa-back-to-mc"
                  onClick={() => setExamPhase(1)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft size={16} />
                  <span>กลับไปตรวจทานปรนัย</span>
                </button>

                <button
                  type="button"
                  id="btn-sa-go-to-written"
                  onClick={() => setExamPhase(3)}
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg font-bold text-sm shadow hover:shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>ส่วนที่ 3: แสดงวิธีทำต่อ</span>
                  <ChevronRight size={16} />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PHASE 3: WRITTEN METHOD (แสดงวิธีทำ) */}
        {examPhase === 3 && writtenQuestion && (
          <div className="bg-white rounded-xl shadow-md border border-slate-200 relative overflow-hidden p-6 md:p-8" id="phase-3-wr">
            <div className="absolute top-0 left-0 w-1 bg-red-600 h-full" />

            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-full">
                ส่วนที่ 3: แสดงวิธีทำ (1 ข้อ)
              </span>
              <span className="text-slate-400 font-mono text-sm">
                แสดงวิธีทำอย่างละเอียด
              </span>
            </div>

            <div className="space-y-6">
              {/* Written Problem Statement */}
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                <p className="text-xs font-bold text-red-600 uppercase tracking-wider">โจทย์แสดงวิธีทำ:</p>
                <p className="text-base font-bold text-slate-800 leading-relaxed font-sans">
                  <MathRenderer text={writtenQuestion.text} />
                </p>
                
                {/* Question Image if available */}
                {writtenQuestion.image && (
                  <div className="mt-2 flex justify-center bg-white p-4 rounded-xl border border-slate-200">
                    <img
                      src={writtenQuestion.image}
                      alt="รูปภาพประกอบข้อแสดงวิธีทำ"
                      className="max-h-[300px] object-contain rounded-lg shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                <div className="text-[11px] text-slate-500 italic">
                  * คำชี้แจง: ให้ทดและเขียนขั้นตอนวิธีคิดลงในพื้นที่กระดานวาดเขียนด้านล่างให้ชัดเจนที่สุดเพื่อประโยชน์ในการให้คะแนนโดยคณะกรรมการคุณครูตรวจข้อสอบ
                </div>
              </div>

              {/* Drawing Board Canvas */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">กระดานทดและเขียนวิธีทำอย่างละเอียด (Digital Canvas Pad):</p>
                <CanvasDrawing
                  initialData={writtenAnswer}
                  onChange={(base64) => setWrittenAnswer(base64)}
                />
              </div>

              <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-written-back-to-sa"
                  onClick={() => setExamPhase(2)}
                  className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg flex items-center gap-1.5 hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft size={16} />
                  <span>กลับไปแก้ไขส่วนเติมคำ</span>
                </button>

                <button
                  type="button"
                  id="btn-written-go-to-confirm"
                  onClick={() => setExamPhase(4)}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-[#D22630] text-white rounded-lg font-bold text-sm shadow hover:shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>ตรวจทานและเตรียมส่งสอบ</span>
                  <ChevronRight size={16} />
                </button>
              </div>

            </div>
          </div>
        )}

        {/* PHASE 4: CONFIRMATION / PRE-SUBMISSION */}
        {examPhase === 4 && (
          <div className="bg-white rounded-xl shadow-md border border-slate-200 relative overflow-hidden p-6 md:p-8" id="phase-4-confirm">
            <div className="absolute top-0 left-0 w-1 bg-red-600 h-full" />

            <div className="flex justify-between items-start mb-6">
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                ส่วนที่ 4: ตรวจทานคำตอบ
              </span>
              <span className="text-slate-400 font-mono text-sm">
                ยืนยันการส่งข้อสอบ
              </span>
            </div>

            <div className="space-y-8">
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm leading-relaxed font-semibold shadow-sm">
                ท่านใกล้จะเสร็จสิ้นการทำข้อสอบวิชาคณิตศาสตร์แล้ว โปรดตรวจทานสถานะการตอบข้อสอบแต่ละส่วนด้านล่างให้เรียบร้อยเพื่อความแน่ใจสูงสุด
              </div>

              {/* Grid of status counts */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500 font-semibold mb-1">ส่วนที่ 1: ข้อสอบเลือกตอบ (ปรนัย)</p>
                  <p className="text-lg font-bold text-[#002B49]">
                    ทำแล้ว {Object.keys(mcAnswers).length} / {mcQuestions.length} ข้อ
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {mcQuestions.map((q, i) => (
                      <span
                        key={q.id}
                        className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center border ${
                          mcAnswers[q.id]
                            ? 'bg-blue-100 text-blue-800 border-blue-200'
                            : 'bg-red-50 text-red-500 border-red-100'
                        }`}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50">
                  <p className="text-xs text-slate-500 font-semibold mb-1">ส่วนที่ 2: ข้อสอบเติมคำตอบ (อัตนัย)</p>
                  <p className="text-lg font-bold text-amber-700">
                    ทำแล้ว {(Object.values(shortAnswers) as string[]).filter(v => v.trim()).length} / {saQuestions.length} ข้อ
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {saQuestions.map((q, i) => (
                      <span
                        key={q.id}
                        className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center border ${
                          shortAnswers[q.id]?.trim()
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-red-50 text-red-500 border-red-100'
                        }`}
                      >
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 flex flex-col justify-between">
                  <div>
                    <p className="text-xs text-slate-500 font-semibold mb-1">ส่วนที่ 3: แสดงวิธีทำ</p>
                    <p className={`text-sm font-bold ${writtenAnswer ? 'text-green-600' : 'text-red-600'}`}>
                      {writtenAnswer ? '✅ วาดเขียนแสดงวิธีทำเรียบร้อยแล้ว' : '❌ ยังไม่ได้วาดเขียนแสดงวิธีทำ'}
                    </p>
                  </div>
                  {writtenAnswer && (
                    <div className="border border-slate-200 rounded-lg overflow-hidden h-14 bg-white mt-2 p-1">
                      <img src={writtenAnswer} alt="Preview" className="h-full w-auto mx-auto object-contain" />
                    </div>
                  )}
                </div>
              </div>

              {/* Detailed answers preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 border-b border-slate-200">
                  รายละเอียดการตอบข้อสอบเติมคำตอบ (ส่วนอัตนัย):
                </div>
                <div className="p-4 bg-white divide-y divide-slate-100">
                  {saQuestions.map((q, index) => (
                    <div key={q.id} className="py-2.5 first:pt-0 last:pb-0 flex justify-between gap-4 text-xs font-medium items-center">
                      <span className="text-slate-500 shrink-0 flex items-center gap-1">
                        <span>ข้อที่ {index + 1}:</span>
                        <MathRenderer text={q.text.length > 45 ? `${q.text.substring(0, 45)}...` : q.text} />
                      </span>
                      <span className={`font-mono font-bold ${shortAnswers[q.id] ? 'text-slate-800' : 'text-red-500'}`}>
                        {shortAnswers[q.id] ? `"${shortAnswers[q.id]}"` : '(ไม่ได้ตอบ)'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time progress block for 30 minutes rule */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-slate-700">🕒 ตรวจสอบระยะเวลาการทำข้อสอบ (ขั้นต่ำ 30 นาที):</span>
                  <span className={3600 - timeLeft >= 1800 ? 'text-green-600' : 'text-amber-600'}>
                    {3600 - timeLeft >= 1800 ? 'ผ่านเกณฑ์ขั้นต่ำแล้ว' : 'ยังไม่ผ่านเกณฑ์ขั้นต่ำ'}
                  </span>
                </div>
                <p className="text-slate-500 leading-relaxed font-medium">
                  เพื่อความโปร่งใสในการจัดสอบออนไลน์ นักเรียนทุกคนต้องใช้เวลาทำข้อสอบอย่างน้อย <span className="font-bold text-slate-800">30 นาที</span> จึงจะสามารถส่งข้อสอบวิชาคณิตศาสตร์ได้
                </p>
                <div className="flex justify-between font-mono text-[11px] text-slate-600 font-bold">
                  <span>ใช้เวลาไปแล้ว: {Math.floor((3600 - timeLeft) / 60)} นาที {(3600 - timeLeft) % 60} วินาที</span>
                  {3600 - timeLeft < 1800 && (
                    <span className="text-red-500 font-bold">ต้องรออีกอย่างน้อย: {Math.ceil((1800 - (3600 - timeLeft)) / 60)} นาที</span>
                  )}
                </div>
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden border border-slate-300">
                  <div 
                    className={`h-full transition-all duration-500 ${3600 - timeLeft >= 1800 ? 'bg-green-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, ((3600 - timeLeft) / 1800) * 100)}%` }}
                  />
                </div>
              </div>

              {submitError && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl text-xs leading-relaxed">
                  {submitError}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-6 border-t border-slate-100">
                <button
                  type="button"
                  id="btn-confirm-back-to-written"
                  onClick={() => setExamPhase(3)}
                  className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-all"
                >
                  <ChevronLeft size={16} />
                  <span>กลับไปตรวจสอบส่วนแสดงวิธีทำ</span>
                </button>

                <button
                  type="button"
                  id="btn-final-submit"
                  onClick={handleManualSubmit}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <CheckCircle size={18} />
                  <span>ส่งข้อสอบวิชาคณิตศาสตร์</span>
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* FOOTER BAR */}
      <footer className="bg-slate-900 text-slate-500 py-4 text-center text-xs border-t border-slate-800 mt-8">
        <p>© 2026 ระบบการสอบวิชาคณิตศาสตร์. ห้ามปิด คัดลอก หรือพยายามดัดแปลงหน้าจอสอบนี้เด็ดขาด</p>
      </footer>
    </div>
  );
}
