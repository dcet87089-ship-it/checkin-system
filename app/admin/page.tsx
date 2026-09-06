
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  AlertCircle, ShieldAlert, LogOut, RefreshCw, Users, Database, 
  Trash2, Edit, Power, Activity, Server, History, PlaySquare, X, Download
} from 'lucide-react';
import { 
  getActiveRooms, getAllHistory, getAllUsers,
  deleteUser, upsertUser, deleteRoom, deleteHistory,
  isSupabaseConfigured, RoomRecord, HistoryRecord, UserProfile
} from '../lib/supabase';
import { downloadCSV } from '../lib/csvHelper';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'rooms' | 'history'>('overview');
  
  const [activeRooms, setActiveRooms] = useState<RoomRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);
  const [userList, setUserList] = useState<UserProfile[]>([]);
  const [configured, setConfigured] = useState(true);

  // Edit Modal State
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ name: '', userId: '', role: 'student' });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [roomsData, historyData, usersData] = await Promise.all([
        getActiveRooms(),
        getAllHistory(),
        getAllUsers()
      ]);
      setActiveRooms(roomsData || []);
      setHistoryRecords(historyData || []);
      setUserList(usersData || []);
      setConfigured(isSupabaseConfigured());
    } catch (error) {
      console.error("Error fetching admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const adminStr = localStorage.getItem('current_user');
    if (!adminStr) {
      router.push('/');
      return;
    }
    const admin = JSON.parse(adminStr);
    if (admin.role !== 'admin') {
      router.push('/');
      return;
    }
    fetchAdminData();
  }, [router]);

  
  
  const handleExportHistory = () => {
    const headers = ["วันที่เวลา", "รหัสวิชา", "ชื่อวิชา", "อาจารย์ผู้สอน", "รหัสห้อง"];
    const rows = historyRecords.map(h => [new Date(h.timestamp).toLocaleString('th-TH'), h.courseCode, h.courseName, h.teacherName, h.id]);
    downloadCSV("checkin_history_export", headers, rows);
  };

  const handleExportUsers = () => {
    const headers = ["อีเมล", "ชื่อ-นามสกุล", "รหัสประจำตัว", "บทบาท"];
    const rows = userList.map(u => [u.email, u.name, u.userId, u.role === 'teacher' ? 'อาจารย์' : 'นักศึกษา']);
    downloadCSV("checkin_users_export", headers, rows);
  };

  const handleLogout = () => {
    localStorage.removeItem('current_user');
    router.push('/');
  };

  const handleDeleteUser = async (email: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้ใช้ ${email}?`)) return;
    setActionLoading(true);
    const success = await deleteUser(email);
    if (success) await fetchAdminData();
    else alert("เกิดข้อผิดพลาดในการลบผู้ใช้");
    setActionLoading(false);
  };

  const handleSaveEditUser = async () => {
    if (!editUser) return;
    setActionLoading(true);
    const updatedUser = { 
      ...editUser, 
      ...editForm, 
      role: editForm.role as 'teacher' | 'student' | 'admin' 
    };
    const success = await upsertUser(updatedUser);
    if (success) {
      setEditUser(null);
      await fetchAdminData();
    } else {
      alert("เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
    }
    setActionLoading(false);
  };

  const handleForceCloseRoom = async (roomCode: string) => {
    if (!confirm(`คุณต้องการบังคับปิดห้อง ${roomCode} ใช่หรือไม่?`)) return;
    setActionLoading(true);
    const success = await deleteRoom(roomCode);
    if (success) await fetchAdminData();
    else alert("เกิดข้อผิดพลาดในการปิดห้อง");
    setActionLoading(false);
  };

  const handleDeleteHistory = async (id: string) => {
    if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบประวัติคลาสนี้?`)) return;
    setActionLoading(true);
    const success = await deleteHistory(id);
    if (success) await fetchAdminData();
    else alert("เกิดข้อผิดพลาดในการลบประวัติ");
    setActionLoading(false);
  };

  if (loading && userList.length === 0) {
    return (
      <div className="min-h-screen bg-[#05000a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05000a] text-gray-200 font-sans selection:bg-rose-900/50 flex">
      {/* Sidebar - Deep God Mode Theme */}
      <aside className="w-72 bg-[#0a0510] border-r border-rose-900/30 flex flex-col relative z-10 shadow-[0_0_30px_rgba(225,29,72,0.1)]">
        <div className="p-8 border-b border-rose-900/30 bg-gradient-to-b from-rose-950/20 to-transparent">
          <h1 className="text-3xl font-black text-rose-500 tracking-wider flex items-center gap-3 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]">
            <ShieldAlert className="w-8 h-8" />
            GOD MODE
          </h1>
          <p className="text-rose-400/50 text-xs mt-2 uppercase tracking-[0.2em] font-bold">Absolute Control</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'overview' 
                ? 'bg-rose-600/10 text-rose-400 border border-rose-500/30 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]' 
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <Activity className="w-5 h-5" /> ภาพรวมระบบ
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'users' 
                ? 'bg-rose-600/10 text-rose-400 border border-rose-500/30 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]' 
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <Users className="w-5 h-5" /> ผู้ใช้งาน ({userList.length})
          </button>

          <button 
            onClick={() => setActiveTab('rooms')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'rooms' 
                ? 'bg-rose-600/10 text-rose-400 border border-rose-500/30 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]' 
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <PlaySquare className="w-5 h-5" /> ห้องสด ({activeRooms.length})
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-6 py-4 rounded-xl text-sm font-bold transition-all ${
              activeTab === 'history' 
                ? 'bg-rose-600/10 text-rose-400 border border-rose-500/30 shadow-[inset_0_0_20px_rgba(225,29,72,0.1)]' 
                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            <History className="w-5 h-5" /> ประวัติคลาส ({historyRecords.length})
          </button>
        </nav>

        <div className="p-4 mt-auto border-t border-rose-900/30">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-gray-400 hover:bg-rose-950 hover:text-rose-400 transition-colors"
          >
            <Power className="w-4 h-4" /> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10 h-screen overflow-y-auto relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="animate-fadeIn space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-4xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">ระบบควบคุมหลัก (Main Terminal)</h2>
                <p className="text-gray-400 mt-2">ศูนย์กลางการควบคุมระบบ CheckIn ทั้งหมด</p>
              </div>
              <button onClick={() => fetchAdminData()} className="bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-400 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center shadow-[0_0_15px_rgba(225,29,72,0.2)]">
                <RefreshCw className="w-4 h-4 mr-2" /> ซิงค์ข้อมูลล่าสุด
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div className="bg-[#0f0714] border border-rose-900/40 p-8 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.8)]"></div>
                <Database className="w-8 h-8 text-emerald-500/30 absolute right-4 top-4 group-hover:scale-110 transition-transform" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Live Rooms</p>
                <p className="text-5xl font-black text-white">{activeRooms.length} <span className="text-lg text-emerald-500 font-bold ml-1">Active</span></p>
              </div>
              
              <div className="bg-[#0f0714] border border-rose-900/40 p-8 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.8)]"></div>
                <History className="w-8 h-8 text-blue-500/30 absolute right-4 top-4 group-hover:scale-110 transition-transform" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Total History</p>
                <p className="text-5xl font-black text-white">{historyRecords.length} <span className="text-lg text-blue-500 font-bold ml-1">Records</span></p>
              </div>

              <div className="bg-[#0f0714] border border-rose-900/40 p-8 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.8)]"></div>
                <Users className="w-8 h-8 text-purple-500/30 absolute right-4 top-4 group-hover:scale-110 transition-transform" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Total Users</p>
                <p className="text-5xl font-black text-white">{userList.length} <span className="text-lg text-purple-500 font-bold ml-1">Users</span></p>
              </div>

              <div className="bg-[#0f0714] border border-rose-900/40 p-8 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.05)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.8)]"></div>
                <Server className="w-8 h-8 text-rose-500/30 absolute right-4 top-4 group-hover:scale-110 transition-transform" />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3">Database Core</p>
                <p className="text-2xl font-black text-rose-400 mt-2 flex items-center gap-3">
                  <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping"></span> ONLINE
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-end">
<h2 className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">จัดการผู้ใช้งาน (User Management)</h2>
            <button onClick={handleExportUsers} className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center shadow-[0_0_15px_rgba(16,185,129,0.2)] ml-auto">
              <Download className="w-4 h-4 mr-2" /> ส่งออกข้อมูล (CSV)
            </button>
</div>
            <div className="bg-[#0f0714] border border-rose-900/40 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.02)] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#160a1d] text-rose-400 text-xs uppercase tracking-widest border-b border-rose-900/30">
                  <tr>
                    <th className="p-5 font-bold">อีเมล (Email)</th>
                    <th className="p-5 font-bold">ชื่อ - นามสกุล</th>
                    <th className="p-5 font-bold">รหัสประจำตัว</th>
                    <th className="p-5 font-bold text-center">บทบาท</th>
                    <th className="p-5 font-bold text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-900/20">
                  {userList.map((user) => (
                    <tr key={user.email} className="hover:bg-white/5 transition-colors group">
                      <td className="p-5 font-mono text-gray-300 text-sm">{user.email}</td>
                      <td className="p-5 font-bold text-white">{user.name}</td>
                      <td className="p-5 text-gray-400 font-mono text-sm">{user.userId}</td>
                      <td className="p-5 text-center">
                        <span className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${user.role === 'teacher' ? 'bg-purple-900/40 text-purple-400 border border-purple-500/30' : 'bg-blue-900/40 text-blue-400 border border-blue-500/30'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-5 text-center space-x-3">
                        <button onClick={() => { setEditUser(user); setEditForm({ name: user.name, userId: user.userId, role: user.role }); }} className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteUser(user.email)} disabled={actionLoading} className="p-2 rounded-lg bg-rose-950/50 text-rose-500 hover:bg-rose-600 hover:text-white transition-colors border border-transparent hover:border-rose-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rooms Tab */}
        {activeTab === 'rooms' && (
          <div className="animate-fadeIn space-y-6">
            <h2 className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">ห้องเรียนสด (Active Rooms)</h2>
            <div className="bg-[#0f0714] border border-rose-900/40 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.02)] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#160a1d] text-rose-400 text-xs uppercase tracking-widest border-b border-rose-900/30">
                  <tr>
                    <th className="p-5 font-bold">รหัสห้อง (Join Code)</th>
                    <th className="p-5 font-bold">วิชา</th>
                    <th className="p-5 font-bold">อาจารย์ผู้สอน</th>
                    <th className="p-5 font-bold text-center">นศ. (คน)</th>
                    <th className="p-5 font-bold text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-900/20">
                  {activeRooms.map((room) => (
                    <tr key={room.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-5 font-black text-emerald-400 text-lg tracking-widest">{room.id}</td>
                      <td className="p-5">
                        <p className="font-bold text-white">{room.settings?.courseCode}</p>
                        <p className="text-xs text-gray-400 mt-1">{room.settings?.name}</p>
                      </td>
                      <td className="p-5 text-gray-300 font-medium">{room.settings?.teacherName}</td>
                      <td className="p-5 text-center font-bold text-xl text-blue-400">{room.students?.length || 0}</td>
                      <td className="p-5 text-center">
                        <button onClick={() => handleForceCloseRoom(room.id)} disabled={actionLoading} className="px-4 py-2 rounded-lg bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(225,29,72,0.2)]">
                          Force Close
                        </button>
                      </td>
                    </tr>
                  ))}
                  {activeRooms.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-10 text-center text-gray-500 font-medium">ไม่มีห้องเรียนที่กำลังเปิดสอน</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="animate-fadeIn space-y-6">
            <div className="flex justify-between items-end">
<h2 className="text-3xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">ประวัติคลาส (History Records)</h2>
            <button onClick={handleExportHistory} className="bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-400 px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center shadow-[0_0_15px_rgba(16,185,129,0.2)] ml-auto">
              <Download className="w-4 h-4 mr-2" /> ส่งออกประวัติ (CSV)
            </button>
</div>
            <div className="bg-[#0f0714] border border-rose-900/40 rounded-2xl shadow-[inset_0_0_30px_rgba(225,29,72,0.02)] overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-[#160a1d] text-rose-400 text-xs uppercase tracking-widest border-b border-rose-900/30">
                  <tr>
                    <th className="p-5 font-bold">วันที่ / เวลา</th>
                    <th className="p-5 font-bold">วิชา</th>
                    <th className="p-5 font-bold">อาจารย์ผู้สอน</th>
                    <th className="p-5 font-bold text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-900/20">
                  {historyRecords.map((rec) => (
                    <tr key={rec.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-5">
                        <p className="font-bold text-white">{rec.dateStr}</p>
                        <p className="text-xs text-gray-400 mt-1">{new Date(rec.timestamp).toLocaleString('th-TH')}</p>
                      </td>
                      <td className="p-5 font-bold text-blue-400">{rec.courseCode}</td>
                      <td className="p-5 text-gray-300">{rec.teacherName}</td>
                      <td className="p-5 text-center">
                        <button onClick={() => handleDeleteHistory(rec.id)} disabled={actionLoading} className="p-2 rounded-lg bg-rose-950/50 text-rose-500 hover:bg-rose-600 hover:text-white transition-colors border border-transparent hover:border-rose-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {historyRecords.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-gray-500 font-medium">ไม่มีประวัติการสอน</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-[#0f0714] border border-rose-900/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(225,29,72,0.15)] w-full max-w-md animate-scaleIn">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-white">แก้ไขข้อมูลผู้ใช้</h3>
                <button onClick={() => setEditUser(null)} className="text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 block">อีเมล</label>
                  <input type="text" value={editUser.email} disabled className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 text-gray-500 font-mono text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 block">ชื่อ-นามสกุล</label>
                  <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="w-full bg-white/5 border border-rose-900/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-colors font-bold" />
                </div>
                <div>
                  <label className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 block">รหัสประจำตัว</label>
                  <input type="text" value={editForm.userId} onChange={e => setEditForm({...editForm, userId: e.target.value})} className="w-full bg-white/5 border border-rose-900/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-colors font-mono" />
                </div>
                <div>
                  <label className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 block">บทบาท</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} className="w-full bg-[#160a1d] border border-rose-900/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-colors font-bold appearance-none">
                    <option value="student">นักศึกษา (Student)</option>
                    <option value="teacher">อาจารย์ (Teacher)</option>
                  </select>
                </div>
                <div className="pt-4 flex gap-4">
                  <button onClick={() => setEditUser(null)} className="flex-1 py-3 rounded-xl bg-gray-800 text-white font-bold hover:bg-gray-700 transition-colors">ยกเลิก</button>
                  <button onClick={handleSaveEditUser} disabled={actionLoading} className="flex-1 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-500 transition-colors shadow-[0_0_20px_rgba(225,29,72,0.4)]">บันทึก</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
