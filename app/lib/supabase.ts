import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !url.includes('your-project-id') && !url.includes('ใส่_URL'));
};

export const supabase = createClient(supabaseUrl, supabaseKey);

// Types
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
  joinTime?: string;
  lastSeen?: string;
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

// Helpers for Room Management
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

// Helpers for History
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

// Realtime Subscriptions
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