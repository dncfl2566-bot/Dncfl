import React, { useState } from 'react';
import { LogIn, KeyRound, ShieldAlert, Award, Calculator, School } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Student } from '../types';

interface StudentLoginProps {
  onLoginSuccess: (student: Student) => void;
  onAdminLoginSuccess: () => void;
}

export default function StudentLogin({ onLoginSuccess, onAdminLoginSuccess }: StudentLoginProps) {
  const [studentId, setStudentId] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId.trim()) {
      setError('กรุณากรอกรหัสนักเรียน');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: studentId.trim() })
      });
      const data = await response.json();
      
      if (data.success) {
        onLoginSuccess(data.student);
      } else {
        setError(data.message || 'รหัสนักเรียนไม่ถูกต้อง โปรดตรวจสอบอีกครั้ง');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword.trim()) {
      setError('กรุณากรอกข้อมูลแอดมินให้ครบถ้วน');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername.trim(), password: adminPassword })
      });
      const data = await response.json();

      if (data.success) {
        onAdminLoginSuccess();
      } else {
        setError(data.message || 'ข้อมูลแอดมินไม่ถูกต้อง');
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden" id="login-screen-root">
      {/* Background visual graphics */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-50 -z-10" />
      
      {/* Math-themed absolute visual background indicators */}
      <div className="absolute top-[10%] left-[10%] text-blue-900/5 font-mono text-[10rem] select-none pointer-events-none font-bold">∑</div>
      <div className="absolute bottom-[15%] right-[8%] text-blue-900/5 font-mono text-[12rem] select-none pointer-events-none font-bold">π</div>
      <div className="absolute top-[40%] right-[15%] text-blue-900/5 font-mono text-[8rem] select-none pointer-events-none font-bold">√</div>
      <div className="absolute bottom-[40%] left-[12%] text-blue-900/5 font-mono text-[7rem] select-none pointer-events-none font-bold">∫</div>

      <div className="w-full max-w-md my-auto z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden"
        >
          {/* Header Theme - Red & Blue banner */}
          <div className="relative h-28 bg-blue-900 border-b-4 border-red-700 p-6 flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-xl border border-white/20">
              <Calculator className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">ระบบทำข้อสอบ</h1>
              <p className="text-sm text-white/80">วิชาคณิตศาสตร์ (Mathematics Exam)</p>
            </div>
            <div className="absolute -bottom-6 right-6 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 border border-red-500">
              <Award size={14} />
              <span>ม.3 | ม.5 | ม.6</span>
            </div>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {!isAdminMode ? (
                // STUDENT LOGIN FORM
                <motion.form
                  key="student-form"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleStudentLogin}
                  className="space-y-6"
                  id="student-login-form"
                >
                  <div className="text-center mb-4">
                    <h2 className="text-lg font-bold text-slate-800">เข้าสู่ระบบสำหรับนักเรียน</h2>
                    <p className="text-xs text-slate-500">กรอกรหัสนักเรียนเพื่อเข้าทำข้อสอบ</p>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-red-50 text-red-700 text-xs p-3.5 rounded-lg border border-red-100 flex items-start gap-2"
                    >
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="student-id-input" className="block text-xs font-semibold text-slate-700">
                      รหัสนักเรียน (Username / Password)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        id="student-id-input"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        placeholder="กรอกรหัสนักเรียนของท่าน"
                        className="w-full px-4 py-3 pl-11 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-sm font-medium"
                        disabled={loading}
                      />
                      <School className="absolute left-3.5 top-3.5 text-slate-400 w-5 h-5" />
                    </div>
                  </div>

                  <button
                    type="submit"
                    id="student-login-submit"
                    disabled={loading}
                    className="w-full py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn size={18} />
                        เข้าสู่ระบบทำข้อสอบ
                      </>
                    )}
                  </button>
                  
                  <div className="border-t border-slate-100 pt-4 text-center flex flex-col items-center">
                    <p className="text-xs text-slate-400 font-medium">
                      *ใช้รหัสนักเรียนเป็นทั้งชื่อผู้ใช้และรหัสผ่านเข้าใช้งาน
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdminMode(true);
                        setError('');
                      }}
                      className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-bold hover:underline transition-all cursor-pointer"
                    >
                      เข้าสู่ระบบสำหรับคุณครู / แอดมิน (Admin Login)
                    </button>
                  </div>
                </motion.form>
              ) : (
                // ADMIN LOGIN FORM (SUBTLE & ACCESSIBLE)
                <motion.form
                  key="admin-form"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onSubmit={handleAdminLogin}
                  className="space-y-5"
                  id="admin-login-form"
                >
                  <div className="text-center">
                    <h2 className="text-lg font-bold text-red-700 flex items-center justify-center gap-1.5">
                      <KeyRound size={20} />
                      แผงควบคุมผู้ดูแลระบบ
                    </h2>
                    <p className="text-xs text-slate-500">สำหรับคุณครูและแอดมินจัดการข้อสอบ</p>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-700 text-xs p-3.5 rounded-lg border border-red-100 flex items-start gap-2">
                      <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="admin-username-input" className="block text-xs font-semibold text-slate-700">
                      ชื่อผู้ใช้แอดมิน
                    </label>
                    <input
                      type="text"
                      id="admin-username-input"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all text-sm font-medium"
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="admin-password-input" className="block text-xs font-semibold text-slate-700">
                      รหัสผ่านแอดมิน
                    </label>
                    <input
                      type="password"
                      id="admin-password-input"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-all text-sm font-medium"
                      disabled={loading}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      id="admin-cancel"
                      onClick={() => {
                        setIsAdminMode(false);
                        setError('');
                      }}
                      className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-all cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      id="admin-login-submit"
                      disabled={loading}
                      className="w-2/3 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {loading ? (
                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>เข้าสู่แผงควบคุม</span>
                      )}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* Subtle Admin Entrance Toggle in Footer */}
      <footer className="w-full max-w-4xl text-center flex justify-between items-center text-[11px] text-slate-400 mt-8 border-t border-slate-200 pt-4 px-2 z-10">
        <p>© 2026 ระบบข้อสอบวิชาคณิตศาสตร์. สงวนลิขสิทธิ์</p>
        
        {/* Visible Admin Lock Icon */}
        <button
          type="button"
          id="btn-subtle-admin"
          onClick={() => {
            setIsAdminMode(!isAdminMode);
            setError('');
          }}
          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1.5 transition-colors flex items-center gap-1.5 rounded-lg border border-blue-200 font-bold cursor-pointer text-xs"
          title="เจ้าหน้าที่ดูแลระบบ"
        >
          <KeyRound size={13} />
          <span>สำหรับครู/แอดมิน</span>
        </button>
      </footer>
    </div>
  );
}
