"use client";

import { supabase } from "@/lib/supabase";
import type { BeerUrl, Me } from "@/lib/types";

export default function Profile({
    beers,
    me,
    reload
}: {
    beers: BeerUrl[];
    me: Me;
    reload: () => void;
}) {
    const ml = beers.reduce((a, b) => a + b.ml, 0);
    const alc = beers.reduce((a, b) => a + b.ml * b.abv / 100, 0);
    const eur = beers.reduce((a, b) => a + Number(b.price), 0);

    const top = (k: "brand" | "type") => {
        const m: Record<string, number> = {};

        beers.forEach(b => {
            m[b[k]] = (m[b[k]] || 0) + 1;
        });

        return Object.entries(m)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
    };

    async function del(id: string) {
        await supabase.from("beers").delete().eq("id", id);
        reload();
    }

    return (
        <>
            <h1>{me?.username ?? "Tu perfil"}</h1>

            <div className="card stats">
                <div className="stat">
                    <b>{beers.length}</b>
                    <span>registres</span>
                </div>

                <div className="stat">
                    <b>{(ml / 1000).toFixed(1)} L</b>
                    <span>volum total</span>
                </div>

                <div className="stat">
                    <b>{(alc / 1000).toFixed(2)} L</b>
                    <span>alcohol pur</span>
                </div>

                <div className="stat">
                    <b>{eur.toFixed(2)} €</b>
                    <span>gastat</span>
                </div>
            </div>

            {(["brand", "type"] as const).map(k => (
                <div className="card" key={k}>
                    <b>{k === "brand" ? "Marcas favorites" : "Tipus"}</b>

                    {top(k).map(([n, v]) => (
                        <div key={n} className="item">
                            <div>{n}</div>
                            <span className="mu">{v}</span>
                        </div>
                    ))}
                </div>
            ))}

            <div className="card">
                <b>Historial</b>

                {beers.map(b => (
                    <div className="item" key={b.id}>
                        {b.url ? (
                            <img src={b.url} alt="" />
                        ) : (
                            <span style={{ fontSize: 30 }}>🍺</span>
                        )}

                        <div>
                            <b>{b.brand}</b>{" "}
                            <span className="mu">
                                {b.type} · {b.ml} ml
                            </span>

                            <div className="mu">
                                {b.place ?? "—"}
                                {b.with_whom ? ` · con ${b.with_whom}` : ""}
                                {" · "}
                                {Number(b.price).toFixed(2)} €
                                {" · "}
                                {new Date(b.created_at).toLocaleDateString("es-ES")}
                            </div>
                        </div>

                        <button className="s" onClick={() => del(b.id)}>
                            ✕
                        </button>
                    </div>
                ))}
            </div>

            <button
                className="s"
                onClick={() => supabase.auth.signOut()}
            >
                Cerrar sesión
            </button>
        </>
    );
}