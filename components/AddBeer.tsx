"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { TYPES, ABV, SIZES } from "@/lib/constants";

async function shrink(file: File): Promise<Blob> {
    const img = await createImageBitmap(file);
    const s = Math.min(1, 800 / Math.max(img.width, img.height));

    const c = document.createElement("canvas");
    c.width = img.width * s;
    c.height = img.height * s;

    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);

    return new Promise(r =>
        c.toBlob(b => r(b!), "image/jpeg", 0.7)
    );
}

export default function AddBeer({
    uid,
    done
}: {
    uid: string;
    done: () => void;
}) {
    const [f, setF] = useState({
        brand: "",
        type: "Lager",
        abv: "4.8",
        ml: "330",
        price: "",
        place: "",
        who: ""
    });

    const [file, setFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const set = (k: string, v: string) =>
        setF(p => ({ ...p, [k]: v }));

    async function save() {
        if (!f.brand.trim()) return;

        setBusy(true);

        let photo_path: string | null = null;

        if (file) {
            photo_path = `${uid}/${Date.now()}.jpg`;

            await supabase.storage
                .from("beer-photos")
                .upload(photo_path, await shrink(file), {
                    contentType: "image/jpeg"
                });
        }

        await supabase.from("beers").insert({
            brand: f.brand.trim(),
            type: f.type,
            abv: +f.abv || 0,
            ml: +f.ml,
            price: +f.price || 0,
            place: f.place.trim() || null,
            with_whom: f.who.trim() || null,
            photo_path
        });

        setBusy(false);
        done();
    }

    return (
        <div className="card">
            <h1>¿Qué te estás bebiendo?</h1>

            <label>Marca / cerveza</label>
            <input
                value={f.brand}
                onChange={e => set("brand", e.target.value)}
                placeholder="Estrella Damm, Moritz..."
            />

            <div className="row">
                <div>
                    <label>Tipo</label>
                    <select
                        value={f.type}
                        onChange={e => {
                            set("type", e.target.value);
                            set("abv", String(ABV[e.target.value]));
                        }}
                    >
                        {TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                </div>

                <div>
                    <label>Graduación %</label>
                    <input
                        type="number"
                        step="0.1"
                        value={f.abv}
                        onChange={e => set("abv", e.target.value)}
                    />
                </div>
            </div>

            <div className="row">
                <div>
                    <label>Tamaño</label>
                    <select
                        value={f.ml}
                        onChange={e => set("ml", e.target.value)}
                    >
                        {SIZES.map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label>Precio (€)</label>
                    <input
                        type="number"
                        step="0.05"
                        value={f.price}
                        onChange={e => set("price", e.target.value)}
                    />
                </div>
            </div>

            <label>Dónde</label>
            <input
                value={f.place}
                onChange={e => set("place", e.target.value)}
            />

            <label>Con quién</label>
            <input
                value={f.who}
                onChange={e => set("who", e.target.value)}
            />

            <label>Foto (opcional)</label>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
            />

            <button onClick={save} disabled={busy}>
                {busy ? "Guardando..." : "Registrar cerveza"}
            </button>
        </div>
    );
}