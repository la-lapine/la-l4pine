import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  "";

// Đọc đúng biến PUBLISHABLE_KEY của bạn
const supabaseKey = 
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  "";

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Chưa tìm thấy biến môi trường trên Vercel!");
} else {
  console.log("✅ ĐÃ KẾT NỐI SUPABASE THÀNH CÔNG RỒI!");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;
