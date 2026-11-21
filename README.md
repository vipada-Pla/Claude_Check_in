# ระบบเช็คชื่อ Claude AI Class · v2.0.0

เว็บเช็คชื่อผู้เข้าเรียน ใช้ได้ทั้งคอม แท็บเล็ต และมือถือ
ผู้เรียนกด **เช็คชื่อ** → เซ็นชื่อ → **Approve** ระบบบันทึก **เวลา (จากเซิร์ฟเวอร์) + สถานะ ตรงเวลา/สาย + ลายเซ็น** ลง **Supabase** และทุกเครื่องเห็นผลทันที

```
หน้าเว็บ (GitHub Pages)  ──►  Supabase (ฐานข้อมูล Postgres + ระบบล็อกอิน + Realtime)
```

## ไฟล์ในโปรเจกต์

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `index.html` | หน้าเช็คชื่อ (ผู้เรียนใช้หน้านี้) |
| `login.html` | หน้าเข้าสู่ระบบผู้ดูแล (Google / ลิงก์ทางอีเมล) |
| `config.js` | URL + publishable key ของ Supabase และอีเมลผู้ดูแล |
| `supabase-schema.sql` | สร้างตาราง + สิทธิ์ (RLS) — รันครั้งเดียวใน Supabase SQL Editor |
| `roster-template.csv` | ตัวอย่างไฟล์รายชื่อสำหรับนำเข้า |

> ⚠️ ห้ามใส่ไฟล์รายชื่อจริง หรือ `service_role` / secret key ลงใน GitHub
> `SUPABASE_KEY` ใน `config.js` เป็น *publishable key* เปิดเผยได้ เพราะสิทธิ์ถูกคุมด้วย RLS ในฐานข้อมูล

## ใครทำอะไรได้

| | ผู้เรียน (ไม่ต้องล็อกอิน) | ผู้ดูแล (vipada@foodlenoodle.com) |
|---|---|---|
| ดูรายชื่อ/หน่วยงาน, สถานะเช็คชื่อ | ✅ | ✅ |
| เช็คชื่อ + เซ็น | ✅ เฉพาะวันนี้ | ✅ เลือกวันได้ |
| ดูลายเซ็น / เบอร์โทร / อีเมล | ❌ | ✅ |
| นำเข้า/แก้ไข/ลบรายชื่อ, ตั้งค่าคลาส, ล้างข้อมูล, ดาวน์โหลด Excel | ❌ | ✅ |

เพิ่มผู้ดูแลคนอื่น: Supabase → Table Editor → ตาราง `admins` → Insert แถวใหม่ใส่อีเมล

## ตั้งค่าล็อกอินด้วย Google (ครั้งเดียว)

1. **Google Cloud Console** → APIs & Services → Credentials → *Create OAuth client ID* → ประเภท **Web application**
   - Authorized redirect URI: `https://sfbugtozxknimwfksszb.supabase.co/auth/v1/callback`
2. **Supabase** → Authentication → Sign In / Providers → **Google** → เปิด แล้ววาง Client ID + Client Secret → Save
3. **Supabase** → Authentication → URL Configuration
   - Site URL: `https://vipada-pla.github.io/Claude_Check_in/`
   - Redirect URLs: เพิ่ม `https://vipada-pla.github.io/Claude_Check_in/login.html`

ระหว่างยังไม่ตั้ง Google ใช้ปุ่ม **"ส่งลิงก์เข้าสู่ระบบ"** (ลิงก์ทางอีเมล) แทนได้ทันที

## วิธีใช้ในห้องเรียน

1. เปิด https://vipada-pla.github.io/Claude_Check_in/ บนแท็บเล็ต/คอมหน้าห้อง หรือแชร์ลิงก์/QR ให้ผู้เรียน
2. ผู้เรียนค้นหาชื่อตัวเอง → **เช็คชื่อ** → เซ็น → **Approve**
3. ผู้ดูแลกด **🔒 เข้าสู่ระบบผู้ดูแล** (ท้ายหน้า) → ดูลายเซ็น, แก้รายชื่อ, **ดาวน์โหลด Excel** หลังจบคลาส
