import { createClient } from "@supabase/supabase-js";

// Đọc biến môi trường an toàn tuyệt đối cho Vite
const supabaseUrl = 
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_URL) ||
  "";

const supabaseAnonKey = 
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  "";

// Nếu chưa có key thì không làm sập web, có key thì kết nối
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
