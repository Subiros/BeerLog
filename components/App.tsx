"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Beer } from "@/lib/supabase";
import type { BeerUrl, Me } from "@/lib/types";

import Feed from "@/components/Feed";
import AddBeer from "@/components/AddBeer";
import Profile from "@/components/Profile";
import Ranking from "@/components/Ranking";

export default function App({ session }: { session: Session }) {
    const [tab, setTab] = useState<"feed" | "add" | "me" | "rank">("feed");
    const [beers, setBeers] = useState<BeerUrl[]>([]);
    const [me, setMe] = useState<Me>(null);

    const load = useCallback(async () => {
        const uid = session.user.id;

        const { data: p } = await supabase
            .from("profiles")
            .select("username,invite_code")
            .eq("id", uid)
            .single();

        setMe(p);

        const { data } = await supabase
            .from("beers")
            .select("*")
            .eq("user_id", uid)
            .order("created_at", { ascending: false });

        const list = (data ?? []) as Beer[];

        const paths = list
            .map(b => b.photo_path)
            .filter(Boolean) as string[];

        const signed = paths.length
            ? (await supabase.storage
                .from("beer-photos")
                .createSignedUrls(paths, 3600)).data ?? []
            : [];

        const map = new Map(signed.map(s => [s.path, s.signedUrl]));

        setBeers(
            list.map(b => ({
                ...b,
                url: b.photo_path
                    ? (map.get(b.photo_path) ?? undefined)
                    : undefined
            }))
        );
    }, [session]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <>
            {tab === "feed" && <Feed />}

            {tab === "add" && (
                <AddBeer
                    uid={session.user.id}
                    done={() => {
                        load();
                        setTab("feed");
                    }}
                />
            )}

            {tab === "me" && (
                <Profile beers={beers} me={me} reload={load} />
            )}

            {tab === "rank" && <Ranking me={me} />}

            <nav>
                {(["feed", "add", "me", "rank"] as const).map(t => (
                    <button
                        key={t}
                        className={tab === t ? "on" : ""}
                        onClick={() => setTab(t)}
                    >
                        {{
                            feed: "🏠 Inicio",
                            add: "➕ Registrar",
                            me: "👤 Perfil",
                            rank: "🏆 Amigos"
                        }[t]}
                    </button>
                ))}
            </nav>
        </>
    );
}