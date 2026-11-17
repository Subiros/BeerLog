"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
    const [mode, setMode] = useState<"in" | "up">("in");
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [err, setErr] = useState("");
    const [busy, setBusy] = useState(false);

    const name = user.trim().toLowerCase();

    async function go() {
        setErr("");

        if (!/^[a-z0-9_]{3,20}$/.test(name))
            return setErr("Usuario: 3 a 20 letras, números o _");

        if (pass.length < 6)
            return setErr("La contraseña necesita al menos 6 caracteres");

        setBusy(true);

        const email = `${name}@birreal.app`;

        if (mode === "up") {
            const { data: free, error: checkError } =
                await supabase.rpc("username_available", { name });

            if (checkError) {
                setBusy(false);
                return setErr("Error comprobando usuario: " + checkError.message);
            }

            if (free !== true) {
                setBusy(false);
                return setErr("Ese usuario ya existe");
            }

            const { error } = await supabase.auth.signUp({
                email,
                password: pass,
                options: { data: { username: name } }
            });

            if (error) setErr(error.message);
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password: pass
            });

            if (error) setErr(error.message);
        }

        setBusy(false);
    }

    return (
        <div className="card">
            <h1>🍺 BeerLog</h1>

            <h2 className="mu">
                Alguna vez te has preguntado cuánto gastas, consumes y que marcas?...
                Este es tu sitio.
            </h2>

            <p className="mu">
                {mode === "in" ? "Inicia sesión" : "Crea tu cuenta"}.
                Solo para mayores de edad.
            </p>

            <label>Usuario</label>
            <input
                value={user}
                onChange={e => setUser(e.target.value)}
                autoCapitalize="none"
            />

            <label>Contraseña</label>
            <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
            />

            <button onClick={go} disabled={busy}>
                {mode === "in" ? "Entrar" : "Registrarme"}
            </button>

            {err && <p className="mu">{err}</p>}

            <p>
                <button
                    className="s"
                    onClick={() => {
                        setMode(mode === "in" ? "up" : "in");
                        setErr("");
                    }}
                >
                    {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}
                </button>
            </p>
        </div>
    );
}