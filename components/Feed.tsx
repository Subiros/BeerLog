"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FeedItem } from "@/lib/types";

function ago(d: string) {
    const m = Math.floor(
        (Date.now() - new Date(d).getTime()) / 60000
    );

    if (m < 1) return "ahora";
    if (m < 60) return `hace ${m} min`;
    if (m < 1440) return `hace ${Math.floor(m / 60)} h`;

    return new Date(d).toLocaleDateString("es-ES");
}

export default function Feed() {
    const [items, setItems] = useState<FeedItem[] | null>(null);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.rpc("feed", { lim: 50 });

            const list = (data ?? []) as FeedItem[];
            const paths = list.map(b => b.photo_path).filter(Boolean) as string[];

            const signed = paths.length
                ? (await supabase.storage
                    .from("beer-photos")
                    .createSignedUrls(paths, 3600)).data ?? []
                : [];

            const map = new Map(signed.map(s => [s.path, s.signedUrl]));

            setItems(
                list.map(b => ({
                    ...b,
                    url: b.photo_path
                        ? (map.get(b.photo_path) ?? undefined)
                        : undefined
                }))
            );
        })();
    }, []);

    if (!items) return <p className="mu">Cargando...</p>;

    return (
        <>
            <h1>Inicio</h1>

            {items.length === 0 && (
                <div className="card mu">
                    Aún no hay cervezas. Registra la primera o añade amigos en la pestaña Amigos.
                </div>
            )}

            {items.map(b => (
                <div className="card" key={b.id}>
                    <div
                        className="row"
                        style={{ justifyContent: "space-between" }}
                    >
                        <b>{b.username}</b>
                        <span className="mu" style={{ textAlign: "right" }}>
                            {ago(b.created_at)}
                        </span>
                    </div>

                    {b.url && (
                        <img
                            src={b.url}
                            alt=""
                            style={{ width: "100%", borderRadius: 10, margin: "8px 0" }}
                        />
                    )}

                    <div>
                        🍺 <b>{b.brand}</b>{" "}
                        <span className="mu">
                            {b.type} · {b.ml} ml · {b.abv}%
                        </span>
                    </div>

                    <div className="mu">
                        {b.place ?? "—"}
                        {b.with_whom ? ` · con ${b.with_whom}` : ""}
                        {" · "}
                        {Number(b.price).toFixed(2)} €
                    </div>
                </div>
            ))}
        </>
    );
}