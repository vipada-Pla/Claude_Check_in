/**
 * ตั้งค่าการเชื่อมต่อ Google Sheets
 * วาง "Web app URL" ที่ได้จาก Apps Script (ลงท้ายด้วย /exec) ไว้ในเครื่องหมายคำพูดด้านล่าง
 * ถ้าเว้นว่าง หน้าเว็บจะทำงานแบบ "เครื่องเดียว" (บันทึกในเบราว์เซอร์ ไม่ส่งเข้า Google Sheet)
 */
window.ATTENDANCE_CONFIG = {
  APPS_SCRIPT_URL: "",
  REFRESH_SECONDS: 15   // ดึงข้อมูลล่าสุดจาก Google Sheet ทุกกี่วินาที
};
