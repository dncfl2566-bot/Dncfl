import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getInitialQuestions, getInitialStudents } from "./src/data/initialQuestions";
import { Student, Question, Submission, SystemState } from "./src/types";

// --- เพิ่มส่วนเชื่อมต่อ FIREBASE FIRESTORE ---
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const DOC_REF = doc(db, "system", "state"); // เก็บ state ทั้งหมดไว้ใน collection ชื่อ system id ชื่อ state
// ------------------------------------------

import http from "http";
import https from "https";

const PORT = 3000;

// Parse CSV content into Student[]
function parseStudentCSV(csvText: string): Student[] {
  const lines = csvText.split(/\r?\n/);
  const students: Student[] = [];
  
  if (lines.length <= 1) return [];

  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
  
  let idIdx = -1;
  let nameIdx = -1;
  let classIdx = -1;
  let numIdx = -1;

  headers.forEach((h, idx) => {
    const low = h.toLowerCase();
    if (low.includes("รหัส") || low.includes("id") || low.includes("student_id") || low.includes("student id")) {
      idIdx = idx;
    } else if (low.includes("ชื่อ") || low.includes("name") || low.includes("สกุล") || low.includes("fullname")) {
      nameIdx = idx;
    } else if (low.includes("ชั้น") || low.includes("class") || low.includes("grade") || low.includes("ห้อง")) {
      classIdx = idx;
    } else if (low.includes("เลขที่") || low.includes("no") || low.includes("number") || low.includes("index")) {
      numIdx = idx;
    }
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

    students.push({
      id: studentId,
      name: name,
      class: className,
      number: studentNum
    });
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

// Global cached state variables
let cachedDbState: SystemState | null = null;

// เปลี่ยนเป็น Async Function เพื่อไปดึงข้อมูลจาก Cloud Firebase
async function readDb(): Promise<SystemState> {
  if (cachedDbState) {
    return cachedDbState;
  }
  try {
    const docSnap = await getDoc(DOC_REF);
    if (docSnap.exists()) {
      const data = docSnap.data() as any;
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
        await setDoc(DOC_REF, data);
      }

      cachedDbState = data;
      return data;
    }
  } catch (err) {
    console.error("Error reading Firebase database, using fallback:", err);
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
  await writeDb(state);
  return state;
}

// เปลี่ยนเป็นเซฟข้อมูลลง Firebase ถาวร
async function writeDb(state: SystemState) {
  cachedDbState = state;
  try {
    await setDoc(DOC_REF, state);
  } catch (err) {
    console.error("Firebase write failed:", err);
  }
}

function getThailandTimestamp(): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(new Date());
  } catch (e) {
    const d = new Date();
    d.setHours(d.getHours() + 7);
    return d.toISOString().replace('T', ' ').substring(0, 19);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Initialize DB from cloud on startup
  await readDb();

  // API: Student Login
  app.post("/api/login", async (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: "กรุณากรอกรหัสนักเรียน" });
    }

    const state = await readDb();
    const student = state.students.find(s => s.id === username.trim());
    if (student) {
      res.json({ success: true, student });
    } else {
      res.json({ success: false, message: "ไม่พบรหัสนักเรียนนี้ในระบบ" });
    }
  });

  // API: Admin Login
  app.post("/api/admin/login", (req, res) => {
    const { username, password } = req.body;
    if (username === "cfl128211" && password === "dn128211") {
      res.json({ success: true, token: "admin-jwt-token-simulated" });
    } else {
      res.json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านแอดมินไม่ถูกต้อง" });
    }
  });

  // API: Get questions
  app.get("/api/questions", async (req, res) => {
    const { class: className, number } = req.query;
    if (!className || !number) {
      return res.status(400).json({ success: false, message: "ข้อมูลห้องเรียนหรือเลขที่ไม่ครบถ้วน" });
    }

    const studentNumber = parseInt(number as string, 10);
    const set = studentNumber % 2 === 1 ? 'A' : 'B';

    let gradeLevel: '3' | '5' | '6' | '6/8' = '3';
    const cStr = (className as string).trim();
    if (cStr.startsWith("3/")) gradeLevel = '3';
    else if (cStr.startsWith("5/")) gradeLevel = '5';
    else if (cStr === "6/8") gradeLevel = '6/8';
    else if (cStr.startsWith("6/")) gradeLevel = '6';

    const state = await readDb();
    const filteredQuestions = state.questions.filter(
      q => q.gradeLevel === gradeLevel && q.set === set
    );

    res.json({
      success: true,
      gradeLevel,
      set,
      questions: filteredQuestions
    });
  });

  // API: Submit student exam answers
  app.post("/api/submit", async (req, res) => {
    const {
      studentId,
      class: className,
      number,
      gradeLevel,
      set,
      multipleChoiceAnswers,
      shortAnswers,
      writtenAnswer,
      timeTaken,
      cheatingWarningsCount
    } = req.body;

    const state = await readDb();

    const student = state.students.find(s => s.id === studentId);
    const studentName = student ? student.name : "นักเรียนภายนอก";

    const targetQuestions = state.questions.filter(
      q => q.gradeLevel === gradeLevel && q.set === set
    );

    let mcScore = 0;
    const mcQuestions = targetQuestions.filter(q => q.type === 'multiple-choice');
    
    mcQuestions.forEach(q => {
      const studentAns = multipleChoiceAnswers[q.id];
      if (studentAns !== undefined && studentAns !== null) {
        if (studentAns.toString().trim() === q.correctAnswer.toString().trim()) {
          mcScore++;
        }
      }
    });

    const isCheated = cheatingWarningsCount >= 3;
    const finalMcScore = isCheated ? 0 : mcScore;

    const shortAnswerScores: Record<string, number> = {};
    const saQuestions = targetQuestions.filter(q => q.type === 'short-answer');
    saQuestions.forEach(q => {
      shortAnswerScores[q.id] = 0;
    });

    const submission: Submission = {
      id: `${studentId}-${className.replace("/", "_")}-${Date.now()}`,
      studentId,
      name: studentName,
      class: className,
      number: parseInt(number, 10),
      gradeLevel,
      set,
      multipleChoiceAnswers,
      multipleChoiceScore: finalMcScore,
      shortAnswers,
      shortAnswerScores,
      writtenAnswer,
      writtenScore: 0,
      totalScore: finalMcScore,
      timeTaken,
      cheatingWarningsCount,
      cheated: isCheated,
      submittedAt: getThailandTimestamp(),
      graded: false
    };

    state.submissions.push(submission);
    
    await writeDb(state);

    res.json({ success: true, submission });
  });

  // ADMIN API: Get all submissions
  app.get("/api/admin/submissions", async (req, res) => {
    const state = await readDb();
    res.json({ success: true, submissions: state.submissions });
  });

  // ADMIN API: Delete submission
  app.post("/api/admin/submissions/delete", async (req, res) => {
    const { submissionId } = req.body;
    if (!submissionId) {
      return res.status(400).json({ success: false, message: "กรุณาระบุรหัสการส่งคำตอบที่ต้องการลบ" });
    }

    const state = await readDb();
    const subExists = state.submissions.some(s => s.id === submissionId);
    if (!subExists) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลการส่งคำตอบนี้" });
    }

    state.submissions = state.submissions.filter(s => s.id !== submissionId);
    await writeDb(state);

    res.json({ success: true, message: "ลบกระดาษคำตอบของนักเรียนเรียบร้อยแล้ว" });
  });

  // ADMIN API: Upload local image (Base64)
  app.post("/api/admin/upload", (req, res) => {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "ไม่พบข้อมูลรูปภาพประกอบ" });
    }

    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      const uniqueFilename = `${Date.now()}-${filename || "image.png"}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, buffer);

      res.json({ success: true, url: `/uploads/${uniqueFilename}` });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดทางเซิร์ฟเวอร์ในการบันทึกรูปภาพ" });
    }
  });

  // ADMIN API: Grade answers
  app.post("/api/admin/grade", async (req, res) => {
    const { 
      submissionId, 
      shortAnswerScores, 
      writtenScore, 
      feedback,
      editedMultipleChoiceAnswers,
      editedShortAnswers,
      cheated
    } = req.body;

    const state = await readDb();
    const subIdx = state.submissions.findIndex(s => s.id === submissionId);
    if (subIdx === -1) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลการส่งข้อสอบนี้" });
    }

    const sub = state.submissions[subIdx];

    if (!sub.originalMultipleChoiceAnswers) {
      sub.originalMultipleChoiceAnswers = { ...sub.multipleChoiceAnswers };
    }
    if (!sub.originalShortAnswers) {
      sub.originalShortAnswers = { ...sub.shortAnswers };
    }

    if (cheated !== undefined) {
      sub.cheated = cheated;
    }

    if (editedMultipleChoiceAnswers) {
      sub.multipleChoiceAnswers = editedMultipleChoiceAnswers;
    }

    const targetQuestions = state.questions.filter(
      q => q.gradeLevel === sub.gradeLevel && q.set === sub.set
    );
    const mcQuestions = targetQuestions.filter(q => q.type === 'multiple-choice');
    let mcScore = 0;
    
    mcQuestions.forEach(q => {
      const ans = sub.multipleChoiceAnswers[q.id];
      if (ans !== undefined && ans !== null) {
        if (ans.toString().trim() === q.correctAnswer.toString().trim()) {
          mcScore++;
        }
      }
    });

    if (editedShortAnswers) {
      sub.shortAnswers = editedShortAnswers;
    }
    
    sub.multipleChoiceScore = mcScore;
    sub.shortAnswerScores = shortAnswerScores;
    sub.writtenScore = parseFloat(writtenScore) || 0;
    
    let saSum = 0;
    Object.keys(shortAnswerScores).forEach(qId => {
      saSum += parseFloat(shortAnswerScores[qId]) || 0;
    });

    sub.totalScore = sub.multipleChoiceScore + saSum + sub.writtenScore;
    sub.feedback = feedback;

    sub.graded = true;
    sub.gradedAt = getThailandTimestamp();

    state.submissions[subIdx] = sub;
    await writeDb(state);

    res.json({ success: true, submission: sub });
  });

  // ADMIN API: Get student list
  app.get("/api/admin/students", async (req, res) => {
    const state = await readDb();
    res.json({ success: true, students: state.students });
  });

  // ADMIN API: Import students manually
  app.post("/api/admin/students/import", async (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: "รูปแบบข้อมูลนักเรียนไม่ถูกต้อง" });
    }

    const state = await readDb();
    state.students = students;
    await writeDb(state);

    res.json({ success: true, students: state.students });
  });

  // ADMIN API: Fetch from Google Sheet CSV
  app.post("/api/admin/students/fetch-sheet", async (req, res) => {
    const { sheetUrl } = req.body;
    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: "กรุณาระบุลิงก์ Google Sheet" });
    }

    try {
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes("docs.google.com/spreadsheets")) {
        const matches = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          const spreadsheetId = matches[1];
          let gid = "0";
          const gidMatch = csvUrl.match(/gid=([0-9]+)/);
          if (gidMatch && gidMatch[1]) {
            gid = gidMatch[1];
          }
          csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
        }
      }

      console.log("Fetching CSV from URL:", csvUrl);
      const csvText = await fetchUrlText(csvUrl);
      const parsedStudents = parseStudentCSV(csvText);

      if (parsedStudents.length === 0) {
        return res.json({ success: false, message: "ไม่พบข้อมูลรายชื่อนักเรียนใน Google Sheet หรือไม่สามารถดึงข้อมูลได้" });
      }

      const state = await readDb();
      state.students = parsedStudents;
      await writeDb(state);

      res.json({ success: true, count: parsedStudents.length, students: parsedStudents });
    } catch (err: any) {
      console.error("Error fetching Google Sheet:", err);
      res.json({ success: false, message: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}` });
    }
  });

  // ADMIN API: Get questions
  app.get("/api/admin/questions", async (req, res) => {
    const state = await readDb();
    res.json({ success: true, questions: state.questions });
  });

  // ADMIN API: Add/edit question
  app.post("/api/admin/questions", async (req, res) => {
    const { question, questions, deleteId } = req.body;
    const state = await readDb();

    if (questions && Array.isArray(questions)) {
      for (const q of questions) {
        if (!q || !q.id) continue;
        const idx = state.questions.findIndex(item => item.id === q.id);
        if (idx > -1) {
          state.questions[idx] = q;
        } else {
          state.questions.push(q);
        }
      }

      if (deleteId) {
        state.questions = state.questions.filter(item => item.id !== deleteId);
      }

      await writeDb(state);
      return res.json({ success: true, count: questions.length });
    }

    if (!question || !question.id) {
      return res.status(400).json({ success: false, message: "ข้อมูลข้อสอบไม่ถูกต้อง" });
    }

    const idx = state.questions.findIndex(q => q.id === question.id);
    if (idx > -1) {
      state.questions[idx] = question;
    } else {
      state.questions.push(question);
    }

    if (deleteId) {
      state.questions = state.questions.filter(item => item.id !== deleteId);
    }

    await writeDb(state);
    res.json({ success: true, question });
  });

  // ADMIN API: Delete question
  app.delete("/api/admin/questions/:id", async (req, res) => {
    const { id } = req.params;
    const state = await readDb();
    const initialLen = state.questions.length;
    state.questions = state.questions.filter(q => q.id !== id);
    
    if (state.questions.length < initialLen) {
      await writeDb(state);
      res.json({ success: true, message: "ลบข้อสอบสำเร็จ" });
    } else {
      res.status(404).json({ success: false, message: "ไม่พบข้อสอบที่ต้องการลบ" });
    }
  });

  // ADMIN API: Bulk delete questions
  app.post("/api/admin/questions/bulk-delete", async (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: "กรุณาระบุรหัสข้อสอบที่ต้องการลบ" });
    }
    const state = await readDb();
    const initialLen = state.questions.length;
    state.questions = state.questions.filter(q => !ids.includes(q.id));
    await writeDb(state);
    res.json({ success: true, count: initialLen - state.questions.length, message: "ลบข้อสอบที่เลือกสำเร็จ" });
  });

  app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
