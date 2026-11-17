"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Me, Rank } from "@/lib/types";

export default function Ranking({ me }: { me: Me }) {
    const [rows, setRows] = useState<Rank[]>([]);
    const [code, setCode] = useState("");
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        const { data } = await supabase.rpc("friend_ranking");
        setRows((data ?? []) as Rank[]);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function add() {
        const { data } = await supabase.rpc("add_friend_by_code", {
            code
        });

        setMsg(data === "ok" ? "¡Amigo añadido!" : String(data));
        setCode("");
        load();
    }

    return (
        <>
            <h1>Ranking entre amigos</h1>

            <div className="card">
                {rows.map((r, i) => (
                    <div className="item" key={r.username}>
                        <b>{i + 1}</b>

                        <div>
                            {r.username}

                            <div className="mu">
                                {r.beers} registres ·
                                {(Number(r.alcohol_ml) / 1000).toFixed(2)} L ·
                                {Number(r.spent).toFixed(2)} €
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="card">
                <b>Añadir amigo</b>

                <p className="mu">
                    Tu código: <b>{me?.invite_code}</b>
                    (compártelo con tus amigos)
                </p>

                <div className="row">
                    <input
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        placeholder="Código de tu amigo"
                    />

                    <button
                        onClick={add}
                        style={{ marginTop: 0, flex: "0 0 90px" }}
                    >
                        Añadir
                    </button>
                </div>

                {msg && <p className="mu">{msg}</p>}
            </div>
        </>
    );
}