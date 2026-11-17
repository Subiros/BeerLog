"use client";
import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, Beer } from "@/lib/supabase";

const TYPES = ["Lager", "Pilsner", "IPA", "Stout", "Trigo", "Sin alcohol", "Otra"];
const ABV: Record<string, number> = { Lager: 4.8, Pilsner: 5, IPA: 6.5, Stout: 5.5, Trigo: 5, "Sin alcohol": 0.5, Otra: 5 };
const SIZES: [number, string][] = [[200, "200 ml"], [330, "Tercio 330 ml"], [500, "Media 500 ml"], [568, "Pinta 568 ml"], [1000, "Litro"]];
type BeerUrl = Beer & { url?: string };
type Me = { username: string; invite_code: string } | null;

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!ready) return null;
  return <main>{session ? <App session={session} /> : <Login />}</main>;
}

function Login() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [user, setUser] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const name = user.trim().toLowerCase();
  async function go() {
    setErr("");
    if (!/^[a-z0-9_]{3,20}$/.test(name)) return setErr("Usuario: 3 a 20 letras, números o _");
    if (pass.length < 6) return setErr("La contraseña necesita al menos 6 caracteres");
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
      const { error } = await supabase.auth.signUp({ email, password: pass, options: { data: { username: name } } });
      if (error) setErr(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setErr(error.message);
    }
    setBusy(false);
  }
  return (
    <div className="card"><h1>🍺 Birreal</h1>
      <p className="mu">{mode === "in" ? "Inicia sesión" : "Crea tu cuenta"}. Solo para mayores de edad.</p>
      <label>Usuario</label><input value={user} onChange={e => setUser(e.target.value)} autoCapitalize="none" />
      <label>Contraseña</label><input type="password" value={pass} onChange={e => setPass(e.target.value)} />
      <button onClick={go} disabled={busy}>{mode === "in" ? "Entrar" : "Registrarme"}</button>
      {err && <p className="mu">{err}</p>}
      <p><button className="s" onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(""); }}>
        {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}</button></p>
    </div>
  );
}

type FeedItem = Beer & { username: string; url?: string };

function ago(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  if (m < 1440) return `hace ${Math.floor(m / 60)} h`;
  return new Date(d).toLocaleDateString("es-ES");
}

function Feed() {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("feed", { lim: 50 });
      const list = (data ?? []) as (Beer & { username: string })[];
      const paths = list.map(b => b.photo_path).filter(Boolean) as string[];
      const signed = paths.length ? (await supabase.storage.from("beer-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
      const map = new Map(signed.map(s => [s.path, s.signedUrl]));
      setItems(list.map(b => ({ ...b, url: b.photo_path ? (map.get(b.photo_path) ?? undefined) : undefined })));
    })();
  }, []);
  if (!items) return <p className="mu">Cargando...</p>;
  return (<>
    <h1>Inicio</h1>
    {items.length === 0 && <div className="card mu">Aún no hay cervezas. Registra la primera o añade amigos en la pestaña Amigos.</div>}
    {items.map(b => <div className="card" key={b.id}>
      <div className="row" style={{ justifyContent: "space-between" }}><b>{b.username}</b><span className="mu" style={{ textAlign: "right" }}>{ago(b.created_at)}</span></div>
      {b.url && <img src={b.url} alt="" style={{ width: "100%", borderRadius: 10, margin: "8px 0" }} />}
      <div>🍺 <b>{b.brand}</b> <span className="mu">{b.type} · {b.ml} ml · {b.abv}%</span></div>
      <div className="mu">{b.place ?? "—"}{b.with_whom ? ` · con ${b.with_whom}` : ""} · {Number(b.price).toFixed(2)} €</div>
    </div>)}
  </>);
}

type Rank = { username: string; beers: number; alcohol_ml: number; spent: number };

function App({ session }: { session: Session }) {
  const [tab, setTab] = useState<"feed" | "add" | "me" | "rank">("feed");
  const [beers, setBeers] = useState<BeerUrl[]>([]);
  const [me, setMe] = useState<Me>(null);

  const load = useCallback(async () => {
    const uid = session.user.id;
    const { data: p } = await supabase.from("profiles").select("username,invite_code").eq("id", uid).single();
    setMe(p);
    const { data } = await supabase.from("beers").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    const list = (data ?? []) as Beer[];
    const paths = list.map(b => b.photo_path).filter(Boolean) as string[];
    const signed = paths.length ? (await supabase.storage.from("beer-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
    const map = new Map(signed.map(s => [s.path, s.signedUrl]));
    setBeers(list.map(b => ({ ...b, url: b.photo_path ? (map.get(b.photo_path) ?? undefined) : undefined })));
  }, [session]);
  useEffect(() => { load(); }, [load]);

  return (<>
    {tab === "feed" && <Feed />}
    {tab === "add" && <Add uid={session.user.id} done={() => { load(); setTab("feed"); }} />}
    {tab === "me" && <Profile beers={beers} me={me} reload={load} />}
    {tab === "rank" && <Ranking me={me} />}
    <nav>{(["feed", "add", "me", "rank"] as const).map(t =>
      <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
        {{ feed: "🏠 Inicio", add: "➕ Registrar", me: "👤 Perfil", rank: "🏆 Amigos" }[t]}</button>)}</nav>
  </>);
}

async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = img.width * s; c.height = img.height * s;
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => r(b!), "image/jpeg", 0.7));
}

function Add({ uid, done }: { uid: string; done: () => void }) {
  const [f, setF] = useState({ brand: "", type: "Lager", abv: "4.8", ml: "330", price: "", place: "", who: "" });
  const [file, setFile] = useState<File | null>(null); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  async function save() {
    if (!f.brand.trim()) return;
    setBusy(true);
    let photo_path: string | null = null;
    if (file) {
      photo_path = `${uid}/${Date.now()}.jpg`;
      await supabase.storage.from("beer-photos").upload(photo_path, await shrink(file), { contentType: "image/jpeg" });
    }
    await supabase.from("beers").insert({
      brand: f.brand.trim(), type: f.type, abv: +f.abv || 0, ml: +f.ml, price: +f.price || 0,
      place: f.place.trim() || null, with_whom: f.who.trim() || null, photo_path,
    });
    setBusy(false); done();
  }
  return (
    <div className="card"><h1>¿Qué te estás bebiendo?</h1>
      <label>Marca / cerveza</label><input value={f.brand} onChange={e => set("brand", e.target.value)} placeholder="Estrella Damm, Moritz..." />
      <div className="row">
        <div><label>Tipo</label><select value={f.type} onChange={e => { set("type", e.target.value); set("abv", String(ABV[e.target.value])); }}>
          {TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label>Graduación %</label><input type="number" step="0.1" value={f.abv} onChange={e => set("abv", e.target.value)} /></div>
      </div>
      <div className="row">
        <div><label>Tamaño</label><select value={f.ml} onChange={e => set("ml", e.target.value)}>
          {SIZES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label>Precio (€)</label><input type="number" step="0.05" value={f.price} onChange={e => set("price", e.target.value)} /></div>
      </div>
      <label>Dónde</label><input value={f.place} onChange={e => set("place", e.target.value)} />
      <label>Con quién</label><input value={f.who} onChange={e => set("who", e.target.value)} />
      <label>Foto (opcional)</label><input type="file" accept="image/*" capture="environment" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      <button onClick={save} disabled={busy}>{busy ? "Guardando..." : "Registrar cerveza"}</button>
    </div>
  );
}

function Profile({ beers, me, reload }: { beers: BeerUrl[]; me: Me; reload: () => void }) {
  const ml = beers.reduce((a, b) => a + b.ml, 0);
  const alc = beers.reduce((a, b) => a + b.ml * b.abv / 100, 0);
  const eur = beers.reduce((a, b) => a + Number(b.price), 0);
  const top = (k: "brand" | "type") => {
    const m: Record<string, number> = {}; beers.forEach(b => m[b[k]] = (m[b[k]] || 0) + 1);
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5);
  };
  async function del(id: string) { await supabase.from("beers").delete().eq("id", id); reload(); }
  return (<>
    <h1>{me?.username ?? "Tu perfil"}</h1>
    <div className="card stats">
      <div className="stat"><b>{beers.length}</b><span>cervezas</span></div>
      <div className="stat"><b>{(ml / 1000).toFixed(1)} L</b><span>cerveza total</span></div>
      <div className="stat"><b>{(alc / 1000).toFixed(2)} L</b><span>alcohol puro</span></div>
      <div className="stat"><b>{eur.toFixed(2)} €</b><span>gastado</span></div>
    </div>
    {(["brand", "type"] as const).map(k => <div className="card" key={k}><b>{k === "brand" ? "Marcas favoritas" : "Tipos"}</b>
      {top(k).map(([n, v]) => <div key={n} className="item"><div>{n}</div><span className="mu">{v}</span></div>)}</div>)}
    <div className="card"><b>Historial</b>
      {beers.map(b => <div className="item" key={b.id}>
        {b.url ? <img src={b.url} alt="" /> : <span style={{ fontSize: 30 }}>🍺</span>}
        <div><b>{b.brand}</b> <span className="mu">{b.type} · {b.ml} ml</span>
          <div className="mu">{b.place ?? "—"}{b.with_whom ? ` · con ${b.with_whom}` : ""} · {Number(b.price).toFixed(2)} € · {new Date(b.created_at).toLocaleDateString("es-ES")}</div></div>
        <button className="s" onClick={() => del(b.id)}>✕</button></div>)}
    </div>
    <button className="s" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
  </>);
}

function Ranking({ me }: { me: Me }) {
  const [rows, setRows] = useState<Rank[]>([]); const [code, setCode] = useState(""); const [msg, setMsg] = useState("");
  const load = useCallback(async () => { const { data } = await supabase.rpc("friend_ranking"); setRows((data ?? []) as Rank[]); }, []);
  useEffect(() => { load(); }, [load]);
  async function add() {
    const { data } = await supabase.rpc("add_friend_by_code", { code });
    setMsg(data === "ok" ? "¡Amigo añadido!" : String(data)); setCode(""); load();
  }
  return (<>
    <h1>Ranking entre amigos</h1>
    <div className="card">
      {rows.map((r, i) => <div className="item" key={r.username}>
        <b>{i + 1}</b><div>{r.username}<div className="mu">{r.beers} cervezas · {(Number(r.alcohol_ml) / 1000).toFixed(2)} L alcohol · {Number(r.spent).toFixed(2)} €</div></div></div>)}
    </div>
    <div className="card"><b>Añadir amigo</b>
      <p className="mu">Tu código: <b>{me?.invite_code}</b> (compártelo con tus amigos)</p>
      <div className="row"><input value={code} onChange={e => setCode(e.target.value)} placeholder="Código de tu amigo" />
        <button onClick={add} style={{ marginTop: 0, flex: "0 0 90px" }}>Añadir</button></div>
      {msg && <p className="mu">{msg}</p>}</div>
  </>);
}
