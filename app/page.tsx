"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUserByEmail } from './lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [userPreview, setUserPreview] = useState<{ name: string; role: string } | null>(null);

  // ตรวจสอบอีเมลเมื่อผู้ใช้พิมพ์เสร็จหรือกดออกจากช่อง (Blur)
  const handleEmailBlur = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setUserPreview(null);
      setErrorMessage('');
      return;
    }

    try {
      const user = await getUserByEmail(trimmed);
      if (user) {
        setUserPreview({ name: user.name, role: user.role });
        setErrorMessage('');
      } else {
        setUserPreview(null);
        setErrorMessage('ไม่พบอีเมลนี้ในระบบ (ต้องลงทะเบียนก่อนจึงจะเข้าใช้งานได้)');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const trimmedEmail = email.trim().toLowerCase();

    try {
      // ตรวจสอบกับฐานข้อมูล Supabase ตาราง users โดยตรง
      const user = await getUserByEmail(trimmedEmail);

      if (!user) {
        setErrorMessage('❌ ไม่พบอีเมลนี้ในฐานข้อมูล! เฉพาะผู้ที่ลงทะเบียนแล้วเท่านั้นจึงจะเข้าใช้งานได้');
        setUserPreview(null);
        setLoading(false);
        return;
      }

      // พบผู้ใช้ในฐานข้อมูลจริง -> บันทึกข้อมูลเซสชัน
      localStorage.setItem(`profile_${trimmedEmail}`, JSON.stringify(user));
      localStorage.setItem('current_user', JSON.stringify(user));
      
      if (user.role === 'teacher') {
        localStorage.setItem('teacher_data', JSON.stringify(user));
        router.push('/dashboard/teacher');
      } else {
        localStorage.setItem('student_data', JSON.stringify(user));
        router.push('/dashboard/students');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage('เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 font-sans bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] relative overflow-hidden">
      
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
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7a00ff] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse delay-1000"></div>

      {/* กรอบไฟวิ่ง (Animated Border Wrapper) */}
      <div className="relative group w-full max-w-md rounded-[2.5rem] p-[3px] overflow-hidden shadow-[0_0_80px_rgba(122,0,255,0.2)]">
        
        {/* ตัวสีไฟวิ่ง */}
        <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_180deg,#ff00a0_240deg,#7a00ff_300deg,#00e5ff_360deg)] animate-border-spin"></div>
        
        {/* การ์ดด้านใน (Glassmorphism) */}
        <div className="relative bg-[#0d0b14]/90 backdrop-blur-2xl rounded-[calc(2.5rem-3px)] p-10 w-full border border-white/5 z-10 flex flex-col items-center">
          
          <div className="text-center mb-8 w-full">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#7a00ff] to-[#ff00a0] mb-3 tracking-wider drop-shadow-[0_0_10px_rgba(255,0,160,0.5)]">
              CheckIn
            </h1>
            <p className="text-gray-400 text-sm tracking-wide">เข้าสู่ระบบเช็คชื่อเข้าเรียน (GPS & Supabase)</p>
          </div>

          {/* กล่องแสดงผลเมื่อพบผู้ใช้ในระบบ */}
          {userPreview && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center animate-fadeIn">
              <p className="text-xs text-emerald-400 font-bold">✅ พบบัญชีในฐานข้อมูล</p>
              <p className="text-white font-bold text-lg mt-1">{userPreview.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                สถานะ: <span className="text-[#00e5ff] font-bold">{userPreview.role === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}</span>
              </p>
            </div>
          )}

          {/* กล่องแจ้งเตือนเมื่อไม่พบบัญชี */}
          {errorMessage && (
            <div className="w-full mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center animate-fadeIn leading-relaxed">
              {errorMessage}
              <div className="mt-2">
                <Link 
                  href="/register" 
                  className="inline-block text-[#00e5ff] font-bold underline hover:text-white transition-colors"
                >
                  👉 คลิกที่นี่เพื่อลงทะเบียนใหม่
                </Link>
              </div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6 w-full">
            
            {/* Input Email */}
            <div className="relative">
              <label className="text-xs font-semibold text-gray-400 mb-1.5 block">
                อีเมลที่ลงทะเบียนไว้ในระบบ (Registered Email)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500">📧</span>
                </div>
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="w-full bg-white/5 border border-white/10 text-white rounded-full pl-12 pr-6 py-4 focus:outline-none focus:border-[#00e5ff] focus:bg-white/10 transition-all placeholder-gray-500 shadow-inner text-sm"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage('');
                  }}
                  onBlur={handleEmailBlur}
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-white text-[#0d0b14] hover:bg-gray-200 font-extrabold py-4 rounded-full transition-all duration-300 shadow-[0_6px_0_0_#9ca3af,0_15px_30px_rgba(255,255,255,0.2)] hover:shadow-[0_8px_0_0_#9ca3af,0_15px_40px_rgba(255,255,255,0.3)] active:translate-y-2 active:shadow-[0_0px_0_0_#9ca3af,0_0px_0px_rgba(255,255,255,0)] transform hover:-translate-y-1 disabled:opacity-50 tracking-wider"
            >
              {loading ? "กำลังเข้าสู่ระบบ..." : "LOGIN"}
            </button>
          </form>

          {/* ลิงก์ไปหน้า Register */}
          <div className="mt-8 text-center border-t border-white/10 pt-6 w-full">
            <p className="text-gray-400 text-sm">
              ยังไม่มีบัญชีในระบบ?{' '}
              <Link 
                href="/register" 
                className="text-[#00e5ff] font-bold hover:underline transition-all inline-flex items-center gap-1 ml-1"
              >
                สมัครสมาชิกใหม่ (Register) →
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}