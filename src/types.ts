export interface Student {
  id: string; // Student ID
  name: string; // Full Name
  class: string; // Classroom (e.g. "3/2", "5/3", "5/5", "6/3", "6/5", "6/8")
  number: number; // Student number (เลขที่)
}

export type QuestionType = 'multiple-choice' | 'short-answer' | 'written';

export interface Question {
  id: string; // e.g. "q-g3-setA-mc-1"
  gradeLevel: '3' | '5' | '6' | '6/8';
  set: 'A' | 'B';
  type: QuestionType;
  questionNumber: number; // 1 to 15 for MC, 1 to 5 for SA, 1 for Written
  text: string;
  image?: string; // Optional image URL or base64
  choices?: string[]; // Only for multiple-choice (can be 4 or 5 options)
  choiceImages?: string[]; // Optional images matching the choices (can be 4 or 5 options)
  correctAnswer: string; // The correct text or choice index (e.g. "0" for ก, or exact answer for short-answer)
}

export interface Submission {
  id: string;
  studentId: string;
  name: string;
  class: string;
  number: number;
  gradeLevel: '3' | '5' | '6' | '6/8';
  set: 'A' | 'B';
  multipleChoiceAnswers: Record<string, string>; // questionId -> selected choice text or index
  multipleChoiceScore: number;
  shortAnswers: Record<string, string>; // questionId -> student response text
  shortAnswerScores: Record<string, number>; // questionId -> graded score (0 or 1)
  writtenAnswer: string; // Drawing canvas base64 data URL
  writtenScore: number; // Graded score (0 to 10 or whatever)
  totalScore: number;
  timeTaken: number; // in minutes
  cheatingWarningsCount: number; // 0, 1, or 2
  cheated: boolean; // if warnings >= 2, score is forced to 0
  submittedAt: string;
  graded: boolean;
  gradedAt?: string;
  feedback?: string;
  originalMultipleChoiceAnswers?: Record<string, string>;
  originalShortAnswers?: Record<string, string>;
}

export interface SystemState {
  students: Student[];
  questions: Question[];
  submissions: Submission[];
}
