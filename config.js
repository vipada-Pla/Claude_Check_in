/**
 * ตั้งค่าการเชื่อมต่อ Supabase (ฐานข้อมูล + ระบบล็อกอิน)
 * - SUPABASE_KEY คือ "publishable key" — เปิดเผยบนเว็บได้ ปลอดภัยเพราะสิทธิ์คุมด้วย RLS ในฐานข้อมูล
 * - ห้ามนำ service_role / secret key มาใส่ไฟล์นี้เด็ดขาด
 */
window.ATTENDANCE_CONFIG = {
  SUPABASE_URL: "https://sfbugtozxknimwfksszb.supabase.co",
  SUPABASE_KEY: "sb_publishable_Ttuqyc55GQv5LxsMRGX3zQ_pSNvD42j",
  ADMIN_EMAIL:  "vipada@foodlenoodle.com",   // บัญชี Gmail/Google Workspace ของผู้ดูแล
  VERSION: "2.0.0",
  GITHUB_REPO: "vipada-Pla/Claude_Check_in"
};
