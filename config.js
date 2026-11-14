/**
 * ตั้งค่าการเชื่อมต่อ Google Sheets
 * วาง "Web app URL" ที่ได้จาก Apps Script (ลงท้ายด้วย /exec) ไว้ในเครื่องหมายคำพูดด้านล่าง
 * ถ้าเว้นว่าง หน้าเว็บจะทำงานแบบ "เครื่องเดียว" (บันทึกในเบราว์เซอร์ ไม่ส่งเข้า Google Sheet)
 */
window.ATTENDANCE_CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbz6zIK6IObV8xjg-so9EcbNedXyMrdg2JPd1NANrF3UMduVC5ljOMYqWcD-l1SrCg9s/exec",
  REFRESH_SECONDS: 15,  // ดึงข้อมูลล่าสุดจาก Google Sheet ทุกกี่วินาที
  GITHUB_REPO: "vipada-Pla/Claude_Check_in"   // ใช้แสดงลิงก์และวันที่อัปเดตล่าสุดจาก GitHub
};
