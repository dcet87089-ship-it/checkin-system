"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Scanner } from '@yudiel/react-qr-scanner';

// === นำเข้า Supabase ===
import { 
  getRoom, 
  updateRoom, 
  getAllHistory, 
  subscribeToRoom, 
  getSchedulesByStudent,
  addSchedule,
  deleteSchedule,
  isSupabaseConfigured,
  StudentData, 
  ChatMessage, 
  HistoryRecord 
} from '../../lib/supabase';

interface UserDataType {
  name: string;
  userId: string;
  role: string;
}

interface HistoryRecordType {
  id: string;
  day: number;
  dateStr: string;
  code: string;
  name: string;
  time: string;
  status: string;
  type: "success" | "warning" | "error";
  distance?: number;
}

interface ScheduleItemType {
  id: number;
  code: string;
  name: string;
  time: string;
  location: string;
}

function calculateDistance(lat1?: number, lon1?: number, lat2?: number, lon2?: number) {
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
}

function formatActiveDuration(totalSeconds?: number) {
  if (!totalSeconds || totalSeconds <= 0) return "0 นาที";
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins === 0) return `${secs} วินาที`;
  return `${mins} นาที ${secs} วินาที`;
}

export default function StudentDashboard() {
  const router = useRouter();
  const [activeMenu, setActiveMenu] = useState<'home' | 'schedule' | 'history'>('history');
  const [userData, setUserData] = useState<UserDataType | null>(null);
  const [loading, setLoading] = useState(true);

  const [isScanning, setIsScanning] = useState(false);
  const [joinedClass, setJoinedClass] = useState<{code: string, name: string} | null>(null);
  const [joinCodeInput, setJoinCodeInput] = useState("");

  const [myLocation, setMyLocation] = useState({ lat: 0, lng: 0 });
  const [isGpsActive, setIsGpsActive] = useState(true);
  const [teacherLocation, setTeacherLocation] = useState({ lat: 0, lng: 0 });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentStudents, setCurrentStudents] = useState<StudentData[]>([]); 

  const [selectedDate, setSelectedDate] = useState<number | null>(null);
  const [historyData, setHistoryData] = useState<HistoryRecordType[]>([]);
  
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [configured, setConfigured] = useState(true);

  const currentMonth = calendarDate.getMonth();
  const currentYear = calendarDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const monthNamesThai = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", 
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];

  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [refreshSchedule, setRefreshSchedule] = useState(0);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    const storedData = localStorage.getItem(Object.keys(localStorage)[0] || "");
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.role !== 'student') {
          router.push('/');
          return;
        }
        setUserData(parsed);
        if (parsed.userId) {
          getSchedulesByStudent(parsed.userId).then((dbSchedules) => {
            if (dbSchedules && dbSchedules.length > 0) {
              const schedMap: Record<string, any[]> = {};
              dbSchedules.forEach((s) => {
                if (!schedMap[s.day]) schedMap[s.day] = [];
                schedMap[s.day].push(s);
              });
              localStorage.setItem('my_schedule', JSON.stringify(schedMap));
              setRefreshSchedule((p) => p + 1);
            }
          });
        }
      } catch {
        router.push('/');
        return;
      }
    } else {
      router.push('/');
      return;
    }
    setLoading(false);

    if (typeof window !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setIsGpsActive(true);
        },
        (error: any) => {
          console.warn("กำลังหาพิกัด GPS หรือถูกปิด...", error.message);
          setIsGpsActive(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [router]);

  // ฟังก์ชันเด้งนักศึกษาออกจากห้องเรียนทันทีเมื่อปิด GPS
  const handleEjectForGpsOff = async (reason = "ปิด GPS ระหว่างเรียน") => {
    if (!joinedClass || !userData) return;
    const roomCode = joinedClass.code;
    setJoinedClass(null); // เด้งออกจากห้องทันที
    setIsScanning(false);

    try {
      const room = await getRoom(roomCode);
      if (room && room.students) {
        const nowMs = Date.now();
        const updated = room.students.map((s: StudentData) => {
          if (s.studentId === userData.userId) {
            const deltaSec = s.lastTick ? Math.min(30, Math.max(0, Math.floor((nowMs - s.lastTick) / 1000))) : 0;
            return {
              ...s,
              gpsActive: false,
              status: "เด้งออก (ปิด GPS)",
              leaveReason: reason,
              totalActiveSeconds: (s.totalActiveSeconds || 0) + deltaSec,
              lastTick: nowMs,
              lastSeen: new Date().toISOString()
            };
          }
          return s;
        });
        await updateRoom(roomCode, { students: updated });
      }
    } catch (e) {
      console.error("Ejection sync error:", e);
    }

    alert("🚨 คุณถูกเด้งออกจากห้องเรียนทันที!\n\nสาเหตุ: มีการปิด GPS หรือไม่ยอมรับตำแหน่งพิกัดระหว่างเรียน\n\n📌 ระบบได้บันทึกเวลาเรียนสะสมไว้ให้แล้ว หากเปิด GPS แล้วเข้าห้องใหม่อีกครั้ง ระบบจะนับเวลาเรียนต่อกันทันที");
  };

  // Heartbeat อัปเดตสถานะและคำนวณเวลาเรียนสะสมต่อเนื่องทุก 5 วินาที
  useEffect(() => {
    if (joinedClass && userData) {
      const interval = setInterval(async () => {
        // ตรวจสอบสถานะ GPS อย่างต่อเนื่อง ถ้าปิดให้เด้งออกทันที
        if (!navigator.geolocation) {
          setIsGpsActive(false);
          handleEjectForGpsOff("อุปกรณ์ไม่รองรับ GPS");
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setIsGpsActive(true);
          },
          (err) => {
            console.warn("Student closed GPS during class:", err.message);
            setIsGpsActive(false);
            handleEjectForGpsOff("ตรวจพบการปิด GPS ในระหว่างเรียน");
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );

        const nowMs = Date.now();
        const currentTime = new Date().toISOString();
        const distMeters = (teacherLocation.lat !== 0 && myLocation.lat !== 0 && isGpsActive)
          ? Math.round(calculateDistance(myLocation.lat, myLocation.lng, teacherLocation.lat, teacherLocation.lng))
          : undefined;

        let curStatus = "เข้าเรียน";
        if (!isGpsActive || myLocation.lat === 0) {
          curStatus = "เด้งออก (ปิด GPS)";
        } else if (distMeters !== undefined) {
          if (distMeters > 100) curStatus = "ไกลเกินพิกัด";
          else if (distMeters > 50) curStatus = "เฝ้าระวัง";
        }

        const updatedStudents = currentStudents.map((s: StudentData) => {
          if (s.studentId === userData.userId) {
            const deltaSec = s.lastTick ? Math.min(30, Math.max(0, Math.floor((nowMs - s.lastTick) / 1000))) : 5;
            const accumulated = (s.totalActiveSeconds || 0) + deltaSec;
            return { 
              ...s, 
              lat: isGpsActive ? (myLocation.lat || s.lat) : 0,
              lng: isGpsActive ? (myLocation.lng || s.lng) : 0,
              distance: isGpsActive ? distMeters : undefined,
              gpsActive: isGpsActive && myLocation.lat !== 0,
              status: curStatus,
              totalActiveSeconds: accumulated,
              lastTick: nowMs,
              lastSeen: currentTime 
            };
          }
          return s;
        });
        await updateRoom(joinedClass.code, { students: updatedStudents });
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [joinedClass, userData, currentStudents, myLocation, teacherLocation, isGpsActive]);

  // Realtime listener สำหรับห้องเรียนที่เข้าร่วม
  useEffect(() => {
    if (joinedClass && userData) {
      getRoom(joinedClass.code).then((room) => {
        if (room) {
          setTeacherLocation(room.teacher_location || room.teacherLocation || { lat: 0, lng: 0 });
          setChatMessages(room.chat || []);
          setCurrentStudents(room.students || []);
        }
      });

      const unsubscribe = subscribeToRoom(
        joinedClass.code,
        (room) => {
          setTeacherLocation(room.teacher_location || room.teacherLocation || { lat: 0, lng: 0 });
          setChatMessages(room.chat || []);
          setCurrentStudents(room.students || []);

          const isMeInside = room.students?.some((s: StudentData) => s.studentId === userData.userId);
          if (!isMeInside && (room.students?.length || 0) > 0) {
            alert("คุณถูกอาจารย์เชิญออกจากห้องเรียน");
            setJoinedClass(null); 
          }
        },
        () => {
          alert("อาจารย์ได้ทำการยุบห้องเรียนแล้ว");
          setJoinedClass(null);
        }
      );
      return () => unsubscribe();
    }
  }, [joinedClass, userData]);

  // ดึงประวัติการเรียนของนักศึกษา
  useEffect(() => {
    if (activeMenu === 'history' && userData) {
      const fetchMyHistory = async () => {
        try {
          const allHistory = await getAllHistory();
          const myRecords: HistoryRecordType[] = [];
          
          allHistory.forEach((record: HistoryRecord) => {
            const myRecord = record.studentsData?.find((s: StudentData) => s.studentId === userData.userId);
            
            if (myRecord) {
              const lastSeenTime = myRecord.lastSeen ? new Date(myRecord.lastSeen).getTime() : 0;
              const classEndTime = new Date(record.timestamp).getTime();
              const isOffline = (classEndTime - lastSeenTime) > 60000;
              const dateObj = new Date(record.timestamp);
              
              myRecords.push({
                id: record.id,
                day: dateObj.getDate(),
                dateStr: record.dateStr,
                code: record.courseCode,
                name: record.courseName,
                time: myRecord.joinTime || '-',
                status: isOffline ? "ออฟไลน์ก่อนปิด" : "เข้าเรียนปกติ",
                type: isOffline ? "warning" : "success"
              });
            }
          });

          setHistoryData(myRecords);
        } catch (error) {
          console.error("Error fetching history:", error);
        }
      };
      fetchMyHistory();
    }
  }, [activeMenu, userData]);

  const [gpsStatus, setGpsStatus] = useState<'idle' | 'requesting' | 'ready' | 'denied'>('idle');

  const requestStudentGPS = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !navigator.geolocation) {
        alert("อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับระบบ GPS");
        setGpsStatus('denied');
        resolve(null);
        return;
      }
      setGpsStatus('requesting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setMyLocation(loc);
          setGpsStatus('ready');
          resolve(loc);
        },
        (err) => {
          console.warn("GPS error:", err.message);
          setGpsStatus('denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const joinRoom = async (courseCode: string, forcedLoc?: { lat: number; lng: number }) => {
    if (!userData) return;

    // ตรวจสอบและถาม GPS ทุกครั้งก่อนเข้าห้องเรียน
    let curLoc = forcedLoc || myLocation;
    if (!curLoc || curLoc.lat === 0) {
      const loc = await requestStudentGPS();
      if (!loc || loc.lat === 0) {
        alert("⚠️ ต้องอนุญาตการเข้าถึงตำแหน่ง GPS บนอุปกรณ์ของท่านก่อนเข้าเรียน เพื่อยืนยันระยะห่างจากอาจารย์ (กรุณากด 'อนุญาต / Allow' ในเบราว์เซอร์)");
        return;
      }
      curLoc = loc;
    }

    setIsScanning(false);
    setJoinCodeInput(""); 

    const room = await getRoom(courseCode);

    if (room) {
      const teacherLoc = room.teacher_location || room.teacherLocation || { lat: 0, lng: 0 };
      setTeacherLocation(teacherLoc);

      let distMeters = 0;
      let checkStatus = "เข้าเรียน";
      if (teacherLoc.lat !== 0 && curLoc.lat !== 0) {
        distMeters = Math.round(calculateDistance(curLoc.lat, curLoc.lng, teacherLoc.lat, teacherLoc.lng));
        if (distMeters > 100) {
          checkStatus = "ไกลเกินพิกัด";
        } else if (distMeters > 50) {
          checkStatus = "เฝ้าระวัง";
        }
      }

      setJoinedClass({ code: courseCode, name: room.settings?.name || "กำลังเข้าเรียน..." });
      
      const existingStudents = room.students || [];
      const prevRecord = existingStudents.find((s: StudentData) => s.studentId === userData.userId);
      const currentTimeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
      const nowMs = Date.now();

      const newStudent: StudentData = {
        id: prevRecord?.id || nowMs,
        studentId: userData.userId, 
        name: userData.name,        
        major: "วิศวกรรมคอมพิวเตอร์", 
        status: checkStatus,
        lat: curLoc.lat,
        lng: curLoc.lng,
        distance: distMeters,
        gpsActive: true,
        joinTime: currentTimeStr,
        firstJoinTime: prevRecord?.firstJoinTime || prevRecord?.joinTime || currentTimeStr,
        totalActiveSeconds: prevRecord?.totalActiveSeconds || 0,
        lastTick: nowMs,
        reconnectCount: (prevRecord?.reconnectCount || 0) + (prevRecord ? 1 : 0),
        leaveReason: undefined,
        lastSeen: new Date().toISOString()
      };

      const updated = existingStudents.filter((s: StudentData) => s.studentId !== userData.userId);
      updated.push(newStudent);
      setCurrentStudents(updated);
      await updateRoom(courseCode, { students: updated });
    } else {
      alert("ไม่พบห้องเรียนนี้ หรืออาจารย์ยังไม่ได้เปิดคลาส");
    }
  };

  const handleScanSuccess = async (text: string) => {
    if (text.includes("CheckIn-")) {
      const courseCode = text.replace("CheckIn-", "");
      let curLoc = myLocation;
      if (!curLoc || curLoc.lat === 0) {
        const loc = await requestStudentGPS();
        if (!loc || loc.lat === 0) {
          alert("⚠️ กรุณาอนุญาตตำแหน่ง GPS ของอุปกรณ์ก่อนเพื่อสแกนเข้าเรียน");
          return;
        }
        curLoc = loc;
      }
      joinRoom(courseCode, curLoc);
    } else {
      alert("QR Code ไม่ถูกต้อง");
    }
  };

  const handleStartScan = async () => {
    let curLoc = myLocation;
    if (!curLoc || curLoc.lat === 0) {
      const loc = await requestStudentGPS();
      if (!loc || loc.lat === 0) {
        alert("⚠️ จำเป็นต้องเปิดและอนุญาตพิกัด GPS ก่อนเริ่มสแกน QR Code");
        return;
      }
    }
    setIsScanning(true);
  };

  const handleJoinWithCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!joinCodeInput) return;
    try {
      let curLoc = myLocation;
      if (!curLoc || curLoc.lat === 0) {
        const loc = await requestStudentGPS();
        if (!loc || loc.lat === 0) {
          alert("⚠️ กรุณาอนุญาตตำแหน่ง GPS ของอุปกรณ์ก่อนจึงจะเข้าร่วมห้องได้");
          return;
        }
        curLoc = loc;
      }
      await joinRoom(joinCodeInput.trim(), curLoc);
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
  };

  const handleLeaveRoom = async () => {
    if (joinedClass && userData) {
      const nowMs = Date.now();
      const updatedStudents = currentStudents.map((s: StudentData) => {
        if (s.studentId === userData.userId) {
          const deltaSec = s.lastTick ? Math.min(30, Math.max(0, Math.floor((nowMs - s.lastTick) / 1000))) : 0;
          return {
            ...s,
            status: "ออกจากห้องชั่วคราว",
            totalActiveSeconds: (s.totalActiveSeconds || 0) + deltaSec,
            lastTick: nowMs,
            lastSeen: new Date().toISOString()
          };
        }
        return s;
      });
      await updateRoom(joinedClass.code, { students: updatedStudents });
      setJoinedClass(null);
    }
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = e.currentTarget.elements.namedItem("message") as HTMLInputElement;
    if (input.value && joinedClass) {
      const newMsg: ChatMessage = { 
        sender: userData?.name || "Student", 
        text: input.value, 
        time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        type: "text"
      };
      const updated = [...chatMessages, newMsg];
      setChatMessages(updated);
      await updateRoom(joinedClass.code, { chat: updated });
      input.value = "";
    }
  };

  const handleSaveCourse = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const code = (form.elements.namedItem("code") as HTMLInputElement).value;
    const name = (form.elements.namedItem("name") as HTMLInputElement).value;
    const day = (form.elements.namedItem("day") as HTMLSelectElement).value;
    const time = (form.elements.namedItem("time") as HTMLInputElement).value;
    const location = (form.elements.namedItem("location") as HTMLInputElement).value;

    if (code && day && userData) {
      const added = await addSchedule({
        studentId: userData.userId,
        code,
        name,
        day,
        time,
        location
      });
      const sched = JSON.parse(localStorage.getItem('my_schedule') || "{}");
      if (!sched[day]) sched[day] = [];
      sched[day].push(added || { id: Date.now(), code, name, time, location });
      localStorage.setItem('my_schedule', JSON.stringify(sched));
      setShowAddCourseModal(false); 
      setRefreshSchedule(prev => prev + 1); 
    }
  };

  const handleLogout = () => {
    localStorage.clear(); 
    router.push('/');
  };

  if (loading || !userData) return (
    <div className="min-h-screen bg-[#0d1017] flex flex-col items-center justify-center gap-6">
      <div className="w-12 h-12 border-4 border-[#00b87c] border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-[#00b87c] tracking-[0.2em] animate-pulse">LOADING SYSTEM...</p>
    </div>
  );

  const isGpsOff = !isGpsActive || myLocation.lat === 0;
  const dist = calculateDistance(myLocation.lat, myLocation.lng, teacherLocation.lat, teacherLocation.lng);
  
  let statusColor = "";
  let statusMessage = "";
  let distTextColor = "";

  if (isGpsOff) {
      statusColor = "bg-rose-500/20 text-rose-500 border-rose-500/50 shadow-[0_0_20px_rgba(244,63,94,0.3)] animate-pulse";
      statusMessage = "🚨 คุณปิด GPS! (ระบบแจ้งอาจารย์แล้ว / ถือว่าขาดเรียน)";
      distTextColor = "text-rose-500";
  } else if (dist <= 50) {
      statusColor = "bg-[#00b87c]/10 text-[#00b87c] border-[#00b87c]/30 shadow-[0_0_20px_rgba(0,184,124,0.2)]";
      statusMessage = "✅ ระยะปลอดภัย (สถานะ: เข้าเรียน)";
      distTextColor = "text-[#00b87c]";
  } else if (dist <= 100) {
      statusColor = "bg-amber-500/10 text-amber-500 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)]";
      statusMessage = "⚠️ เริ่มออกห่างจากห้อง (สถานะ: เฝ้าระวัง)";
      distTextColor = "text-amber-500";
  } else {
      statusColor = "bg-rose-500/10 text-rose-500 border-rose-500/30 shadow-[0_0_20px_rgba(225,29,72,0.2)]";
      statusMessage = "🚫 ไกลเกิน 100 เมตร (สถานะ: ขาดเรียน)";
      distTextColor = "text-rose-500";
  }

  const filteredHistory = selectedDate ? historyData.filter((h: HistoryRecordType) => h.day === selectedDate) : historyData;
  const totalClasses = historyData.length; 
  const successClasses = historyData.filter(h => h.type === 'success').length; 
  const warningClasses = historyData.filter(h => h.type === 'warning').length; 
  const errorClasses = historyData.filter(h => h.type === 'error').length; 

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#0d1017] text-gray-200 font-sans relative">
      
      {/* Mobile Top Header (สำหรับสมาร์ทโฟนและแท็บเล็ต) */}
      <header className="md:hidden bg-[#151822] border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-xl">📍</span>
          <div>
            <h1 className="text-base font-black text-[#00b87c] leading-tight">CheckIn</h1>
            <p className="text-[11px] text-gray-400 leading-none">{userData.name} ({userData.userId})</p>
          </div>
        </div>
        <button 
          type="button" 
          onClick={handleLogout}
          className="text-xs bg-gray-800/80 hover:bg-rose-900/40 border border-gray-700 hover:border-rose-500/50 text-gray-300 hover:text-rose-300 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 font-semibold"
        >
          <span>🚪</span> ออกจากระบบ
        </button>
      </header>

      {/* แถบแจ้งเตือนฉุกเฉินเมื่อนักศึกษาปิด GPS ระหว่างเรียน */}
      {isGpsOff && joinedClass && (
        <div className="fixed top-16 md:top-5 left-1/2 -translate-x-1/2 z-50 bg-rose-600 border-2 border-white text-white px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 sm:gap-4 max-w-xl w-[92%] animate-bounce">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-2xl sm:text-3xl">🚨</span>
            <div>
              <p className="font-black text-xs sm:text-base">ระบบตรวจพบว่าคุณ "ปิด GPS"!</p>
              <p className="text-[10px] sm:text-xs text-rose-100">ส่งแจ้งเตือนอาจารย์แล้ว กรุณากดเปิดสิทธิ์ GPS ทันทีเพื่อรักษาสิทธิ์</p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              const loc = await requestStudentGPS();
              if (loc && loc.lat !== 0) setIsGpsActive(true);
            }}
            className="bg-white text-rose-600 font-black text-[11px] sm:text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl whitespace-nowrap hover:bg-rose-50 shadow transition-colors"
          >
            เปิด GPS ทันที
          </button>
        </div>
      )}
      
      {/* Modal เพิ่มวิชาเรียน */}
      {showAddCourseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#151822] border border-gray-800 p-6 sm:p-8 rounded-2xl w-full max-w-lg shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-[#00b87c]">เพิ่มวิชาเรียนใหม่</h2>
              <button onClick={() => setShowAddCourseModal(false)} className="text-gray-500 hover:text-white transition-colors text-xl p-1">✕</button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 sm:space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">รหัสวิชา</label>
                  <input name="code" placeholder="CPE101" className="w-full p-3.5 sm:p-4 rounded-xl bg-[#0d1017] border border-gray-800 focus:outline-none focus:border-[#00b87c] text-white text-sm sm:text-base" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">ชื่อวิชา</label>
                  <input name="name" placeholder="Programming" className="w-full p-3.5 sm:p-4 rounded-xl bg-[#0d1017] border border-gray-800 focus:outline-none focus:border-[#00b87c] text-white text-sm sm:text-base" required />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-400 mb-1.5 block">วันเรียน</label>
                <select name="day" className="w-full p-3.5 sm:p-4 rounded-xl bg-[#0d1017] border border-gray-800 focus:outline-none focus:border-[#00b87c] text-white cursor-pointer text-sm sm:text-base" required>
                  <option value="Monday">วันจันทร์</option>
                  <option value="Tuesday">วันอังคาร</option>
                  <option value="Wednesday">วันพุธ</option>
                  <option value="Thursday">วันพฤหัสบดี</option>
                  <option value="Friday">วันศุกร์</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">เวลา</label>
                  <input name="time" placeholder="09:00 - 12:00" className="w-full p-3.5 sm:p-4 rounded-xl bg-[#0d1017] border border-gray-800 focus:outline-none focus:border-[#00b87c] text-white text-sm sm:text-base" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-1.5 block">สถานที่</label>
                  <input name="location" placeholder="ห้อง 401" className="w-full p-3.5 sm:p-4 rounded-xl bg-[#0d1017] border border-gray-800 focus:outline-none focus:border-[#00b87c] text-white text-sm sm:text-base" />
                </div>
              </div>

              <button type="submit" className="w-full bg-[#00b87c] hover:bg-[#00a36e] text-white p-3.5 sm:p-4 rounded-xl font-bold text-base sm:text-lg mt-4 transition-all">
                บันทึกตารางเรียน
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Sidebar (จอคอมพิวเตอร์และ iPad แนวนอน) */}
      <aside className="hidden md:flex md:w-64 bg-[#151822] flex-col py-6 px-4 border-r border-gray-800 relative z-20 shrink-0">
        <h1 className="text-lg font-bold text-[#00b87c] mb-8 mt-2 px-2 flex items-center gap-2">
          <span>📍</span> CheckIn
        </h1>
        
        <div className="space-y-2 flex-1">
          <button type="button" onClick={() => setActiveMenu('home')} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${activeMenu === 'home' ? 'bg-[#00b87c] text-white' : 'text-gray-400 hover:bg-[#1e2230] hover:text-white border border-transparent'}`}>
            <span className="text-lg">📱</span> เข้าเรียน
          </button>
          <button type="button" onClick={() => setActiveMenu('schedule')} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${activeMenu === 'schedule' ? 'bg-[#00b87c] text-white' : 'text-gray-400 hover:bg-[#1e2230] hover:text-white border border-transparent'}`}>
            <span className="text-lg">📅</span> ตารางเรียน
          </button>
          <button type="button" onClick={() => setActiveMenu('history')} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all flex items-center gap-3 ${activeMenu === 'history' ? 'bg-[#00b87c] text-white' : 'text-gray-400 hover:bg-[#1e2230] hover:text-white border border-transparent'}`}>
            <span className="text-lg">📊</span> ประวัติเข้าเรียน
          </button>
        </div>

        <div className="mt-auto pt-6 border-t border-gray-800">
          <div className="flex flex-col mb-4 px-2">
            <p className="text-sm font-bold text-[#00b87c]">{userData.name}</p>
            <p className="text-xs text-gray-500 mt-1">{userData.userId}</p>
          </div>
          <button type="button" onClick={handleLogout} className="w-full flex items-center gap-3 text-gray-400 hover:text-gray-200 py-2 transition-colors text-sm font-medium">
            <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white font-bold text-xs border border-gray-700">
              {userData.name.charAt(0)}
            </div>
            ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar (แถบเมนูล่างสำหรับสมาร์ทโฟน/แท็บเล็ต) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#151822]/95 backdrop-blur-lg border-t border-gray-800 flex justify-around items-center py-2 px-3 shadow-[0_-5px_20px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => setActiveMenu('home')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'home'
              ? 'text-[#00b87c] font-bold bg-[#00b87c]/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">📱</span>
          <span className="text-[11px] mt-1">เข้าเรียน</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMenu('schedule')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'schedule'
              ? 'text-[#00b87c] font-bold bg-[#00b87c]/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">📅</span>
          <span className="text-[11px] mt-1">ตารางเรียน</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMenu('history')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-xl transition-all ${
            activeMenu === 'history'
              ? 'text-[#00b87c] font-bold bg-[#00b87c]/10 shadow-sm'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-xl leading-none">📊</span>
          <span className="text-[11px] mt-1">ประวัติ</span>
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 md:p-10 overflow-y-auto min-h-screen md:h-screen pb-24 md:pb-10 scroll-smooth">
        {!configured && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            ⚠️ <strong>คำแนะนำ:</strong> ยังไม่ได้ตั้งค่า Supabase URL หรือ Anon Key ในไฟล์ <code>.env.local</code>
          </div>
        )}
        
        {/* =========================================
            หน้า 1: เข้าเรียน (Live Room) 
            ========================================= */}
        {activeMenu === 'home' && (
          <div className="animate-fadeIn max-w-6xl mx-auto w-full">
            <h2 className="text-2xl font-bold text-white mb-8">เข้าสู่ห้องเรียน</h2>
            
            {!joinedClass ? (
              <div className="bg-[#151822] border border-gray-800 p-10 rounded-2xl max-w-2xl mx-auto shadow-sm">
                <p className="text-gray-400 mb-6 text-center font-medium">เลือกวิธีเข้าเรียน (ระบบจะจับระยะห่าง GPS)</p>
                
                {/* กล่องแสดงสถานะ GPS ของนักศึกษา */}
                <div className="bg-[#0d1017] border border-gray-800 rounded-2xl p-4 mb-6 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-300 flex items-center gap-2">
                      📍 พิกัด GPS เครื่องของคุณ:
                    </span>
                    {myLocation.lat !== 0 ? (
                      <span className="text-emerald-400 font-bold text-xs bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        พร้อม ({myLocation.lat.toFixed(4)}, {myLocation.lng.toFixed(4)})
                      </span>
                    ) : (
                      <span className="text-amber-400 font-bold text-xs bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                        {gpsStatus === 'requesting' ? 'กำลังขอพิกัด...' : 'ยังไม่ได้เชื่อมต่อ GPS'}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => requestStudentGPS()}
                      className="text-xs text-[#00b87c] hover:underline font-bold"
                    >
                      {myLocation.lat !== 0 ? '🔄 ตรวจจับพิกัดใหม่' : '👉 แตะเพื่ออนุญาตสิทธิ์ GPS'}
                    </button>
                  </div>
                </div>

                {isScanning ? (
                  <div className="max-w-sm mx-auto animate-fadeIn text-center">
                    <div className="overflow-hidden rounded-2xl border-2 border-[#00b87c] mb-6 p-1 bg-[#0d1017]">
                      <div className="rounded-xl overflow-hidden">
                         <Scanner onScan={(result: any[]) => handleScanSuccess(result[0].rawValue)} onError={(error: any) => console.log(error?.message)} />
                      </div>
                    </div>
                    <button type="button" onClick={() => setIsScanning(false)} className="text-gray-400 hover:text-white underline text-sm">ยกเลิกการสแกน</button>
                  </div>
                ) : (
                  <button type="button" onClick={handleStartScan} className="w-full bg-[#00b87c] hover:bg-[#00a36e] text-white py-4 rounded-xl font-bold text-lg mb-8 transition-colors flex justify-center items-center gap-2">
                    <span className="text-2xl">📸</span> สแกน QR Code (ต้องเปิด GPS)
                  </button>
                )}

                <div className="flex items-center gap-4 mb-8 opacity-50">
                  <div className="h-px bg-gray-700 flex-1"></div>
                  <span className="text-gray-400 text-sm">หรือใส่รหัส 6 หลัก</span>
                  <div className="h-px bg-gray-700 flex-1"></div>
                </div>

                <form onSubmit={handleJoinWithCode} className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="ใส่รหัสห้อง 6 หลัก" 
                    maxLength={6}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value)}
                    className="flex-1 bg-[#0d1017] border border-gray-800 rounded-xl px-6 py-4 text-center text-xl font-bold tracking-[0.2em] focus:outline-none focus:border-[#00b87c] text-white transition-all" 
                    required 
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 px-8 rounded-xl font-bold text-white transition-colors">
                    เข้าร่วม
                  </button>
                </form>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                
                {/* Tracking Panel (แสดงเป็นอันดับแรกบนมือถือและแท็บเล็ต) */}
                <div className="order-1 lg:order-2 lg:col-span-2 bg-[#151822] border border-gray-800 rounded-2xl p-5 sm:p-8 flex flex-col relative overflow-hidden shadow-xl">
                  <div className="absolute top-0 left-0 w-full h-1 bg-[#00b87c]"></div>
                  
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6 sm:mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></span>
                        <h2 className="text-xs sm:text-sm font-bold text-red-400">กำลังติดตามตำแหน่ง Live GPS</h2>
                      </div>
                      <h3 className="text-2xl sm:text-4xl font-black text-white">{joinedClass.code}</h3>
                    </div>
                    <button type="button" onClick={handleLeaveRoom} className="bg-gray-800/80 hover:bg-red-500/20 border border-gray-700 hover:border-red-500/50 text-gray-300 hover:text-red-400 px-3.5 py-2 rounded-xl font-bold transition-all text-xs sm:text-sm shadow">
                       🚪 ออกจากการติดตาม
                    </button>
                  </div>

                  <div className="bg-[#0d1017] rounded-2xl p-6 sm:p-10 text-center border border-gray-800 flex-1 flex flex-col justify-center items-center relative shadow-inner">
                    <p className="text-gray-400 mb-1 font-medium text-xs sm:text-sm">ระยะห่างจากอาจารย์ในห้องเรียน</p>
                    <p className={`text-5xl sm:text-7xl font-black mb-3 ${distTextColor}`}>
                      {dist.toFixed(0)} <span className="text-xl sm:text-2xl text-gray-500 font-normal ml-1">ม.</span>
                    </p>
                    <div className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold border ${statusColor} mb-5 max-w-full text-center`}>
                      {statusMessage}
                    </div>

                    {/* ข้อมูลเวลาเรียนสะสม */}
                    <div className="w-full max-w-md bg-[#11141c] border border-gray-800 rounded-xl p-3.5 sm:p-4 text-xs space-y-2 text-left mb-3 shadow-inner">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-medium">⏱️ เวลาเรียนสะสม:</span>
                        <span className="font-mono text-[#00b87c] font-black text-xs sm:text-sm">
                          {formatActiveDuration(currentStudents.find(s => s.studentId === userData.userId)?.totalActiveSeconds)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-400 font-medium">🕒 เข้าห้องครั้งแรก:</span>
                        <span className="font-mono text-gray-300 font-bold">
                          {currentStudents.find(s => s.studentId === userData.userId)?.firstJoinTime || currentStudents.find(s => s.studentId === userData.userId)?.joinTime || '-'}
                        </span>
                      </div>
                      {(currentStudents.find(s => s.studentId === userData.userId)?.reconnectCount || 0) > 0 && (
                        <div className="flex justify-between items-center text-amber-400 pt-1 border-t border-gray-800/60">
                          <span className="font-medium">🔄 เข้าเรียนต่อเนื่อง:</span>
                          <span className="font-bold">ครั้งที่ {(currentStudents.find(s => s.studentId === userData.userId)?.reconnectCount || 0) + 1}</span>
                        </div>
                      )}
                    </div>

                    <div className="w-full max-w-md bg-[#151822] border border-gray-800/80 rounded-xl p-3.5 sm:p-4 text-xs space-y-2 text-left">
                      <div className="flex justify-between items-center flex-wrap gap-1">
                        <span className="text-gray-400">📍 พิกัดของคุณ:</span>
                        <span className="font-mono text-emerald-400 font-bold text-[11px] sm:text-xs">
                          {myLocation.lat ? `${myLocation.lat.toFixed(5)}, ${myLocation.lng.toFixed(5)}` : 'กำลังระบุพิกัด...'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center flex-wrap gap-1">
                        <span className="text-gray-400">🏫 พิกัดห้องเรียนอาจารย์:</span>
                        <span className="font-mono text-blue-400 font-bold text-[11px] sm:text-xs">
                          {teacherLocation.lat ? `${teacherLocation.lat.toFixed(5)}, ${teacherLocation.lng.toFixed(5)}` : 'ไม่มีข้อมูลพิกัด'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => requestStudentGPS()}
                      className="mt-4 text-xs text-[#00b87c] hover:underline flex items-center gap-1 font-bold py-1 px-2 rounded"
                    >
                      🔄 แตะเพื่อรีเฟรชพิกัด GPS ของอุปกรณ์
                    </button>
                  </div>
                </div>

                {/* Chat Panel */}
                <div className="order-2 lg:order-1 lg:col-span-1 bg-[#151822] border border-gray-800 rounded-2xl flex flex-col overflow-hidden h-[420px] sm:h-[500px] lg:h-[600px] shadow-xl">
                  <div className="p-3.5 sm:p-4 border-b border-gray-800 bg-[#1a1d27] flex items-center justify-between">
                    <h3 className="font-bold text-white text-xs sm:text-sm flex items-center gap-1.5">
                      <span>💬</span> แชทห้องเรียน
                    </h3>
                    <span className="text-[10px] text-gray-400 font-mono">{chatMessages.length} ข้อความ</span>
                  </div>
                  <div className="flex-1 p-3.5 sm:p-4 space-y-3 sm:space-y-4 overflow-y-auto">
                    {chatMessages.map((msg: ChatMessage, idx: number) => (
                      <div key={`chat-${idx}`} className={`p-3 rounded-xl max-w-[88%] ${msg.sender === userData.name ? 'bg-[#00b87c]/20 border border-[#00b87c]/30 ml-auto rounded-tr-none' : msg.sender === 'System' ? 'bg-gray-800/50 mx-auto text-center border border-gray-700' : 'bg-[#0d1017] border border-gray-800 rounded-tl-none'}`}>
                        {msg.sender !== 'System' && <p className={`text-[11px] mb-1 font-bold ${msg.sender === userData.name ? 'text-[#00b87c]' : 'text-blue-400'}`}>{msg.sender} <span className="text-gray-500 font-normal ml-1.5">{msg.time}</span></p>}
                        {msg.type === "image" ? <img src={msg.imageUrl} alt="img" className="mt-2 rounded-lg max-w-full max-h-48 object-contain" /> : <p className={`text-xs sm:text-sm ${msg.sender === 'System' ? 'text-gray-400 text-xs' : 'text-gray-200'}`}>{msg.text}</p>}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-gray-800 bg-[#1a1d27] flex gap-2">
                    <input name="message" placeholder="พิมพ์ข้อความ..." className="flex-1 bg-[#0d1017] border border-gray-800 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 focus:outline-none focus:border-[#00b87c] text-white text-xs sm:text-sm" required />
                    <button type="submit" className="bg-[#00b87c] hover:bg-[#00a36e] px-4 rounded-xl font-bold text-white text-xs sm:text-sm transition-colors">ส่ง</button>
                  </form>
                </div>
                
              </div>
            )}
          </div>
        )}
        
        {/* =========================================
            หน้า 2: ตารางเรียน 
            ========================================= */}
        {activeMenu === 'schedule' && (
          <div className="animate-fadeIn max-w-6xl mx-auto w-full">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-white">ตารางเรียน</h2>
              <button 
                type="button"
                onClick={() => setShowAddCourseModal(true)} 
                className="bg-[#00b87c] hover:bg-[#00a36e] px-4 py-2 rounded-xl font-bold text-white transition-colors text-sm"
              >
                + เพิ่มวิชาเรียน
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4" key={refreshSchedule}>
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map((day: string) => {
                const scheduleData = JSON.parse(localStorage.getItem('my_schedule') || "{}");
                const daysSchedule = scheduleData[day] || [];
                
                return (
                  <div key={day} className="bg-[#151822] border border-gray-800 rounded-2xl p-5 flex flex-col">
                    <h3 className="text-base font-bold text-[#00b87c] mb-4 pb-2 border-b border-gray-800 uppercase">{day}</h3>
                    
                    <div className="space-y-3 flex-1">
                      {daysSchedule.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm font-medium">
                          ไม่มีวิชาเรียน
                        </div>
                      ) : (
                        daysSchedule.map((item: ScheduleItemType) => (
                          <div key={item.id} className="bg-[#0d1017] p-4 rounded-xl border border-gray-800 hover:border-[#00b87c]/50 transition-colors">
                            <div className="font-bold text-white text-base mb-1">{item.code}</div>
                            <p className="text-gray-400 text-xs mb-3 truncate font-medium">{item.name}</p>
                            <div className="flex flex-col gap-1.5 mt-auto">
                               {item.time && <div className="bg-gray-800/50 text-gray-300 text-[10px] font-bold px-2 py-1 rounded w-fit">🕒 {item.time}</div>}
                               {item.location && <div className="bg-gray-800/50 text-gray-300 text-[10px] font-bold px-2 py-1 rounded w-fit">📍 {item.location}</div>}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================
            หน้า 3: ประวัติและสถิติ
            ========================================= */}
        {activeMenu === 'history' && (
          <div className="animate-fadeIn max-w-[1400px] mx-auto w-full">
            <h2 className="text-2xl font-bold text-white mb-6">ประวัติและสถิติ</h2>
            
            {/* สถิติ 4 กล่องบน */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8">
               <div className="bg-[#151822] border border-gray-800 p-6 rounded-2xl text-center flex flex-col justify-center">
                 <p className="text-gray-400 text-xs md:text-sm mb-2 font-medium">เรียนทั้งหมด</p>
                 <p className="text-3xl font-bold text-white">{totalClasses} <span className="text-sm font-normal text-gray-500">คาบ</span></p>
               </div>
               <div className="bg-[#0e2920] border border-[#00b87c]/30 p-6 rounded-2xl text-center flex flex-col justify-center">
                 <p className="text-[#00b87c] text-xs md:text-sm mb-2 font-medium">เข้าเรียน (เขียว)</p>
                 <p className="text-3xl font-bold text-[#00b87c]">{successClasses} <span className="text-sm font-normal text-emerald-800">คาบ</span></p>
               </div>
               <div className="bg-[#292211] border border-yellow-500/30 p-6 rounded-2xl text-center flex flex-col justify-center">
                 <p className="text-yellow-500 text-xs md:text-sm mb-2 font-medium">เฝ้าระวัง (เหลือง)</p>
                 <p className="text-3xl font-bold text-yellow-500">{warningClasses} <span className="text-sm font-normal text-yellow-800">คาบ</span></p>
               </div>
               <div className="bg-[#2c1618] border border-red-500/30 p-6 rounded-2xl text-center flex flex-col justify-center">
                 <p className="text-rose-500 text-xs md:text-sm mb-2 font-medium">ขาดเรียน (แดง)</p>
                 <p className="text-3xl font-bold text-rose-500">{errorClasses} <span className="text-sm font-normal text-rose-800">คาบ</span></p>
               </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 md:gap-8">
              
              {/* Calendar Panel (ซ้าย) */}
              <div className="xl:col-span-4 flex flex-col bg-[#151822] p-6 rounded-2xl border border-gray-800">
                 <div className="flex justify-between items-center mb-6">
                    <button type="button" onClick={() => { setCalendarDate(new Date(currentYear, currentMonth - 1, 1)); setSelectedDate(null); }} className="w-8 h-8 rounded bg-gray-800/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors">&lt;</button>
                    <h3 className="font-bold text-lg text-[#00b87c]">{monthNamesThai[currentMonth]} {currentYear}</h3>
                    <button type="button" onClick={() => { setCalendarDate(new Date(currentYear, currentMonth + 1, 1)); setSelectedDate(null); }} className="w-8 h-8 rounded bg-gray-800/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors">&gt;</button>
                 </div>
                 
                 <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500 mb-2 font-medium">
                    <div>อา</div><div>จ</div><div>อ</div><div>พ</div><div>พฤ</div><div>ศ</div><div>ส</div>
                 </div>
                 
                 <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium">
                    {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                      <div key={`empty-${i}`} className="py-2.5"></div>
                    ))}
                    
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day: number) => {
                       const dayRecords = historyData.filter((h: HistoryRecordType) => h.day === day);
                       let bgColor = "hover:bg-gray-800 text-gray-300 border border-transparent";
                       let isSpecial = false;
                       
                       if (dayRecords.length > 0) {
                         isSpecial = true;
                         if (dayRecords.some(r => r.type === 'error')) {
                           bgColor = "bg-rose-900/40 text-rose-500 border border-rose-500/50 rounded-lg";
                         } else if (dayRecords.some(r => r.type === 'warning')) {
                           bgColor = "bg-amber-900/40 text-amber-500 border border-amber-500/50 rounded-lg";
                         } else {
                           bgColor = "bg-[#00b87c] text-white rounded-lg";
                         }
                       }

                       return (
                         <button 
                           key={day} 
                           type="button"
                           onClick={() => setSelectedDate(selectedDate === day ? null : day)}
                           className={`py-2.5 w-full transition-all ${bgColor} ${isSpecial ? 'font-bold' : ''}`}
                         >
                            {day}
                         </button>
                       )
                    })}
                 </div>
                 
                 <div className="mt-8 space-y-3 text-xs text-gray-400 border-t border-gray-800 pt-6">
                    <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-[#00b87c]"></span> เข้าเรียน (อยู่ในรัศมี)</div>
                    <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span> เฝ้าระวัง (50-100 ม.)</div>
                    <div className="flex items-center gap-3"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> ขาดเรียน (เกิน 100 ม.)</div>
                 </div>
              </div>

              {/* Table Panel (ขวา) */}
              <div className="xl:col-span-8 bg-[#151822] rounded-2xl border border-gray-800 overflow-hidden flex flex-col shadow-xl">
                 <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[560px]">
                       <thead className="bg-[#1f222e] text-gray-400 text-xs sm:text-sm">
                          <tr>
                             <th className="p-4 sm:p-6 font-medium">วันที่</th>
                             <th className="p-4 sm:p-6 font-medium">วิชา</th>
                             <th className="p-4 sm:p-6 font-medium text-center">เวลาเช็คชื่อ</th>
                             <th className="p-4 sm:p-6 font-medium text-center">สถานะ / ระยะทาง</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-800/50">
                          {filteredHistory.length > 0 ? (
                             filteredHistory.map((record: HistoryRecordType) => (
                                <tr key={record.id} className="hover:bg-gray-800/30 transition-colors">
                                   <td className="p-4 sm:p-6 text-gray-300 text-xs sm:text-sm whitespace-nowrap">{record.dateStr}</td>
                                   <td className="p-4 sm:p-6">
                                      <div className="font-bold text-blue-400 text-sm sm:text-base mb-0.5">{record.code}</div> 
                                      <span className="text-gray-500 text-xs">{record.name}</span>
                                   </td>
                                   <td className="p-4 sm:p-6 text-center text-gray-300 text-xs sm:text-sm">{record.time}</td>
                                   <td className="p-4 sm:p-6 text-center h-full align-middle">
                                      <div className="flex justify-center items-center w-full h-full pt-1">
                                        {record.type === 'success' && <span className="inline-flex items-center justify-center bg-[#00b87c]/10 text-[#00b87c] border border-[#00b87c]/30 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">✅ {record.status} {record.distance && `(${record.distance}m)`}</span>}
                                        {record.type === 'warning' && <span className="inline-flex items-center justify-center bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">⚠️ {record.status} {record.distance && `(${record.distance}m)`}</span>}
                                        {record.type === 'error' && <span className="inline-flex items-center justify-center bg-rose-500/10 text-rose-500 border border-rose-500/30 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap">🚫 {record.status}</span>}
                                      </div>
                                   </td>
                                </tr>
                             ))
                          ) : (
                             <tr>
                                <td colSpan={4} className="py-20 text-center">
                                   <div className="text-4xl mb-4 opacity-20 grayscale">📭</div>
                                   <p className="font-medium text-gray-500">ไม่มีข้อมูลเข้าเรียน</p>
                                </td>
                             </tr>
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}