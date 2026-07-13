import React, { useState } from 'react';
import { User, Layers, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { Student } from '../types';

interface ClassroomSelectionProps {
  student: Student;
  onClassroomSelected: (selectedClass: string) => void;
  onBackToLogin: () => void;
}

export default function ClassroomSelection({ student, onClassroomSelected, onBackToLogin }: ClassroomSelectionProps) {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const availableClassrooms = ["3/2", "5/3", "5/5", "6/3", "6/5", "6/8"];

  const handleConfirm = () => {
    if (!selectedClass) {
      setError('กรุณาเลือกห้องเรียนของท่านก่อนเริ่มทำข้อสอบ');
      return;
    }

    // Strict validation: check if selected classroom matches student's registered classroom
    if (student.class !== selectedClass) {
      setError(`⚠️ ข้อมูลไม่ตรงกัน: ท่านลงทะเบียนในชั้นเรียน "${student.class}" แต่กำลังจะเลือกเข้าห้องสอบ "${selectedClass}" โปรดเลือกให้ถูกต้องตามข้อมูลของท่านเพื่อป้องกันข้อผิดพลาดในการจัดส่งข้อสอบ`);
      return;
    }

    setError('');
    onClassroomSelected(selectedClass);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12" id="classroom-select-root">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-md border border-slate-200 relative overflow-hidden p-8">
        {/* Top/Left solid red accent line */}
        <div className="absolute top-0 left-0 w-1.5 bg-red-600 h-full" />

        <div>
          <h1 className="text-2xl font-bold text-[#002B49] text-center mb-6 tracking-tight">
            ยืนยันข้อมูลและเลือกห้องเรียนเพื่อเข้าสอบ
          </h1>

          {/* Student Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 flex flex-col md:flex-row gap-6 items-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-[#002B49] shrink-0 border border-blue-200">
              <User size={32} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <div>
                <p className="text-xs text-slate-500 font-semibold">ชื่อ-นามสกุลนักเรียน</p>
                <p className="text-base font-bold text-slate-800">{student.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold">รหัสนักเรียน</p>
                <p className="text-base font-bold text-[#002B49] font-mono">{student.id}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold">ชั้นเรียนที่ลงทะเบียน</p>
                <p className="text-base font-bold text-slate-800">มัธยมศึกษาปีที่ {student.class}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-semibold">เลขที่</p>
                <p className="text-base font-bold text-slate-800">เลขที่ {student.number}</p>
              </div>
            </div>
          </div>

          {/* Action Warning */}
          <div className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-5 mb-6 flex items-start gap-3 text-xs shadow-sm">
            <ShieldAlert size={18} className="text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold text-sm text-red-900 mb-1">สำคัญมาก: กรุณาเลือกห้องเรียนที่ตรงกับห้องเรียนจริงของท่าน</p>
              <p className="leading-relaxed font-medium">ระบบต้องการให้ท่านยืนยันห้องเรียน (Classrooms) ซ้ำอีกครั้ง เพื่อป้องกันการจัดส่งคะแนนข้อสอบผิดห้องโดยเด็ดขาด หากคะแนนถูกส่งไปผิดห้องจะไม่สามารถแก้ไขข้อมูลได้</p>
            </div>
          </div>

          {/* Classroom Selection Grid */}
          <div className="mb-8">
            <p className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-1.5">
              <Layers size={18} className="text-blue-600" />
              โปรดกดเลือกห้องเรียนของท่าน:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {availableClassrooms.map((cName) => {
                const isSelected = selectedClass === cName;
                
                return (
                  <button
                    key={cName}
                    type="button"
                    id={`btn-select-class-${cName.replace('/', '_')}`}
                    onClick={() => {
                      setSelectedClass(cName);
                      setError('');
                    }}
                    className={`p-4 rounded-xl border-2 text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-[#002B49] font-bold scale-[1.02] shadow-sm'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-slate-700 font-semibold'
                    }`}
                  >
                    <div className="text-lg">ชั้น ม.{cName}</div>
                    {isSelected && (
                      <div className="text-[10px] text-blue-800 flex items-center justify-center gap-1 mt-1 font-bold">
                        <CheckCircle2 size={10} className="text-blue-800" />
                        <span>ห้องเรียนนี้</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 text-red-700 text-xs p-4 rounded-xl border border-red-200 mb-6 font-semibold leading-relaxed"
            >
              {error}
            </motion.div>
          )}

          {/* Navigation Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center border-t border-slate-100 pt-6">
            <button
              type="button"
              id="btn-back-to-login"
              onClick={onBackToLogin}
              className="w-full sm:w-auto px-6 py-2.5 text-slate-500 hover:text-slate-800 font-bold text-sm transition-colors text-center cursor-pointer"
            >
              ออกจากระบบ / กลับหน้าล็อกอิน
            </button>
            <button
              type="button"
              id="btn-start-exam"
              onClick={handleConfirm}
              className="w-full sm:w-auto px-8 py-3 bg-blue-900 hover:bg-blue-950 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>ยืนยันห้องเรียนและเริ่มทำข้อสอบ</span>
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Info about exam set assignment */}
          <div className="mt-8 text-center bg-slate-100 p-3.5 rounded-xl border border-slate-200/50">
            <p className="text-[11px] text-slate-500 font-medium">
              * ข้อมูลเลขที่ {student.number} เป็นเลขที่{student.number % 2 === 1 ? 'คี่ (จะถูกจัดส่งข้อสอบชุด A)' : 'คู่ (จะถูกจัดส่งข้อสอบชุด B)'} อัตโนมัติ โดยระบบจะดึงข้อสอบที่ตรงกับห้องเรียนวิชาคณิตศาสตร์ของท่านโดยเฉพาะ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
