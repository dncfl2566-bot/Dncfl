import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getInitialQuestions, getInitialStudents } from "./src/data/initialQuestions";
import { Student, Question, Submission, SystemState } from "./src/types";

import http from "http";
import https from "https";

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "db.json");

// Parse CSV content into Student[]
function parseStudentCSV(csvText: string): Student[] {
  const lines = csvText.split(/\r?\n/);
  const students: Student[] = [];
  
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
  
  let idIdx = -1, nameIdx = -1, classIdx = -1, numIdx = -1;

  headers.forEach((h, idx) => {
    const low = h.toLowerCase();
    if (low.includes("รหัส") || low.includes("id") || low.includes("student_id") || low.includes("student id")) idIdx = idx;
    else if (low.includes("ชื่อ") || low.includes("name") || low.includes("สกุล") || low.includes(\"fullname\")) nameIdx = idx;
    else if (low.includes("ชั้น") || low.includes("class") || low.includes("grade") || low.includes("ห้อง")) classIdx = idx;
    else if (low.includes("เลขที่") || low.includes("no") || low.includes("number")) numIdx = idx;
  });

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cells = line.split(",").map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 2) continue;

    const id = idIdx !== -1 ? cells[idIdx] : cells[0];
    const name = nameIdx !== -1 ? cells[nameIdx] : cells[1];
    const classroom = classIdx !== -1 ? cells[classIdx] : (cells[2] || "3");
    const number = numIdx !== -1 ? cells[numIdx] : (cells[3] || "");
    const password = id; 

    if (id && name) {
      students.push({ id, name, classroom, number, password });
    }
  }

  return students;
}

function readDb(): SystemState {
  if (!fs.existsSync(DB_FILE)) {
    const initialState: SystemState = {
      students: getInitialStudents(),
      questions: getInitialQuestions(),
      submissions: [],
      googleAccessToken: undefined,
      spreadsheetId: undefined
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialState, null, 2), "utf-8");
    return initialState;
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    const initialState: SystemState = {
      students: getInitialQuestions() as any, 
      questions: getInitialQuestions(),
      submissions: [],
      googleAccessToken: undefined,
      spreadsheetId: undefined
    };
    return initialState;
  }
}

function writeDb(state: SystemState) {
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2), "utf-8");
  syncToGoogleSheetsWithQueue(state);
}

// 2-Way Sync Queue Utilities
let syncQueue: SystemState | null = null;
let isSyncing = false;

function syncToGoogleSheetsWithQueue(state: SystemState) {
  syncQueue = JSON.parse(JSON.stringify(state)); 
  processSyncQueue();
}

async function processSyncQueue() {
  if (isSyncing || !syncQueue) return;
  isSyncing = true;
  const stateToSync = syncQueue;
  syncQueue = null;

  if (stateToSync.googleAccessToken && stateToSync.spreadsheetId) {
    try {
      await pushAllToGoogleSheets(stateToSync.googleAccessToken, stateToSync.spreadsheetId, stateToSync);
    } catch (err) {
      console.error("Auto Sync Error:", err);
    }
  }
  isSyncing = false;
  if (syncQueue) processSyncQueue();
}

// 🔥 ปรับปรุงให้เริ่มต้นระบบสอบทุกระดับชั้นเป็น false เสมอเมื่อเปิดระบบ (ตามความต้องการที่ 1)
let examSettings: Record<string, boolean> = { '3': false, '5': false, '6': false, '6/8': false };

// Google Sheets API Integration Helpers
async function pushAllToGoogleSheets(accessToken: string, spreadsheetId: string, state: SystemState) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
  
  const studentRows = [["ID", "Name", "Classroom", "Number", "Password"]];
  state.students.forEach(s => {
    studentRows.push([s.id, s.name, s.classroom, s.number || "", s.password || s.id]);
  });

  const questionRows = [["ID", "Code", "Level", "Type", "Choices", "Question", "Answer", "Solution", "Image"]];
  state.questions.forEach(q => {
    questionRows.push([
      q.id, q.code, q.level, q.type, 
      JSON.stringify(q.choices), 
      q.question, q.answer, q.solution || "", q.image || ""
    ]);
  });

  const submissionRows = [
    ["ID", "StudentID", "StudentName", "Classroom", "Score", "TotalQuestions", "SubmittedAt", "Answers", "CheatingAttempts", "TabSwitches", "FaceOuts", "IsCheater", "Logs", "WrittenAnswers"]
  ];
  state.submissions.forEach(s => {
    submissionRows.push([
      s.id, s.studentId, s.studentName, s.classroom, 
      String(s.score), String(s.totalQuestions), s.submittedAt,
      JSON.stringify(s.answers), String(s.cheatingAttempts || 0),
      String(s.tabSwitches || 0), String(s.faceOuts || 0),
      String(s.isCheater || false), JSON.stringify(s.logs || []),
      JSON.stringify(s.writtenAnswers || {})
    ]);
  });

  const body = {
    valueInputOption: "USER_ENTERED",
    data: [
      { range: "Students!A:E", values: studentRows },
      { range: "Questions!A:I", values: questionRows },
      { range: "Submissions!A:N", values: submissionRows }
    ]
  };

  const cleanRangesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`;
  await fetch(cleanRangesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ ranges: ["Students!A:E", "Questions!A:I", "Submissions!A:N"] })
  });

  const updateRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (updateRes.status === 401) {
    const cachedDbState = readDb();
    if (cachedDbState) {
      cachedDbState.googleAccessToken = undefined;
      writeDb(cachedDbState);
    }
    return;
  }

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(`Push failed: ${errText}`);
  }
}

// 🔥 ปรับปรุงให้ดึงข้อมูลประวัติการทำข้อสอบ (Submissions) กลับมาจากตารางชีตเสมอเมื่อกดดึงข้อมูล (แก้ปัญหาประวัติหาย)
async function pullAllFromGoogleSheets(accessToken: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Students!A:E&ranges=Questions!A:I&ranges=Submissions!A:N`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    throw new Error(`Google Sheets Pull API respond error status: ${res.status}`);
  }
  
  const data = await res.json();
  const valueRanges = data.valueRanges || [];
  
  const studentRows = valueRanges[0]?.values || [];
  const questionRows = valueRanges[1]?.values || [];
  const submissionRows = valueRanges[2]?.values || [];
  
  const state = readDb();
  
  if (studentRows.length > 1) {
    state.students = studentRows.slice(1).map((row: any) => ({
      id: row[0] || "",
      name: row[1] || "",
      classroom: row[2] || "",
      number: row[3] || "",
      password: row[4] || ""
    }));
  }
  
  if (questionRows.length > 1) {
    state.questions = questionRows.slice(1).map((row: any) => {
      let choicesArr = ["", "", "", "", ""];
      try {
        if (row[4]) {
          const parsed = JSON.parse(row[4]);
          if (Array.isArray(parsed)) choicesArr = parsed;
        }
      } catch(e) {
        if (row[4]) choicesArr = row[4].split(",").map((c: string) => c.trim());
      }
      
      return {
        id: row[0] || "",
        code: row[1] || "",
        level: row[2] || "",
        type: (row[3] || "multiple-choice") as any,
        question: row[5] || "",
        choices: choicesArr,
        answer: row[6] || "0",
        solution: row[7] || "",
        image: row[8] || ""
      };
    });
  }
  
  // แกะและอัปเดตข้อมูลประวัติผลงานการสอบไม่ให้สูญหาย
  if (submissionRows.length > 1) {
    state.submissions = submissionRows.slice(1).map((row: any) => ({
      id: row[0] || "",
      studentId: row[1] || "",
      studentName: row[2] || "",
      classroom: row[3] || "",
      score: Number(row[4] || 0),
      totalQuestions: Number(row[5] || 0),
      submittedAt: row[6] || "",
      answers: row[7] ? JSON.parse(row[7]) : {},
      cheatingAttempts: Number(row[8] || 0),
      tabSwitches: Number(row[9] || 0),
      faceOuts: Number(row[10] || 0),
      isCheater: row[11] === 'true' || row[11] === true,
      logs: row[12] ? JSON.parse(row[12]) : [],
      writtenAnswers: row[13] ? JSON.parse(row[13]) : {}
    }));
  }
  
  writeDb(state);
  return state;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // API Authentication Endpoints
  app.post("/api/login", (req, res) => {
    const { studentId, password } = req.body;
    const state = readDb();
    
    const student = state.students.find(s => s.id === studentId && (s.password || s.id) === password);
    if (!student) {
      return res.status(401).json({ success: false, message: "ไม่พบรหัสประจำตัวนี้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    
    res.json({ success: true, student });
  });

  // Google Integration Status API
  app.get("/api/admin/google-sheets/status", (req, res) => {
    const state = readDb();
    res.json({ 
      connected: !!state.googleAccessToken, 
      spreadsheetId: state.spreadsheetId 
    });
  });

  app.post("/api/admin/google-sheets/connect", async (req, res) => {
    const { accessToken, spreadsheetId } = req.body;
    if (!accessToken || !spreadsheetId) return res.status(400).json({ message: "ข้อมูลพารามิเตอร์ไม่ครบถ้วน" });
    
    const state = readDb();
    state.googleAccessToken = accessToken;
    state.spreadsheetId = spreadsheetId;
    
    try {
      await pushAllToGoogleSheets(accessToken, spreadsheetId, state);
      writeDb(state);
      res.json({ success: true, message: "เชื่อมต่อเครือข่าย Google Sheets สมบูรณ์" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  app.post("/api/admin/google-sheets/pull", async (req, res) => {
    const state = readDb();
    if (!state.googleAccessToken || !state.spreadsheetId) return res.status(400).json({ success: false, message: "ไม่ได้เชื่อมต่อนโยบายสิทธิ์ชีต" });
    try {
      const updatedState = await pullAllFromGoogleSheets(state.googleAccessToken, state.spreadsheetId);
      res.json({ success: true, message: "ดึงข้อมูลจากตารางมาอัปเดตระบบแล้ว!", data: updatedState });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Exam Control Configuration API
  app.get("/api/exam-settings", (req, res) => {
    res.json({ success: true, settings: examSettings });
  });

  app.post("/api/admin/exam-settings", (req, res) => {
    const { classroom, enabled } = req.body;
    if (!classroom) return res.status(400).json({ success: false, message: "กรุณาระบุกำหนดชั้นเรียน" });
    examSettings[classroom] = !!enabled;
    res.json({ success: true, settings: examSettings });
  });

  // API Lists
  app.get("/api/admin/students", (req, res) => res.json(readDb().students));
  app.get("/api/admin/questions", (req, res) => res.json(readDb().questions));
  app.get("/api/admin/submissions", (req, res) => res.json(readDb().submissions));

  app.get("/api/exam/questions/:classroom", (req, res) => {
    const { classroom } = req.params;
    if (!examSettings[classroom]) {
      return res.status(403).json({ success: false, message: "ระบบปิดสอบสำหรับระดับชั้นนี้อยู่ กรุณารอแอดมินสั่งเปิดระบบ" });
    }
    const filtered = readDb().questions.filter(q => q.level === classroom);
    res.json({ success: true, questions: filtered });
  });

  // Students Data CRUD
  app.post("/api/admin/students", (req, res) => {
    const s = req.body;
    if (!s.id || !s.name || !s.classroom) return res.status(400).json({ message: "ฟิลด์ไม่ครบ" });
    const state = readDb();
    const idx = state.students.findIndex(x => x.id === s.id);
    if (idx >= 0) state.students[idx] = s;
    else state.students.push(s);
    writeDb(state);
    res.json({ success: true, student: s });
  });

  app.post("/api/admin/students/bulk-csv", (req, res) => {
    const { csvText } = req.body;
    if (!csvText) return res.status(400).json({ message: "ไม่มีเนื้อหาไฟล์" });
    const parsed = parseStudentCSV(csvText);
    if (parsed.length === 0) return res.status(400).json({ message: "ไม่สามารถแปลงรูปแบบรายชื่อนร.ได้โปรดตรวจเช็คหัวตาราง" });
    
    const state = readDb();
    parsed.forEach(newStu => {
      const idx = state.students.findIndex(x => x.id === newStu.id);
      if (idx >= 0) state.students[idx] = newStu;
      else state.students.push(newStu);
    });
    writeDb(state);
    res.json({ success: true, count: parsed.length });
  });

  app.delete("/api/admin/students/:id", (req, res) => {
    const state = readDb();
    state.students = state.students.filter(x => x.id !== req.params.id);
    writeDb(state);
    res.json({ success: true });
  });

  app.post("/api/admin/students/clear-all", (req, res) => {
    const state = readDb();
    state.students = [];
    writeDb(state);
    res.json({ success: true });
  });

  // Questions Managing API
  app.post("/api/admin/questions", (req, res) => {
    const q = req.body;
    if (!q.question || !q.level) return res.status(400).json({ message: "ข้อมูลไม่สมบูรณ์" });
    const state = readDb();
    if (!q.id) {
      q.id = "q_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    }
    const idx = state.questions.findIndex(x => x.id === q.id);
    if (idx >= 0) state.questions[idx] = q;
    else state.questions.push(q);
    writeDb(state);
    res.json({ success: true, question: q });
  });

  app.delete("/api/admin/questions/:id", (req, res) => {
    const state = readDb();
    state.questions = state.questions.filter(x => x.id !== req.params.id);
    writeDb(state);
    res.json({ success: true });
  });

  // 🔥 เพิ่ม API ลบข้อสอบทั้งหมดออกระบบทีละตาราง (ตามความต้องการที่ 2)
  app.post("/api/admin/questions/clear-all", (req, res) => {
    try {
      const state = readDb();
      state.questions = [];
      writeDb(state);
      res.json({ success: true, message: "ลบข้อสอบทั้งหมดในฐานข้อมูลเรียบร้อยแล้ว" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Exam Submissions Processing API
  app.post("/api/exam/submit", (req, res) => {
    const sub: Submission = req.body;
    if (!sub.studentId || !sub.id) return res.status(400).json({ message: "ข้อมูลส่งกระดาษคำตอบไม่สมบูรณ์" });
    
    const state = readDb();
    const idx = state.submissions.findIndex(x => x.id === sub.id || (x.studentId === sub.studentId && x.submittedAt === sub.submittedAt));
    if (idx >= 0) state.submissions[idx] = sub;
    else state.submissions.push(sub);
    
    writeDb(state);
    res.json({ success: true, submission: sub });
  });

  app.delete("/api/admin/submissions/:id", (req, res) => {
    const state = readDb();
    state.submissions = state.submissions.filter(x => x.id !== req.params.id);
    writeDb(state);
    res.json({ success: true });
  });

  app.post("/api/admin/submissions/clear-all", (req, res) => {
    const state = readDb();
    state.submissions = [];
    writeDb(state);
    res.json({ success: true });
  });

  // Manual Push Sheet Handler
  app.post("/api/admin/google-sheets/push-manual", async (req, res) => {
    const state = readDb();
    if (!state.googleAccessToken || !state.spreadsheetId) return res.status(400).json({ success: false, message: "ระบบยังไม่ได้เชื่อมต่อสิทธิ์กับ Google Sheets" });
    try {
      await pushAllToGoogleSheets(state.googleAccessToken, state.spreadsheetId, state);
      res.json({ success: true, message: "ส่งข้อมูลข้อสอบและประวัติทั้งหมดขึ้นทับแผ่นงาน Google Sheets สำเร็จเรียบร้อย!" });
    } catch (err: any) { 
      res.status(500).json({ success: false, message: err.message }); 
    }
  });

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  app.use("/uploads", express.static(uploadsDir));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, () => console.log(`ระบบสอบคณิตศาสตร์รันที่: http://localhost:${PORT}`));
}

startServer();
