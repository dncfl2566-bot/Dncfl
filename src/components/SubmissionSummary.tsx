import React, { useState } from 'react';
import { CheckCircle2, User, Award, Clock, FileText, AlertOctagon, HelpCircle, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { Submission } from '../types';

interface SubmissionSummaryProps {
  submission: Submission;
  onDone: () => void;
}

export default function SubmissionSummary({ submission, onDone }: SubmissionSummaryProps) {
  const [isExiting, setIsExiting] = useState(false);
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12" id="submission-summary-root">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden relative">
        
        {/* Header - Success Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-green-600 p-8 text-white text-center relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle2 size={120} />
          </div>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30"
          >
            <CheckCircle2 size={36} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-black tracking-tight mb-2">ส่งกระดาษคำตอบเรียบร้อยแล้ว!</h1>
          <p className="text-sm text-white/80">ระบบได้ทำการบันทึกข้อมูลการสอบและคำตอบของท่านเข้าสู่ฐานข้อมูลกลางแล้ว</p>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Student details display */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-50 rounded-xl border border-slate-200 text-sm">
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-0.5">ชื่อ-นามสกุล</p>
              <p className="font-bold text-slate-800">{submission.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-0.5">รหัสนักเรียน</p>
              <p className="font-bold text-[#002B49] font-mono">{submission.studentId}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-0.5">ชั้นเรียน / ห้อง</p>
              <p className="font-bold text-slate-800">มัธยมศึกษาปีที่ {submission.class}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold mb-0.5">เลขที่</p>
              <p className="font-bold text-slate-800">เลขที่ {submission.number}</p>
            </div>
          </div>

          {/* Core Results Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Multiple Choice Score */}
            <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-blue-800 font-bold text-sm mb-3">
                  <Award size={18} />
                  <span>ผลคะแนนปรนัย (ประเมินอัตโนมัติ)</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  ข้อสอบส่วนเลือกตอบ ปรนัย ได้รับการตรวจและประเมินผลคะแนนโดยเซิร์ฟเวอร์ทันที
                </p>
              </div>

              <div className="my-6 text-center">
                <div>
                  <span className="text-5xl font-black text-[#002B49]">{submission.multipleChoiceScore}</span>
                  <span className="text-lg text-slate-400 font-bold"> / 15 คะแนน</span>
                </div>
                {submission.cheated && !submission.graded && (
                  <div className="inline-block mt-3 bg-red-50 text-red-700 px-3 py-1 rounded-md border border-red-200 text-[10px] font-bold">
                    ⚠️ ตรวจพบพฤติกรรมสลับหน้าต่าง (รอตรวจความถูกต้อง)
                  </div>
                )}
              </div>

              <div className="bg-blue-50/50 p-3 rounded-lg text-center text-xs font-semibold text-blue-900 border border-blue-100/50">
                {submission.cheated && !submission.graded 
                  ? `พบการสลับหน้าจอสอบ ${submission.cheatingWarningsCount} ครั้ง อยู่ระหว่างดุลยพินิจของคุณครู` 
                  : `ทำถูกต้องคิดเป็น ${Math.round((submission.multipleChoiceScore / 15) * 100)}% ของข้อสอบทั้งหมด`
                }
              </div>
            </div>

            {/* Time Taken & Status */}
            <div className="border border-slate-200 rounded-xl p-6 bg-white flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-slate-700 font-bold text-sm mb-3">
                  <Clock size={18} className="text-slate-500" />
                  <span>เวลาที่ใช้และสถานะการส่ง</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  บันทึกเวลาที่ใช้ในการตอบข้อสอบและประวัติความปลอดภัยในการคุมสอบออนไลน์
                </p>
              </div>

              <div className="my-6 space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">เวลาที่ใช้ทั้งหมด:</span>
                  <span className="font-bold text-slate-800">{submission.timeTaken} นาที</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">สถานะสลับหน้าต่าง:</span>
                  <span className={`font-bold ${submission.cheatingWarningsCount > 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {submission.cheatingWarningsCount} / 3 ครั้ง
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">การประเมินอัตนัย:</span>
                  <span className="font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-xs">
                    {submission.graded ? 'ตรวจเสร็จแล้ว' : 'รอคุณครูให้คะแนน'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-100 p-3 rounded-lg text-center text-xs font-bold text-slate-600 border border-slate-200/50">
                {submission.graded 
                  ? `คะแนนประเมินรวม: ${submission.totalScore} คะแนน` 
                  : 'เมื่อคุณครูทำการตรวจกระดาษคำตอบเรียบร้อยแล้ว คะแนนจะปรับปรุง'
                }
              </div>
            </div>

          </div>

          {/* Short Answers Table Preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <FileText size={16} className="text-slate-500" />
                คำตอบส่วนข้อสอบอัตนัยเติมคำ (5 ข้อ)
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded">
                {submission.graded ? 'ตรวจเสร็จแล้ว' : 'รอรับการให้คะแนน'}
              </span>
            </div>
            <div className="p-4 divide-y divide-slate-100 bg-white">
              {Object.keys(submission.shortAnswers).map((qId, idx) => {
                const answer = submission.shortAnswers[qId];
                const score = submission.shortAnswerScores[qId];

                return (
                  <div key={qId} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-700">ข้อที่ {idx + 1} (เติมคำตอบ)</p>
                      <p className="text-xs text-slate-400 italic">ID: {qId}</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 font-medium">คำตอบของท่าน:</span>
                        <span className="font-mono font-bold bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">
                          {answer ? `"${answer}"` : '(ไม่ได้พิมพ์ตอบ)'}
                        </span>
                      </div>
                      
                      {submission.graded ? (
                        <span className={`px-2 py-0.5 rounded font-bold ${score > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {score} / 2 คะแนน
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">รอตรวจ</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Written Method Preview */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-slate-100 px-5 py-3.5 border-b border-slate-200 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <HelpCircle size={16} className="text-slate-500" />
                รูปวาดกระดาษทดแสดงวิธีทำอย่างละเอียด (1 ข้อ)
              </span>
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded">
                {submission.graded ? `คะแนนส่วนนี้: ${submission.writtenScore} คะแนน` : 'รอการให้คะแนน (เต็ม 5)'}
              </span>
            </div>
            <div className="p-6 bg-slate-50 flex flex-col items-center justify-center">
              {submission.writtenAnswer ? (
                <div className="bg-white border-2 border-dashed border-slate-300 rounded-lg p-2 max-w-lg w-full shadow-inner overflow-hidden flex flex-col items-center gap-2">
                  <img 
                    src={submission.writtenAnswer} 
                    referrerPolicy="no-referrer"
                    alt="กระดาษทดแสดงวิธีทำ" 
                    className="w-full h-auto object-contain block max-h-96"
                    onError={(e) => {
                      const url = submission.writtenAnswer;
                      const matches = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);
                      if (matches && matches[1]) {
                        e.currentTarget.src = `https://drive.google.com/thumbnail?id=${matches[1]}&sz=w1000`;
                      }
                    }}
                  />
                  <a
                    href={submission.writtenAnswer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline font-bold mt-1 flex items-center gap-1"
                  >
                    🔗 เปิดดูรูปภาพแสดงวิธีทำจาก Google Drive (หากรูปภาพด้านบนไม่ยอมแสดง)
                  </a>
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  <AlertOctagon className="w-12 h-12 text-red-300 mx-auto mb-2 animate-pulse" />
                  <span>นักเรียนไม่ได้วาดเขียนตอบในส่วนแสดงวิธีทำ</span>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Section (if graded) */}
          {submission.graded && submission.feedback && (
            <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-6 shadow-sm">
              <h3 className="text-sm font-bold text-blue-900 mb-2">ความเห็นและคำติชมจากคุณครูผู้ตรวจข้อสอบ:</h3>
              <p className="text-xs text-blue-800 leading-relaxed bg-white border border-blue-100 rounded-lg p-4 font-medium whitespace-pre-line">
                {submission.feedback}
              </p>
            </div>
          )}

          {/* Done Controls */}
          <div className="border-t border-slate-100 pt-6 flex justify-center">
            <button
              type="button"
              id="btn-summary-done"
              onClick={() => {
                setIsExiting(true);
                requestAnimationFrame(() => {
                  setTimeout(() => {
                    onDone();
                  }, 50);
                });
              }}
              disabled={isExiting}
              className="px-8 py-3 bg-blue-900 hover:bg-blue-950 text-white rounded-xl font-bold text-sm shadow hover:shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isExiting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>กำลังออกจากระบบ...</span>
                </>
              ) : (
                <>
                  <LogOut size={16} />
                  <span>เสร็จสิ้น / ออกจากระบบสอบ</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
