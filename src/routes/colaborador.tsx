import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { readCollaboratorSession, rememberCollaborator, clearCollaboratorSession } from "../lib/collaborator-session";
import "../equipe-escalas.css";
import "../collaborator-access.css";

export const Route = createFileRoute("/colaborador")({ component: CollaboratorAccess });
type Mode = "access" | "recover" | "register";
type Result = { created?: boolean; sessionToken: string; profile: { losi_id: string; display_name: string; city: string | null; state: string | null; photo_url: string | null; whatsapp_masked: string } };
function CollaboratorAccess() {
  const [mode, setMode] = useState<Mode>("access");
  const [form, setForm] = useState({ losiId: "", name: "", professionalName: "", whatsapp: "", city: "", state: "" });
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const session = readCollaboratorSession(); if (!session) return;
    const controller = new AbortController(); setLoading(true);
    void fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/team-collaborator-access", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({action:"resume",sessionToken:session.sessionToken}),signal:controller.signal})
      .then(async response => { if(response.ok) window.location.replace("/calendario/meu"); else if(response.status===401) clearCollaboratorSession(); else setError("Não foi possível verificar seu acesso. Tente novamente."); })
      .catch(e => { if(e.name!=="AbortError") setError("Não foi possível verificar seu acesso. Tente novamente."); })
      .finally(() => { if(!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const field = (key: keyof typeof form, value: string) => setForm(old => ({ ...old, [key]: value }));
  const switchMode = (value: Mode) => { setMode(value); setError(""); setResult(null); };
  async function lookup(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const response = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/team-collaborator-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, action: mode === "access" ? "access" : mode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível continuar.");
      if (!data.sessionToken || !data.profile?.losi_id) throw new Error("Não foi possível abrir o calendário. Tente novamente.");
      if (!rememberCollaborator(data.profile.losi_id, data.sessionToken)) throw new Error("Permita o armazenamento neste navegador para acessar seu calendário.");
      window.location.replace("/calendario/meu");
      setResult(data); field("losiId", data.profile.losi_id);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível continuar."); }
    finally { setLoading(false); }
  }
  return <main className="collaborator-access-page"><section className="collaborator-access-card">
    <a className="collaborator-access-brand" href="/">LOSI <b>CONECTA</b></a>
    <h1>Calendário do colaborador</h1>
    <p>Acesse suas escalas e oportunidades sem conta de fornecedor, e-mail ou senha na LOSI Conecta.</p>
    <div className="collaborator-access-modes" aria-label="Como deseja acessar?">
      <button type="button" aria-pressed={mode !== "register"} disabled={loading} onClick={() => switchMode("access")}>Já tenho ID</button>
      <button type="button" aria-pressed={mode === "register"} disabled={loading} onClick={() => switchMode("register")}>Primeiro acesso</button>
    </div>
    <form onSubmit={lookup}>
      {mode === "access" ? <label>ID do colaborador<input required autoComplete="off" placeholder="LOSI-000000" value={form.losiId} onChange={e => field("losiId", e.target.value.toUpperCase())} /></label> : <label>{mode === "register" ? "Nome completo" : "Nome completo ou nome de tio cadastrado"}<input required autoComplete="name" maxLength={160} value={form.name} onChange={e => field("name", e.target.value)} /></label>}
      {mode === "register" && <label>Nome profissional / nome de tio<input required maxLength={160} value={form.professionalName} onChange={e => field("professionalName", e.target.value)} /></label>}
      <label>{mode === "register" ? "WhatsApp" : "WhatsApp cadastrado"}<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(DDD) número" value={form.whatsapp} onChange={e => field("whatsapp", e.target.value)} /></label>
      {mode === "register" && <div className="collaborator-location-fields"><label>Cidade<input required autoComplete="address-level2" maxLength={120} value={form.city} onChange={e => field("city", e.target.value)} /></label><label>UF<input maxLength={2} autoComplete="address-level1" value={form.state} onChange={e => field("state", e.target.value.toUpperCase())} /></label></div>}
      {error && <p className="opportunity-error" role="alert">{error}</p>}
      <button disabled={loading}>{loading ? "AGUARDE..." : mode === "register" ? "CRIAR MEU ID" : mode === "recover" ? "LOCALIZAR MEU CALENDÁRIO" : "IR PARA CALENDÁRIO"}</button>
      {mode !== "register" && <button type="button" className="opportunity-text-button" disabled={loading} onClick={() => switchMode(mode === "recover" ? "access" : "recover")}>{mode === "recover" ? "JÁ SEI MEU ID" : "ESQUECI MEU ID"}</button>}
      {mode === "register" && <small>Este cadastro cria apenas sua identidade de colaborador. Seu ID será o mesmo nas próximas oportunidades.</small>}
    </form>
    {result && <div className="collaborator-found" role="status">
      {result.profile.photo_url ? <img src={result.profile.photo_url} alt="" /> : <div className="calendar-avatar">{result.profile.display_name.slice(0, 1).toUpperCase()}</div>}
      <div><small>{result.created ? "SEU ID FOI CRIADO" : "COLABORADOR LOCALIZADO"}</small><strong>{result.profile.display_name}</strong><b>{result.profile.losi_id}</b><span>{result.profile.city ? result.profile.city + (result.profile.state ? " / " + result.profile.state : "") : ""}</span><span>WhatsApp {result.profile.whatsapp_masked}</span></div>
      <div className="collaborator-verification"><a className="opportunity-calendar-link" href="/calendario/meu">ABRIR MEU CALENDÁRIO</a><p>Guarde seu ID. Você também pode acessar com nome de tio e WhatsApp.</p></div>
    </div>}
    <footer><span>Seu acesso fica salvo neste navegador até você clicar em Sair.</span></footer>
  </section></main>;
}
