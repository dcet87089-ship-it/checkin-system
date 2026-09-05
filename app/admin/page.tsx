"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// === นำเข้า Firebase ===
import { db, auth } from '../lib/firebase'; // Path ถอย 1 ขั้น เพราะไฟล์อยู่ app/admin/page.tsx
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { signOut } from 'firebase/auth';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  
  // State เก็บข้อมูลสถิติ
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);

  useEffect(() => {
    // ฟังก์ชันดึงข้อมูลจาก Firebase
    const fetchAdminData = async () => {
      try {
        // 1. ดึงข้อมูลห้องเรียนที่กำลังเปิดอยู่
        const roomsSnap = await getDocs(collection(db, "rooms"));
        const roomsData = roomsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActiveRooms(roomsData);

        // 2. ดึงประวัติการเรียนทั้งหมด
        const historyQuery = query(collection(db, "history"), orderBy("timestamp", "desc"));
        const historySnap = await getDocs(historyQuery);
        const historyData = historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setHistoryRecords(historyData);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0b0f19] text-emerald-400 flex items-center justify-center font-bold text-xl">กำลังโหลดระบบหลังบ้าน...</div>;

  return (
    <div className="flex min-h-screen bg-[#0b0f19] text-white font-sans">
      
      {/* แถบเมนูด้านซ้าย (Sidebar) */}
      <div className="w-64 bg-[#151923] p-6 border-r border-[#1e2233] flex flex-col shadow-2xl z-10">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]">Admin</h1>
          <p className="text-gray-400 text-xs mt-2">CheckIn System Control</p>
        </div>
        
        <div className="space-y-4 flex-1">
          <button className="w-full text-left p-4 rounded-2xl font-bold bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)] flex items-center gap-3 transition-all">
            <span>📊</span> ภาพรวมระบบ
          </button>
          <button className="w-full text-left p-4 rounded-2xl font-bold text-gray-400 hover:bg-[#1c212d] hover:text-white flex items-center gap-3 transition-all">
            <span>👥</span> จัดการผู้ใช้
          </button>
        </div>

        <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 text-left p-4 rounded-2xl transition-all text-sm font-bold flex items-center gap-3">
          <span>🚪</span> ออกจากระบบ
        </button>
      </div>

      {/* พื้นที่เนื้อหาหลัก (Main Content) */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-3xl font-bold text-white">ภาพรวมระบบ (Dashboard)</h2>
          <button onClick={() => window.location.reload()} className="bg-[#1c212d] hover:bg-emerald-600 border border-[#1e2233] px-6 py-2 rounded-xl text-sm font-bold transition-all">
            🔄 รีเฟรชข้อมูล
          </button>
        </div>

        {/* การ์ดสรุปสถิติ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-[#151923] border border-[#1e2233] p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
            <p className="text-gray-400 text-sm font-medium mb-2">ห้องเรียนที่กำลังเปิดสอน</p>
            <p className="text-5xl font-black text-white">{activeRooms.length} <span className="text-lg text-gray-500 font-normal">ห้อง</span></p>
          </div>
          
          <div className="bg-[#151923] border border-[#1e2233] p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <p className="text-gray-400 text-sm font-medium mb-2">ประวัติคลาสเรียนทั้งหมด</p>
            <p className="text-5xl font-black text-white">{historyRecords.length} <span className="text-lg text-gray-500 font-normal">คลาส</span></p>
          </div>

          <div className="bg-[#151923] border border-[#1e2233] p-8 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
            <p className="text-gray-400 text-sm font-medium mb-2">สถานะเซิร์ฟเวอร์ (Firebase)</p>
            <p className="text-3xl font-bold text-emerald-400 mt-2 flex items-center gap-2">
              <span className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse"></span> ปกติ
            </p>
          </div>
        </div>

        {/* ตารางแสดงห้องเรียนที่กำลัง Live */}
        <div className="bg-[#151923] border border-[#1e2233] rounded-3xl shadow-xl overflow-hidden mb-8">
          <div className="p-6 border-b border-[#1e2233] bg-[#1c212d]">
            <h3 className="text-xl font-bold text-emerald-400">🔴 คลาสเรียนที่กำลังเปิดอยู่ตอนนี้</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#151923] text-gray-400 text-sm border-b border-[#1e2233]">
                <tr>
                  <th className="p-5 font-semibold">รหัสห้อง (Join Code)</th>
                  <th className="p-5 font-semibold">วิชา</th>
                  <th className="p-5 font-semibold">อาจารย์ผู้สอน</th>
                  <th className="p-5 font-semibold text-center">นักศึกษา (คน)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2233]">
                {activeRooms.length > 0 ? (
                  activeRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-[#1c212d] transition-colors">
                      <td className="p-5 font-bold text-emerald-400 text-lg tracking-widest">{room.id}</td>
                      <td className="p-5">
                        <p className="font-bold text-white">{room.settings?.courseCode}</p>
                        <p className="text-sm text-gray-400">{room.settings?.name}</p>
                      </td>
                      <td className="p-5 text-gray-300">{room.settings?.teacherName}</td>
                      <td className="p-5 text-center font-bold text-blue-400">{room.students?.length || 0}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-10 text-center text-gray-500">
                      ไม่มีห้องเรียนที่กำลังเปิดสอนในขณะนี้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}