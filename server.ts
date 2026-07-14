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
    else if (low.includes("ชื่อ") || low.includes("name") || low.includes("สกุล") || low.includes("fullname")) nameIdx = idx;
    else if (low.includes("ชั้น") || low.includes("class") || low.includes("grade") || low.includes("ห้อง")) classIdx = idx;
    else if (low.includes("เลขที่") || low.includes("no") || low.includes("number") || low.includes("index")) numIdx = idx;
  });

  if (idIdx === -1) idIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (classIdx === -1) classIdx = 2;
  if (numIdx === -1) numIdx = 3;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols: string[] = [];
    let inQuotes = false;
    let colBuffer = "";
    for (let charIdx = 0; charIdx < line.length; charIdx++) {
      const char = line[charIdx];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cols.push(colBuffer.trim().replace(/^"|"$/g, ''));
        colBuffer = "";
      } else {
        colBuffer += char;
      }
    }
    cols.push(colBuffer.trim().replace(/^"|"$/g, ''));

    if (cols.length < 2) continue;

    const studentId = cols[idIdx] || `S${1000 + i}`;
    const name = cols[nameIdx] || "ไม่ระบุชื่อ";
    const className = cols[classIdx] || "3/2";
    const studentNum = parseInt(cols[numIdx] || `${i}`, 10) || i;

    students.push({ id: studentId, name, class: className, number: studentNum });
  }
  return students;
}

function fetchUrlText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrlText(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch URL. Status code: ${res.statusCode}`));
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => { resolve(data); });
    }).on("error", (err) => { reject(err); });
  });
}

let cachedDbState: SystemState | null = null;
let examSettings: Record<string, boolean> = { '3': false, '5': false, '6': false, '6/8': false };

function readDb(): SystemState {
  if (cachedDbState) return cachedDbState;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const data = JSON.parse(raw);
      if (!data.students) data.students = getInitialStudents();
      if (!data.questions) data.questions = getInitialQuestions();
      if (!data.submissions) data.submissions = [];

      const has6_8 = data.questions.some((q: any) => q.gradeLevel === '6/8');
      if (!has6_8) {
        const grade6Questions = data.questions.filter((q: any) => q.gradeLevel === '6');
        const cloned6_8 = grade6Questions.map((q: any) => ({
          ...q,
          id: q.id.replace("q-g6-", "q-g6_8-"),
          gradeLevel: '6/8'
        }));
        data.questions = [...data.questions, ...cloned6_8];
        fs.writeFileSync(DB_FILE, JSON.stringify(data), "utf-8");
      }
      cachedDbState = data;
      return data;
    }
  } catch (err) {
    console.error("Error reading database file, using fallback:", err);
  }

  const initialQs = getInitialQuestions();
  const grade6Qs = initialQs.filter(q => q.gradeLevel === '6');
  const cloned6_8 = grade6Qs.map(q => ({
    ...q,
    id: q.id.replace("q-g6-", "q-g6_8-"),
    gradeLevel: '6/8' as const
  }));

  const state: SystemState = {
    students: getInitialStudents(),
    questions: [...initialQs, ...cloned6_8],
    submissions: []
  };
  cachedDbState = state;
  writeDb(state);
  return state;
}

let isWritingDb = false;
let pendingDbWriteState: SystemState | null = null;
let isSyncingToGoogleSheets = false;
let pendingGoogleSheetsSync = false;

// 🔥 ฟังก์ชัน Push ข้อมูลขึ้นชีตแบบล้างข้อมูลเก่าก่อนเสมอ ป้องกันข้อมูลก้นชีตค้าง
async function pushAllToGoogleSheets(token: string, spreadsheetId: string, state: SystemState) {
  try {
    // ล้างข้อมูลเก่าก่อน
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchClear`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ranges: ["Questions!A:J", "Students!A:D", "Submissions!A:W"] })
    });

    // 1. จัดเรียง Questions
    const questionHeaders = ["ID", "GradeLevel", "Set", "Type", "QuestionNumber", "Text", "Image", "Choices", "ChoiceImages", "CorrectAnswer"];
    const questionRows = [questionHeaders];
    state.questions.forEach(q => {
      questionRows.push([
        q.id, q.gradeLevel, q.set, q.type, q.questionNumber.toString(), q.text, q.image || "",
        q.choices ? JSON.stringify(q.choices) : "", q.choiceImages ? JSON.stringify(q.choiceImages) : "", q.correctAnswer
      ]);
    });

    // 2. จัดเรียง Students
    const studentHeaders = ["ID", "Name", "Class", "Number"];
    const studentRows = [studentHeaders];
    state.students.forEach(s => {
      studentRows.push([s.id, s.name, s.class, s.number.toString()]);
    });

    // 3. จัดเรียง Submissions
    const submissionHeaders = [
      "ID", "StudentId", "Name", "Class", "Number", "GradeLevel", "Set",
      "MultipleChoiceAnswers", "MultipleChoiceScore", "ShortAnswers", "ShortAnswerScores",
      "WrittenAnswer", "WrittenScore", "TotalScore", "TimeTaken", "CheatingWarningsCount",
      "Cheated", "SubmittedAt", "Graded", "GradedAt", "Feedback",
      "OriginalMultipleChoiceAnswers", "OriginalShortAnswers"
    ];
    const submissionRows = [submissionHeaders];
    state.submissions.forEach(sub => {
      submissionRows.push([
        sub.id, sub.studentId, sub.name, sub.class, sub.number.toString(), sub.gradeLevel, sub.set,
        JSON.stringify(sub.multipleChoiceAnswers), sub.multipleChoiceScore.toString(),
        JSON.stringify(sub.shortAnswers), JSON.stringify(sub.shortAnswerScores),
        sub.writtenAnswer || "", sub.writtenScore.toString(), sub.totalScore.toString(),
        sub.timeTaken.toString(), sub.cheatingWarningsCount.toString(), sub.cheated ? "true" : "false",
        sub.submittedAt, sub.graded ? "true" : "false", sub.gradedAt || "", sub.feedback || "",
        sub.originalMultipleChoiceAnswers ? JSON.stringify(sub.originalMultipleChoiceAnswers) : "",
        sub.originalShortAnswers ? JSON.stringify(sub.originalShortAnswers) : ""
      ]);
    });
// ตัวอย่างส่วนแปลงค่าในฟังก์ชัน pull จาก Google Sheets ใน server.ts
const submissionsRows = valueRanges[2]?.values || []; // ลำดับอาร์เรย์ของตารางที่เก็บ Submissions
if (submissionsRows.length > 1) {
  state.submissions = submissionsRows.slice(1).map((row) => ({
    id: row[0],
    studentId: row[1],
    studentName: row[2],
    classroom: row[3],
    score: Number(row[4]),
    totalQuestions: Number(row[5]),
    submittedAt: row[6],
    // แมปคอลัมน์อื่น ๆ เพิ่มเติมให้ตรงตามที่บันทึกไว้ในแผ่น Google Sheets
  }));
}
writeDb(state); // บันทึกลงฐานข้อมูลทดแทนค่าเดิมโดยข้อมูลไม่สูญหาย
    const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          { range: "Questions!A1", values: questionRows },
          { range: "Students!A1", values: studentRows },
          { range: "Submissions!A1", values: submissionRows }
        ]
      })
    });

    if (updateRes.status === 401) {
      if (cachedDbState) {
        cachedDbState.googleAccessToken = undefined;
        writeDb(cachedDbState);
      }
      return;
    }
    console.log("Synchronized all data to Google Sheets cleanly!");
  } catch (err) {
    console.error("Error pushing data to Google Sheets:", err);
  }
}

async function syncToGoogleSheetsWithQueue(token: string, spreadsheetId: string, state: SystemState) {
  if (isSyncingToGoogleSheets) {
    pendingGoogleSheetsSync = true;
    return;
  }
  isSyncingToGoogleSheets = true;
  pendingGoogleSheetsSync = false;
  try {
    await pushAllToGoogleSheets(token, spreadsheetId, state);
  } finally {
    isSyncingToGoogleSheets = false;
    if (pendingGoogleSheetsSync && cachedDbState && cachedDbState.googleAccessToken && cachedDbState.spreadsheetId) {
      syncToGoogleSheetsWithQueue(cachedDbState.googleAccessToken, cachedDbState.spreadsheetId, cachedDbState);
    }
  }
}

async function createMathExamSpreadsheet(token: string, state: SystemState): Promise<string> {
  const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      properties: { title: "ระบบทำข้อสอบคณิตศาสตร์ (Math Exam System)" },
      sheets: [{ properties: { title: "Questions" } }, { properties: { title: "Students" } }, { properties: { title: "Submissions" } }]
    })
  });
  if (!createRes.ok) throw new Error("Failed to create spreadsheet");
  const data: any = await createRes.json();
  await pushAllToGoogleSheets(token, data.spreadsheetId, state);
  return data.spreadsheetId;
}

async function findMathExamSpreadsheet(token: string): Promise<string | null> {
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='ระบบทำข้อสอบคณิตศาสตร์ (Math Exam System)' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!searchRes.ok) return null;
  const searchData: any = await searchRes.json();
  return (searchData.files && searchData.files.length > 0) ? searchData.files[0].id : null;
}

async function ensureSpreadsheetTabs(token: string, spreadsheetId: string) {
  try {
    const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!getRes.ok) return;
    const data: any = await getRes.json();
    const existingTitles = (data.sheets || []).map((s: any) => s.properties?.title);
    const required = ["Questions", "Students", "Submissions"];
    const missing = required.filter(title => !existingTitles.includes(title));
    if (missing.length > 0) {
      const requests = missing.map(title => ({ addSheet: { properties: { title } } }));
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) { console.error(err); }
}

// ค้นหาฟังก์ชัน pullAllFromGoogleSheets ในไฟล์ server (4).ts แล้วปรับปรุงให้เป็นแบบนี้:
async function pullAllFromGoogleSheets(token: string, spreadsheetId: string): Promise<Partial<SystemState>> {
  const result: Partial<SystemState> = {};
  const getRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Questions!A:J&ranges=Students!A:D&ranges=Submissions!A:W`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (!getRes.ok) return result;
  
  const data: any = await getRes.json();
  const valueRanges = data.valueRanges || [];

  // ดึงข้อมูลข้อสอบจากชีต Questions
  const questionsVal = valueRanges[0]?.values || [];
  const parsedQuestions: Question[] = [];
  
  // ตรวจสอบว่าถ้าแถวมากกว่า 1 (มีข้อสอบ) ให้แปลงค่ามาใส่
  if (questionsVal.length > 1) {
    for (let i = 1; i < questionsVal.length; i++) {
      const row = questionsVal[i];
      if (!row[0]) continue; // ถ้าไม่มี ID ข้ามไป
      let choices, choiceImages;
      try { if (row[7]) choices = JSON.parse(row[7]); } catch (_) {}
      try { if (row[8]) choiceImages = JSON.parse(row[8]); } catch (_) {}
      parsedQuestions.push({
        id: row[0],
        gradeLevel: row[1] as any,
        set: row[2] as any,
        type: row[3] as any,
        questionNumber: parseInt(row[4], 10) || i,
        text: row[5] || "",
        image: row[6] || undefined,
        choices,
        choiceImages,
        correctAnswer: row[9] || ""
      });
    }
  }
  // ส่งค่าที่ประมวลผลได้กลับไป (หากลบเกลี้ยง parsedQuestions จะเป็น [] ซึ่งหมายความว่าระบบจะเคลียร์ข้อสอบออกทั้งหมดตามชีต)
  result.questions = parsedQuestions;

  // ดึงข้อมูลรายชื่อนักเรียนจากชีต Students
  const studentsVal = valueRanges[1]?.values || [];
  const parsedStudents: Student[] = [];
  if (studentsVal.length > 1) {
    for (let i = 1; i < studentsVal.length; i++) {
      const row = studentsVal[i];
      if (!row[0] || !row[1]) continue;
      parsedStudents.push({ id: row[0], name: row[1], class: row[2] || "3/2", number: parseInt(row[3], 10) || i });
    }
    result.students = parsedStudents;
  }
  
  return result;
}
async function pullAllFromGoogleSheets(accessToken: string, spreadsheetId: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Students!A:E&ranges=Questions!A:I&ranges=Submissions!A:W`;
  
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  
  if (!res.ok) {
    throw new Error(`Google API respond error status: ${res.status}`);
  }
  
  const data = await res.json();
  const valueRanges = data.valueRanges || [];
  
  const studentRows = valueRanges[0]?.values || [];
  const questionRows = valueRanges[1]?.values || [];
  const submissionRows = valueRanges[2]?.values || []; // ดึงข้อมูล Submissions
  
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
  
  // 🔥 ดึงข้อมูลประวัติการสอบกลับเข้าระบบป้องกันการสูญหาย
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

function writeDb(state: SystemState) {
  cachedDbState = state;
  pendingDbWriteState = state;
  triggerDbWrite();
  if (state.googleAccessToken && state.spreadsheetId) {
    syncToGoogleSheetsWithQueue(state.googleAccessToken, state.spreadsheetId, state).catch(e => console.error(e));
  }
}

function triggerDbWrite() {
  if (isWritingDb || !pendingDbWriteState) return;
  isWritingDb = true;
  const stateToWrite = pendingDbWriteState;
  pendingDbWriteState = null;
  const tempPath = DB_FILE + ".tmp";
  fs.writeFile(tempPath, JSON.stringify(stateToWrite), "utf-8", (err) => {
    if (err) { isWritingDb = false; triggerDbWrite(); return; }
    fs.rename(tempPath, DB_FILE, (renameErr) => {
      isWritingDb = false;
      triggerDbWrite();
    });
  });
}

function getThailandTimestamp(): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).format(new Date());
  } catch (e) {
    const d = new Date(); d.setHours(d.getHours() + 7);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.post("/api/login", (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ success: false, message: "กรุณากรอกรหัสนักเรียน" });
    const state = readDb();
    const student = state.students.find(s => s.id === username.trim());
    res.json(student ? { success: true, student } : { success: false, message: "ไม่พบรหัสนักเรียนนี้ในระบบ" });
  });

  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "cfl128211" && password === "dn128211") {
      res.json({ success: true, token: "admin-jwt-token-simulated" });
    } else {
      res.json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง" });
    }
  });

  app.get("/api/questions", (req, res) => {
    const { class: className, number } = req.query;
    if (!className || !number) return res.status(400).json({ success: false, message: "ข้อมูลห้องเรียนหรือเลขที่ไม่ครบถ้วน" });

    const studentNumber = parseInt(number as string, 10);
    const set = studentNumber % 2 === 1 ? 'A' : 'B';

    let gradeLevel: '3' | '5' | '6' | '6/8' = '3';
    const cStr = (className as string).trim();
    if (cStr.startsWith("3/")) gradeLevel = '3';
    else if (cStr.startsWith("5/")) gradeLevel = '5';
    else if (cStr === "6/8") gradeLevel = '6/8';
    else if (cStr.startsWith("6/")) gradeLevel = '6';

    if (examSettings[gradeLevel] === false) {
      return res.status(403).json({ success: false, message: `ขณะนี้ระบบสอบของระดับชั้น ม.${gradeLevel} ปิดบริการชั่วคราว` });
    }
    
    const state = readDb();
    const filteredQuestions = state.questions.filter(q => q.gradeLevel === gradeLevel && q.set === set);
    res.json({ success: true, gradeLevel, set, questions: filteredQuestions });
  });

  app.post("/api/submit", (req, res) => {
    const { studentId, class: className, number, gradeLevel, set, multipleChoiceAnswers, shortAnswers, writtenAnswer, timeTaken, cheatingWarningsCount } = req.body;
    const state = readDb();
    const student = state.students.find(s => s.id === studentId);
    const studentName = student ? student.name : "นักเรียนภายนอก";

    const targetQuestions = state.questions.filter(q => q.gradeLevel === gradeLevel && q.set === set);
    let mcScore = 0;
    targetQuestions.filter(q => q.type === 'multiple-choice').forEach(q => {
      const studentAns = multipleChoiceAnswers[q.id];
      if (studentAns !== undefined && studentAns !== null && studentAns.toString().trim() === q.correctAnswer.toString().trim()) mcScore++;
    });

    const isCheated = cheatingWarningsCount >= 3;
    const finalMcScore = isCheated ? 0 : mcScore;
    const shortAnswerScores: Record<string, number> = {};
    targetQuestions.filter(q => q.type === 'short-answer').forEach(q => { shortAnswerScores[q.id] = 0; });

    const submission: Submission = {
      id: `${studentId}-${className.replace("/", "_")}-${Date.now()}`,
      studentId, name: studentName, class: className, number: parseInt(number, 10), gradeLevel, set,
      multipleChoiceAnswers, multipleChoiceScore: finalMcScore, shortAnswers, shortAnswerScores,
      writtenAnswer, writtenScore: 0, totalScore: finalMcScore, timeTaken, cheatingWarningsCount, cheated: isCheated,
      submittedAt: getThailandTimestamp(), graded: false
    };
    state.submissions.push(submission);
    writeDb(state);
    res.json({ success: true, submission });
  });

  app.get("/api/admin/submissions", (req, res) => { res.json({ success: true, submissions: readDb().submissions }); });
  app.get('/api/admin/settings', (req, res) => { res.json({ success: true, settings: examSettings }); });
  
  app.post('/api/admin/settings', (req, res) => {
    const { settings } = req.body;
    if (settings) { examSettings = { ...examSettings, ...settings }; return res.json({ success: true, settings: examSettings }); }
    res.status(400).json({ success: false, message: 'ข้อมูลไม่ถูกต้อง' });
  });

  app.post("/api/admin/submissions/delete", (req, res) => {
    const { submissionId } = req.body;
    const state = readDb();
    if (!state.submissions.some(s => s.id === submissionId)) return res.status(404).json({ success: false, message: "ไม่พบข้อมูล" });
    state.submissions = state.submissions.filter(s => s.id !== submissionId);
    writeDb(state);
    res.json({ success: true, message: "ลบกระดาษคำตอบเรียบร้อยแล้ว" });
  });

  app.post("/api/admin/upload", (req, res) => {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) return res.status(400).json({ success: false, message: "ไม่พบรูปภาพ" });
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const uniqueFilename = `${Date.now()}-${filename || "image.png"}`;
      fs.writeFileSync(path.join(uploadsDir, uniqueFilename), Buffer.from(base64Data, "base64"));
      res.json({ success: true, url: `/uploads/${uniqueFilename}` });
    } catch (err) { res.status(500).json({ success: false }); }
  });
import { google } from 'googleapis';
import fs from 'fs';

app.post('/api/admin/upload', async (req, res) => {
  try {
    const state = readDb();
    if (!state.googleAccessToken) {
      return res.status(401).json({ success: false, message: 'กรุณาเชื่อมต่อ Google Account ก่อนอัปโหลด' });
    }

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: state.googleAccessToken });
    const drive = google.drive({ version: 'v3', auth });

    // โค้ดสำหรับบันทึกไฟล์และอัปโหลดไปยัง Drive (Multi-part upload)
    const fileMetadata = {
      name: `exam_${Date.now()}.jpg`,
      parents: ['โฟลเดอร์ไอดีในกูเกิ้ลไดรฟ์ (ถ้ามี)'] 
    };
    
    // หลังจากอัปโหลดสำเร็จ ให้นำเอา webContentLink หรือ id มาเจนเนอเรตเป็น URL ภาพเพื่อบันทึกแทนพิกเซลลิงก์เดิม
    // ตัวอย่างรูปแบบลิงก์ตรง: https://lh3.googleusercontent.com/u/0/d/{FILE_ID}
    
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upload ล้มเหลว' });
  }
});
  
  app.post("/api/admin/grade", (req, res) => {
    const { submissionId, shortAnswerScores, writtenScore, feedback, editedMultipleChoiceAnswers, editedShortAnswers, cheated } = req.body;
    const state = readDb();
    const subIdx = state.submissions.findIndex(s => s.id === submissionId);
    if (subIdx === -1) return res.status(404).json({ success: false });

    const sub = state.submissions[subIdx];
    if (!sub.originalMultipleChoiceAnswers) sub.originalMultipleChoiceAnswers = { ...sub.multipleChoiceAnswers };
    if (!sub.originalShortAnswers) sub.originalShortAnswers = { ...sub.shortAnswers };

    if (cheated !== undefined) sub.cheated = cheated;
    if (editedMultipleChoiceAnswers) sub.multipleChoiceAnswers = editedMultipleChoiceAnswers;
    if (editedShortAnswers) sub.shortAnswers = editedShortAnswers;

    const targetQuestions = state.questions.filter(q => q.gradeLevel === sub.gradeLevel && q.set === sub.set);
    let mcScore = 0;
    targetQuestions.filter(q => q.type === 'multiple-choice').forEach(q => {
      const ans = sub.multipleChoiceAnswers[q.id];
      if (ans !== undefined && ans !== null && ans.toString().trim() === q.correctAnswer.toString().trim()) mcScore++;
    });

    sub.multipleChoiceScore = mcScore;
    sub.shortAnswerScores = shortAnswerScores;
    sub.writtenScore = parseFloat(writtenScore) || 0;
    
    let saSum = 0;
    Object.keys(shortAnswerScores).forEach(qId => { saSum += parseFloat(shortAnswerScores[qId]) || 0; });
    sub.totalScore = sub.multipleChoiceScore + saSum + sub.writtenScore;
    sub.feedback = feedback;
    sub.graded = true;
    sub.gradedAt = getThailandTimestamp();

    state.submissions[subIdx] = sub;
    writeDb(state);
    res.json({ success: true, submission: sub });
  });

  app.get("/api/admin/students", (req, res) => { res.json({ success: true, students: readDb().students }); });

  app.post("/api/admin/students/import", (req, res) => {
    const { students } = req.body;
    const state = readDb();
    state.students = students;
    writeDb(state);
    res.json({ success: true, students: state.students });
  });

  app.post("/api/admin/students/fetch-sheet", async (req, res) => {
    const { sheetUrl } = req.body;
    try {
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes("docs.google.com/spreadsheets")) {
        const matches = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          const spreadsheetId = matches[1];
          let gid = "0";
          const gidMatch = csvUrl.match(/gid=([0-9]+)/);
          if (gidMatch && gidMatch[1]) gid = gidMatch[1];
          csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        }
      }
      const csvText = await fetchUrlText(csvUrl);
      const parsedStudents = parseStudentCSV(csvText);
      if (parsedStudents.length === 0) return res.json({ success: false, message: "ไม่พบข้อมูล" });
      const state = readDb();
      state.students = parsedStudents;
      writeDb(state);
      res.json({ success: true, count: parsedStudents.length, students: parsedStudents });
    } catch (err: any) { res.json({ success: false, message: err.message }); }
  });

  app.get("/api/admin/questions", (req, res) => { res.json({ success: true, questions: readDb().questions }); });

  app.post("/api/admin/questions", (req, res) => {
    const { question, questions: bulkQuestions } = req.body;
    const state = readDb();
    if (bulkQuestions && Array.isArray(bulkQuestions)) {
      state.questions = bulkQuestions;
      writeDb(state);
      return res.json({ success: true, message: "บันทึกเรียบร้อย", questions: state.questions });
    }
    if (!question || !question.id) return res.status(400).json({ success: false });
    const existingIdx = state.questions.findIndex(q => q.id === question.id);
    if (existingIdx !== -1) {
      state.questions[existingIdx] = { ...state.questions[existingIdx], ...question, questionNumber: parseInt(question.questionNumber, 10) || state.questions[existingIdx].questionNumber };
    } else {
      state.questions.push({ ...question, questionNumber: parseInt(question.questionNumber, 10) || (state.questions.length + 1) });
    }
    writeDb(state);
    res.json({ success: true, questions: state.questions });
  });

  app.delete("/api/admin/questions/:id", (req, res) => {
    const { id } = req.params;
    const state = readDb();
    const len = state.questions.length;
    state.questions = state.questions.filter(q => q.id !== id);
    if (state.questions.length === len) return res.status(404).json({ success: false });
    writeDb(state);
    res.json({ success: true, questions: state.questions });
  });

  app.post("/api/admin/questions/delete-all", (req, res) => {
    const state = readDb(); state.questions = []; writeDb(state);
    res.json({ success: true, questions: [] });
  });

  app.get("/api/admin/google-sheets/status", (req, res) => {
    const state = readDb();
    res.json({ success: true, hasToken: !!state.googleAccessToken, spreadsheetId: state.spreadsheetId || null });
  });
// server.ts
app.post("/api/admin/google-sheets/sync-questions", async (req, res) => {
  const state = readDb();
  if (!state.googleAccessToken) return res.status(400).json({ message: "กรุณาล็อกอิน Google ใหม่" });
  
  try {
    // รันฟังก์ชันลูปเพื่อเขียนทับข้อมูลข้อสอบ (questions) ลงในแผ่นชีตเดิมทั้งหมดรวดเดียว
    await pushQuestionsToSheet(state.questions, state.googleAccessToken);
    res.json({ success: true, message: "ซิงค์ข้อสอบทั้งหมดเข้า Google Sheets เรียบร้อย!" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
  app.post("/api/admin/google-sheets/setup", async (req, res) => {
    const { token, spreadsheetId } = req.body;
    if (!token) return res.status(400).json({ success: false });
    const state = readDb(); state.googleAccessToken = token;
    try {
      let activeSpreadsheetId = spreadsheetId;
      if (!activeSpreadsheetId) activeSpreadsheetId = await findMathExamSpreadsheet(token);
      if (!activeSpreadsheetId) activeSpreadsheetId = await createMathExamSpreadsheet(token, state);
      else {
        await ensureSpreadsheetTabs(token, activeSpreadsheetId);
        state.spreadsheetId = activeSpreadsheetId;
        await pushAllToGoogleSheets(token, activeSpreadsheetId, state);
      }
      state.spreadsheetId = activeSpreadsheetId;
      writeDb(state);
      res.json({ success: true, spreadsheetId: activeSpreadsheetId });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
  });

  // ค้นหา API /api/admin/google-sheets/pull ในไฟล์ server (4).ts แล้วเปลี่ยนเป็นแบบนี้:
app.post("/api/admin/google-sheets/pull", async (req, res) => {
  const state = readDb();
  if (!state.googleAccessToken || !state.spreadsheetId) {
    return res.status(400).json({ success: false, message: "ระบบยังไม่ได้เชื่อมต่อกับ Google Sheets" });
  }
  try {
    const pulledData = await pullAllFromGoogleSheets(state.googleAccessToken, state.spreadsheetId);
    
    // บังคับอัปเดตข้อสอบตาม Google Sheets เสมอ แม้ข้อมูลที่ดึงมาจะเป็นอาเรย์ว่างเปล่าก็ตาม (กรณีที่คุณครูลบจนเกลี้ยงชีต)
    if (pulledData.questions !== undefined) {
      state.questions = pulledData.questions;
    }
    if (pulledData.students !== undefined) {
      state.students = pulledData.students;
    }
    
    writeDb(state);
    res.json({ 
      success: true, 
      message: "ซิงค์ดึงข้อมูลจาก Google Sheets ลงระบบเรียบร้อยแล้ว!", 
      questionsCount: state.questions.length, 
      studentsCount: state.students.length 
    });
  } catch (err: any) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
});
  app.post("/api/admin/questions/clear-all", (req, res) => {
  try {
    const state = readDb();
    state.questions = [];
    writeDb(state);
    res.json({ success: true, message: "ลบข้อสอบทั้งหมดในระบบเรียบร้อยแล้ว" });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
  // 🔥 2-Way Sync: สั่ง Push ข้อมูลปัจจุบันขึ้นทับบนชีตด้วยตนเอง
  app.post("/api/admin/google-sheets/push-manual", async (req, res) => {
    const state = readDb();
    if (!state.googleAccessToken || !state.spreadsheetId) return res.status(400).json({ success: false, message: "ระบบยังไม่ได้เชื่อมต่อกับ Google Sheets" });
    try {
      await pushAllToGoogleSheets(state.googleAccessToken, state.spreadsheetId, state);
      res.json({ success: true, message: "ส่งข้อมูลข้อสอบและรายชื่อนักเรียนไปบันทึกบนชีตเรียบร้อยแล้ว!" });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
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
    app.get("*", (req, res) => { res.sendFile(path.join(distPath, "index.html")); });
  }

  app.listen(PORT, "0.0.0.0", () => { console.log(`Server running on http://localhost:${PORT}`); });
}

startServer().catch(err => { console.error("Failed to start server:", err); });
