"use client";
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeCanvas } from 'qrcode.react'; 

// === นำเข้า Supabase ===
import { 
  createRoom, 
  updateRoom, 
  deleteRoom, 
  getRoom, 
  getAllHistory, 
  addHistory, 
  deleteHistory, 
  subscribeToRoom, 
  subscribeToHistory,
  getCoursesByTeacher,
  addCourse,
  deleteCourse,
  isSupabaseConfigured,
  HistoryRecord,
  StudentData,
  ChatMessage
} from '../../lib/supabase';

export default function TeacherDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  
  const [activeMenu, setActiveMenu] = useState<'home' | 'add' | 'stats'>('home');

  const [savedCourses, setSavedCourses] = useState<any[]>([]);
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([]);

  // State: ตั้งค่าห้องเรียน
  const [setupCourse, setSetupCourse] = useState<{code: string, name: string} | null>(null);
  const [autoSessionNum, setAutoSessionNum] = useState<number>(1);
  const [maxStudents, setMaxStudents] = useState("40");
  const [classDuration, setClassDuration] = useState("60");

  // State: ห้องเรียน Live
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [isRoomActive, setIsRoomActive] = useState(false);
  const [teacherLocation, setTeacherLocation] = useState({ lat: 0, lng: 0 });
  const [showQRModal, setShowQRModal] = useState(false);
  const [roomEndTime, setRoomEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [currentStudents, setCurrentStudents] = useState<StudentData[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State: หน้าสถิติ
  const [selectedStatsCourse, setSelectedStatsCourse] = useState<string | null>(null);
  const [selectedSessionView, setSelectedSessionView] = useState<string>('all');
  const [configured, setConfigured] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const requestTeacherGPS = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        alert("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับ GPS");
        setGpsStatus('denied');
        resolve(null);
        return;
      }
      setGpsStatus('requesting');

      let isDone = false;

      // ขั้นที่ 1: ขอพิกัดความแม่นยำสูง (ดาวเทียม) ภายใน 6 วินาที
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isDone) return;
          isDone = true;
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setTeacherLocation(loc);
          setGpsAccuracy(Math.round(pos.coords.accuracy));
          setGpsStatus('ready');
          resolve(loc);
        },
        (err) => {
          if (isDone) return;
          if (err.code === 1) { // PERMISSION_DENIED
            isDone = true;
            setGpsStatus('denied');
            alert("⚠️ อาจารย์ยังไม่ได้อนุญาตการเข้าถึงตำแหน่ง GPS\n\nวิธีกดอนุญาตในเบราว์เซอร์:\n📱 บน Safari (iPhone/iPad): แตะปุ่ม 'aA' ด้านล่างหรือบนแถบ URL > การตั้งค่าเว็บไซต์ > ตำแหน่งที่ตั้ง > เลือก 'อนุญาต (Allow)'\n📱 บน Chrome: แตะไอคอนแม่กุญแจ 🔒 ข้าง URL > สิทธิ์ > ตำแหน่ง > เลือก 'อนุญาต (Allow)'");
            resolve(null);
            return;
          }

          // ขั้นที่ 2: ถ้าดาวเทียมในอาคาร Timeout ให้ดึงพิกัดจาก Cell Tower / WiFi ทันที
          console.warn("Teacher high accuracy GPS timeout, trying cell/wifi network...", err.message);
          navigator.geolocation.getCurrentPosition(
            (fallbackPos) => {
              if (isDone) return;
              isDone = true;
              const loc = { lat: fallbackPos.coords.latitude, lng: fallbackPos.coords.longitude };
              setTeacherLocation(loc);
              setGpsAccuracy(Math.round(fallbackPos.coords.accuracy));
              setGpsStatus('ready');
              resolve(loc);
            },
            (fallbackErr) => {
              if (isDone) return;
              isDone = true;
              console.error("Teacher GPS failed completely:", fallbackErr.message);
              setGpsStatus('denied');
              alert("⚠️ ไม่สามารถรับตำแหน่ง GPS ได้ในขณะนี้ กรุณาเปิด 'Location' ในอุปกรณ์แล้วกดใหม่อีกครั้ง");
              resolve(null);
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
          );
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
      );
    });
  };

  const fetchMyHistory = useCallback(async (teacherName: string) => {
    if (!teacherName) return;
    try {
      const records = await getAllHistory();
      const myRecords = records.filter(r => r.teacherName === teacherName);
      setHistoryRecords(myRecords);
    } catch (err) {
      console.error("Error loading history:", err);
    }
  }, []);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    const storedData = localStorage.getItem('teacher_data');
    let teacherUser: any = null;
    if (storedData) {
      teacherUser = JSON.parse(storedData);
      if (teacherUser.role !== 'teacher') {
        router.push('/');
        return;
      }
      setUserData(teacherUser);
    } else {
      router.push('/');
      return;
    }
    
    const teacherIdentifier = teacherUser?.userId || teacherUser?.email || teacherUser?.name || 'teacher';
    getCoursesByTeacher(teacherIdentifier).then((dbCourses) => {
      if (dbCourses && dbCourses.length > 0) {
        setSavedCourses(dbCourses);
        localStorage.setItem('teacher_saved_courses', JSON.stringify(dbCourses));
      } else {
        const loadedCourses = JSON.parse(localStorage.getItem('teacher_saved_courses') || "[]");
        setSavedCourses(loadedCourses);
        loadedCourses.forEach((c: any) => addCourse({ code: c.code, name: c.name, teacherId: teacherIdentifier }));
      }
    });
    setLoading(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setTeacherLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log("กำลังหาพิกัด GPS...", err),
        { enableHighAccuracy: true }
      );
    }

    if (teacherUser?.name) {
      fetchMyHistory(teacherUser.name);
    }

    const unsubscribeHistory = subscribeToHistory(() => {
      if (teacherUser?.name) {
        fetchMyHistory(teacherUser.name);
      }
    });

    return () => {
      unsubscribeHistory();
    };
  }, [fetchMyHistory]);

  const playAlertSound = () => {
    try {
      if (typeof window === "undefined") return;
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // Audio context might be restricted before first interaction
    }
  };

  // === ดักฟังข้อมูลห้องเรียนแบบ Live ผ่าน Supabase Realtime ===
  useEffect(() => {
    if (isRoomActive && roomCode) {
      // ดึงสถานะปัจจุบันครั้งแรก
      getRoom(roomCode).then((room) => {
        if (room) {
          setCurrentStudents(room.students || []);
          setChatMessages(room.chat || []);
          setPinnedMessage(room.settings?.pinnedMessage || null);
        }
      });

      // สมัครรับการอัปเดตแบบ Realtime
      const unsubscribe = subscribeToRoom(
        roomCode,
        (room) => {
          const newStudents: StudentData[] = room.students || [];
          // ตรวจสอบว่ามีนักศึกษาคนใดเพิ่งปิด GPS หรือไม่
          const newlyDisabled = newStudents.filter(
            (ns) => ns.gpsActive === false || ns.status === 'ปิด GPS' || (!ns.lat && !ns.lng)
          );
          if (newlyDisabled.length > 0) {
            playAlertSound();
          }

          setCurrentStudents(newStudents);
          setChatMessages(room.chat || []);
          setPinnedMessage(room.settings?.pinnedMessage || null);
        },
        () => {
          alert("ห้องเรียนถูกปิดแล้ว");
          setIsRoomActive(false);
          setRoomCode(null);
        }
      );

      return () => unsubscribe();
    }
  }, [isRoomActive, roomCode]);

  // === นับเวลาถอยหลังยุบห้องอัตโนมัติ ===
  useEffect(() => {
    if (!isRoomActive || !roomEndTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = roomEndTime - now;
      if (distance <= 0) {
        clearInterval(interval);
        setTimeLeft(0);
        handleEndClass(true);
      } else {
        setTimeLeft(Math.floor(distance / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRoomActive, roomEndTime]);

  // === ฟังก์ชันเลือกวิชาเพื่อเปิดสอน (คำนวณรอบอัตโนมัติ) ===
  const handleSelectCourseToOpen = (course: any) => {
    setSetupCourse(course);
    const pastSessions = historyRecords.filter(r => r.courseCode === course.code);
    const maxNum = pastSessions.reduce((max, r) => Math.max(max, parseInt(r.sessionNum || "0")), 0);
    setAutoSessionNum(maxNum + 1);
  };

  // === ฟังก์ชันเปิดห้อง ===
  const handleStartClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupCourse) return;
    
    let currentLoc = teacherLocation;
    if (currentLoc.lat === 0) {
      const loc = await requestTeacherGPS();
      if (!loc || loc.lat === 0) {
        alert("⚠️ ต้องอนุญาตการเข้าถึงตำแหน่ง GPS ของอาจารย์ก่อนเปิดห้องเรียน เพื่อใช้เป็นจุดอ้างอิงเทียบระยะห่างของนักศึกษา (กรุณากด 'อนุญาต / Allow' การเข้าถึงพิกัดในเบราว์เซอร์)");
        return;
      }
      currentLoc = loc;
    }

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    const durationMs = parseInt(classDuration) * 60 * 1000;
    const endTime = new Date().getTime() + durationMs;
    const startTimeStr = new Date().toISOString();
    
    try {
      const success = await createRoom({
        id: newCode,
        settings: {
          courseCode: setupCourse.code,
          name: setupCourse.name,
          joinCode: newCode,
          teacherName: userData?.name || "อาจารย์",
          startTime: startTimeStr,
          sessionNum: autoSessionNum.toString(),
          maxStudents: parseInt(maxStudents),
          durationMinutes: parseInt(classDuration),
          endTime,
          pinnedMessage: null
        },
        teacherLocation: teacherLocation,
        students: [],
        chat: [{ 
          sender: "System", 
          text: `เริ่มต้นคาบเรียนใหม่: สอนครั้งที่ ${autoSessionNum} | จำกัด ${maxStudents} คน | เวลา ${classDuration} นาที`, 
          time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          type: "text"
        }]
      });

      if (success) {
        setRoomCode(newCode);
        setRoomEndTime(endTime);
        setIsRoomActive(true);
        setShowQRModal(true); 
      } else {
        alert("เกิดข้อผิดพลาดในการเปิดคลาส กรุณาตรวจสอบการเชื่อมต่อ Supabase");
      }
    } catch (error) {
      console.error("Error creating room:", error);
      alert("เกิดข้อผิดพลาดในการเปิดคลาส");
    }
  };

  // === ฟังก์ชันยุบห้อง ===
  const handleEndClass = async (isAutoClose = false) => {
    if (!roomCode || !setupCourse) return;
    if (!isAutoClose) {
      const confirmEnd = window.confirm("คุณต้องการยุบห้องเรียนและบันทึกสถิติใช่หรือไม่?");
      if (!confirmEnd) return;
    } else {
      alert("หมดเวลาเรียน! ระบบทำการยุบห้องอัตโนมัติ");
    }

    try {
      const historyData = {
        courseCode: setupCourse.code,
        courseName: setupCourse.name,
        teacherName: userData?.name || "อาจารย์",
        timestamp: new Date().toISOString(),
        dateStr: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }),
        studentsData: currentStudents,
        sessionNum: autoSessionNum.toString(),
        teacherLocation: teacherLocation,
      };

      await addHistory(historyData);
      await deleteRoom(roomCode);

      setRoomCode(null);
      setIsRoomActive(false);
      setSetupCourse(null);
      setCurrentStudents([]);
      setChatMessages([]);
      setRoomEndTime(null);
      setShowQRModal(false);

      if (userData?.name) {
        fetchMyHistory(userData.name);
      }
    } catch (error) {
      console.error("Error ending class:", error);
      alert("เกิดข้อผิดพลาดในการปิดคลาส");
    }
  };

  // === ฟังก์ชันลบประวัติการสอน ===
  const handleDeleteHistory = async (recordId: string) => {
    if (window.confirm("คุณแน่ใจหรือไม่ว่าต้องการลบประวัติการสอนครั้งนี้?\n(การลบจะไม่สามารถกู้คืนได้ และเลขรอบจะถูกรีเซ็ตใหม่)")) {
      try {
        await deleteHistory(recordId);
        alert("ลบประวัติสำเร็จ");
        if (userData?.name) {
          fetchMyHistory(userData.name);
        }
      } catch (error) {
        console.error("Error deleting history:", error);
        alert("เกิดข้อผิดพลาดในการลบประวัติ");
      }
    }
  };

  // === ฟังก์ชันแชท & ไฟล์ ===
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chatInput.trim() === "" || !roomCode) return;
    const newMsg: ChatMessage = { 
      sender: "อาจารย์", 
      text: chatInput, 
      time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), 
      type: "text" 
    };
    const updated = [...chatMessages, newMsg];
    setChatMessages(updated);
    await updateRoom(roomCode, { chat: updated });
    setChatInput("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomCode) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const newMsg: ChatMessage = { 
        sender: "อาจารย์", 
        text: "ส่งรูปภาพ", 
        imageUrl: reader.result as string, 
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), 
        type: "image" 
      };
      const updated = [...chatMessages, newMsg];
      setChatMessages(updated);
      await updateRoom(roomCode, { chat: updated });
    };
    reader.readAsDataURL(file);
  };

  const handlePinMessage = async (text: string) => {
    if (!roomCode || !setupCourse) return;
    setPinnedMessage(text || null);
    await updateRoom(roomCode, {
      settings: {
        courseCode: setupCourse.code,
        name: setupCourse.name,
        joinCode: roomCode,
        teacherName: userData?.name || "อาจารย์",
        sessionNum: autoSessionNum.toString(),
        pinnedMessage: text || null,
      }
    });
  };

  const handleKickStudent = async (studentId: string) => {
    if (!roomCode) return;
    const updatedStudents = currentStudents.filter(s => s.studentId !== studentId);
    setCurrentStudents(updatedStudents);
    await updateRoom(roomCode, { students: updatedStudents });
  };

  const handleSaveCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem("newCourseCode") as HTMLInputElement).value;
    const name = (form.elements.namedItem("newCourseName") as HTMLInputElement).value;
    if (code && name) {
      const teacherIdentifier = userData?.userId || userData?.email || userData?.name || 'teacher';
      const added = await addCourse({ code, name, teacherId: teacherIdentifier });
      const newCourse = added || { id: Date.now().toString(), code, name, teacherId: teacherIdentifier };
      const updatedCourses = [...savedCourses, newCourse];
      setSavedCourses(updatedCourses);
      localStorage.setItem('teacher_saved_courses', JSON.stringify(updatedCourses));
      form.reset();
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    await deleteCourse(courseId);
    const updated = savedCourses.filter(c => c.id !== courseId);
    setSavedCourses(updated);
    localStorage.setItem('teacher_saved_courses', JSON.stringify(updated));
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push('/');
  };

  const calculateDistance = (lat1?: number, lon1?: number, lat2?: number, lon2?: number) => {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 0;
    if (lat1 === 0 && lon1 === 0 && lat2 === 0 && lon2 === 0) return 0;
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const formatDuration = (totalSeconds?: number) => {
    if (!totalSeconds || totalSeconds <= 0) return "0 นาที";
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs} วิ`;
    return `${mins} นาที ${secs} วิ`;
  };

  const getGroupedCourses = () => {
    const map = new Map();
    historyRecords.forEach(r => {
      if (!map.has(r.courseCode)) {
        map.set(r.courseCode, { code: r.courseCode, name: r.courseName, records: [] });
      }
      map.get(r.courseCode).records.push(r);
    });
    return Array.from(map.values());
  };

  const getCurrentCourseStats = () => {
    if (!selectedStatsCourse) return { sessions: [], students: [] };
    const courseRecords = historyRecords.filter(r => r.courseCode === selectedStatsCourse);
    const stdMap = new Map();
    courseRecords.forEach(rec => {
      rec.studentsData?.forEach((std: any) => {
        if (!stdMap.has(std.studentId)) {
          stdMap.set(std.studentId, { id: std.studentId, name: std.name });
        }
      });
    });
    const allStudents = Array.from(stdMap.values()).sort((a: any, b: any) => a.id.localeCompare(b.id));
    return { sessions: courseRecords, students: allStudents };
  };

  const calculateMinutesInClass = (joinTimeStr?: string, classEndIso?: string) => {
    if (!joinTimeStr || !classEndIso) return 0;
    const [joinH, joinM] = joinTimeStr.split(':').map(Number);
    const endDate = new Date(classEndIso);
    const joinDate = new Date(classEndIso);
    joinDate.setHours(joinH, joinM, 0, 0);
    const diffMs = endDate.getTime() - joinDate.getTime();
    const mins = Math.floor(diffMs / 60000);
    return mins > 0 ? mins : 0;
  };

  if (loading) return <div className="min-h-screen bg-[#11141c] text-white flex justify-center items-center">กำลังโหลด...</div>;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-cosmic animate-gradient-bg relative overflow-hidden text-white font-sans relative">
      
      
      {/* 🔮 Ultra Holographic Ambient Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#00e5ff] rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-pulse-glow pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-[#7a00ff] rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-pulse-glow pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 w-[400px] h-[400px] bg-[#ff00a0] rounded-full mix-blend-screen filter blur-[180px] opacity-20 animate-pulse-glow pointer-events-none" style={{ animationDelay: '4s' }}></div>
      
      {/* 🌌 Animated Stars / Particles overlay */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none mix-blend-screen"></div>
{/* Mobile Top Header (สำหรับสมาร์ทโฟนและแท็บเล็ต) */}
      <header className="md:hidden glass-panel border-b border-white/20 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">👨‍🏫</span>
          <div>
            <h1 className="text-base font-black text-blue-400 leading-tight">CheckIn Teacher</h1>
            <p className="text-[11px] text-gray-400 leading-none">{userData?.name || "อาจารย์ผู้สอน"}</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={handleLogout}
          className="text-xs bg-[#1c2130] hover:bg-rose-900/40 border border-[#2a3041] hover:border-rose-500/50 text-gray-300 hover:text-rose-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-semibold"
        >
          <span>🚪</span> ออกจากระบบ
        </button>
      </header>

      {showQRModal && isRoomActive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#1a1f2e] p-6 sm:p-10 rounded-3xl border border-[#2a3041] shadow-2xl text-center relative max-w-sm w-full">
            <button onClick={() => setShowQRModal(false)} className="absolute top-4 right-6 text-gray-400 hover:text-white text-2xl font-bold">✕</button>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">สแกนเพื่อเข้าเรียน</h2>
            <p className="text-blue-400 font-bold mb-6">{setupCourse?.code}</p>
            <div className="bg-white p-4 sm:p-6 rounded-2xl inline-block shadow-lg mb-6">
              <QRCodeCanvas value={`CheckIn-${roomCode}`} size={180} />
            </div>
            <p className="text-gray-400 text-sm mb-1">รหัสเข้าร่วมห้องเรียน</p>
            <p className="text-4xl sm:text-5xl font-black tracking-widest text-blue-400">{roomCode}</p>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (จอคอมพิวเตอร์และ iPad แนวนอน) */}
      <aside className="hidden md:flex md:w-64 bg-[#161a26] flex-col border-r border-[#232938] z-10 shadow-xl shrink-0">
        <div className="p-6 border-b border-[#232938]">
          <h1 className="text-xl font-bold text-blue-400">เมนูการจัดการ</h1>
          <p className="text-xs text-gray-400 mt-1">{userData?.name || "อาจารย์"}</p>
        </div>
        <div className="flex-1 p-4 space-y-2">
          <button onClick={() => { setActiveMenu('home'); setSelectedStatsCourse(null); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all ${activeMenu === 'home' ? 'btn-holographic text-white shadow-lg' : 'text-gray-400 hover:bg-[#202636] hover:text-white'}`}>
            <span>🏠</span> หน้าแรก (ห้องเรียน)
          </button>
          <button onClick={() => { setActiveMenu('add'); setSelectedStatsCourse(null); }} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all ${activeMenu === 'add' ? 'btn-holographic text-white shadow-lg' : 'text-gray-400 hover:bg-[#202636] hover:text-white'}`}>
            <span>📚</span> เพิ่มรายวิชา
          </button>
          <button onClick={() => setActiveMenu('stats')} className={`w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all ${activeMenu === 'stats' ? 'btn-holographic text-white shadow-lg' : 'text-gray-400 hover:bg-[#202636] hover:text-white'}`}>
            <span>📊</span> สถิติการเข้าเรียน
          </button>
        </div>
        <div className="p-4 border-t border-[#232938]">
          <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-gray-300 hover:text-red-400 transition-colors text-sm font-medium flex items-center gap-2">
            <span>🚪</span> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (แถบเมนูล่างสำหรับมือถือ/แท็บเล็ต) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#161a26]/95 backdrop-blur-lg border-t border-[#232938] flex justify-around items-center py-2 px-3 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => { setActiveMenu('home'); setSelectedStatsCourse(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'home'
              ? 'text-blue-400 font-bold bg-blue-600/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">🏠</span>
          <span className="text-[11px] mt-1">ห้องเรียน</span>
        </button>
        <button
          type="button"
          onClick={() => { setActiveMenu('add'); setSelectedStatsCourse(null); }}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'add'
              ? 'text-blue-400 font-bold bg-blue-600/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">📚</span>
          <span className="text-[11px] mt-1">เพิ่มรายวิชา</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMenu('stats')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'stats'
              ? 'text-blue-400 font-bold bg-blue-600/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">📊</span>
          <span className="text-[11px] mt-1">สถิติ</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen md:h-screen overflow-y-auto pb-24 md:pb-0">
        {!configured && (
          <div className="bg-amber-500/20 border-b border-amber-500/40 p-3 px-6 text-amber-300 text-xs flex justify-between items-center">
            <span>⚠️ <strong>คำแนะนำ:</strong> ยังไม่ได้ใส่ Supabase URL หรือ Anon Key ใน <code>.env.local</code> หากต้องการให้ข้อมูลบันทึกถาวรโปรดระบุ Key</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* เมนู 1: หน้าแรก (Live Room) */}
        {/* ========================================================= */}
        {activeMenu === 'home' && (
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            {!isRoomActive && !setupCourse && (
               <div className="animate-fadeIn w-full max-w-4xl mx-auto">
                 <h2 className="text-3xl font-bold text-white mb-8">รายวิชาของคุณ</h2>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {savedCourses.length === 0 ? (
                      <div className="col-span-3 text-center p-10 bg-[#161a26] border border-[#232938] rounded-3xl text-gray-300">คุณยังไม่มีรายวิชา กรุณาไปที่เมนู "เพิ่มรายวิชา" ก่อน</div>
                    ) : (
                      savedCourses.map(course => (
                        <div key={course.id} className="bg-[#161a26] p-6 rounded-3xl border border-[#232938] hover:border-blue-500 transition-all cursor-pointer shadow-lg hover:-translate-y-1" onClick={() => handleSelectCourseToOpen(course)}>
                          <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-xl mb-4 text-blue-400">📘</div>
                          <h3 className="font-bold text-xl text-white">{course.code}</h3>
                          <p className="text-sm text-gray-400 mt-1">{course.name}</p>
                          <p className="text-xs text-blue-500 mt-4 font-bold">คลิกเพื่อเปิดห้องเรียน →</p>
                        </div>
                      ))
                    )}
                 </div>
               </div>
            )}

            {!isRoomActive && setupCourse && (
              <div className="max-w-md w-full mx-auto mt-10 animate-fadeIn">
                <div className="bg-[#161a26] p-8 rounded-3xl border border-[#232938] shadow-2xl relative">
                  <button onClick={() => setSetupCourse(null)} className="absolute top-6 right-6 text-gray-400 hover:text-white text-2xl font-bold">✕</button>
                  <div className="mb-6 border-b border-[#232938] pb-6">
                    <h2 className="text-3xl font-bold text-blue-400">{setupCourse.code}</h2>
                    <p className="text-gray-300 mt-1 text-lg">{setupCourse.name}</p>
                  </div>
                  <form onSubmit={handleStartClass} className="space-y-5">
                    <div>
                      <label className="text-sm font-bold text-gray-300 mb-2 block">สอนครั้งที่ ...</label>
                      <div className="w-full bg-[#11141c] border border-[#2a3041] text-blue-400 font-bold rounded-xl px-4 py-4 flex items-center justify-between">
                        <span>ครั้งที่ {autoSessionNum}</span>
                        <span className="text-xs font-normal text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md">คำนวณอัตโนมัติ</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-bold text-gray-300 mb-2 block">จำกัดสมาชิก (คน)</label>
                      <input type="number" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} placeholder="เช่น 40" className="w-full bg-[#1c2130] border border-[#2a3041] focus:border-blue-500 text-white rounded-xl px-4 py-3 focus:outline-none transition-all" required />
                    </div>
                    <div>
                      <label className="text-sm font-bold text-gray-300 mb-2 block">ระยะเวลาคลาส (นาที)</label>
                      <input type="number" value={classDuration} onChange={(e) => setClassDuration(e.target.value)} placeholder="เช่น 60" className="w-full bg-[#1c2130] border border-[#2a3041] focus:border-blue-500 text-white rounded-xl px-4 py-3 focus:outline-none transition-all" required />
                    </div>

                    {/* กล่องสถานะ GPS ของอาจารย์ */}
                    <div className="bg-[#11141c] border border-[#2a3041] rounded-2xl p-4 text-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl">📍</span>
                          <div>
                            <span className="font-bold text-gray-300 block text-xs">
                              พิกัด GPS ห้องเรียนอาจารย์:
                            </span>
                            {teacherLocation.lat !== 0 ? (
                              <span className="text-emerald-400 font-mono text-xs flex items-center gap-1 mt-0.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                {teacherLocation.lat.toFixed(5)}, {teacherLocation.lng.toFixed(5)} {gpsAccuracy ? `(±${gpsAccuracy}ม.)` : ''}
                              </span>
                            ) : (
                              <span className="text-amber-400 text-xs mt-0.5 block">
                                {gpsStatus === 'requesting' ? '⏳ กำลังขอสิทธิ์และค้นหาพิกัด...' : '⚠️ ยังไม่ได้ระบุพิกัด'}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestTeacherGPS()}
                          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow ${
                            teacherLocation.lat !== 0
                              ? 'bg-[#1c2130] text-blue-300 hover:bg-[#202636] border border-[#2a3041]'
                              : 'btn-holographic hover:bg-blue-500 text-white animate-pulse'
                          }`}
                        >
                          {teacherLocation.lat !== 0 ? '🔄 ตรวจจับใหม่อีกครั้ง' : '👉 แตะเพื่อเปิด GPS'}
                        </button>
                      </div>

                      {gpsStatus === 'denied' && (
                        <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                          <p className="font-bold mb-1">🚨 สิทธิ์พิกัดถูกบล็อกในเบราว์เซอร์:</p>
                          <p className="text-[11px] text-rose-200">
                            แตะที่ไอคอนกุญแจ 🔒 ข้าง URL หรือปุ่ม aA บนเบราว์เซอร์ เพื่อเปิดสิทธิ์ "ตำแหน่ง (Location)" แล้วกดใหม่อีกครั้ง
                          </p>
                        </div>
                      )}
                    </div>

                    <p className="text-red-400 text-xs mt-2">* ต้องเปิดพิกัด GPS ของอาจารย์ก่อนเริ่มคลาส เพื่อใช้เปรียบเทียบระยะห่างของนักศึกษา</p>
                    <button type="submit" className="w-full btn-holographic hover:bg-blue-500 text-white font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] py-4 rounded-xl shadow-lg transition-all mt-6">
                      สร้างห้องเรียน (เปิดคลาส)
                    </button>
                  </form>
                </div>
              </div>
            )}

            {isRoomActive && setupCourse && (
              <div className="flex-1 flex flex-col animate-fadeIn">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6 border-b border-[#232938] pb-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
                      <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></span> ห้องเรียน Live: {setupCourse.code}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2">
                      <p className="text-xs sm:text-sm text-gray-400">{setupCourse.name} | หมู่เรียน 1 | สอนครั้งที่ {autoSessionNum}</p>
                      <span className="text-[11px] sm:text-xs font-mono bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full">
                        📍 พิกัด: {teacherLocation.lat.toFixed(5)}, {teacherLocation.lng.toFixed(5)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full lg:w-auto">
                    <div className="bg-[#1c2130] border border-[#2a3041] px-4 sm:px-6 py-2 rounded-xl text-center flex-1 sm:flex-initial">
                      <p className="text-[10px] sm:text-xs text-gray-400 mb-0.5">เวลาที่เหลือ</p>
                      <p className={`text-xl sm:text-2xl font-mono font-bold ${timeLeft <= 300 ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>{formatTime(timeLeft)}</p>
                    </div>
                    <button onClick={() => setShowQRModal(true)} className="bg-white hover:bg-gray-200 text-black px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg transition-colors flex-1 sm:flex-initial">
                      📸 แสดง QR Code
                    </button>
                    <button onClick={() => handleEndClass(false)} className="bg-red-900/40 hover:bg-red-600 border border-red-500/30 text-red-200 hover:text-white px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl font-bold text-xs sm:text-sm transition-all flex-1 sm:flex-initial">
                      ยุบห้องเรียน
                    </button>
                  </div>
                </div>

                {/* แถบแจ้งเตือนอาจารย์เมื่อมีนักศึกษาปิด GPS / โดนเด้งออก */}
                {currentStudents.some(s => s.gpsActive === false || s.status?.includes('ปิด GPS') || (!s.lat && !s.lng)) && (
                  <div className="mb-6 bg-rose-950/80 border-2 border-rose-500 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_0_25px_rgba(244,63,94,0.4)] animate-pulse">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl animate-bounce">🚨</span>
                      <div>
                        <h4 className="font-bold text-white text-base flex items-center gap-2">
                          แจ้งเตือนอาจารย์: มีนักศึกษา "ปิด GPS" และถูกเด้งออกจากห้องเรียน ({currentStudents.filter(s => s.gpsActive === false || s.status?.includes('ปิด GPS') || (!s.lat && !s.lng)).length} คน)!
                        </h4>
                        <p className="text-rose-200 text-xs mt-1">
                          รายชื่อ: {currentStudents.filter(s => s.gpsActive === false || s.status?.includes('ปิด GPS') || (!s.lat && !s.lng)).map(s => `${s.name} (${s.studentId})`).join(', ')}
                        </p>
                      </div>
                    </div>
                    <span className="btn-holographic text-white font-black text-xs px-3 py-1.5 rounded-xl uppercase tracking-wider whitespace-nowrap self-start md:self-auto">
                      เด้งออกจากห้อง (ปิด GPS)
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1 min-h-0">
                  <div className="bg-[#161a26] border border-[#232938] rounded-3xl flex flex-col overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-[#232938] flex items-center gap-2">
                      <span className="text-gray-400">💬</span><h3 className="font-bold text-white">กระดานข้อความ</h3>
                    </div>
                    {pinnedMessage && (
                      <div className="bg-blue-900/30 border-b border-blue-800/50 p-3 px-5 flex justify-between items-center">
                        <div className="flex items-center gap-2"><span className="text-blue-400">📌</span><p className="text-sm text-blue-100 font-medium">{pinnedMessage}</p></div>
                        <button onClick={() => handlePinMessage("")} className="text-gray-400 hover:text-white text-sm">✕</button>
                      </div>
                    )}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                      {chatMessages.map((msg, idx) => (
                        <div key={idx} className={msg.sender === 'System' ? 'flex justify-center' : (msg.sender === "อาจารย์" ? 'flex justify-end' : 'flex justify-start')}>
                          <div className={`group relative p-4 rounded-2xl max-w-[85%] text-sm ${msg.sender === 'System' ? 'bg-[#1c2130] text-gray-400 border border-[#2a3041] text-center w-full' : (msg.sender === "อาจารย์" ? 'btn-holographic text-white rounded-tr-none' : 'bg-[#1c2130] border border-[#2a3041] rounded-tl-none')}`}>
                            {msg.sender === "อาจารย์" && msg.type === "text" && <button onClick={() => handlePinMessage(msg.text)} className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white transition-opacity" title="ปักหมุดข้อความ">📌</button>}
                            {msg.sender !== 'System' && <p className={`text-xs mb-1 font-semibold ${msg.sender === "อาจารย์" ? 'text-blue-200' : 'text-blue-400'}`}>{msg.sender} <span className="text-xs opacity-70 ml-1">{msg.time}</span></p>}
                            {msg.type === "image" ? <img src={msg.imageUrl} alt="img" className="mt-2 rounded-lg max-w-full max-h-48 object-contain" /> : <p>{msg.text}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendMessage} className="p-4 bg-[#1c2130] border-t border-[#232938] flex items-center gap-3">
                      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-[#2a3041] rounded-xl text-gray-400 hover:text-white">📎</button>
                      <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="พิมพ์ข้อความ / สั่งงาน..." className="flex-1 bg-[#11141c] border border-[#2a3041] rounded-xl px-5 py-4 focus:outline-none focus:border-blue-500 text-sm text-white" />
                      <button type="submit" className="btn-holographic px-6 py-4 rounded-xl font-bold">ส่ง</button>
                    </form>
                  </div>

                  <div className="bg-[#161a26] border border-[#232938] rounded-3xl flex flex-col overflow-hidden shadow-xl">
                    <div className="p-5 border-b border-[#232938] flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400">📍</span>
                        <h3 className="font-bold text-white">สถานะนักศึกษา Real-time</h3>
                      </div>
                      <div className="flex items-center gap-2">
                        {currentStudents.some(s => s.gpsActive === false || s.status?.includes('ปิด GPS') || (!s.lat && !s.lng)) && (
                          <span className="text-xs font-bold text-rose-300 bg-rose-900/50 border border-rose-500/50 px-2.5 py-1 rounded-full animate-pulse">
                            🚨 เด้งออก: {currentStudents.filter(s => s.gpsActive === false || s.status?.includes('ปิด GPS') || (!s.lat && !s.lng)).length} คน
                          </span>
                        )}
                        <div className="text-sm font-bold text-blue-400 bg-blue-900/20 px-3 py-1 rounded-full">
                          {currentStudents.length} / {maxStudents} คน
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-x-auto">
                      <table className="w-full text-left text-xs sm:text-sm min-w-[640px]">
                        <thead className="bg-[#1c2130] text-gray-400 border-b border-[#232938] sticky top-0">
                          <tr>
                            <th className="p-4">รหัส</th>
                            <th className="p-4">ชื่อ-นามสกุล</th>
                            <th className="p-4 text-center">เวลาเข้า (แรก/ล่าสุด)</th>
                            <th className="p-4 text-center">เวลาเรียนสะสม</th>
                            <th className="p-4 text-center">สถานะ/ระยะ</th>
                            <th className="p-4 text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#232938]">
                          {currentStudents.length === 0 ? (
                            <tr><td colSpan={6} className="p-10 text-center text-gray-300">ยังไม่มีนักศึกษาสแกนเข้าเรียนในขณะนี้...</td></tr>
                          ) : (
                            currentStudents.map((student) => {
                              const isEjectedOrGpsOff = student.gpsActive === false || student.status?.includes("ปิด GPS") || (!student.lat && !student.lng);
                              const dist = student.lat ? calculateDistance(teacherLocation.lat, teacherLocation.lng, student.lat, student.lng) : 0;
                              const timeMissing = new Date().getTime() - (student.lastSeen ? new Date(student.lastSeen).getTime() : 0);
                              
                              let statusColor = "bg-emerald-500"; 
                              let bgRow = ""; 
                              let statusText = "ปกติ";

                              if (isEjectedOrGpsOff) {
                                statusColor = "bg-rose-600";
                                bgRow = "bg-rose-950/40 border-l-4 border-rose-500";
                                statusText = "🚨 เด้งออก (ปิด GPS)";
                              } else if (student.status === "ออกจากห้องชั่วคราว") {
                                statusColor = "bg-gray-500";
                                bgRow = "bg-gray-900/30";
                                statusText = "ออกจากห้องชั่วคราว";
                              } else if (timeMissing > 60000 || dist > 100) { 
                                statusColor = "bg-red-500"; 
                                bgRow = "bg-red-900/10"; 
                                statusText = dist > 100 ? "ไกลเกิน" : "ขาดการเชื่อมต่อ"; 
                              } else if (timeMissing > 20000 || dist > 50) { 
                                statusColor = "bg-yellow-500"; 
                                bgRow = "bg-yellow-900/10"; 
                                statusText = dist > 50 ? "เฝ้าระวัง" : "ซ่อนแอป"; 
                              }

                              return (
                                <tr key={student.studentId} className={`hover:bg-[#1c2130] transition-colors ${bgRow}`}>
                                  <td className="p-4 font-mono text-gray-300">{student.studentId}</td>
                                  <td className="p-4 font-bold text-white">
                                    <div className="flex items-center gap-2">
                                      {student.name}
                                      {isEjectedOrGpsOff && (
                                        <span className="text-[10px] font-extrabold btn-holographic text-white px-1.5 py-0.5 rounded animate-pulse">
                                          เด้งออก (ปิด GPS)
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="p-4 text-center text-gray-400">
                                    <div className="font-mono text-xs text-gray-300">
                                      {student.firstJoinTime || student.joinTime}
                                    </div>
                                    {(student.reconnectCount || 0) > 0 && (
                                      <div className="text-[10px] text-amber-400 mt-0.5">
                                        เข้าซ้ำ {(student.reconnectCount || 0) + 1} ครั้ง ({student.joinTime})
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className="font-mono text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] to-[#00b87c] animate-text-glow font-black bg-[#00b87c]/10 border border-[#00b87c]/30 px-2.5 py-1 rounded-lg inline-block">
                                      ⏱️ {formatDuration(student.totalActiveSeconds)}
                                    </span>
                                  </td>
                                  <td className="p-4 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ${isEjectedOrGpsOff ? 'animate-ping' : 'animate-pulse'}`}></div>
                                      <span className={`font-bold text-xs ${isEjectedOrGpsOff ? 'text-rose-400 font-black' : (statusColor === 'bg-emerald-500' ? 'text-emerald-400' : (statusColor === 'bg-yellow-500' ? 'text-yellow-400' : 'text-red-400'))}`}>
                                        {statusText} {isEjectedOrGpsOff || student.status === "ออกจากห้องชั่วคราว" ? '' : `(${dist.toFixed(0)}ม.)`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-4 text-center">
                                    <button onClick={() => handleKickStudent(student.studentId)} className="text-gray-300 hover:text-red-400 px-3 py-1 rounded-lg border border-[#2a3041] hover:border-red-500/30 text-xs">นำออก</button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* เมนู 2: เพิ่มรายวิชา */}
        {/* ========================================================= */}
        {activeMenu === 'add' && (
          <div className="flex-1 p-8 overflow-y-auto animate-fadeIn">
            <h2 className="text-3xl font-bold text-white mb-8">📚 การจัดการรายวิชา</h2>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-[#161a26] p-6 rounded-3xl border border-[#232938] shadow-xl">
                  <h3 className="text-xl font-bold text-blue-400 mb-6">เพิ่มวิชาใหม่</h3>
                  <form onSubmit={handleSaveCourse} className="space-y-4">
                    <div><input name="newCourseCode" type="text" placeholder="รหัสวิชา (เช่น CPE101)" className="w-full bg-[#1c2130] border border-[#2a3041] focus:border-blue-500 text-white rounded-xl px-4 py-3 focus:outline-none" required /></div>
                    <div><input name="newCourseName" type="text" placeholder="ชื่อวิชา (เช่น Computer)" className="w-full bg-[#1c2130] border border-[#2a3041] focus:border-blue-500 text-white rounded-xl px-4 py-3 focus:outline-none" required /></div>
                    <button type="submit" className="w-full btn-holographic hover:bg-blue-500 text-white font-bold drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] py-3 rounded-xl shadow-lg mt-4">บันทึกรายวิชา</button>
                  </form>
                </div>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-[#161a26] rounded-3xl border border-[#232938] shadow-xl h-full p-6">
                  <h3 className="text-xl font-bold text-white mb-6">รายวิชาที่คุณสอนประจำ</h3>
                  {savedCourses.length === 0 ? <p className="text-gray-300 text-center">ยังไม่มีรายวิชาที่บันทึกไว้</p> : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {savedCourses.map((course: any) => (
                        <div key={course.id} className="bg-[#1c2130] p-4 rounded-2xl border border-[#2a3041] flex justify-between items-center group">
                          <div><p className="font-bold text-blue-400">{course.code}</p><p className="text-sm text-white mt-1">{course.name}</p></div>
                          <button onClick={() => handleDeleteCourse(course.id)} className="text-gray-300 hover:text-red-400" title="ลบรายวิชา">🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* เมนู 3: สถิติการเข้าเรียน */}
        {/* ========================================================= */}
        {activeMenu === 'stats' && (
          <div className="flex-1 p-8 overflow-y-auto animate-fadeIn">
            <h2 className="text-3xl font-bold text-white mb-8">📊 สถิติประวัติการสอน</h2>
            
            {!selectedStatsCourse ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {getGroupedCourses().length === 0 ? (
                  <div className="col-span-3 text-center p-10 bg-[#161a26] border border-[#232938] rounded-3xl text-gray-300">ยังไม่มีประวัติการเปิดสอนวิชาใดๆ</div>
                ) : (
                  getGroupedCourses().map((courseObj: any) => (
                    <div 
                      key={courseObj.code} 
                      className="bg-[#161a26] p-6 rounded-3xl border border-[#232938] hover:border-blue-500 transition-all cursor-pointer shadow-lg group"
                      onClick={() => { setSelectedStatsCourse(courseObj.code); setSelectedSessionView('all'); }}
                    >
                      <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center text-xl mb-4 text-blue-400">📉</div>
                      <h3 className="font-bold text-xl text-white">{courseObj.code}</h3>
                      <p className="text-sm text-gray-400 mt-1">{courseObj.name}</p>
                      <div className="mt-6 border-t border-[#232938] pt-4 flex justify-between items-center text-sm">
                        <span className="text-gray-300">เปิดคลาสทั้งหมด</span><span className="font-bold text-blue-400">{courseObj.records.length} ครั้ง</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="bg-[#161a26] rounded-3xl border border-[#232938] overflow-hidden shadow-xl flex flex-col animate-fadeIn">
                <div className="p-6 border-b border-[#232938] bg-[#1c2130] flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <button onClick={() => setSelectedStatsCourse(null)} className="text-gray-400 hover:text-white bg-[#11141c] px-4 py-2 rounded-lg font-bold">← กลับ</button>
                    <div><h3 className="font-bold text-xl text-white">ประวัติวิชา {selectedStatsCourse}</h3><p className="text-xs text-gray-400 mt-1">เรียงตามรหัสนักศึกษา และแยกรายครั้ง</p></div>
                  </div>
                  <select 
                    value={selectedSessionView} onChange={(e) => setSelectedSessionView(e.target.value)}
                    className="bg-[#11141c] border border-[#2a3041] focus:border-blue-500 text-blue-400 font-bold rounded-xl px-4 py-2 outline-none cursor-pointer"
                  >
                    <option value="all">ดูภาพรวมทุกรอบ (Matrix)</option>
                    {getCurrentCourseStats().sessions.map((rec: any) => (
                       <option key={rec.id} value={rec.sessionNum}>ดูรายละเอียดเจาะจง รอบที่ {rec.sessionNum}</option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto flex-1 p-6">
                  {selectedSessionView === 'all' && (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="text-gray-400 border-b border-[#232938]">
                        <tr>
                          <th className="pb-4 font-semibold text-blue-300">รหัสนักศึกษา</th>
                          <th className="pb-4 font-semibold text-blue-300">ชื่อ - นามสกุล</th>
                          {getCurrentCourseStats().sessions.map((rec: any) => (
                            <th key={rec.id} className="pb-4 font-semibold text-center group">
                              <div className="flex flex-col items-center">
                                ครั้งที่ {rec.sessionNum}
                                <button onClick={() => handleDeleteHistory(rec.id)} className="mt-1 text-xs text-red-500 bg-red-500/10 px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="ลบประวัตินี้ทิ้ง">ลบห้องนี้</button>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232938]">
                        {getCurrentCourseStats().students.map((std: any) => (
                          <tr key={std.id} className="hover:bg-[#1c2130]">
                            <td className="py-4 font-mono text-gray-300">{std.id}</td>
                            <td className="py-4 font-bold text-white">{std.name}</td>
                            {getCurrentCourseStats().sessions.map((rec: any) => {
                              const attendedRecord = rec.studentsData?.find((s: any) => s.studentId === std.id);
                              if (!attendedRecord) return <td key={rec.id} className="py-4 text-center"><span className="w-3 h-3 rounded-full bg-gray-600 inline-block opacity-50" title="ขาดเรียน"></span></td>;
                              const classEndTime = new Date(rec.timestamp).getTime();
                              const lastSeenTime = attendedRecord.lastSeen ? new Date(attendedRecord.lastSeen).getTime() : 0;
                              const isMissingLong = (classEndTime - lastSeenTime) > 60000;
                              let colorClass = "bg-emerald-500";
                              if (isMissingLong) colorClass = "bg-red-500";
                              else if (attendedRecord.lat) {
                                const finalDist = calculateDistance(rec.teacherLocation?.lat, rec.teacherLocation?.lng, attendedRecord.lat, attendedRecord.lng);
                                if (finalDist > 100) colorClass = "bg-red-500";
                                else if (finalDist > 50) colorClass = "bg-yellow-500";
                              }
                              return (
                                <td key={rec.id} className="py-4 text-center">
                                  <span className={`w-3 h-3 rounded-full ${colorClass} inline-block`} title={`เวลาเข้า: ${attendedRecord.joinTime}`}></span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {selectedSessionView !== 'all' && (
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="text-gray-400 border-b border-[#232938]">
                        <tr>
                          <th className="pb-4 font-semibold text-blue-300">รหัสนักศึกษา</th>
                          <th className="pb-4 font-semibold text-blue-300">ชื่อ - นามสกุล</th>
                          <th className="pb-4 font-semibold text-center">เวลาที่เข้าคลาส</th>
                          <th className="pb-4 font-semibold text-center">อยู่ในคลาส (นาที)</th>
                          <th className="pb-4 font-semibold text-center">สถานะสุดท้าย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#232938]">
                        {(() => {
                          const specificSession = getCurrentCourseStats().sessions.find((s: any) => s.sessionNum === selectedSessionView);
                          if (!specificSession) return null;

                          return getCurrentCourseStats().students.map((std: any) => {
                            const attendedRecord = specificSession.studentsData?.find((s: any) => s.studentId === std.id);
                            if (!attendedRecord) {
                              return (
                                <tr key={std.id} className="opacity-40">
                                  <td className="py-4 font-mono">{std.id}</td><td className="py-4">{std.name}</td><td className="py-4 text-center">-</td><td className="py-4 text-center">-</td><td className="py-4 text-center text-red-500 font-bold">ขาดเรียน</td>
                                </tr>
                              );
                            }
                            const minsInClass = calculateMinutesInClass(attendedRecord.joinTime, specificSession.timestamp);
                            const classEndTime = new Date(specificSession.timestamp).getTime();
                            const lastSeenTime = attendedRecord.lastSeen ? new Date(attendedRecord.lastSeen).getTime() : 0;
                            const isMissingLong = (classEndTime - lastSeenTime) > 60000;
                            
                            let colorText = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"; let label = "เข้าเรียนปกติ";
                            if (isMissingLong) { colorText = "bg-red-500/10 text-red-400 border-red-500/30"; label = "ออกก่อนจบคาบ / ขาดการเชื่อมต่อ"; } 
                            else if (attendedRecord.lat) {
                              const finalDist = calculateDistance(specificSession.teacherLocation?.lat, specificSession.teacherLocation?.lng, attendedRecord.lat, attendedRecord.lng);
                              if (finalDist > 100) { colorText = "bg-red-500/10 text-red-400 border-red-500/30"; label = `อยู่ไกลระยะ (${finalDist.toFixed(0)} ม.)`; }
                              else if (finalDist > 50) { colorText = "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"; label = `เฝ้าระวัง (${finalDist.toFixed(0)} ม.)`; }
                            }
                            return (
                              <tr key={std.id} className="hover:bg-[#1c2130]">
                                <td className="py-4 font-mono text-gray-300">{std.id}</td><td className="py-4 font-bold text-white">{std.name}</td><td className="py-4 text-center text-blue-300 font-mono">{attendedRecord.joinTime}</td>
                                <td className="py-4 text-center font-bold text-white">{minsInClass} <span className="font-normal text-gray-300 text-xs">นาที</span></td><td className="py-4 text-center"><span className={`px-3 py-1 border rounded-lg text-xs font-bold ${colorText}`}>{label}</span></td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  )}

                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
