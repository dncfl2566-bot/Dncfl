import React, { useState, useEffect } from 'react';
import { Student, Submission } from './types';
import StudentLogin from './components/StudentLogin';
import ClassroomSelection from './components/ClassroomSelection';
import ExamEngine from './components/ExamEngine';
import SubmissionSummary from './components/SubmissionSummary';
import AdminPanel from './components/AdminPanel';

export default function App() {
  const [phase, setPhase] = useState<'login' | 'classroom-select' | 'exam' | 'result' | 'admin'>(() => {
    if (window.location.hash && window.location.hash.includes('access_token=')) {
      return 'admin';
    }
    const savedPhase = localStorage.getItem('app_phase');
    if (savedPhase === 'admin') return 'admin';
    return 'login';
  });
  
  // Student Context
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [classroom, setClassroom] = useState<string>('');
  
  // Submission result for the current session
  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);

  useEffect(() => {
    localStorage.setItem('app_phase', phase);
  }, [phase]);

  // Auto restore session if left mid-test (optional helper, but we keep it simple)
  const handleStudentLoginSuccess = (student: Student) => {
    setCurrentStudent(student);
    setPhase('classroom-select');
  };

  const handleAdminLoginSuccess = () => {
    setPhase('admin');
  };

  const handleClassroomSelection = (selectedClass: string) => {
    setClassroom(selectedClass);
    setPhase('exam');
  };

  const handleExamSubmitted = (submission: Submission) => {
    setActiveSubmission(submission);
    setPhase('result');
  };

  const handleBackToLogin = () => {
    setCurrentStudent(null);
    setClassroom('');
    setActiveSubmission(null);
    setPhase('login');
  };

  return (
    <div className="font-sans antialiased bg-slate-50 min-h-screen text-slate-800" id="app-root">
      {phase === 'login' && (
        <StudentLogin
          onLoginSuccess={handleStudentLoginSuccess}
          onAdminLoginSuccess={handleAdminLoginSuccess}
        />
      )}

      {phase === 'classroom-select' && currentStudent && (
        <ClassroomSelection
          student={currentStudent}
          onClassroomSelected={handleClassroomSelection}
          onBackToLogin={handleBackToLogin}
        />
      )}

      {phase === 'exam' && currentStudent && (
        <ExamEngine
          student={currentStudent}
          classroom={classroom}
          onExamSubmitted={handleExamSubmitted}
          onForceLogout={handleBackToLogin}
        />
      )}

      {phase === 'result' && activeSubmission && (
        <SubmissionSummary
          submission={activeSubmission}
          onDone={handleBackToLogin}
        />
      )}

      {phase === 'admin' && (
        <AdminPanel
          onLogout={handleBackToLogin}
        />
      )}
    </div>
  );
}
