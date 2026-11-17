import type { Beer } from "@/lib/supabase";

export type BeerUrl = Beer & {
  url?: string;
};

export type Me = {
  username: string;
  invite_code: string;
} | null;

export type FeedItem = Beer & {
  username: string;
  url?: string;
};

export type Rank = {
  username: string;
  beers: number;
  alcohol_ml: number;
  spent: number;
};