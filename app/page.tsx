"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  
  // State สำหรับเช็คว่าเคยล็อกอินด้วยอีเมลนี้หรือยัง
  const [isKnownUser, setIsKnownUser] = useState(false);

  // ฟังก์ชันเช็คอีเมลแบบ Real-time
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputEmail = e.target.value;
    setEmail(inputEmail);

    // ค้นหาประวัติในเครื่อง
    const savedProfile = localStorage.getItem(`profile_${inputEmail}`);
    if (savedProfile) {
      const parsed = JSON.parse(savedProfile);
      setName(parsed.name);
      setUserId(parsed.userId);
      setRole(parsed.role);
      setIsKnownUser(true);
    } else {
      setIsKnownUser(false);
      // ถ้าเป็นอีเมลใหม่ ให้เคลียร์ข้อมูลเก่าที่อาจค้างอยู่
      if (isKnownUser) {
        setName('');
        setUserId('');
      }
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const userData = { email, name, userId, role };
    
    // บันทึกโปรไฟล์ผูกกับอีเมลนี้ถาวรในเครื่อง
    localStorage.setItem(`profile_${email}`, JSON.stringify(userData));
    
    // เซ็ตข้อมูลเซสชันปัจจุบันส่งให้หน้า Dashboard
    localStorage.setItem('teacher_data', JSON.stringify(userData));
    localStorage.setItem(Object.keys(localStorage)[0] || "user", JSON.stringify(userData)); 
    
    if (role === 'teacher') {
      router.push('/dashboard/teacher');
    } else {
      router.push('/dashboard/students');
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
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7a00ff] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#00e5ff] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse delay-1000"></div>

      {/* กรอบไฟวิ่ง (Animated Border Wrapper) */}
      <div className="relative group w-full max-w-md rounded-[2.5rem] p-[3px] overflow-hidden shadow-[0_0_80px_rgba(122,0,255,0.2)]">
        
        {/* ตัวสีไฟวิ่ง */}
        <div className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0_180deg,#ff00a0_240deg,#7a00ff_300deg,#00e5ff_360deg)] animate-border-spin"></div>
        
        {/* การ์ดด้านใน (Glassmorphism) */}
        <div className="relative bg-[#0d0b14]/90 backdrop-blur-2xl rounded-[calc(2.5rem-3px)] p-10 w-full border border-white/5 z-10 flex flex-col items-center">
          
          <div className="text-center mb-10 w-full">
            <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#7a00ff] to-[#ff00a0] mb-3 tracking-wider drop-shadow-[0_0_10px_rgba(255,0,160,0.5)]">
              CheckIn
            </h1>
            <p className="text-gray-400 text-sm tracking-wide">ระบบเช็คชื่อเข้าเรียนด้วย GPS</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 w-full">
            
            {/* Input Email */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-500">📧</span>
              </div>
              <input 
                type="email" 
                placeholder="Username or Email" 
                className="w-full bg-white/5 border border-white/10 text-white rounded-full pl-12 pr-6 py-4 focus:outline-none focus:border-[#7a00ff] focus:bg-white/10 transition-all placeholder-gray-500 shadow-inner"
                value={email}
                onChange={handleEmailChange}
                required
              />
            </div>

            {/* ระบบแสดงผลเงื่อนไข (รู้จำผู้ใช้) */}
            {isKnownUser ? (
              <div className="bg-white/5 border border-[#7a00ff]/30 rounded-3xl p-6 text-center animate-fadeIn shadow-[0_0_20px_rgba(122,0,255,0.1)]">
                <p className="text-[#00e5ff] font-bold mb-2">👋 ยินดีต้อนรับกลับมา!</p>
                <p className="text-white text-lg font-black">{name}</p>
                <p className="text-gray-400 text-sm mt-1">
                  เข้าสู่ระบบในฐานะ: <span className="text-[#ff00a0]">{role === 'teacher' ? 'อาจารย์ผู้สอน' : 'นักศึกษา'}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-6 animate-fadeIn">
                {/* Toggle ปุ่มเลือกสถานะ */}
                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={() => setRole('teacher')}
                    className={`flex-1 py-4 rounded-full font-bold transition-all duration-500 border ${
                      role === 'teacher' 
                        ? 'bg-gradient-to-r from-[#ff00a0] to-[#7a00ff] text-white border-transparent shadow-[0_0_20px_rgba(255,0,160,0.4)]' 
                        : 'bg-transparent text-gray-500 border-white/10 hover:text-white hover:border-white/30'
                    }`}
                  >
                    อาจารย์
                  </button>
                  <button 
                    type="button"
                    onClick={() => setRole('student')}
                    className={`flex-1 py-4 rounded-full font-bold transition-all duration-500 border ${
                      role === 'student' 
                        ? 'bg-gradient-to-r from-[#00e5ff] to-[#3b82f6] text-white border-transparent shadow-[0_0_20px_rgba(0,229,255,0.4)]' 
                        : 'bg-transparent text-gray-500 border-white/10 hover:text-white hover:border-white/30'
                    }`}
                  >
                    นักศึกษา
                  </button>
                </div>

                {/* Name */}
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="ชื่อ-นามสกุล" 
                    className="w-full bg-white/5 border border-white/10 text-white rounded-full px-6 py-4 focus:outline-none focus:border-[#00e5ff] transition-all placeholder-gray-500"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                {/* User ID */}
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder={role === 'teacher' ? "รหัสประจำตัวบุคลากร" : "รหัสนักศึกษา"} 
                    className="w-full bg-white/5 border border-white/10 text-white rounded-full px-6 py-4 focus:outline-none focus:border-[#00e5ff] transition-all placeholder-gray-500"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="w-full bg-white text-[#0d0b14] hover:bg-gray-200 font-extrabold py-4 rounded-full transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:shadow-[0_0_50px_rgba(255,255,255,0.5)] transform hover:-translate-y-1"
            >
              LOGIN
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}