import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { getInitialQuestions, getInitialStudents } from "./src/data/initialQuestions";
import { Student, Question, Submission, SystemState } from "./src/types";

// Helper to download Google Sheets or any URL content
import http from "http";
import https from "https";

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.join(process.cwd(), "db.json");
const TARGET_DRIVE_FOLDER_ID = "1EbKMnX8twSAStZxjJXidlv_1D5G5u6GR";

// Parse CSV content into Student[]
function parseStudentCSV(csvText: string): Student[] {
  const lines = csvText.split(/\r?\n/);
  const students: Student[] = [];
  
  if (lines.length <= 1) return [];

  // Parse headers to see column indices
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ''));
  
  let idIdx = -1;
  let nameIdx = -1;
  let classIdx = -1;
  let numIdx = -1;

  // Attempt to map headers based on common Thai/English names
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

  // Fallback to indices if headers don't match
  if (idIdx === -1) idIdx = 0;
  if (nameIdx === -1) nameIdx = 1;
  if (classIdx === -1) classIdx = 2;
  if (numIdx === -1) numIdx = 3;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Split considering optional quotes around commas
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

// Helper to fetch text from a URL (supports http and https)
function fetchUrlText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      // Handle redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrlText(res.headers.location).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch URL. Status code: ${res.statusCode}`));
        return;
      }

      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(data);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

// Read database
let cachedDbState: SystemState | null = null;

function readDb(): SystemState {
  if (cachedDbState) {
    return cachedDbState;
  }
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const data = JSON.parse(raw);
      // Fallback guarantees
      if (!data.students) data.students = getInitialStudents();
      if (!data.questions) data.questions = getInitialQuestions();
      if (!data.submissions) data.submissions = [];
      if (!data.examStatus) {
        data.examStatus = {
          '3': 'closed',
          '5': 'closed',
          '6': 'closed',
          '6/8': 'closed'
        };
      }

      // Migration check: Ensure '6/8' questions exist separately
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

  // If not exist, write initial state
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
    submissions: [],
    examStatus: {
      '3': 'closed',
      '5': 'closed',
      '6': 'closed',
      '6/8': 'closed'
    }
  };
  cachedDbState = state;
  writeDb(state);
  return state;
}

// Write database with high-concurrency atomic serialization
let isWritingDb = false;
let pendingDbWriteState: SystemState | null = null;
let isSyncingToGoogleSheets = false;
let pendingGoogleSheetsSync = false;

// --- GOOGLE DRIVE UPLOAD HELPER ---

async function uploadToGoogleDrive(token: string, folderId: string, filename: string, mimeType: string, base64Data: string): Promise<string | null> {
  try {
    const boundary = "-------314159265358979323846";
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";
    
    const metadata = {
      name: filename,
      mimeType: mimeType,
      parents: [folderId]
    };
    
    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + mimeType + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      base64Data +
      close_delim;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(multipartRequestBody).toString()
      },
      body: multipartRequestBody
    });

    if (res.ok) {
      const fileData: any = await res.json();
      const fileId = fileData.id;

      // Set permission so the image is viewable via direct URL
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone'
        })
      });

      return `https://docs.google.com/uc?export=view&id=${fileId}`;
    } else {
      const errText = await res.text();
      console.error(`Google Drive upload failed: ${res.status} - ${errText}`);
      return null;
    }
  } catch (err) {
    console.error('Error in uploadToGoogleDrive:', err);
    return null;
  }
}

// --- GOOGLE SHEETS INTEGRATION HELPERS ---

async function pushAllToGoogleSheets(token: string, spreadsheetId: string, state: SystemState) {
  try {
    // 1. Push Questions
    const questionHeaders = ["ID", "GradeLevel", "Set", "Type", "QuestionNumber", "Text", "Image", "Choices", "ChoiceImages", "CorrectAnswer"];
    const questionRows = [questionHeaders];
    state.questions.forEach(q => {
      questionRows.push([
        q.id,
        q.gradeLevel,
        q.set,
        q.type,
        q.questionNumber.toString(),
        q.text,
        q.image || "",
        q.choices ? JSON.stringify(q.choices) : "",
        q.choiceImages ? JSON.stringify(q.choiceImages) : "",
        q.correctAnswer
      ]);
    });
// 💡 แก้ไขฟังก์ชันให้ Push ข้อมูลแยกตาม 2 ลิงก์ชีตอย่างถูกต้อง
async function pushAllToGoogleSheets(accessToken: string, studentSpreadsheetId: string, mainSpreadsheetId: string, state: SystemState) {
  const urlMain = `https://sheets.googleapis.com/v4/spreadsheets/${mainSpreadsheetId}/values:batchUpdate`;
  const urlStudent = `https://sheets.googleapis.com/v4/spreadsheets/${studentSpreadsheetId}/values:batchUpdate`;

  // 1. ส่งรายชื่อนักเรียนไปลิงก์แรก (studentSpreadsheetId)
  const studentRows = [["ID", "Name", "Classroom", "Number", "Password"]];
  state.students.forEach(s => studentRows.push([s.id, s.name, s.classroom, s.number || "", s.password || s.id]));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${studentSpreadsheetId}/values:batchClear`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ranges: ["Students!A:E"] })
  });
  await fetch(urlStudent, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: [{ range: "Students!A:E", values: studentRows }] })
  });

  // 2. ส่งข้อสอบและประวัติผลการสอบไปลิงก์ที่สอง (mainSpreadsheetId)
  const questionRows = [["ID", "Code", "Level", "Type", "Choices", "Question", "Answer", "Solution", "Image"]];
  state.questions.forEach(q => questionRows.push([q.id, q.code, q.level, q.type, JSON.stringify(q.choices), q.question, q.answer, q.solution || "", q.image || ""]));

  const submissionRows = [["ID", "StudentID", "StudentName", "Classroom", "Score", "TotalQuestions", "SubmittedAt", "Answers", "CheatingAttempts", "TabSwitches", "FaceOuts", "IsCheater", "Logs", "WrittenAnswers"]];
  state.submissions.forEach(s => submissionRows.push([s.id, s.studentId, s.studentName, s.classroom, String(s.score), String(s.totalQuestions), s.submittedAt, JSON.stringify(s.answers), String(s.cheatingAttempts || 0), String(s.tabSwitches || 0), String(s.faceOuts || 0), String(s.isCheater || false), JSON.stringify(s.logs || []), JSON.stringify(s.writtenAnswers || {})]));

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${mainSpreadsheetId}/values:batchClear`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ranges: ["Questions!A:I", "Submissions!A:N"] })
  });
  await fetch(urlMain, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: [{ range: "Questions!A:I", values: questionRows }, { range: "Submissions!A:N", values: submissionRows }] })
  });
}

// 💡 แก้ไขฟังก์ชัน Pull ให้ดึงรายชื่อจากลิงก์ 1 และข้อสอบ/ประวัติผลสอบจากลิงก์ 2
async function pullAllFromGoogleSheets(accessToken: string, studentSpreadsheetId: string, mainSpreadsheetId: string) {
  const state = readDb();

  // ดึงรายชื่อนักเรียน (ลิงก์ที่ 1)
  const resStudent = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${studentSpreadsheetId}/values/Students!A:E`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (resStudent.ok) {
    const dataStudent = await resStudent.json();
    if (dataStudent.values && dataStudent.values.length > 1) {
      state.students = dataStudent.values.slice(1).map((row: any) => ({ id: row[0]||"", name: row[1]||"", classroom: row[2]||"", number: row[3]||"", password: row[4]||"" }));
    }
  }

  // ดึงข้อสอบและผลการทำข้อสอบ (ลิงก์ที่ 2)
  const resMain = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${mainSpreadsheetId}/values:batchGet?ranges=Questions!A:I&ranges=Submissions!A:N`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (resMain.ok) {
    const dataMain = await resMain.json();
    const valueRanges = dataMain.valueRanges || [];
    
    if (valueRanges[0]?.values?.length > 1) {
      state.questions = valueRanges[0].values.slice(1).map((row: any) => {
        let choices = ["", "", "", "", ""];
        try { choices = JSON.parse(row[4]); } catch { if (row[4]) choices = row[4].split(","); }
        return { id: row[0]||"", code: row[1]||"", level: row[2]||"", type: row[3]||"multiple-choice", question: row[5]||"", choices, answer: row[6]||"0", solution: row[7]||"", image: row[8]||"" };
      });
    }
    if (valueRanges[1]?.values?.length > 1) {
      state.submissions = valueRanges[1].values.slice(1).map((row: any) => ({ id: row[0]||"", studentId: row[1]||"", studentName: row[2]||"", classroom: row[3]||"", score: Number(row[4]||0), totalQuestions: Number(row[5]||0), submittedAt: row[6]||"", answers: row[7]?JSON.parse(row[7]):{}, cheatingAttempts: Number(row[8]||0), tabSwitches: Number(row[9]||0), faceOuts: Number(row[10]||0), isCheater: row[11]==='true', logs: row[12]?JSON.parse(row[12]):[], writtenAnswers: row[13]?JSON.parse(row[13]):{} }));
    }
  }

  writeDb(state);
  return state;
}
    
    // 2. Push Students
    const studentHeaders = ["ID", "Name", "Class", "Number"];
    const studentRows = [studentHeaders];
    state.students.forEach(s => {
      studentRows.push([
        s.id,
        s.name,
        s.class,
        s.number.toString()
      ]);
    });

    // 3. Push Submissions
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
        sub.id,
        sub.studentId,
        sub.name,
        sub.class,
        sub.number.toString(),
        sub.gradeLevel,
        sub.set,
        JSON.stringify(sub.multipleChoiceAnswers),
        sub.multipleChoiceScore.toString(),
        JSON.stringify(sub.shortAnswers),
        JSON.stringify(sub.shortAnswerScores),
        sub.writtenAnswer || "",
        sub.writtenScore.toString(),
        sub.totalScore.toString(),
        sub.timeTaken.toString(),
        sub.cheatingWarningsCount.toString(),
        sub.cheated ? "true" : "false",
        sub.submittedAt,
        sub.graded ? "true" : "false",
        sub.gradedAt || "",
        sub.feedback || "",
        sub.originalMultipleChoiceAnswers ? JSON.stringify(sub.originalMultipleChoiceAnswers) : "",
        sub.originalShortAnswers ? JSON.stringify(sub.originalShortAnswers) : ""
      ]);
    });

    // Make batchUpdate call to update all three sheets
    const updateRes = await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
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
      console.warn("Google Access Token is expired or invalid in background sync. Clearing token.");
      if (cachedDbState) {
        cachedDbState.googleAccessToken = undefined;
        writeDb(cachedDbState);
      }
      return;
    }

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error(`Batch update Sheets failed: ${updateRes.statusText} - ${errText}`);
    } else {
      console.log("Successfully synchronized all data to Google Sheets in background!");
    }
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
  } catch (err) {
    console.error("Failed to sync to Google Sheets:", err);
  } finally {
    isSyncingToGoogleSheets = false;
    if (pendingGoogleSheetsSync && cachedDbState && cachedDbState.googleAccessToken && cachedDbState.spreadsheetId) {
      // Trigger next sync
      syncToGoogleSheetsWithQueue(cachedDbState.googleAccessToken, cachedDbState.spreadsheetId, cachedDbState);
    }
  }
}

async function createMathExamSpreadsheet(token: string, state: SystemState): Promise<string> {
  try {
    const createRes = await fetch("https://sheets.googleapis.com/v1/spreadsheets", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        properties: {
          title: "ระบบทำข้อสอบคณิตศาสตร์ (Math Exam System)"
        },
        sheets: [
          { properties: { title: "Questions" } },
          { properties: { title: "Students" } },
          { properties: { title: "Submissions" } }
        ]
      })
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`Failed to create spreadsheet: ${createRes.statusText} - ${errText}`);
    }

    const data: any = await createRes.json();
    const spreadsheetId = data.spreadsheetId;
    console.log("Created Google Spreadsheet with ID:", spreadsheetId);

    // Populate data right after creation
    await pushAllToGoogleSheets(token, spreadsheetId, state);

    return spreadsheetId;
  } catch (err) {
    console.error("Error creating Google Spreadsheet:", err);
    throw err;
  }
}

async function findMathExamSpreadsheet(token: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='ระบบทำข้อสอบคณิตศาสตร์ (Math Exam System)' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
    const searchRes = await fetch(searchUrl, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!searchRes.ok) {
      const errText = await searchRes.text();
      console.error(`Search spreadsheet failed: ${searchRes.statusText} - ${errText}`);
      return null;
    }
    const searchData: any = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
    return null;
  } catch (err) {
    console.error("Error searching for spreadsheet:", err);
    return null;
  }
}

async function ensureSpreadsheetTabs(token: string, spreadsheetId: string) {
  try {
    const getRes = await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!getRes.ok) return;
    const data: any = await getRes.json();
    const existingTitles = (data.sheets || []).map((s: any) => s.properties?.title);
    
    const required = ["Questions", "Students", "Submissions"];
    const missing = required.filter(title => !existingTitles.includes(title));
    
    if (missing.length > 0) {
      console.log(`Adding missing sheets to spreadsheet ${spreadsheetId}:`, missing);
      const requests = missing.map(title => ({
        addSheet: { properties: { title } }
      }));
      
      await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ requests })
      });
    }
  } catch (err) {
    console.error("Error ensuring sheet tabs exist:", err);
  }
}

async function pullAllFromGoogleSheets(token: string, spreadsheetId: string): Promise<Partial<SystemState>> {
  const result: Partial<SystemState> = {};
  try {
    // Read all ranges
    const getRes = await fetch(`https://sheets.googleapis.com/v1/spreadsheets/${spreadsheetId}/values:batchGet?ranges=Questions!A:J&ranges=Students!A:D&ranges=Submissions!A:W`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (getRes.status === 401) {
      console.warn("Google Access Token is expired or invalid in background pull. Clearing token.");
      if (cachedDbState) {
        cachedDbState.googleAccessToken = undefined;
        writeDb(cachedDbState);
      }
      return result;
    }

    if (!getRes.ok) {
      const errText = await getRes.text();
      console.error(`Batch get Sheets failed: ${getRes.statusText} - ${errText}`);
      return result;
    }

    const data: any = await getRes.json();
    const valueRanges = data.valueRanges || [];

    // Parse Questions
    const questionsVal = valueRanges[0]?.values || [];
    if (questionsVal.length > 1) {
      const parsedQuestions: Question[] = [];
      for (let i = 1; i < questionsVal.length; i++) {
        const row = questionsVal[i];
        if (!row[0]) continue;
        
        let choices: string[] | undefined = undefined;
        try {
          if (row[7]) choices = JSON.parse(row[7]);
        } catch (_) {}

        let choiceImages: string[] | undefined = undefined;
        try {
          if (row[8]) choiceImages = JSON.parse(row[8]);
        } catch (_) {}

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
      result.questions = parsedQuestions;
    }

    // Parse Students
    const studentsVal = valueRanges[1]?.values || [];
    if (studentsVal.length > 1) {
      const parsedStudents: Student[] = [];
      for (let i = 1; i < studentsVal.length; i++) {
        const row = studentsVal[i];
        if (!row[0] || !row[1]) continue;
        parsedStudents.push({
          id: row[0],
          name: row[1],
          class: row[2] || "3/2",
          number: parseInt(row[3], 10) || i
        });
      }
      result.students = parsedStudents;
    }

    // Parse Submissions
    const submissionsVal = valueRanges[2]?.values || [];
    if (submissionsVal.length > 1) {
      const parsedSubmissions: Submission[] = [];
      for (let i = 1; i < submissionsVal.length; i++) {
        const row = submissionsVal[i];
        if (!row[0]) continue;

        let mcAns = {};
        try { if (row[7]) mcAns = JSON.parse(row[7]); } catch (_) {}

        let shAns = {};
        try { if (row[9]) shAns = JSON.parse(row[9]); } catch (_) {}

        let shScores = {};
        try { if (row[10]) shScores = JSON.parse(row[10]); } catch (_) {}

        let origMcAns = undefined;
        try { if (row[21]) origMcAns = JSON.parse(row[21]); } catch (_) {}

        let origShAns = undefined;
        try { if (row[22]) origShAns = JSON.parse(row[22]); } catch (_) {}

        parsedSubmissions.push({
          id: row[0],
          studentId: row[1] || "",
          name: row[2] || "",
          class: row[3] || "3/2",
          number: parseInt(row[4], 10) || 0,
          gradeLevel: row[5] as any,
          set: row[6] as any,
          multipleChoiceAnswers: mcAns,
          multipleChoiceScore: parseInt(row[8], 10) || 0,
          shortAnswers: shAns,
          shortAnswerScores: shScores,
          writtenAnswer: row[11] || "",
          writtenScore: parseFloat(row[12]) || 0,
          totalScore: parseFloat(row[13]) || 0,
          timeTaken: parseFloat(row[14]) || 0,
          cheatingWarningsCount: parseInt(row[15], 10) || 0,
          cheated: row[16] === "true",
          submittedAt: row[17] || "",
          graded: row[18] === "true",
          gradedAt: row[19] || undefined,
          feedback: row[20] || undefined,
          originalMultipleChoiceAnswers: origMcAns,
          originalShortAnswers: origShAns
        });
      }
      result.submissions = parsedSubmissions;
    }
  } catch (err) {
    console.error("Error pulling data from Google Sheets:", err);
  }
  return result;
}

function writeDb(state: SystemState) {
  cachedDbState = state;
  pendingDbWriteState = state;
  triggerDbWrite();

  // Trigger Google Sheets background sync if set up
  if (state.googleAccessToken && state.spreadsheetId) {
    syncToGoogleSheetsWithQueue(state.googleAccessToken, state.spreadsheetId, state).catch(err => {
      console.error("Auto background Google Sheets sync failed:", err);
    });
  }
}

function triggerDbWrite() {
  if (isWritingDb || !pendingDbWriteState) return;
  isWritingDb = true;
  const stateToWrite = pendingDbWriteState;
  pendingDbWriteState = null;

  const tempPath = DB_FILE + ".tmp";
  fs.writeFile(tempPath, JSON.stringify(stateToWrite), "utf-8", (err) => {
    if (err) {
      console.error("Atomic write failed at step 1:", err);
      isWritingDb = false;
      triggerDbWrite();
      return;
    }
    fs.rename(tempPath, DB_FILE, (renameErr) => {
      isWritingDb = false;
      if (renameErr) {
        console.error("Atomic rename failed:", renameErr);
      }
      triggerDbWrite();
    });
  });
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
  app.use(express.json({ limit: '50mb' })); // Allow larger payloads for canvas base64 images

  // Initialize DB
  readDb();

  // API: Student Login
  app.post("/api/login", (req, res) => {
    const { username } = req.body;
    if (!username) {
      return res.status(400).json({ success: false, message: "กรุณากรอกรหัสนักเรียน" });
    }

    const state = readDb();
    const student = state.students.find(s => s.id === username.trim());
    if (student) {
      // Check exam status
      let gradeLevel: '3' | '5' | '6' | '6/8' = '3';
      const cStr = student.class.trim();
      if (cStr.startsWith("3/")) gradeLevel = '3';
      else if (cStr.startsWith("5/")) gradeLevel = '5';
      else if (cStr === "6/8") gradeLevel = '6/8';
      else if (cStr.startsWith("6/")) gradeLevel = '6';

      const examStatus = state.examStatus?.[gradeLevel] || 'closed';
      if (examStatus === 'closed') {
        return res.json({ success: false, message: `ระบบทำข้อสอบของ ม.${gradeLevel === '6/8' ? '6/8' : gradeLevel} ถูกปิดใช้งานอยู่โดยแอดมิน กรุณารอให้คุณครูเปิดระบบก่อนเข้าสู่ระบบ` });
      }

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

  // API: Get questions for specific class and student number
  app.get("/api/questions", (req, res) => {
    const { class: className, number } = req.query;
    if (!className || !number) {
      return res.status(400).json({ success: false, message: "ข้อมูลห้องเรียนหรือเลขที่ไม่ครบถ้วน" });
    }

    const studentNumber = parseInt(number as string, 10);
    const set = studentNumber % 2 === 1 ? 'A' : 'B'; // Odd -> A, Even -> B

    // Class mapping to Grade levels:
    // 3/2 -> Grade 3
    // 5/3, 5/5 -> Grade 5
    // 6/3, 6/5 -> Grade 6
    // 6/8 -> Grade 6/8 (Separate subject code)
    let gradeLevel: '3' | '5' | '6' | '6/8' = '3';
    const cStr = (className as string).trim();
    if (cStr.startsWith("3/")) gradeLevel = '3';
    else if (cStr.startsWith("5/")) gradeLevel = '5';
    else if (cStr === "6/8") gradeLevel = '6/8';
    else if (cStr.startsWith("6/")) gradeLevel = '6';

    const state = readDb();
    const examStatus = state.examStatus?.[gradeLevel] || 'closed';
    if (examStatus === 'closed') {
      return res.status(403).json({ success: false, message: `ระบบทำข้อสอบของ ม.${gradeLevel === '6/8' ? '6/8' : gradeLevel} ถูกปิดอยู่โดยผู้คุมสอบ` });
    }

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

    const state = readDb();

    // 1. Double check student info
    const student = state.students.find(s => s.id === studentId);
    const studentName = student ? student.name : "นักเรียนภายนอก";

    // 2. Fetch specific set questions to calculate Multiple Choice score
    const targetQuestions = state.questions.filter(
      q => q.gradeLevel === gradeLevel && q.set === set
    );

    let mcScore = 0;
    const mcQuestions = targetQuestions.filter(q => q.type === 'multiple-choice');
    
    mcQuestions.forEach(q => {
      const studentAns = multipleChoiceAnswers[q.id];
      if (studentAns !== undefined && studentAns !== null) {
        // String trimming comparison for accuracy
        if (studentAns.toString().trim() === q.correctAnswer.toString().trim()) {
          mcScore++;
        }
      }
    });

    const isCheated = cheatingWarningsCount >= 3;
    const finalMcScore = isCheated ? 0 : mcScore;

    // 3. Initialize short answer scores to 0 (admin will grade these later)
    const shortAnswerScores: Record<string, number> = {};
    const saQuestions = targetQuestions.filter(q => q.type === 'short-answer');
    saQuestions.forEach(q => {
      shortAnswerScores[q.id] = 0; // default to 0
    });

    // 4. Process Written Answer (drawing canvas base64) to Google Drive or Local uploads
    let processedWrittenAnswer = writtenAnswer;
    if (writtenAnswer && writtenAnswer.startsWith("data:image/")) {
      try {
        const base64Data = writtenAnswer.replace(/^data:image\/\w+;base64,/, "");
        const filename = `written_ans_${studentId}_class_${className.replace("/", "_")}_no_${number}_${Date.now()}.png`;
        const mimeType = "image/png";
        const token = state.googleAccessToken;
        let driveUrl: string | null = null;

        if (token) {
          console.log(`Uploading student written answer for ID ${studentId} to Google Drive...`);
          // Try to upload to targeted drive folder
          driveUrl = await uploadToGoogleDrive(token, TARGET_DRIVE_FOLDER_ID, filename, mimeType, base64Data);
          if (!driveUrl) {
            console.log("Failed uploading to specified folder, trying root folder...");
            driveUrl = await uploadToGoogleDrive(token, "root", filename, mimeType, base64Data);
          }
        }

        if (driveUrl) {
          processedWrittenAnswer = driveUrl;
          console.log(`Student written answer successfully saved to Google Drive: ${driveUrl}`);
        } else {
          // Fallback to saving as a local server image
          const uploadsDir = path.join(process.cwd(), "public", "uploads");
          if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
          }
          const buffer = Buffer.from(base64Data, "base64");
          const uniqueFilename = `${Date.now()}-${filename}`;
          const filePath = path.join(uploadsDir, uniqueFilename);
          fs.writeFileSync(filePath, buffer);
          processedWrittenAnswer = `/uploads/${uniqueFilename}`;
          console.log(`Google Drive upload unavailable, saved written answer locally: ${processedWrittenAnswer}`);
        }
      } catch (err) {
        console.error("Error processing student written answer image:", err);
      }
    }

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
      writtenAnswer: processedWrittenAnswer,
      writtenScore: 0,
      totalScore: finalMcScore, // Initially only MC score (unless cheated = 0)
      timeTaken,
      cheatingWarningsCount,
      cheated: isCheated,
      submittedAt: getThailandTimestamp(),
      graded: false
    };

    // Keep all previous submissions as requested for multi-attempt support
    state.submissions.push(submission);
    
    writeDb(state);

    res.json({ success: true, submission });
  });

  // ADMIN API: Get all submissions
  app.get("/api/admin/submissions", (req, res) => {
    const state = readDb();
    res.json({ success: true, submissions: state.submissions });
  });

  // ADMIN API: Delete submission
  app.post("/api/admin/submissions/delete", (req, res) => {
    const { submissionId } = req.body;
    if (!submissionId) {
      return res.status(400).json({ success: false, message: "กรุณาระบุรหัสการส่งคำตอบที่ต้องการลบ" });
    }

    const state = readDb();
    const subExists = state.submissions.some(s => s.id === submissionId);
    if (!subExists) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลการส่งคำตอบนี้" });
    }

    state.submissions = state.submissions.filter(s => s.id !== submissionId);
    writeDb(state);

    res.json({ success: true, message: "ลบกระดาษคำตอบของนักเรียนเรียบร้อยแล้ว" });
  });

  // ADMIN API: Upload local image (Base64)
  app.post("/api/admin/upload", (req, res) => {
    const { imageBase64, filename } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "ไม่พบข้อมูลรูปภาพประกอบ" });
    }

    try {
      // Create public/uploads directory if not exists
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // Extract raw base64 data
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // Generate unique name
      const uniqueFilename = `${Date.now()}-${filename || "image.png"}`;
      const filePath = path.join(uploadsDir, uniqueFilename);

      fs.writeFileSync(filePath, buffer);

      // Return local server URL path
      res.json({ success: true, url: `/uploads/${uniqueFilename}` });
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดทางเซิร์ฟเวอร์ในการบันทึกรูปภาพ" });
    }
  });

  // ADMIN API: Grade short answers and written answer (And edit student answers if requested)
  app.post("/api/admin/grade", (req, res) => {
    const { 
      submissionId, 
      shortAnswerScores, 
      writtenScore, 
      feedback,
      editedMultipleChoiceAnswers,
      editedShortAnswers,
      cheated
    } = req.body;

    const state = readDb();
    const subIdx = state.submissions.findIndex(s => s.id === submissionId);
    if (subIdx === -1) {
      return res.status(404).json({ success: false, message: "ไม่พบข้อมูลการส่งข้อสอบนี้" });
    }

    const sub = state.submissions[subIdx];

    // Preserve original answers on the very first edit
    if (!sub.originalMultipleChoiceAnswers) {
      sub.originalMultipleChoiceAnswers = { ...sub.multipleChoiceAnswers };
    }
    if (!sub.originalShortAnswers) {
      sub.originalShortAnswers = { ...sub.shortAnswers };
    }

    // Update cheated status if provided by admin
    if (cheated !== undefined) {
      sub.cheated = cheated;
    }

    // Apply edited multiple-choice answers and recalculate score
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

    // Apply edited short answers
    if (editedShortAnswers) {
      sub.shortAnswers = editedShortAnswers;
    }
    
    // The admin has full grading discretion even if the student's warning count is high
    sub.multipleChoiceScore = mcScore;
    sub.shortAnswerScores = shortAnswerScores;
    sub.writtenScore = parseFloat(writtenScore) || 0;
    
    // Calculate total short answer score
    let saSum = 0;
    Object.keys(shortAnswerScores).forEach(qId => {
      saSum += parseFloat(shortAnswerScores[qId]) || 0;
    });

    sub.totalScore = sub.multipleChoiceScore + saSum + sub.writtenScore;
    sub.feedback = feedback;

    sub.graded = true;
    sub.gradedAt = getThailandTimestamp();

    state.submissions[subIdx] = sub;
    writeDb(state);

    res.json({ success: true, submission: sub });
  });

  // ADMIN API: Get student list
  app.get("/api/admin/students", (req, res) => {
    const state = readDb();
    res.json({ success: true, students: state.students });
  });

  // ADMIN API: Import students manually
  app.post("/api/admin/students/import", (req, res) => {
    const { students } = req.body;
    if (!Array.isArray(students)) {
      return res.status(400).json({ success: false, message: "รูปแบบข้อมูลนักเรียนไม่ถูกต้อง" });
    }

    const state = readDb();
    // Overwrite student list
    state.students = students;
    writeDb(state);

    res.json({ success: true, students: state.students });
  });

  // ADMIN API: Fetch from Google Sheet CSV export
  app.post("/api/admin/students/fetch-sheet", async (req, res) => {
    const { sheetUrl } = req.body;
    if (!sheetUrl) {
      return res.status(400).json({ success: false, message: "กรุณาระบุลิงก์ Google Sheet" });
    }

    try {
      // Convert standard sharing link to a direct CSV export link
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes("docs.google.com/spreadsheets")) {
        // Extract spreadsheet ID and gid
        const matches = csvUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (matches && matches[1]) {
          const spreadsheetId = matches[1];
          // Extract GID
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
        return res.json({ success: false, message: "ไม่พบข้อมูลรายชื่อนักเรียนใน Google Sheet หรือไม่สามารถดึงข้อมูลได้ (โปรดตรวจสอบสิทธิ์การแชร์ให้เป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน')" });
      }

      const state = readDb();
      state.students = parsedStudents;
      state.rosterSheetUrl = sheetUrl.trim();
      writeDb(state);

      res.json({ success: true, count: parsedStudents.length, students: parsedStudents });
    } catch (err: any) {
      console.error("Error fetching Google Sheet:", err);
      res.json({ success: false, message: `เกิดข้อผิดพลาดในการดึงข้อมูล: ${err.message}. โปรดระบุลิงก์ที่แชร์เป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน'` });
    }
  });

  // ADMIN API: Get questions
  app.get("/api/admin/questions", (req, res) => {
    const state = readDb();
    res.json({ success: true, questions: state.questions });
  });

  // ADMIN API: Add/edit question (supports batch)
  app.post("/api/admin/questions", (req, res) => {
    const { question, questions, deleteId } = req.body;
    const state = readDb();

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

      writeDb(state);
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

    writeDb(state);
    res.json({ success: true, question });
  });

  // ADMIN API: Delete all questions
  app.delete("/api/admin/questions/all", (req, res) => {
    const state = readDb();
    state.questions = [];
    writeDb(state);
    res.json({ success: true, message: "ลบข้อสอบทั้งหมดในฐานข้อมูลเรียบร้อยแล้ว" });
  });

  // ADMIN API: Delete question
  app.delete("/api/admin/questions/:id", (req, res) => {
    const { id } = req.params;
    const state = readDb();
    const initialLen = state.questions.length;
    state.questions = state.questions.filter(q => q.id !== id);
    
    if (state.questions.length < initialLen) {
      writeDb(state);
      res.json({ success: true, message: "ลบข้อสอบสำเร็จ" });
    } else {
      res.status(404).json({ success: false, message: "ไม่พบข้อสอบที่ต้องการลบ" });
    }
  });

  // ADMIN API: Bulk delete questions
  app.post("/api/admin/questions/bulk-delete", (req, res) => {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: "กรุณาระบุรหัสข้อสอบที่ต้องการลบ" });
    }
    const state = readDb();
    const initialLen = state.questions.length;
    state.questions = state.questions.filter(q => !ids.includes(q.id));
    writeDb(state);
    res.json({ success: true, count: initialLen - state.questions.length, message: "ลบข้อสอบที่เลือกสำเร็จ" });
  });

  // ADMIN API: Connect or pull Google Sheets
  app.post("/api/admin/google-sheets/connect", async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) {
      return res.status(400).json({ success: false, message: "กรุณาระบุ access token" });
    }

    try {
      const state = readDb();
      state.googleAccessToken = accessToken;
      
      // Look for existing spreadsheet
      console.log("Searching for 'ระบบทำข้อสอบคณิตศาสตร์ (Math Exam System)' spreadsheet...");
      let spreadsheetId = await findMathExamSpreadsheet(accessToken);

      if (spreadsheetId) {
        console.log(`Found existing spreadsheet ID: ${spreadsheetId}`);
        state.spreadsheetId = spreadsheetId;
        
        // Ensure all required sheets/tabs exist
        await ensureSpreadsheetTabs(accessToken, spreadsheetId);
        
        // Pull data and intelligently merge/adopt
        console.log("Pulling and merging data from existing Google Spreadsheet...");
        const pulled = await pullAllFromGoogleSheets(accessToken, spreadsheetId);
        let needsPush = false;

        if (pulled.questions && pulled.questions.length > 0) {
          state.questions = pulled.questions;
        } else if (state.questions.length > 0) {
          needsPush = true;
        }

        if (pulled.students && pulled.students.length > 0) {
          state.students = pulled.students;
        } else if (state.students.length > 0) {
          needsPush = true;
        }

        if (pulled.submissions && pulled.submissions.length > 0) {
          state.submissions = pulled.submissions;
        } else if (state.submissions.length > 0) {
          needsPush = true;
        }

        if (needsPush) {
          console.log("Pushing local data to newly-mapped spreadsheet worksheets...");
          await pushAllToGoogleSheets(accessToken, spreadsheetId, state);
        }
      } else {
        console.log("No spreadsheet found. Creating a brand new one...");
        spreadsheetId = await createMathExamSpreadsheet(accessToken, state);
        state.spreadsheetId = spreadsheetId;
      }

      writeDb(state);

      res.json({
        success: true,
        spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        studentsCount: state.students.length,
        questionsCount: state.questions.length,
        submissionsCount: state.submissions.length
      });
    } catch (err: any) {
      console.error("Error connecting Google Sheets:", err);
      res.status(500).json({ success: false, message: `ไม่สามารถเชื่อมต่อ Google Sheets ได้: ${err.message}` });
    }
  });

  // ADMIN API: Get Google Sheets connection status
  app.get("/api/admin/google-sheets/status", (req, res) => {
    const state = readDb();
    res.json({
      success: true,
      spreadsheetId: state.spreadsheetId || null,
      connected: !!state.googleAccessToken,
      url: state.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${state.spreadsheetId}` : null,
      rosterSheetUrl: state.rosterSheetUrl || null
    });
  });

  // ADMIN API: Bidirectional sync with Google Sheets
  app.post("/api/admin/google-sheets/sync", async (req, res) => {
    const state = readDb();
    const token = state.googleAccessToken;
    const sheetId = state.spreadsheetId;

    if (!token || !sheetId) {
      return res.status(400).json({ success: false, message: "กรุณาเชื่อมต่อบัญชี Google ก่อนซิงก์" });
    }

    try {
      console.log("Starting manual bidirectional sync with Google Sheets...");
      
      // Ensure tabs exist
      await ensureSpreadsheetTabs(token, sheetId);

      // Pull worksheets from Google Sheet
      const pulled = await pullAllFromGoogleSheets(token, sheetId);
      
      // Synchronize questions
      if (pulled.questions && pulled.questions.length > 0) {
        state.questions = pulled.questions;
      }
      
      // Synchronize students
      if (pulled.students && pulled.students.length > 0) {
        state.students = pulled.students;
      }

      // Synchronize submissions
      if (pulled.submissions && pulled.submissions.length > 0) {
        state.submissions = pulled.submissions;
      }

      // Save local DB
      writeDb(state);

      // Push back to Sheet so both sides are 100% matched
      await pushAllToGoogleSheets(token, sheetId, state);

      res.json({
        success: true,
        message: "ซิงค์ข้อสอบและรายชื่อนักเรียนแบบสองทิศทางสำเร็จ! ข้อมูลในเว็บและ Google Sheet ตรงกันสมบูรณ์",
        studentsCount: state.students.length,
        questionsCount: state.questions.length,
        submissionsCount: state.submissions.length
      });
    } catch (err: any) {
      console.error("Bidirectional sync error:", err);
      res.status(500).json({ success: false, message: `ซิงค์ล้มเหลว: ${err.message}` });
    }
  });

  // ADMIN API: Get all exam statuses
  app.get("/api/admin/exam-status", (req, res) => {
    const state = readDb();
    res.json({ success: true, examStatus: state.examStatus });
  });

  // ADMIN API: Toggle exam status for a grade level
  app.post("/api/admin/exam-status/toggle", (req, res) => {
    const { gradeLevel } = req.body;
    if (!gradeLevel || !['3', '5', '6', '6/8'].includes(gradeLevel)) {
      return res.status(400).json({ success: false, message: "ระดับชั้นไม่ถูกต้อง" });
    }

    const state = readDb();
    if (!state.examStatus) {
      state.examStatus = { '3': 'closed', '5': 'closed', '6': 'closed', '6/8': 'closed' };
    }
    const current = state.examStatus[gradeLevel as '3' | '5' | '6' | '6/8'] || 'closed';
    const nextStatus = current === 'open' ? 'closed' : 'open';
    state.examStatus[gradeLevel as '3' | '5' | '6' | '6/8'] = nextStatus;

    writeDb(state);
    res.json({ success: true, examStatus: state.examStatus, message: `เปลี่ยนสถานะทำข้อสอบ ม.${gradeLevel === '6/8' ? '6/8' : gradeLevel} เป็น ${nextStatus === 'open' ? 'เปิด' : 'ปิด'} เรียบร้อยแล้ว` });
  });

  // Serve uploaded images statically
  app.use("/uploads", express.static(path.join(process.cwd(), "public/uploads")));

  // Serve static assets in production
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
