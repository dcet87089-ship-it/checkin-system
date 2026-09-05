"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserByEmail, upsertUser } from '../lib/supabase';

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [major, setMajor] = useState('วิศวกรรมคอมพิวเตอร์');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      // 1. ตรวจสอบว่ามีอีเมลนี้ในระบบแล้วหรือไม่
      const existingUser = await getUserByEmail(trimmedEmail);
      if (existingUser) {
        setErrorMessage('อีเมลนี้เคยลงทะเบียนไว้ในระบบแล้ว กรุณาไปที่หน้าเข้าสู่ระบบ');
        setLoading(false);
        return;
      }

      // 2. บันทึกผู้ใช้ใหม่ลงฐานข้อมูล Supabase (ตาราง users)
      const newUser = {
        email: trimmedEmail,
        name: name.trim(),
        userId: userId.trim(),
        role: role,
        major: major.trim() || (role === 'student' ? 'วิศวกรรมคอมพิวเตอร์' : 'อาจารย์ผู้สอน'),
      };

      const success = await upsertUser(newUser);

      if (!success) {
        setErrorMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่อีกครั้ง');
        setLoading(false);
        return;
      }

      // 3. บันทึกข้อมูลลง localStorage เพื่อจดจำเซสชัน
      localStorage.setItem(`profile_${trimmedEmail}`, JSON.stringify(newUser));
      localStorage.setItem('current_user', JSON.stringify(newUser));
      if (role === 'teacher') {
        localStorage.setItem('teacher_data', JSON.stringify(newUser));
      } else {
        localStorage.setItem('student_data', JSON.stringify(newUser));
      }
      localStorage.setItem(Object.keys(localStorage)[0] || "user", JSON.stringify(newUser));

      // 4. นำทางไปยังหน้า Dashboard ตามบทบาท
      if (role === 'teacher') {
        router.push('/dashboard/teacher');
      } else {
        router.push('/dashboard/students');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gradient-to-br from-[#1a0b2e] via-[#0d071a] to-[#040f25] relative overflow-hidden">
      
      {/* ฝัง CSS สำหรับอนิเมชันไฟวิ่ง */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin-slow {
          100% { transform: rotate(360deg); }
        }
        .animate-border-spin {
          animation: spin-slow 4s linear infinite;
        }
      `}} />

      {/* แสงตกแต่งพื้นหลัง (Ambient Glow) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00e5ff] rounded-full mix-blend-screen filter blur-[130px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#ff00a0] rounded-full mix-blend-screen filter blur-[130px] opacity-20 animate-pulse delay-1000"></div>

      {/* กรอบไฟวิ่ง (Animated Border Wrapper) */}
      <div className="relative group w-full max-w-lg rounded-[2.5rem] p-[3px] overflow-hidden shadow-[0_0_80px_rgba(0,229,255,0.2)]">
        
        {/* ตัวสีไฟวิ่ง */}
        <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_180deg,#00e5ff_240deg,#7a00ff_300deg,#ff00a0_360deg)] animate-border-spin"></div>
        
        {/* การ์ดด้านใน (Glassmorphism) */}
        <div className="relative bg-[#0d0b14]/90 backdrop-blur-2xl rounded-[calc(2.5rem-3px)] p-8 sm:p-10 w-full border border-white/5 z-10 flex flex-col items-center">
          
          <div className="text-center mb-8 w-full">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#7a00ff] to-[#ff00a0] mb-2 tracking-wider drop-shadow-[0_0_10px_rgba(0,229,255,0.4)]">
              REGISTER
            </h1>
            <p className="text-gray-400 text-sm tracking-wide">ลงทะเบียนสมาชิกใหม่เข้าสู่ระบบ CheckIn</p>
          </div>

          {/* ข้อความแจ้งเตือน Error */}
          {errorMessage && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-center animate-fadeIn">
              ⚠️ {errorMessage}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-5 w-full">
            
            {/* Toggle เลือกบทบาท (นักศึกษา / อาจารย์) */}
            <div>
              <label className="text-xs font-semibold text-gray-400 mb-2 block tracking-wider uppercase">
                เลือกประเภทผู้ใช้งาน:
              </label>
              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex-1 py-3.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
                    role === 'student' 
                      ? 'bg-gradient-to-r from-[#00e5ff] to-[#3b82f6] text-white border-transparent shadow-[0_0_20px_rgba(0,229,255,0.4)] scale-[1.02]' 
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                  }`}
                >
                  <span>🧑‍🎓</span> นักศึกษา
                </button>
                <button 
                  type="button"
                  onClick={() => setRole('teacher')}
                  className={`flex-1 py-3.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
                    role === 'teacher' 
                      ? 'bg-gradient-to-r from-[#ff00a0] to-[#7a00ff] text-white border-transparent shadow-[0_0_20px_rgba(255,0,160,0.4)] scale-[1.02]' 
                      : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-white/30'
                  }`}
                >
                  <span>👨‍🏫</span> อาจารย์
                </button>
              </div>
            </div>

            {/* Email */}
            <div className="relative">
              <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                อีเมล (Email)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500">📧</span>
                </div>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="w-full bg-white/5 border border-white/10 text-white rounded-2xl pl-12 pr-6 py-3.5 focus:outline-none focus:border-[#00e5ff] focus:bg-white/10 transition-all placeholder-gray-500 text-sm shadow-inner"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Name */}
            <div className="relative">
              <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                ชื่อ-นามสกุล
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500">👤</span>
                </div>
                <input 
                  type="text" 
                  placeholder={role === 'teacher' ? "ดร. สมชาย ใจดี" : "นายสมศักดิ์ ขยันเรียน"} 
                  className="w-full bg-white/5 border border-white/10 text-white rounded-2xl pl-12 pr-6 py-3.5 focus:outline-none focus:border-[#00e5ff] focus:bg-white/10 transition-all placeholder-gray-500 text-sm"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* User ID */}
            <div className="relative">
              <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                {role === 'teacher' ? "รหัสประจำตัวบุคลากร / อาจารย์" : "รหัสนักศึกษา"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500">🆔</span>
                </div>
                <input 
                  type="text" 
                  placeholder={role === 'teacher' ? "T1001" : "66010001"} 
                  className="w-full bg-white/5 border border-white/10 text-white rounded-2xl pl-12 pr-6 py-3.5 focus:outline-none focus:border-[#00e5ff] focus:bg-white/10 transition-all placeholder-gray-500 text-sm"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Major / Department */}
            <div className="relative">
              <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                {role === 'teacher' ? "ภาควิชา / คณะ" : "สาขาวิชา"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500">🏛️</span>
                </div>
                <input 
                  type="text" 
                  placeholder="เช่น วิศวกรรมคอมพิวเตอร์, เทคโนโลยีสารสนเทศ" 
                  className="w-full bg-white/5 border border-white/10 text-white rounded-2xl pl-12 pr-6 py-3.5 focus:outline-none focus:border-[#00e5ff] focus:bg-white/10 transition-all placeholder-gray-500 text-sm"
                  value={major}
                  onChange={(e) => setMajor(e.target.value)}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full font-black py-4 rounded-2xl transition-all duration-300 shadow-lg transform hover:-translate-y-0.5 text-sm uppercase tracking-wider mt-4 ${
                role === 'teacher'
                  ? 'bg-gradient-to-r from-[#ff00a0] to-[#7a00ff] text-white shadow-[0_0_25px_rgba(255,0,160,0.4)] hover:shadow-[0_0_35px_rgba(255,0,160,0.6)]'
                  : 'bg-gradient-to-r from-[#00e5ff] to-[#3b82f6] text-white shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.6)]'
              } disabled:opacity-50`}
            >
              {loading ? "กำลังลงทะเบียน..." : `ลงทะเบียนเป็น${role === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}`}
            </button>
          </form>

          {/* ลิงก์กลับหน้า Login */}
          <div className="mt-8 text-center border-t border-white/10 pt-6 w-full">
            <p className="text-gray-400 text-sm">
              มีบัญชีผู้ใช้อยู่แล้ว?{' '}
              <Link 
                href="/" 
                className="text-[#00e5ff] font-bold hover:underline transition-all inline-flex items-center gap-1 ml-1"
              >
                เข้าสู่ระบบ (Login) →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

