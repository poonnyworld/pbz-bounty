# ป้องกันการชี้ Database ผิด (คะแนน Honor Point หาย)

เคยเกิดเหตุการณ์รันบอทบนเครื่อง Local แต่ `.env` ชี้ไปที่ MongoDB คนละที่ (หรือใช้ DB ชื่อเดียวกับของจริง) ทำให้ข้อมูลที่อ้างอิงกับ MongoDB บน VPS หายหรือผิดไป

## กฎที่ต้องทำตาม

1. **รันบน Local (Mac):**
   - ใช้ **database คนละชื่อ** กับของจริง เช่น `honorbot_test` ไม่ใช่ `honorbot`
   - ตัวอย่าง: `MONGO_URI=mongodb://127.0.0.1:27017/honorbot_test`
   - ถ้า MongoDB อยู่บน VPS อยู่แล้ว **ห้าม** ใส่ connection string ของ VPS ลงใน `.env` ที่ใช้รันบนเครื่อง Local (ยกเว้นจะตั้งใจเชื่อมไปทดสอบจริงและรับความเสี่ยงเอง)

2. **รันบน VPS (production):**
   - ใช้ `MONGO_URI` ที่ชี้ไปที่ MongoDB จริงบน VPS (หรือที่ใช้กับ production)
   - ตัวอย่าง: `MONGO_URI=mongodb://127.0.0.1:27017/honorbot`

3. **แยกไฟล์ env กันชัดเจน:**
   - Local: ใช้ `.env.local` หรือ `.env` ที่มี `MONGO_URI` ชี้ไปที่ **honorbot_test** (หรือ MongoDB ทดสอบอื่น) เท่านั้น
   - VPS: ใช้ `.env` บน VPS ที่มี `MONGO_URI` ชี้ไปที่ **honorbot** (จริง) เท่านั้น
   - อย่า copy `.env` จาก VPS มาวางบนเครื่อง Local แล้วรันบอทโดยไม่แก้ `MONGO_URI` เป็น DB ทดสอบ

## Checklist ก่อนรันบนเครื่อง Local

- [ ] `MONGO_URI` ชี้ไปที่ MongoDB ที่รันบนเครื่องตัวเอง (หรือ Docker บนเครื่อง)
- [ ] ชื่อ database เป็น **honorbot_test** (หรือชื่ออื่นที่ไม่ใช่ `honorbot` ที่ใช้บน VPS)
- [ ] ไม่ได้ copy เอา connection string ของ MongoDB บน VPS มาใส่ใน `.env` ที่ใช้รัน Local
