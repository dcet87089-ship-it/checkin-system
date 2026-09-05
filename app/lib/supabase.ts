import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !url.includes('your-project-id') && !url.includes('ใส่_URL'));
};

export const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// Types
// ==========================================
export interface UserProfile {
  id?: string;
  email: string;
  name: string;
  userId: string;
  role: 'teacher' | 'student' | 'admin';
  major?: string;
  created_at?: string;
}

export interface TeacherCourse {
  id: string;
  code: string;
  name: string;
  teacherId?: string;
  created_at?: string;
}

export interface StudentSchedule {
  id: string;
  studentId: string;
  code: string;
  name: string;
  day: string;
  time?: string;
  location?: string;
  created_at?: string;
}

export interface RoomSettings {
  courseCode: string;
  name: string;
  joinCode: string;
  teacherName: string;
  startTime?: string;
  sessionNum?: string;
  maxStudents?: number;
  durationMinutes?: number;
  endTime?: number;
  pinnedMessage?: string | null;
}

export interface StudentData {
  id?: number | string;
  studentId: string;
  name: string;
  major?: string;
  status?: string;
  lat?: number;
  lng?: number;
  distance?: number;
  gpsActive?: boolean;
  gpsError?: string;
  joinTime?: string;
  firstJoinTime?: string;
  lastSeen?: string;
  totalActiveSeconds?: number;
  lastTick?: number;
  reconnectCount?: number;
  leaveReason?: string;
}

export interface ChatMessage {
  sender: string;
  text: string;
  time: string;
  type?: string;
  imageUrl?: string;
}

export interface RoomRecord {
  id: string; // joinCode
  settings: RoomSettings;
  teacher_location: { lat: number; lng: number };
  teacherLocation?: { lat: number; lng: number };
  students: StudentData[];
  chat: ChatMessage[];
  created_at?: string;
}

export interface HistoryRecord {
  id: string;
  courseCode: string;
  courseName: string;
  teacherName: string;
  sessionNum: string;
  dateStr: string;
  timestamp: string;
  studentsData: StudentData[];
  teacherLocation?: { lat: number; lng: number };
  created_at?: string;
}

// ==========================================
// User & Profile Management
// ==========================================
export async function getUserByEmail(email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      userId: data.user_id,
      role: data.role,
      major: data.major,
      created_at: data.created_at,
    };
  } catch (err) {
    console.warn('Error fetching user from Supabase, checking local cache:', err);
    return null;
  }
}

export async function upsertUser(user: UserProfile): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').upsert({
      id: user.email.trim().toLowerCase(),
      email: user.email.trim().toLowerCase(),
      name: user.name,
      user_id: user.userId,
      role: user.role,
      major: user.major || 'วิศวกรรมคอมพิวเตอร์',
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error upserting user to Supabase:', err);
    return false;
  }
}

export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      userId: row.user_id,
      role: row.role,
      major: row.major,
      created_at: row.created_at,
    }));
  } catch (err) {
    console.warn('Error fetching all users from Supabase:', err);
    return [];
  }
}

// ==========================================
// Course Management (Teacher)
// ==========================================
export async function getCoursesByTeacher(teacherId: string): Promise<TeacherCourse[]> {
  try {
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        teacherId: r.teacher_id,
        created_at: r.created_at,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Error fetching courses from Supabase:', err);
    return [];
  }
}

export async function addCourse(course: { code: string; name: string; teacherId: string }): Promise<TeacherCourse | null> {
  try {
    const { data, error } = await supabase.from('courses').insert({
      code: course.code,
      name: course.name,
      teacher_id: course.teacherId,
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      teacherId: data.teacher_id,
      created_at: data.created_at,
    };
  } catch (err) {
    console.warn('Error adding course to Supabase:', err);
    return null;
  }
}

export async function deleteCourse(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error deleting course from Supabase:', err);
    return false;
  }
}

// ==========================================
// Schedules Management (Student)
// ==========================================
export async function getSchedulesByStudent(studentId: string): Promise<StudentSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      return data.map(r => ({
        id: r.id,
        studentId: r.student_id,
        code: r.code,
        name: r.name,
        day: r.day,
        time: r.time,
        location: r.location,
        created_at: r.created_at,
      }));
    }
    return [];
  } catch (err) {
    console.warn('Error fetching schedules from Supabase:', err);
    return [];
  }
}

export async function addSchedule(item: {
  studentId: string;
  code: string;
  name: string;
  day: string;
  time?: string;
  location?: string;
}): Promise<StudentSchedule | null> {
  try {
    const { data, error } = await supabase.from('schedules').insert({
      student_id: item.studentId,
      code: item.code,
      name: item.name,
      day: item.day,
      time: item.time,
      location: item.location,
    }).select().single();

    if (error) throw error;
    return {
      id: data.id,
      studentId: data.student_id,
      code: data.code,
      name: data.name,
      day: data.day,
      time: data.time,
      location: data.location,
      created_at: data.created_at,
    };
  } catch (err) {
    console.warn('Error adding schedule to Supabase:', err);
    return null;
  }
}

export async function deleteSchedule(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.warn('Error deleting schedule from Supabase:', err);
    return false;
  }
}

// ==========================================
// Helpers for Room Management
// ==========================================
export async function getActiveRooms(): Promise<RoomRecord[]> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      settings: row.settings || {},
      teacher_location: row.teacher_location || row.teacherLocation || { lat: 0, lng: 0 },
      teacherLocation: row.teacher_location || row.teacherLocation || { lat: 0, lng: 0 },
      students: row.students || [],
      chat: row.chat || [],
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error('Error fetching active rooms:', err);
    return [];
  }
}

export async function getRoom(roomCode: string): Promise<RoomRecord | null> {
  try {
    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomCode)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      settings: data.settings || {},
      teacher_location: data.teacher_location || data.teacherLocation || { lat: 0, lng: 0 },
      teacherLocation: data.teacher_location || data.teacherLocation || { lat: 0, lng: 0 },
      students: data.students || [],
      chat: data.chat || [],
      created_at: data.created_at,
    };
  } catch (err) {
    console.error('Error fetching room:', err);
    return null;
  }
}

export async function createRoom(room: {
  id: string;
  settings: RoomSettings;
  teacherLocation: { lat: number; lng: number };
  students: StudentData[];
  chat: ChatMessage[];
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('rooms').upsert({
      id: room.id,
      settings: room.settings,
      teacher_location: room.teacherLocation,
      students: room.students,
      chat: room.chat,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error creating room:', err);
    return false;
  }
}

export async function updateRoom(
  roomCode: string,
  updates: {
    students?: StudentData[];
    chat?: ChatMessage[];
    settings?: RoomSettings;
    teacher_location?: { lat: number; lng: number };
  }
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('id', roomCode);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error updating room:', err);
    return false;
  }
}

export async function deleteRoom(roomCode: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('rooms').delete().eq('id', roomCode);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting room:', err);
    return false;
  }
}

// ==========================================
// Helpers for History
// ==========================================
export async function getAllHistory(): Promise<HistoryRecord[]> {
  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) throw error;
    return (data || []).map(row => ({
      id: row.id,
      courseCode: row.course_code,
      courseName: row.course_name,
      teacherName: row.teacher_name,
      sessionNum: row.session_num,
      dateStr: row.date_str,
      timestamp: row.timestamp,
      studentsData: row.students_data || [],
      teacherLocation: row.teacher_location || row.teacherLocation || { lat: 0, lng: 0 },
      created_at: row.created_at,
    }));
  } catch (err) {
    console.error('Error fetching history:', err);
    return [];
  }
}

export async function addHistory(record: {
  courseCode: string;
  courseName: string;
  teacherName: string;
  timestamp: string;
  dateStr: string;
  studentsData: StudentData[];
  sessionNum: string;
  teacherLocation?: { lat: number; lng: number };
}): Promise<boolean> {
  try {
    const { error } = await supabase.from('history').insert({
      course_code: record.courseCode,
      course_name: record.courseName,
      teacher_name: record.teacherName,
      timestamp: record.timestamp,
      date_str: record.dateStr,
      students_data: record.studentsData,
      session_num: record.sessionNum,
      teacher_location: record.teacherLocation || { lat: 0, lng: 0 },
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error adding history:', err);
    return false;
  }
}

export async function deleteHistory(id: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('history').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting history:', err);
    return false;
  }
}

// ==========================================
// Realtime Subscriptions
// ==========================================
export function subscribeToRoom(
  roomCode: string,
  onUpdate: (room: RoomRecord) => void,
  onDelete: () => void
) {
  const channel = supabase
    .channel(`room_${roomCode}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rooms',
        filter: `id=eq.${roomCode}`,
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onDelete();
        } else if (payload.new) {
          const row = payload.new as any;
          onUpdate({
            id: row.id,
            settings: row.settings || {},
            teacher_location: row.teacher_location || row.teacherLocation || { lat: 0, lng: 0 },
            teacherLocation: row.teacher_location || row.teacherLocation || { lat: 0, lng: 0 },
            students: row.students || [],
            chat: row.chat || [],
            created_at: row.created_at,
          });
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToHistory(onChange: () => void) {
  const channel = supabase
    .channel('history_channel')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'history',
      },
      () => {
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}