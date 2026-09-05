-- ==============================================================================
-- สคริปต์สร้างฐานข้อมูลสำหรับระบบ CheckIn Classroom บน Supabase
-- วิธีใช้: นำโค้ดทั้งหมดนี้ไปวางในเมนู SQL Editor ในหน้าแดชบอร์ดของ Supabase แล้วกด RUN
-- ==============================================================================

-- 1. สร้างตาราง rooms สำหรับห้องเรียนที่กำลังเปิดสด (Active Rooms)
create table if not exists public.rooms (
  id text primary key, -- รหัสห้อง 6 หลัก (joinCode)
  settings jsonb not null default '{}'::jsonb,
  teacher_location jsonb not null default '{"lat": 0, "lng": 0}'::jsonb,
  students jsonb not null default '[]'::jsonb,
  chat jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. สร้างตาราง history สำหรับประวัติคลาสเรียนที่สอนเสร็จสิ้นแล้ว
create table if not exists public.history (
  id uuid default gen_random_uuid() primary key,
  course_code text not null,
  course_name text not null,
  teacher_name text not null,
  session_num text default '1',
  date_str text not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  students_data jsonb not null default '[]'::jsonb,
  teacher_location jsonb default '{"lat": 0, "lng": 0}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. สร้างตาราง users สำหรับเก็บรายชื่อผู้ใช้ (อาจารย์ / นักศึกษา)
create table if not exists public.users (
  id text primary key, -- email
  email text unique not null,
  name text not null,
  user_id text not null, -- รหัสนักศึกษา หรือ รหัสอาจารย์
  role text not null check (role in ('teacher', 'student', 'admin')),
  major text default 'วิศวกรรมคอมพิวเตอร์',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. สร้างตาราง courses สำหรับเก็บรายวิชาประจำของอาจารย์
create table if not exists public.courses (
  id uuid default gen_random_uuid() primary key,
  code text not null,
  name text not null,
  teacher_id text not null, -- userId หรือ email ของอาจารย์
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. สร้างตาราง schedules สำหรับเก็บตารางเรียนของนักศึกษา
create table if not exists public.schedules (
  id uuid default gen_random_uuid() primary key,
  student_id text not null, -- userId ของนักศึกษา
  code text not null,
  name text not null,
  day text not null, -- 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
  time text,
  location text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- เปิดการส่งข้อมูล Realtime ให้กับทุกตาราง
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.history;
alter publication supabase_realtime add table public.users;
alter publication supabase_realtime add table public.courses;
alter publication supabase_realtime add table public.schedules;

-- ตั้งค่า RLS (Row Level Security) แบบสาธารณะ
alter table public.rooms enable row level security;
alter table public.history enable row level security;
alter table public.users enable row level security;
alter table public.courses enable row level security;
alter table public.schedules enable row level security;

-- นโยบายเปิดให้อ่าน-เขียนได้ (Public Access) สำหรับระบบห้องเรียน
drop policy if exists "Allow public all access on rooms" on public.rooms;
create policy "Allow public all access on rooms" on public.rooms for all using (true) with check (true);

drop policy if exists "Allow public all access on history" on public.history;
create policy "Allow public all access on history" on public.history for all using (true) with check (true);

drop policy if exists "Allow public all access on users" on public.users;
create policy "Allow public all access on users" on public.users for all using (true) with check (true);

drop policy if exists "Allow public all access on courses" on public.courses;
create policy "Allow public all access on courses" on public.courses for all using (true) with check (true);

drop policy if exists "Allow public all access on schedules" on public.schedules;
create policy "Allow public all access on schedules" on public.schedules for all using (true) with check (true);
