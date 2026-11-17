import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type Beer = {
  id: string; brand: string; type: string; abv: number; ml: number; price: number;
  place: string | null; with_whom: string | null; photo_path: string | null; created_at: string;
};