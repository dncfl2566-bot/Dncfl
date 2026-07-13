import { Question, Student } from '../types';

// Let's procedurally generate high-quality math questions for all grade levels and sets
export function getInitialQuestions(): Question[] {
  const questions: Question[] = [];

  const grades: ('3' | '5' | '6')[] = ['3', '5', '6'];
  const sets: ('A' | 'B')[] = ['A', 'B'];

  for (const grade of grades) {
    for (const set of sets) {
      const isSetA = set === 'A';
      
      // 1. Multiple Choice: 15 questions
      for (let qNo = 1; qNo <= 15; qNo++) {
        const isFiveChoices = qNo > 10; // Questions 11-15 have 5 choices, 1-10 have 4 choices
        let text = '';
        let choices: string[] = [];
        let correctAnswer = '';

        if (grade === '3') {
          // Grade 3: Basic Arithmetic, Fractions, Simple Word Problems
          if (qNo === 1) {
            const num1 = isSetA ? 2453 : 1845;
            const num2 = isSetA ? 1829 : 2314;
            const sum = num1 + num2;
            text = `ผลบวกของ ${num1} กับ ${num2} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${sum}`;
            choices = [`${sum}`, `${sum - 100}`, `${sum + 10}`, `${sum - 10}`];
          } else if (qNo === 2) {
            const num1 = isSetA ? 5800 : 6200;
            const num2 = isSetA ? 2340 : 1890;
            const diff = num1 - num2;
            text = `ผลลบของ ${num1} ด้วย ${num2} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${diff}`;
            choices = [`${diff}`, `${diff + 100}`, `${diff - 100}`, `${diff + 50}`];
          } else if (qNo === 3) {
            const factor1 = isSetA ? 12 : 15;
            const factor2 = isSetA ? 8 : 6;
            const prod = factor1 * factor2;
            text = `ผลคูณของ ${factor1} × ${factor2} เท่ากับเท่าใด`;
            correctAnswer = `${prod}`;
            choices = [`${prod}`, `${prod - 4}`, `${prod + 10}`, `${prod + 4}`];
          } else if (qNo === 4) {
            const div = isSetA ? 144 : 120;
            const divisor = isSetA ? 12 : 10;
            const quotient = div / divisor;
            text = `ผลหารของ ${div} ÷ ${divisor} เท่ากับเท่าใด`;
            correctAnswer = `${quotient}`;
            choices = [`${quotient}`, `${quotient + 2}`, `${quotient - 2}`, `${quotient * 2}`];
          } else if (qNo === 5) {
            text = isSetA 
              ? `เศษส่วนใดมีค่ามากที่สุด` 
              : `เศษส่วนใดมีค่าน้อยที่สุด`;
            correctAnswer = isSetA ? "3/4" : "1/8";
            choices = ["3/4", "1/2", "1/4", "1/8"];
          } else if (qNo === 6) {
            const num = isSetA ? 450 : 350;
            text = `ในตู้มีดินสอสีแดงอยู่ ${num} แท่ง สีน้ำเงินอยู่ครึ่งหนึ่งของสีแดง มีสีน้ำเงินกี่แท่ง`;
            const ans = num / 2;
            correctAnswer = `${ans} แท่ง`;
            choices = [`${ans} แท่ง`, `${ans - 50} แท่ง`, `${ans + 50} แท่ง`, `${num} แท่ง`];
          } else if (qNo === 7) {
            const width = isSetA ? 6 : 8;
            const height = isSetA ? 4 : 5;
            const area = width * height;
            text = `รูปสี่เหลี่ยมผืนผ้ากว้าง ${width} เซนติเมตร ยาว ${height} เซนติเมตร จะมีพื้นที่กี่ตารางเซนติเมตร`;
            correctAnswer = `${area} ตารางเซนติเมตร`;
            choices = [`${area} ตารางเซนติเมตร`, `${width + height} ตารางเซนติเมตร`, `${2 * (width + height)} ตารางเซนติเมตร`, `${area + 5} ตารางเซนติเมตร`];
          } else if (qNo === 8) {
            const m = isSetA ? 5 : 7;
            text = `แม่ค้ามีส้ม ${m} เข่ง เข่งละ 25 ผล ขายไปได้ 100 ผล จะเหลือส้มกี่ผล`;
            const ans = (m * 25) - 100;
            correctAnswer = `${ans} ผล`;
            choices = [`${ans} ผล`, `${ans + 10} ผล`, `${ans - 10} ผล`, `125 ผล`];
          } else if (qNo === 9) {
            text = `ข้อใดต่อไปนี้เขียนในรูปกระจายได้ถูกต้องสำหรับ 14,509`;
            correctAnswer = `10,000 + 4,000 + 500 + 9`;
            choices = [
              `10,000 + 4,000 + 500 + 9`,
              `10,000 + 4,500 + 9`,
              `14,000 + 500 + 90`,
              `10,000 + 4,000 + 50 + 9`
            ];
          } else if (qNo === 10) {
            const min = isSetA ? 45 : 35;
            text = `เข็มยาวของนาฬิกาเดินไปเป็นเวลา ${min} นาที คิดเป็นกี่วินาที`;
            const ans = min * 60;
            correctAnswer = `${ans} วินาที`;
            choices = [`${ans} วินาที`, `${ans - 100} วินาที`, `${ans + 200} วินาที`, `${min * 10} วินาที`];
          } else {
            // Questions 11-15 (5 choices)
            if (qNo === 11) {
              const a = isSetA ? 8 : 9;
              text = `ผลคูณของ ${a} × 900 มีค่าเท่ากับข้อใด`;
              const ans = a * 900;
              correctAnswer = `${ans}`;
              choices = [`${ans}`, `${ans - 900}`, `${ans + 900}`, `${ans * 10}`, `${ans / 10}`];
            } else if (qNo === 12) {
              const b = isSetA ? 350 : 450;
              text = `ลุงมีเงิน ${b} บาท ป้ามีเงินเป็น 3 เท่าของลุง ทั้งสองคนมีเงินรวมกันกี่บาท`;
              const ans = b + (b * 3);
              correctAnswer = `${ans} บาท`;
              choices = [`${ans} บาท`, `${b * 3} บาท`, `${b * 2} บาท`, `${b * 5} บาท`, `${ans - 100} บาท`];
            } else if (qNo === 13) {
              text = `รูปเรขาคณิตสามมิติที่มีหน้าตัดเป็นรูปวงกลมทั้งสองด้าน เรียกว่าอะไร`;
              correctAnswer = `ทรงกระบอก`;
              choices = [`ทรงกระบอก`, `ทรงกลม`, `กรวย`, `พีระมิด`, `ปริซึมสามเหลี่ยม`];
            } else if (qNo === 14) {
              const hr = isSetA ? 2 : 3;
              text = `สมชายเดินทางไปต่างจังหวัดใช้เวลา ${hr} ชั่วโมง 15 นาที คิดเป็นเวลากี่นาที`;
              const ans = (hr * 60) + 15;
              correctAnswer = `${ans} นาที`;
              choices = [`${ans} นาที`, `${hr * 60} นาที`, `${ans - 15} นาที`, `${ans + 15} นาที`, `${hr * 100} นาที`];
            } else {
              const km = isSetA ? 4 : 6;
              text = `ระยะทาง ${km} กิโลเมตร คิดเป็นกี่เซนติเมตร`;
              const ans = km * 1000 * 100;
              correctAnswer = `${ans.toLocaleString()} เซนติเมตร`;
              choices = [
                `${ans.toLocaleString()} เซนติเมตร`,
                `${(km * 1000).toLocaleString()} เซนติเมตร`,
                `${(km * 100).toLocaleString()} เซนติเมตร`,
                `${(km * 10000).toLocaleString()} เซนติเมตร`,
                `50,000 เซนติเมตร`
              ];
            }
          }
        } else if (grade === '5') {
          // Grade 5: Decimals, Percentages, Volume, Basic Fractions
          if (qNo === 1) {
            const dec1 = isSetA ? 3.45 : 2.75;
            const dec2 = isSetA ? 1.28 : 1.68;
            const sum = (dec1 + dec2).toFixed(2);
            text = `ผลบวกของ ${dec1} + ${dec2} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${sum}`;
            choices = [`${sum}`, `${(dec1 + dec2 + 0.1).toFixed(2)}`, `${(dec1 + dec2 - 0.1).toFixed(2)}`, `${(dec1 + dec2 + 1).toFixed(2)}`];
          } else if (qNo === 2) {
            const val = isSetA ? 250 : 400;
            const pct = isSetA ? 20 : 15;
            const ans = (val * pct) / 100;
            text = `ร้อยละ ${pct} ของ ${val} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${ans}`;
            choices = [`${ans}`, `${ans + 10}`, `${ans - 5}`, `${ans * 2}`];
          } else if (qNo === 3) {
            const f1 = isSetA ? "1/2" : "1/3";
            const f2 = isSetA ? "1/4" : "1/6";
            const ans = isSetA ? "3/4" : "1/2";
            text = `ผลบวกของ ${f1} + ${f2} เท่ากับเท่าใด`;
            correctAnswer = ans;
            choices = [ans, "2/6", "1/6", "5/12"];
          } else if (qNo === 4) {
            const price = isSetA ? 1500 : 2000;
            const disc = isSetA ? 10 : 20;
            const ans = price - (price * disc) / 100;
            text = `รองเท้าคู่หนึ่งราคา ${price} บาท ร้านค้าลดราคาให้ ${disc}% จะต้องจ่ายเงินกี่บาท`;
            correctAnswer = `${ans} บาท`;
            choices = [`${ans} บาท`, `${price - ans} บาท`, `${price - 100} บาท`, `${ans - 50} บาท`];
          } else if (qNo === 5) {
            const w = isSetA ? 4 : 5;
            const l = isSetA ? 5 : 6;
            const h = isSetA ? 8 : 10;
            const vol = w * l * h;
            text = `กล่องทรงสี่เหลี่ยมมุมฉาก กว้าง ${w} ซม. ยาว ${l} ซม. สูง ${h} ซม. จะมีความจุกี่ลูกบาศก์เซนติเมตร`;
            correctAnswer = `${vol} ลูกบาศก์เซนติเมตร`;
            choices = [`${vol} ลูกบาศก์เซนติเมตร`, `${w + l + h} ลูกบาศก์เซนติเมตร`, `${2 * (w*l + l*h + w*h)} ลูกบาศก์เซนติเมตร`, `${vol - 20} ลูกบาศก์เซนติเมตร`];
          } else if (qNo === 6) {
            const base = isSetA ? 10 : 12;
            const height = isSetA ? 8 : 6;
            const area = 0.5 * base * height;
            text = `รูปสามเหลี่ยมที่มีความยาวฐาน ${base} เซนติเมตร และสูง ${height} เซนติเมตร มีพื้นที่กี่ตารางเซนติเมตร`;
            correctAnswer = `${area} ตารางเซนติเมตร`;
            choices = [`${area} ตารางเซนติเมตร`, `${base * height} ตารางเซนติเมตร`, `${base + height} ตารางเซนติเมตร`, `${area * 2} ตารางเซนติเมตร`];
          } else if (qNo === 7) {
            const dec = isSetA ? 0.35 : 0.65;
            const ans = isSetA ? "35/100" : "65/100";
            text = `ทศนิยม ${dec} เขียนในรูปเศษส่วนอย่างง่ายได้เป็นอะไร`;
            const simplified = isSetA ? "7/20" : "13/20";
            correctAnswer = simplified;
            choices = [simplified, ans, "35/10", "65/10", "1/3"];
          } else if (qNo === 8) {
            const num = isSetA ? 3.6 : 4.8;
            const factor = isSetA ? 5 : 4;
            const ans = (num * factor).toFixed(1);
            text = `ผลคูณของ ${num} × ${factor} เท่ากับข้อใด`;
            correctAnswer = `${ans}`;
            choices = [`${ans}`, `${num}`, `${factor}`, `${(num * factor + 1).toFixed(1)}`];
          } else if (qNo === 9) {
            const x = isSetA ? 12 : 15;
            text = `มุมที่มีขนาดมากกว่า 90 องศา แต่เจ็ดสิบและน้อยกว่า 180 องศา เรียกว่ามุมชนิดใด`;
            correctAnswer = `มุมป้าน`;
            choices = [`มุมป้าน`, `มุมแหลม`, `มุมฉาก`, `มุมตรง`];
          } else if (qNo === 10) {
            const val = isSetA ? 80 : 90;
            text = `ข้อสอบวิชาคณิตศาสตร์คะแนนเต็ม 100 คะแนน สมหญิงสอบได้ ${val}% ของคะแนนเต็ม ถ้าคะแนนเต็มเปลี่ยนเป็น 150 คะแนน สมหญิงจะสอบได้กี่คะแนน`;
            const ans = (val / 100) * 150;
            correctAnswer = `${ans} คะแนน`;
            choices = [`${ans} คะแนน`, `${val} คะแนน`, `${ans - 10} คะแนน`, `100 คะแนน`];
          } else {
            // Questions 11-15 (5 choices)
            if (qNo === 11) {
              const a = isSetA ? 1.25 : 2.5;
              const ans = (a * 8).toFixed(1);
              text = `ผลลัพธ์ของ ${a} × 8 เท่ากับข้อใด`;
              correctAnswer = `${parseFloat(ans)}`;
              choices = [`${parseFloat(ans)}`, `10.0`, `15.0`, `8.0`, `12.5`];
            } else if (qNo === 12) {
              text = `รูปสี่เหลี่ยมชนิดใดมีด้านขนานกันสองคู่ และมุมทุกมุมไม่เป็นมุมฉาก โดยมีด้านทุกด้านยาวเท่ากัน`;
              correctAnswer = `รูปสี่เหลี่ยมขนมเปียกปูน`;
              choices = [`รูปสี่เหลี่ยมขนมเปียกปูน`, `รูปสี่เหลี่ยมจัตุรัส`, `รูปสี่เหลี่ยมผืนผ้า`, `รูปสี่เหลี่ยมคางหมู`, `รูปสี่เหลี่ยมด้านขนาน`];
            } else if (qNo === 13) {
              const c = isSetA ? 4 : 5;
              text = `รถยนต์วิ่งระยะทาง ${c * 90} กิโลเมตร ใช้เวลาเดินทาง ${c} ชั่วโมง อัตราเร็วเฉลี่ยของรถยนต์เป็นกี่กิโลเมตรต่อชั่วโมง`;
              correctAnswer = `90 กิโลเมตร/ชั่วโมง`;
              choices = [`90 กิโลเมตร/ชั่วโมง`, `80 กิโลเมตร/ชั่วโมง`, `100 กิโลเมตร/ชั่วโมง`, `70 กิโลเมตร/ชั่วโมง`, `120 กิโลเมตร/ชั่วโมง`];
            } else if (qNo === 14) {
              text = `ค่าเฉลี่ยของข้อมูลชุดนี้: 12, 15, 18, 21, 24 คือข้อใด`;
              correctAnswer = `18`;
              choices = [`18`, `15`, `20`, `21`, `17`];
            } else {
              const base = isSetA ? 1000 : 2000;
              text = `ฝากเงินไว้กับธนาคารเป็นเงิน ${base} บาท อัตราดอกเบี้ย 2% ต่อปี เมื่อสิ้นปีจะได้รับเงินต้นรวมดอกเบี้ยกี่บาท`;
              const ans = base + (base * 0.02);
              correctAnswer = `${ans} บาท`;
              choices = [`${ans} บาท`, `${base} บาท`, `${base * 0.02} บาท`, `${ans + 100} บาท`, `3,000 บาท`];
            }
          }
        } else {
          // Grade 6: Ratio, Equations, Geometry, Percentages, Complex Math
          if (qNo === 1) {
            const val1 = isSetA ? 12 : 18;
            const val2 = isSetA ? 16 : 24;
            const ans = isSetA ? "3:4" : "3:4";
            text = `อัตราส่วนอย่างต่ำของ ${val1} : ${val2} เท่ากับเท่าใด`;
            correctAnswer = ans;
            choices = [ans, "2:3", "4:5", "1:2"];
          } else if (qNo === 2) {
            const xVal = isSetA ? 7 : 9;
            text = `จากสมการ 3x - 5 = ${3 * xVal - 5} ค่าของ x มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${xVal}`;
            choices = [`${xVal}`, `${xVal + 2}`, `${xVal - 2}`, `${2 * xVal}`];
          } else if (qNo === 3) {
            const r = isSetA ? 7 : 14;
            const area = Math.round((22/7) * r * r);
            text = `วงกลมที่มีรัศมียาว ${r} เซนติเมตร จะมีพื้นที่ประมาณกี่ตารางเซนติเมตร (กำหนดให้ π ≈ 22/7)`;
            correctAnswer = `${area} ตารางเซนติเมตร`;
            choices = [`${area} ตารางเซนติเมตร`, `${Math.round(2 * (22/7) * r)} ตารางเซนติเมตร`, `${area - 10} ตารางเซนติเมตร`, `${area + 50} ตารางเซนติเมตร`];
          } else if (qNo === 4) {
            const a = isSetA ? 24 : 36;
            const b = isSetA ? 36 : 48;
            // GCD calculation
            const gcd = (x: number, y: number): number => !y ? x : gcd(y, x % y);
            const ans = gcd(a, b);
            text = `ห.ร.ม. ของ ${a} และ ${b} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${ans}`;
            choices = [`${ans}`, `${ans / 2}`, `${ans * 2}`, `6`];
          } else if (qNo === 5) {
            const a = isSetA ? 12 : 15;
            const b = isSetA ? 15 : 20;
            // LCM calculation
            const gcd = (x: number, y: number): number => !y ? x : gcd(y, x % y);
            const lcm = (a * b) / gcd(a, b);
            text = `ค.ร.น. ของ ${a} และ ${b} มีค่าเท่ากับเท่าใด`;
            correctAnswer = `${lcm}`;
            choices = [`${lcm}`, `${lcm * 2}`, `${lcm / 2}`, `${a * b}`];
          } else if (qNo === 6) {
            const base = isSetA ? 120 : 150;
            const pct = isSetA ? 30 : 40;
            const ans = base + (base * pct) / 100;
            text = `ซื้อสินค้าราคา ${base} บาท ขายไปได้กำไร ${pct}% จะขายไปในราคากี่บาท`;
            correctAnswer = `${ans} บาท`;
            choices = [`${ans} บาท`, `${base} บาท`, `${(base * pct) / 100} บาท`, `${ans + 20} บาท`];
          } else if (qNo === 7) {
            const scale = isSetA ? 100000 : 200000;
            text = `แผนผังมาตราส่วน 1 : ${scale.toLocaleString()} ถ้าระยะทางในแผนผังยาว 5 เซนติเมตร ระยะทางจริงจะเป็นกี่กิโลเมตร`;
            const realKm = (5 * scale) / 100000;
            correctAnswer = `${realKm} กิโลเมตร`;
            choices = [`${realKm} กิโลเมตร`, `${realKm * 10} กิโลเมตร`, `${realKm / 10} กิโลเมตร`, `50 กิโลเมตร`];
          } else if (qNo === 8) {
            text = `รูปคลี่ของพีระมิดฐานสี่เหลี่ยมจัตุรัส ประกอบด้วยรูปเรขาคณิตสองมิติชนิดใดบ้าง`;
            correctAnswer = `รูปสี่เหลี่ยมจัตุรัส 1 รูป และรูปสามเหลี่ยม 4 รูป`;
            choices = [
              `รูปสี่เหลี่ยมจัตุรัส 1 รูป และรูปสามเหลี่ยม 4 รูป`,
              `รูปสี่เหลี่ยมผืนผ้า 1 รูป และรูปสามเหลี่ยม 4 รูป`,
              `รูปสามเหลี่ยม 5 รูป`,
              `รูปสี่เหลี่ยมจัตุรัส 2 รูป และรูปสี่เหลี่ยมผืนผ้า 4 รูป`
            ];
          } else if (qNo === 9) {
            const angles = isSetA ? [50, 60] : [45, 55];
            const sum = angles[0] + angles[1];
            const ans = 180 - sum;
            text = `รูปสามเหลี่ยมรูปหนึ่งมีมุมสองมุมขนาด ${angles[0]} องศา และ ${angles[1]} องศา มุมที่สามจะมีขนาดกี่องศา`;
            correctAnswer = `${ans} องศา`;
            choices = [`${ans} องศา`, `${sum} องศา`, `90 องศา`, `100 องศา`];
          } else if (qNo === 10) {
            const h = isSetA ? 10 : 12;
            const base1 = isSetA ? 6 : 8;
            const base2 = isSetA ? 10 : 12;
            const area = 0.5 * h * (base1 + base2);
            text = `รูปสี่เหลี่ยมคางหมูสูง ${h} เซนติเมตร มีความยาวของด้านคู่ขนานคือ ${base1} เซนติเมตร และ ${base2} เซนติเมตร จะมีพื้นที่กี่ตารางเซนติเมตร`;
            correctAnswer = `${area} ตารางเซนติเมตร`;
            choices = [`${area} ตารางเซนติเมตร`, `${h * (base1 + base2)} ตารางเซนติเมตร`, `${area / 2} ตารางเซนติเมตร`, `100 ตารางเซนติเมตร`];
          } else {
            // Questions 11-15 (5 choices)
            if (qNo === 11) {
              const a = isSetA ? 25 : 30;
              text = `อัตราส่วนของจานต่อช้อนเป็น 2 : 5 ถ้ามีช้อน ${a * 5} คัน จะมีจานกี่ใบ`;
              const ans = a * 2;
              correctAnswer = `${ans} ใบ`;
              choices = [`${ans} ใบ`, `${a * 5} ใบ`, `${a} ใบ`, `${ans * 2} ใบ`, `10 ใบ`];
            } else if (qNo === 12) {
              text = `ค่าของ (2/3) ÷ (4/9) + (1/2) เท่ากับเท่าใด`;
              // (2/3) * (9/4) = 18/12 = 3/2. 3/2 + 1/2 = 4/2 = 2
              correctAnswer = `2`;
              choices = [`2`, `1 1/2`, `3`, `1/2`, `2 1/2`];
            } else if (qNo === 13) {
              const r = isSetA ? 7 : 14;
              const circ = Math.round(2 * (22/7) * r);
              text = `วงกลมที่มีรัศมียาว ${r} เซนติเมตร จะมีความยาวเส้นรอบวงประมาณกี่เซนติเมตร (กำหนดให้ π ≈ 22/7)`;
              correctAnswer = `${circ} เซนติเมตร`;
              choices = [
                `${circ} เซนติเมตร`,
                `${Math.round((22/7) * r * r)} เซนติเมตร`,
                `${circ / 2} เซนติเมตร`,
                `${circ * 2} เซนติเมตร`,
                `50 เซนติเมตร`
              ];
            } else if (qNo === 14) {
              text = `แผนภูมิต้นไม้แสดงจำนวนนักเรียนที่สุ่มมา 200 คน พบว่า 40% ชอบคณิตศาสตร์ มีนักเรียนที่ชอบคณิตศาสตร์กี่คน`;
              correctAnswer = `80 คน`;
              choices = [`80 คน`, `40 คน`, `100 คน`, `120 คน`, `60 คน`];
            } else {
              const b = isSetA ? 12 : 15;
              text = `รูปสามเหลี่ยมหน้าจั่วมีฐานยาว ${b} ซม. ด้านประกอบยอดมุมยาวด้านละ ${b + 3} ซม. จะมีความยาวรอบรูปกี่ซม.`;
              const ans = b + (b + 3) * 2;
              correctAnswer = `${ans} ซม.`;
              choices = [`${ans} ซม.`, `${3 * b} ซม.`, `${b + b + 3} ซม.`, `${ans + 10} ซม.`, `40 ซม.`];
            }
          }
        }

        questions.push({
          id: `q-g${grade}-set${set}-mc-${qNo}`,
          gradeLevel: grade,
          set: set,
          type: 'multiple-choice',
          questionNumber: qNo,
          text: text,
          choices: choices,
          correctAnswer: correctAnswer
        });
      }

      // 2. Short Answer (อัตนัยเติมคำ): 5 questions
      for (let qNo = 1; qNo <= 5; qNo++) {
        let text = '';
        let correctAnswer = '';

        if (grade === '3') {
          if (qNo === 1) {
            const num = isSetA ? 12 : 15;
            text = `ดินสอ 1 โหล ราคา 60 บาท ถ้าซื้อดินสอ ${num} แท่ง จะต้องจ่ายเงินกี่บาท (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${(60 / 12) * num}`;
          } else if (qNo === 2) {
            const num = isSetA ? 84 : 96;
            text = `ส้ม ${num} ผล จัดใส่ถุง ถุงละ 6 ผล จะจัดได้ทั้งหมดกี่ถุง (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${num / 6}`;
          } else if (qNo === 3) {
            const a = isSetA ? 150 : 250;
            const b = isSetA ? 350 : 450;
            text = `มีเงินอยู่ ${a} บาท พี่ให้มาอีก ${b} บาท แล้วนำไปซื้อของ 120 บาท จะเหลือเงินกี่บาท (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${a + b - 120}`;
          } else if (qNo === 4) {
            const s = isSetA ? 5 : 6;
            text = `รูปสี่เหลี่ยมจัตุรัสมีความยาวด้านละ ${s} เซนติเมตร จะมีเส้นรอบรูปยาวกี่เซนติเมตร (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${4 * s}`;
          } else {
            const num = isSetA ? 24 : 36;
            text = `แบ่งลูกอม ${num} เม็ด ให้เด็ก 4 คน คนละเท่าๆ กัน เด็กจะได้รับคนละกี่เม็ด (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${num / 4}`;
          }
        } else if (grade === '5') {
          if (qNo === 1) {
            const num1 = isSetA ? 0.4 : 0.6;
            const num2 = isSetA ? 0.25 : 0.15;
            const ans = (num1 * num2).toFixed(2);
            text = `ผลคูณของ ${num1} × ${num2} มีค่าเท่ากับเท่าใด (ตอบเป็นทศนิยมสองตำแหน่ง)`;
            correctAnswer = `${ans}`;
          } else if (qNo === 2) {
            const num = isSetA ? 500 : 800;
            const pct = isSetA ? 15 : 25;
            text = `ร้อยละ ${pct} ของเงิน ${num} บาท มีค่าเท่ากับกี่บาท (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${(num * pct) / 100}`;
          } else if (qNo === 3) {
            const s = isSetA ? 10 : 12;
            text = `ลูกบาศก์มีความกว้างด้านละ ${s} เซนติเมตร จะมีปริมาตรกี่ลูกบาศก์เซนติเมตร (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${s * s * s}`;
          } else if (qNo === 4) {
            const base = isSetA ? 12 : 16;
            const height = isSetA ? 10 : 8;
            text = `รูปสามเหลี่ยมที่มีฐานยาว ${base} ซม. และสูง ${height} ซม. จะมีพื้นที่กี่ตารางเซนติเมตร (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${0.5 * base * height}`;
          } else {
            text = `แปลงเศษส่วน 3/5 ให้เป็นร้อยละ จะได้ร้อยละเท่าใด (ตอบเป็นตัวเลขร้อยละเท่านั้น)`;
            correctAnswer = `60`;
          }
        } else {
          // Grade 6
          if (qNo === 1) {
            const x = isSetA ? 15 : 18;
            text = `จงหาค่าของ x จากสมการ 5x + 10 = ${5 * x + 10} (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${x}`;
          } else if (qNo === 2) {
            const base = isSetA ? 400 : 600;
            text = `ซื้อวิทยุมารองรับราคา ${base} บาท ขายต่อไปราคา ${base + (base * 0.25)} บาท ได้กำไรร้อยละเท่าใด (ตอบเป็นตัวเลขร้อยละเท่านั้น)`;
            correctAnswer = `25`;
          } else if (qNo === 3) {
            const r = isSetA ? 7 : 14;
            const area = Math.round((22/7) * r * r);
            text = `พื้นที่ของวงกลมที่มีรัศมี ${r} เซนติเมตร มีค่าประมาณกี่ตารางเซนติเมตร (กำหนดให้ π ≈ 22/7, ตอบเป็นตัวเลขกลมๆ)`;
            correctAnswer = `${area}`;
          } else if (qNo === 4) {
            const a = isSetA ? 18 : 24;
            const b = isSetA ? 30 : 36;
            const gcd = (x: number, y: number): number => !y ? x : gcd(y, x % y);
            text = `หา ห.ร.ม. ของ ${a} และ ${b} คือตัวเลขใด (ตอบเป็นตัวเลขเท่านั้น)`;
            correctAnswer = `${gcd(a, b)}`;
          } else {
            text = `ถ้าอัตราส่วนของ A : B = 2 : 3 และ B : C = 3 : 5 จงหาอัตราส่วน A : C ในรูปอย่างง่ายสุด (เช่น เขียนในรูป 2:5)`;
            correctAnswer = `2:5`;
          }
        }

        questions.push({
          id: `q-g${grade}-set${set}-sa-${qNo}`,
          gradeLevel: grade,
          set: set,
          type: 'short-answer',
          questionNumber: qNo,
          text: text,
          correctAnswer: correctAnswer
        });
      }

      // 3. Written (แสดงวิธีทำ): 1 question
      let text = '';
      let correctAnswer = '';

      if (grade === '3') {
        text = isSetA 
          ? `โจทย์: แม่ค้ามีส้มทั้งหมด 345 ผล จัดใส่ถุง ถุงละ 5 ผล แล้วนำไปขายราคาถุงละ 35 บาท ถ้าขายหมดแม่ค้าจะได้เงินทั้งหมดกี่บาท? จงแสดงวิธีทำอย่างละเอียด`
          : `โจทย์: โรงเรียนแห่งหนึ่งมีนักเรียนชาย 240 คน มีนักเรียนหญิงมากกว่านักเรียนชาย 85 คน โรงเรียนนี้มีนักเรียนทั้งหมดกี่คน? จงแสดงวิธีทำอย่างละเอียด`;
        correctAnswer = isSetA
          ? `ส้ม 345 ผล จัดถุงละ 5 ผล ได้ 345 / 5 = 69 ถุง\nขายราคาถุงละ 35 บาท จะได้เงิน 69 * 35 = 2,415 บาท`
          : `นักเรียนชาย = 240 คน\nนักเรียนหญิง = 240 + 85 = 325 คน\nนักเรียนทั้งหมด = 240 + 325 = 565 คน`;
      } else if (grade === '5') {
        text = isSetA
          ? `โจทย์: สระน้ำทรงสี่เหลี่ยมมุมฉาก กว้าง 4 เมตร ยาว 6 เมตร และสูง 2 เมตร ถ้ามีน้ำอยู่ครึ่งสระ จะมีน้ำอยู่ในสระปริมาตรกี่ลูกบาศก์เมตร? จงแสดงวิธีทำอย่างละเอียด`
          : `โจทย์: ร้านค้าซื้อโทรทัศน์มาราคา 8,000 บาท ต้องการขายให้ได้กำไร 15% จะต้องตั้งราคาขายโทรทัศน์กี่บาท? จงแสดงวิธีทำอย่างละเอียด`;
        correctAnswer = isSetA
          ? `ปริมาตรเต็มสระ = กว้าง * ยาว * สูง = 4 * 6 * 2 = 48 ลูกบาศก์เมตร\nมีน้ำอยู่ครึ่งสระ = 48 / 2 = 24 ลูกบาศก์เมตร`
          : `กำไรที่ต้องการ = 15% ของ 8,000 = (15/100) * 8000 = 1,200 บาท\nราคาที่ต้องตั้งขาย = ทุน + กำไร = 8,000 + 1,200 = 9,200 บาท`;
      } else {
        // Grade 6
        text = isSetA
          ? `โจทย์: ถังน้ำทรงกระบอกมีรัศมีของฐานยาว 7 เมตร สูง 10 เมตร จะมีความจุกี่ลูกบาศก์เมตร (กำหนดให้ π ≈ 22/7)? จงแสดงวิธีทำอย่างละเอียด`
          : `โจทย์: แผนผังสวนสาธารณะแห่งหนึ่งใช้มาตราส่วน 1 : 5,000 วัดความกว้างในแผนผังได้ 4 เซนติเมตร และความยาวได้ 8 เซนติเมตร สวนสาธารณะนี้มีพื้นที่จริงกี่ตารางเมตร? จงแสดงวิธีทำอย่างละเอียด`;
        correctAnswer = isSetA
          ? `ความจุทรงกระบอก = π * r^2 * h = (22/7) * 7 * 7 * 10 = 22 * 7 * 10 = 1,540 ลูกบาศก์เมตร`
          : `ระยะกว้างจริง = 4 ซม * 5,000 = 20,000 ซม = 200 เมตร\nระยะยาวจริง = 8 ซม * 5,000 = 40,000 ซม = 400 เมตร\nพื้นที่จริง = กว้างจริง * ยาวจริง = 200 * 400 = 80,000 ตารางเมตร`;
      }

      questions.push({
        id: `q-g${grade}-set${set}-wr-1`,
        gradeLevel: grade,
        set: set,
        type: 'written',
        questionNumber: 1,
        text: text,
        correctAnswer: correctAnswer
      });
    }
  }

  return questions;
}

export function getInitialStudents(): Student[] {
  return [
  {
    "id": "16746",
    "name": "นายกรวีร์  คำวิเชียร",
    "class": "3/2",
    "number": 1
  },
  {
    "id": "16748",
    "name": "เด็กชายธนกร  เส็งสาลี",
    "class": "3/2",
    "number": 2
  },
  {
    "id": "16747",
    "name": "เด็กชายธนภัทร  หนาดทอง",
    "class": "3/2",
    "number": 3
  },
  {
    "id": "16749",
    "name": "เด็กชายปภังกร  เบ้าหนองบัว",
    "class": "3/2",
    "number": 4
  },
  {
    "id": "16750",
    "name": "เด็กชายพีรพล  พลชนะ",
    "class": "3/2",
    "number": 5
  },
  {
    "id": "16752",
    "name": "นายศุภฤกษ์  อุปพงษ์",
    "class": "3/2",
    "number": 6
  },
  {
    "id": "16753",
    "name": "นายศุภวิชญ์  มิ่งใจดี",
    "class": "3/2",
    "number": 7
  },
  {
    "id": "16754",
    "name": "นายสพล  สุภาพล",
    "class": "3/2",
    "number": 8
  },
  {
    "id": "16755",
    "name": "เด็กชายอดิเทพ  นนพละ",
    "class": "3/2",
    "number": 9
  },
  {
    "id": "16756",
    "name": "นางสาวกัญญาณัฐ  ปัญเศษ",
    "class": "3/2",
    "number": 10
  },
  {
    "id": "16757",
    "name": "นางสาวกัญญาณัฐ  ศรีชาดา",
    "class": "3/2",
    "number": 11
  },
  {
    "id": "16758",
    "name": "นางสาวกานต์พิชชา  วงค์คำ",
    "class": "3/2",
    "number": 12
  },
  {
    "id": "16759",
    "name": "เด็กหญิงกิติยาภรณ์  ฉิมพลี",
    "class": "3/2",
    "number": 13
  },
  {
    "id": "16760",
    "name": "นางสาวแก้วกัลยา  วรรณทอง",
    "class": "3/2",
    "number": 14
  },
  {
    "id": "16761",
    "name": "เด็กหญิงจิรภิญญา  เศษโถ",
    "class": "3/2",
    "number": 15
  },
  {
    "id": "16762",
    "name": "เด็กหญิงณิชมน  เทพคำดี",
    "class": "3/2",
    "number": 16
  },
  {
    "id": "16763",
    "name": "เด็กหญิงณุภัทรณีย์  อินทร์คำน้อย",
    "class": "3/2",
    "number": 17
  },
  {
    "id": "16764",
    "name": "นางสาวนุชนาฏ  พลเศษ",
    "class": "3/2",
    "number": 18
  },
  {
    "id": "16765",
    "name": "เด็กหญิงบุษราคัม  การพรมมา",
    "class": "3/2",
    "number": 19
  },
  {
    "id": "16766",
    "name": "เด็กหญิงปัทมภรณ์  รสหอม",
    "class": "3/2",
    "number": 20
  },
  {
    "id": "16767",
    "name": "นางสาวผ่องนภา  สาระด่วน",
    "class": "3/2",
    "number": 21
  },
  {
    "id": "16768",
    "name": "เด็กหญิงภัคจิรา  พักตะไชย",
    "class": "3/2",
    "number": 22
  },
  {
    "id": "16769",
    "name": "เด็กหญิงยิ่งลักษณ์  พวงชัย",
    "class": "3/2",
    "number": 23
  },
  {
    "id": "16770",
    "name": "เด็กหญิงยูมิชฎา  บุตรละคร",
    "class": "3/2",
    "number": 24
  },
  {
    "id": "16771",
    "name": "นางสาวศุภิสรา  มิ่งใจดี",
    "class": "3/2",
    "number": 25
  },
  {
    "id": "16772",
    "name": "เด็กหญิงศุภิสรา  ศรีเสริม",
    "class": "3/2",
    "number": 26
  },
  {
    "id": "16773",
    "name": "นางสาวสุดารัตน์  โคตะมา",
    "class": "3/2",
    "number": 27
  },
  {
    "id": "16774",
    "name": "เด็กหญิงอภิชญา  เครือคช",
    "class": "3/2",
    "number": 28
  },
  {
    "id": "16775",
    "name": "เด็กหญิงอริสรา  วรวีรยา",
    "class": "3/2",
    "number": 29
  },
  {
    "id": "16680",
    "name": "นายกิติศักดิ์  ผดุงภักดิ์",
    "class": "5/3",
    "number": 1
  },
  {
    "id": "15713",
    "name": "นายจิรกร  ลาภอุดมศักดา",
    "class": "5/3",
    "number": 2
  },
  {
    "id": "15714",
    "name": "นายชนะพงศ์  วิประชา",
    "class": "5/3",
    "number": 3
  },
  {
    "id": "15950",
    "name": "นายชาญณรงค์  แดงนา",
    "class": "5/3",
    "number": 4
  },
  {
    "id": "15715",
    "name": "นายชินวุฒิ  ศรีชัย",
    "class": "5/3",
    "number": 5
  },
  {
    "id": "15718",
    "name": "นายทวีศักดิ์  ภูแสนศรี",
    "class": "5/3",
    "number": 6
  },
  {
    "id": "15952",
    "name": "นายธนกฤต  ไวยะ",
    "class": "5/3",
    "number": 7
  },
  {
    "id": "15719",
    "name": "นายธนภัทร  นามวงษ์",
    "class": "5/3",
    "number": 8
  },
  {
    "id": "15794",
    "name": "นายธัญวิชญ์  การุญ",
    "class": "5/3",
    "number": 9
  },
  {
    "id": "15692",
    "name": "นายปิยวัฒน์  สุพร",
    "class": "5/3",
    "number": 10
  },
  {
    "id": "17587",
    "name": "นายพรหมพิริยะ  บุตรละคร",
    "class": "5/3",
    "number": 11
  },
  {
    "id": "15958",
    "name": "นายเมธาวี  โคตะบิน",
    "class": "5/3",
    "number": 12
  },
  {
    "id": "17588",
    "name": "นายวีระวัฒน์  ฤษดี",
    "class": "5/3",
    "number": 13
  },
  {
    "id": "15696",
    "name": "นายวุฒิพงศ์  เชิดชนะ",
    "class": "5/3",
    "number": 14
  },
  {
    "id": "15728",
    "name": "นายสันติสุข  แสนวิไล",
    "class": "5/3",
    "number": 15
  },
  {
    "id": "15849",
    "name": "นางสาวกันยาพัฒน์  ชมชื่น",
    "class": "5/3",
    "number": 16
  },
  {
    "id": "16707",
    "name": "นางสาวจิตติมา  ปิยะนันท์",
    "class": "5/3",
    "number": 17
  },
  {
    "id": "16175",
    "name": "นางสาวชฎารัตน์  คามราช",
    "class": "5/3",
    "number": 18
  },
  {
    "id": "15733",
    "name": "นางสาวชนกนันท์  จามรี",
    "class": "5/3",
    "number": 19
  },
  {
    "id": "15736",
    "name": "นางสาวณัฐริดา  กุลวงค์",
    "class": "5/3",
    "number": 20
  },
  {
    "id": "17589",
    "name": "นางสาวธนภรณ์  ชัยช่วย",
    "class": "5/3",
    "number": 21
  },
  {
    "id": "17590",
    "name": "นางสาวธิราพร  ทุมวัน",
    "class": "5/3",
    "number": 22
  },
  {
    "id": "15929",
    "name": "นางสาวนันท์นลิน  จันทะลุน",
    "class": "5/3",
    "number": 23
  },
  {
    "id": "15682",
    "name": "นางสาวปิยธิดา  ภูกะเดา",
    "class": "5/3",
    "number": 24
  },
  {
    "id": "17591",
    "name": "นางสาวพันธ์ชนก  ดวงเกษ",
    "class": "5/3",
    "number": 25
  },
  {
    "id": "15895",
    "name": "นางสาวภัทรวดี  อัคราช",
    "class": "5/3",
    "number": 26
  },
  {
    "id": "15684",
    "name": "นางสาวภิรัญญา  หนันคำจร",
    "class": "5/3",
    "number": 27
  },
  {
    "id": "15821",
    "name": "นางสาวมนทิรา  นาคแก้ว",
    "class": "5/3",
    "number": 28
  },
  {
    "id": "15705",
    "name": "นางสาวลภัสรดา  รัฐไสย",
    "class": "5/3",
    "number": 29
  },
  {
    "id": "15976",
    "name": "นางสาววิมลวรรณ์  อุปไชย",
    "class": "5/3",
    "number": 30
  },
  {
    "id": "17592",
    "name": "นางสาวศรสวรรค์  เสตรา",
    "class": "5/3",
    "number": 31
  },
  {
    "id": "17593",
    "name": "นางสาวศิริลักษณ์  รูปงาม",
    "class": "5/3",
    "number": 32
  },
  {
    "id": "17594",
    "name": "นางสาวศุภิศรา  ไกรพรม",
    "class": "5/3",
    "number": 33
  },
  {
    "id": "15864",
    "name": "นางสาวสิริกัญญา  สุริยะไชย",
    "class": "5/3",
    "number": 34
  },
  {
    "id": "15787",
    "name": "นางสาวสุนันทา  เงยไชย",
    "class": "5/3",
    "number": 35
  },
  {
    "id": "15791",
    "name": "นางสาวอภิสรา  เทพพิบาล",
    "class": "5/3",
    "number": 36
  },
  {
    "id": "15945",
    "name": "นายกฤตยชญ์  มานันที",
    "class": "5/5",
    "number": 1
  },
  {
    "id": "15869",
    "name": "นายกฤษกรณ์  สุภาพงษ์",
    "class": "5/5",
    "number": 2
  },
  {
    "id": "17608",
    "name": "นายกิตติพัทธ์  วงศ์อนุ",
    "class": "5/5",
    "number": 3
  },
  {
    "id": "15871",
    "name": "นายจิรานุวัฒน์  อินทะนันท์",
    "class": "5/5",
    "number": 4
  },
  {
    "id": "15872",
    "name": "นายชนะพล  จักรโสภา",
    "class": "5/5",
    "number": 5
  },
  {
    "id": "15911",
    "name": "นายฐิติกร  ชิภักดี",
    "class": "5/5",
    "number": 6
  },
  {
    "id": "17609",
    "name": "นายธนภัทร  ทัศน์จันดา",
    "class": "5/5",
    "number": 7
  },
  {
    "id": "17610",
    "name": "นายธนากร  สุพร",
    "class": "5/5",
    "number": 8
  },
  {
    "id": "15382",
    "name": "นายบุริศร์  อุ่นวิเศษ",
    "class": "5/5",
    "number": 9
  },
  {
    "id": "15762",
    "name": "นายปกรณ์  คูณเสมอ",
    "class": "5/5",
    "number": 10
  },
  {
    "id": "16678",
    "name": "นายปรกร  มากนุ้ย",
    "class": "5/5",
    "number": 11
  },
  {
    "id": "15668",
    "name": "นายปวริศ  ปาสาจะ",
    "class": "5/5",
    "number": 12
  },
  {
    "id": "17713",
    "name": "นายปัณณวิชญ์  พรมแสน",
    "class": "5/5",
    "number": 13
  },
  {
    "id": "15797",
    "name": "นายปิติศักดิ์  โคตะบิน",
    "class": "5/5",
    "number": 14
  },
  {
    "id": "15725",
    "name": "นายพีรวิชญ์  คำตลบ",
    "class": "5/5",
    "number": 15
  },
  {
    "id": "17611",
    "name": "นายวรเมธ  เปาสา",
    "class": "5/5",
    "number": 16
  },
  {
    "id": "15999",
    "name": "นางสาวกัญญาภัค  สลักศิลป์",
    "class": "5/5",
    "number": 17
  },
  {
    "id": "17612",
    "name": "นางสาวกาญจนาภรณ์  อภิบาล",
    "class": "5/5",
    "number": 18
  },
  {
    "id": "15885",
    "name": "นางสาวจิตรสุดา  ประจันทา",
    "class": "5/5",
    "number": 19
  },
  {
    "id": "16003",
    "name": "นางสาวจิราวรรณ  บุญมาก",
    "class": "5/5",
    "number": 20
  },
  {
    "id": "15926",
    "name": "นางสาวชนิกานต์  คำสุข",
    "class": "5/5",
    "number": 21
  },
  {
    "id": "17613",
    "name": "นางสาวช่อทับทิม  สกุลซ่ง",
    "class": "5/5",
    "number": 22
  },
  {
    "id": "16007",
    "name": "นางสาวณัฐธิดา  เข็มบุญ",
    "class": "5/5",
    "number": 23
  },
  {
    "id": "17614",
    "name": "นางสาวณัฐพร  เตียมไชย",
    "class": "5/5",
    "number": 24
  },
  {
    "id": "15775",
    "name": "นางสาวณิชานันท์  นามแสง",
    "class": "5/5",
    "number": 25
  },
  {
    "id": "15854",
    "name": "นางสาวพรทิวา  วงค์ษา",
    "class": "5/5",
    "number": 26
  },
  {
    "id": "17618",
    "name": "นางสาวภาวินี  แส���ศรี",
    "class": "5/5",
    "number": 27
  },
  {
    "id": "15897",
    "name": "นางสาววรรณวลี  ศรีคำบ่อ",
    "class": "5/5",
    "number": 28
  },
  {
    "id": "15748",
    "name": "นางสาวศิรินภา  ปาณาราช",
    "class": "5/5",
    "number": 29
  },
  {
    "id": "15939",
    "name": "นางสาวสุกัญญา  สกุลตาล",
    "class": "5/5",
    "number": 30
  },
  {
    "id": "16687",
    "name": "นางสาวใหม่ประวีณา  สีอภัย",
    "class": "5/5",
    "number": 31
  },
  {
    "id": "18150",
    "name": "นายภานุวัฒน์  ทองเฟื่อง",
    "class": "5/5",
    "number": 32
  },
  {
    "id": "15482",
    "name": "นายกฤษฎา  คิดค้า",
    "class": "6/3",
    "number": 1
  },
  {
    "id": "15298",
    "name": "นายกวินทร์  นวมขุนทด",
    "class": "6/3",
    "number": 2
  },
  {
    "id": "15334",
    "name": "นายก่อธรรม์  แสนโคตร",
    "class": "6/3",
    "number": 3
  },
  {
    "id": "15410",
    "name": "นายเกียรติกร  ภูทองก้าน",
    "class": "6/3",
    "number": 4
  },
  {
    "id": "17068",
    "name": "นายฐาปกรณ์  มลานวน",
    "class": "6/3",
    "number": 5
  },
  {
    "id": "15336",
    "name": "นายณภัทร  คำภูษา",
    "class": "6/3",
    "number": 6
  },
  {
    "id": "17079",
    "name": "นายณัฐวุติ  ผลตะขบ",
    "class": "6/3",
    "number": 7
  },
  {
    "id": "15229",
    "name": "นายทิวัตถ์  เทพคำดี",
    "class": "6/3",
    "number": 8
  },
  {
    "id": "15337",
    "name": "นายแทนคุณ  วงศ์ก้อม",
    "class": "6/3",
    "number": 9
  },
  {
    "id": "15195",
    "name": "นายโทมัส  โบวส์",
    "class": "6/3",
    "number": 10
  },
  {
    "id": "15301",
    "name": "นายธนกร  ศรีบัว",
    "class": "6/3",
    "number": 11
  },
  {
    "id": "17080",
    "name": "นายธนพนธ์  จงใจ",
    "class": "6/3",
    "number": 12
  },
  {
    "id": "15383",
    "name": "นายปฏิภากรณ์  เทียนศรี",
    "class": "6/3",
    "number": 13
  },
  {
    "id": "17081",
    "name": "นายปิยะวัฒน์  ดีโท",
    "class": "6/3",
    "number": 14
  },
  {
    "id": "15341",
    "name": "นายภูเมศ  สุวรรณไตรย์",
    "class": "6/3",
    "number": 15
  },
  {
    "id": "15497",
    "name": "นายวัชรพล  ฉัตรทอง",
    "class": "6/3",
    "number": 16
  },
  {
    "id": "17082",
    "name": "นายศรายุทธ  คำภา",
    "class": "6/3",
    "number": 17
  },
  {
    "id": "15312",
    "name": "นายอภิญญา  แถวเนิน",
    "class": "6/3",
    "number": 18
  },
  {
    "id": "15427",
    "name": "นางสาวเกศกนก  แสนซ้ง",
    "class": "6/3",
    "number": 19
  },
  {
    "id": "15346",
    "name": "นางสาวจิตรทิพย์  เฉลิมพงษ์",
    "class": "6/3",
    "number": 20
  },
  {
    "id": "17083",
    "name": "นางสาวชิณธ์ภัทร  หนูจะโป๊ะ",
    "class": "6/3",
    "number": 21
  },
  {
    "id": "15506",
    "name": "นางสาวณัฏฐณิชา  เม่นฉาย",
    "class": "6/3",
    "number": 22
  },
  {
    "id": "15319",
    "name": "นางสาวทิพย์เกสร  ศรีวะลา",
    "class": "6/3",
    "number": 23
  },
  {
    "id": "15349",
    "name": "นางสาวธนิศรา  อินทรสิทธิ์",
    "class": "6/3",
    "number": 24
  },
  {
    "id": "15210",
    "name": "นางสาวธัชธีรา  ชูรัตน์",
    "class": "6/3",
    "number": 25
  },
  {
    "id": "17084",
    "name": "นางสาวปวรา  บรรผนึก",
    "class": "6/3",
    "number": 26
  },
  {
    "id": "15354",
    "name": "นางสาวพรธวัล  ท้วมเจริญ",
    "class": "6/3",
    "number": 27
  },
  {
    "id": "15285",
    "name": "นางสาวพลอยวรินทร์  จันทะแสน",
    "class": "6/3",
    "number": 28
  },
  {
    "id": "17085",
    "name": "นางสาวพศิกา  รักษาบุญ",
    "class": "6/3",
    "number": 29
  },
  {
    "id": "15248",
    "name": "นางสาวพัชรพร  พรมชัย",
    "class": "6/3",
    "number": 30
  },
  {
    "id": "15355",
    "name": "นางสาวพิชญาภา  กอบการนา",
    "class": "6/3",
    "number": 31
  },
  {
    "id": "15217",
    "name": "นางสาวมณีรัตนา  ธงสันเทียะ",
    "class": "6/3",
    "number": 32
  },
  {
    "id": "15329",
    "name": "นางสาวสุชาวดี  ศรีเสริม",
    "class": "6/3",
    "number": 33
  },
  {
    "id": "17086",
    "name": "นางสาวสุธาวินี  นาถาบำรุง",
    "class": "6/3",
    "number": 34
  },
  {
    "id": "15221",
    "name": "นางสาวอนุธิดา  ราชโส",
    "class": "6/3",
    "number": 35
  },
  {
    "id": "17087",
    "name": "นางสาวอุษามณี  เงยไชย",
    "class": "6/3",
    "number": 36
  },
  {
    "id": "15408",
    "name": "นายกนก  พองผาลา",
    "class": "6/5",
    "number": 1
  },
  {
    "id": "17104",
    "name": "นายกฤษฎา  บุตรละคร",
    "class": "6/5",
    "number": 2
  },
  {
    "id": "15409",
    "name": "นายกฤษณ์  ประวรรณา",
    "class": "6/5",
    "number": 3
  },
  {
    "id": "17105",
    "name": "นายชัชวาล  ไชยโชติ",
    "class": "6/5",
    "number": 4
  },
  {
    "id": "15227",
    "name": "นายณฐกร  เทศสนั่น",
    "class": "6/5",
    "number": 5
  },
  {
    "id": "17107",
    "name": "นายธนาธิป  แสงศิริ",
    "class": "6/5",
    "number": 6
  },
  {
    "id": "15416",
    "name": "นายธีรภัทร  สียอด",
    "class": "6/5",
    "number": 7
  },
  {
    "id": "15197",
    "name": "นายธุวานนท์  ภูกะเดา",
    "class": "6/5",
    "number": 8
  },
  {
    "id": "15303",
    "name": "นายนรงเดช  ร้อยพิลา",
    "class": "6/5",
    "number": 9
  },
  {
    "id": "18122",
    "name": "นายปณชัย  พ่วงศิริ",
    "class": "6/5",
    "number": 10
  },
  {
    "id": "15235",
    "name": "นายพัฒนพงษ์  แก้วอินทร์ตา",
    "class": "6/5",
    "number": 11
  },
  {
    "id": "17695",
    "name": "นายฤทธิเดช  สุภิรมณ์",
    "class": "6/5",
    "number": 12
  },
  {
    "id": "17108",
    "name": "นายอนิรุทธ์  นาใคร",
    "class": "6/5",
    "number": 13
  },
  {
    "id": "17109",
    "name": "นายอภินันท์  โกรพิมาย",
    "class": "6/5",
    "number": 14
  },
  {
    "id": "17199",
    "name": "นางสาวกัญญานันท์  นิยมญาติ",
    "class": "6/5",
    "number": 15
  },
  {
    "id": "15315",
    "name": "นางสาวฐิติรัตน์  ตุจันโต",
    "class": "6/5",
    "number": 16
  },
  {
    "id": "16594",
    "name": "นางสาวทิพย์ฆณทา  ยศปัญญา",
    "class": "6/5",
    "number": 17
  },
  {
    "id": "17110",
    "name": "นางสาวธวีลพร  หอมแก้ว",
    "class": "6/5",
    "number": 18
  },
  {
    "id": "15353",
    "name": "นางสาวปิยธิดา  เพชราชัย",
    "class": "6/5",
    "number": 19
  },
  {
    "id": "15435",
    "name": "นางสาวเปรมฤดี  พรมสาร",
    "class": "6/5",
    "number": 20
  },
  {
    "id": "15287",
    "name": "นางสาวพันธิตรา  พานเหนือ",
    "class": "6/5",
    "number": 21
  },
  {
    "id": "15249",
    "name": "นางสาวพิชฎา  ศรีขัดเค้า",
    "class": "6/5",
    "number": 22
  },
  {
    "id": "15323",
    "name": "นางสาวพิมพ์นิภา  แสงหา",
    "class": "6/5",
    "number": 23
  },
  {
    "id": "17111",
    "name": "นางสาวมิลตรา  พรมแสนปัง",
    "class": "6/5",
    "number": 24
  },
  {
    "id": "17112",
    "name": "นางสาวลลิตา  หวังประสพกลาง",
    "class": "6/5",
    "number": 25
  },
  {
    "id": "15511",
    "name": "นางสาวศิริธร  วงสำราช",
    "class": "6/5",
    "number": 26
  },
  {
    "id": "17113",
    "name": "นางสาวศิรินทรา  บุ้งทอง",
    "class": "6/5",
    "number": 27
  },
  {
    "id": "15363",
    "name": "นางสาวศิวาพร  ภูทอง",
    "class": "6/5",
    "number": 28
  },
  {
    "id": "17114",
    "name": "นางสาวศุภาพิชญ์  สังข์ศิริ",
    "class": "6/5",
    "number": 29
  },
  {
    "id": "17115",
    "name": "นางสาวสุพัฒน์ตรา  แซ่โค้ว",
    "class": "6/5",
    "number": 30
  },
  {
    "id": "17116",
    "name": "นางสาวสุภัชชา  แก้วน้ำคำ",
    "class": "6/5",
    "number": 31
  },
  {
    "id": "17117",
    "name": "นางสาวอมลรดา  รูปเหมาะ",
    "class": "6/5",
    "number": 32
  },
  {
    "id": "17118",
    "name": "นางสาวอรจิรา  ธรรมสา",
    "class": "6/5",
    "number": 33
  },
  {
    "id": "15296",
    "name": "นางสาวอรดี  พิกุลทอง",
    "class": "6/5",
    "number": 34
  },
  {
    "id": "15258",
    "name": "นางสาวอรปรีญา  สิงห์ใหญ่",
    "class": "6/5",
    "number": 35
  },
  {
    "id": "15333",
    "name": "นางสาวไอริสา  อวยพร",
    "class": "6/5",
    "number": 36
  },
  {
    "id": "15484",
    "name": "นายณรงค์ฤทธิ์  คำหาญพล",
    "class": "6/5",
    "number": 37
  },
  {
    "id": "15446",
    "name": "นายคมเพชร  ปัญเศษ",
    "class": "6/8",
    "number": 1
  },
  {
    "id": "15224",
    "name": "นายเจษฎา  ราชโส",
    "class": "6/8",
    "number": 2
  },
  {
    "id": "17136",
    "name": "นายชญานนท์  นนยะโส",
    "class": "6/8",
    "number": 3
  },
  {
    "id": "15630",
    "name": "นายณัฏฐ์กฤตา  ประเสริฐสังข์",
    "class": "6/8",
    "number": 4
  },
  {
    "id": "15375",
    "name": "นายณัฐกร  สีแฮด",
    "class": "6/8",
    "number": 5
  },
  {
    "id": "17137",
    "name": "นายณัฐกร  อุปไชย",
    "class": "6/8",
    "number": 6
  },
  {
    "id": "15266",
    "name": "นายธนโชติ  ทาชาติ",
    "class": "6/8",
    "number": 7
  },
  {
    "id": "15379",
    "name": "นายธนวัฒน์  มีเลข",
    "class": "6/8",
    "number": 8
  },
  {
    "id": "15339",
    "name": "นายปฏิภาณ  กึ่มทอง",
    "class": "6/8",
    "number": 9
  },
  {
    "id": "17182",
    "name": "นายพีรพัฒน์  ลีลา",
    "class": "6/8",
    "number": 10
  },
  {
    "id": "15494",
    "name": "นายภาณุภัทร์  ราชโส",
    "class": "6/8",
    "number": 11
  },
  {
    "id": "15459",
    "name": "นายรัตนโชติ  พฤฒิสาร",
    "class": "6/8",
    "number": 12
  },
  {
    "id": "17138",
    "name": "นายฤทธิชัย  สมหวัง",
    "class": "6/8",
    "number": 13
  },
  {
    "id": "17202",
    "name": "นายสิทธิศาสตร์  วิโรพรม",
    "class": "6/8",
    "number": 14
  },
  {
    "id": "17140",
    "name": "นางสาวกชพรรญ  วันดี",
    "class": "6/8",
    "number": 15
  },
  {
    "id": "15501",
    "name": "นางสาวกมลชนก  ศรีหาวงค์",
    "class": "6/8",
    "number": 16
  },
  {
    "id": "15390",
    "name": "นางสาวกุลกิติพร  สายสินธุ์",
    "class": "6/8",
    "number": 17
  },
  {
    "id": "15281",
    "name": "นางสาวขวัญฤดี  ภูวิชัย",
    "class": "6/8",
    "number": 18
  },
  {
    "id": "15504",
    "name": "นางสาวชมัยพร  พัฒนา",
    "class": "6/8",
    "number": 19
  },
  {
    "id": "16134",
    "name": "นางสาวชลธิชา  จันทะสุทธิ์",
    "class": "6/8",
    "number": 20
  },
  {
    "id": "15507",
    "name": "นางสาวณ���ชารีย์  คุณสมบัตร",
    "class": "6/8",
    "number": 21
  },
  {
    "id": "15396",
    "name": "นางสาวเทวิกา  ประวิเศษ",
    "class": "6/8",
    "number": 22
  },
  {
    "id": "15245",
    "name": "นางสาวธนัชชา  พูดจา",
    "class": "6/8",
    "number": 23
  },
  {
    "id": "15467",
    "name": "นางสาวนฤชล  ศรีพันลม",
    "class": "6/8",
    "number": 24
  },
  {
    "id": "17166",
    "name": "นางสาวนันทกานต์  ทองมนต์",
    "class": "6/8",
    "number": 25
  },
  {
    "id": "17141",
    "name": "นางสาวนันทนา  ถินมา",
    "class": "6/8",
    "number": 26
  },
  {
    "id": "15321",
    "name": "นางสาวปณิตา  สว่างไธสง",
    "class": "6/8",
    "number": 27
  },
  {
    "id": "17142",
    "name": "นางสาวปุณยวีร์  ชาดี",
    "class": "6/8",
    "number": 28
  },
  {
    "id": "15471",
    "name": "นางสาวพชรกมล  ฐามณี",
    "class": "6/8",
    "number": 29
  },
  {
    "id": "15437",
    "name": "นางสาวพาขวัญ  บุตรละคร",
    "class": "6/8",
    "number": 30
  },
  {
    "id": "17143",
    "name": "นางสาวพิยะดา  การปรีชา",
    "class": "6/8",
    "number": 31
  },
  {
    "id": "15292",
    "name": "นางสาววณิชชา  รัตน์พันธ์",
    "class": "6/8",
    "number": 32
  },
  {
    "id": "15478",
    "name": "นางสาววรรณวิษา  เบิกบานดี",
    "class": "6/8",
    "number": 33
  },
  {
    "id": "15441",
    "name": "นางสาวศิริภา  บุญสิทธิ์",
    "class": "6/8",
    "number": 34
  },
  {
    "id": "15403",
    "name": "นางสาวศิริยากร  โผดนอก",
    "class": "6/8",
    "number": 35
  },
  {
    "id": "16181",
    "name": "นางสาวศิริรักษ์  พลเพชร",
    "class": "6/8",
    "number": 36
  },
  {
    "id": "17139",
    "name": "นางสาวสุกิจตา  ปิดตาระพา",
    "class": "6/8",
    "number": 37
  },
  {
    "id": "17144",
    "name": "นางสาวสุจิวรรณ  โทสวนจิตร",
    "class": "6/8",
    "number": 38
  },
  {
    "id": "15513",
    "name": "นางสาวสุพิชญา  บุโฮม",
    "class": "6/8",
    "number": 39
  },
  {
    "id": "15516",
    "name": "นางสาวสุวิชาดา  ศรีชัย",
    "class": "6/8",
    "number": 40
  },
  {
    "id": "17659",
    "name": "นางสาวโสรญา  คลี่ศรี",
    "class": "6/8",
    "number": 41
  }
];
}
