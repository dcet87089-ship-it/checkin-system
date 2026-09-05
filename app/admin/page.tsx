"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  getActiveRooms, 
  getAllHistory, 
  getAllUsers,
  subscribeToHistory, 
  isSupabaseConfigured,
  RoomRecord,
  HistoryRecord,
  UserProfile
} from '../lib/supabase';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  
  // State เก็บข้อมูลสถิติ
  const [activeRooms, setActiveRooms] = useState<RoomRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [configured, setConfigured] = useState(true);

  const fetchAdminData = async () => {
    try {
      const [roomsData, historyData, usersData] = await Promise.all([
        getActiveRooms(),
        getAllHistory(),
        getAllUsers(),
      ]);
      setActiveRooms(roomsData);
      setHistoryRecords(historyData);
      setUserList(usersData);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    fetchAdminData();

    // ฟังการเปลี่ยนแปลงประวัติแบบ Realtime
    const unsubscribeHistory = subscribeToHistory(() => {
      fetchAdminData();
    });

    return () => {
      unsubscribeHistory();
    };
  }, []);

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
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
          <button 
            onClick={() => setActiveTab('overview')} 
            className={`w-full text-left p-4 rounded-2xl font-bold flex items-center gap-3 transition-all ${activeTab === 'overview' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)]' : 'text-gray-400 hover:bg-[#1c212d] hover:text-white'}`}
          >
            <span>📊</span> ภาพรวมระบบ
          </button>
          <button 
            onClick={() => setActiveTab('users')} 
            className={`w-full text-left p-4 rounded-2xl font-bold flex items-center gap-3 transition-all ${activeTab === 'users' ? 'bg-emerald-600 text-white shadow-[0_0_15px_rgba(5,150,105,0.4)]' : 'text-gray-400 hover:bg-[#1c212d] hover:text-white'}`}
          >
            <span>👥</span> จัดการผู้ใช้ ({userList.length})
          </button>
        </div>

        <button onClick={handleLogout} className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 text-left p-4 rounded-2xl transition-all text-sm font-bold flex items-center gap-3">
          <span>🚪</span> ออกจากระบบ
        </button>
      </div>

      {/* พื้นที่เนื้อหาหลัก (Main Content) */}
      <div className="flex-1 p-10 overflow-y-auto">
        {!configured && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm flex items-center justify-between">
            <span>⚠️ <strong>คำแนะนำ:</strong> ยังไม่ได้ตั้งค่า Supabase URL หรือ Anon Key ในไฟล์ <code>.env.local</code></span>
          </div>
        )}

        {/* Tab 1: ภาพรวมระบบ */}
        {activeTab === 'overview' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-bold text-white">ภาพรวมระบบ (Dashboard)</h2>
              <button onClick={() => fetchAdminData()} className="bg-[#1c212d] hover:bg-emerald-600 border border-[#1e2233] px-6 py-2 rounded-xl text-sm font-bold transition-all">
                🔄 รีเฟรชข้อมูล
              </button>
            </div>

            {/* การ์ดสรุปสถิติ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
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
                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                <p className="text-gray-400 text-sm font-medium mb-2">ผู้ใช้งานในระบบ (Supabase)</p>
                <p className="text-5xl font-black text-white">{userList.length} <span className="text-lg text-gray-500 font-normal">คน</span></p>
              </div>

              <div className="bg-[#151923] border border-[#1e2233] p-8 rounded-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <p className="text-gray-400 text-sm font-medium mb-2">สถานะเซิร์ฟเวอร์ (Supabase)</p>
                <p className="text-3xl font-bold text-emerald-400 mt-2 flex items-center gap-2">
                  <span className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse"></span> {configured ? "เชื่อมต่อแล้ว" : "รอตั้งค่า Key"}
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
        )}

        {/* Tab 2: จัดการผู้ใช้ */}
        {activeTab === 'users' && (
          <div className="animate-fadeIn">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h2 className="text-3xl font-bold text-white">จัดการผู้ใช้งานในระบบ (Users)</h2>
                <p className="text-gray-400 text-sm mt-1">ข้อมูลผู้ใช้ที่บันทึกลงฐานข้อมูล Supabase ตาราง <code>users</code></p>
              </div>
              <button onClick={() => fetchAdminData()} className="bg-[#1c212d] hover:bg-emerald-600 border border-[#1e2233] px-6 py-2 rounded-xl text-sm font-bold transition-all">
                🔄 รีเฟรชข้อมูล
              </button>
            </div>

            <div className="bg-[#151923] border border-[#1e2233] rounded-3xl shadow-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#1c212d] text-gray-400 text-sm border-b border-[#1e2233]">
                    <tr>
                      <th className="p-5 font-semibold">อีเมล (Email)</th>
                      <th className="p-5 font-semibold">ชื่อ - นามสกุล</th>
                      <th className="p-5 font-semibold">รหัสประจำตัว</th>
                      <th className="p-5 font-semibold text-center">บทบาท (Role)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2233]">
                    {userList.length > 0 ? (
                      userList.map((user) => (
                        <tr key={user.email} className="hover:bg-[#1c212d] transition-colors">
                          <td className="p-5 font-mono text-emerald-400 text-sm">{user.email}</td>
                          <td className="p-5 font-bold text-white">{user.name}</td>
                          <td className="p-5 text-gray-300 font-mono">{user.userId}</td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${user.role === 'teacher' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                              {user.role === 'teacher' ? 'อาจารย์' : 'นักศึกษา'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-gray-500">
                          ยังไม่มีผู้ใช้ลงทะเบียนในฐานข้อมูล Supabase (ตาราง <code>users</code>)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}