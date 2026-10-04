import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { readCollaboratorSession } from "../lib/collaborator-session";
import "../equipe-escalas.css";

export const Route = createFileRoute("/colaborador")({ component: CollaboratorAccess });
type Result = { profile: { losi_id: string; display_name: string; city: string | null; state: string | null; photo_url: string | null; whatsapp_masked: string } };
function CollaboratorAccess() {
  const [id, setId] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [personalLink, setPersonalLink] = useState("");
  useEffect(() => { const session = readCollaboratorSession(); if (session) setId(session.losiId); }, []);

  async function lookup(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError(""); setResult(null); setPersonalLink("");
    try {
      const r = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/team-collaborator-access", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recovering ? { action: "recover", name, whatsapp } : { losiId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível continuar.");
      if (!d.found) throw new Error("Não encontramos esse ID LOSI.");
      setResult(d); setId(d.profile.losi_id);
      const session = readCollaboratorSession();
      if (session && session.losiId === d.profile.losi_id) {
        // O ID localiza o perfil; o token pessoal autoriza o calendário.
        const check = await fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/team-public-calendar", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: session.calendarToken }),
        });
        if (check.ok) {
          const calendar = await check.json();
          if (calendar.collaborator.losi_id === d.profile.losi_id) setPersonalLink(`/calendario/${session.calendarToken}`);
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível continuar."); }
    finally { setLoading(false); }
  }

  return <main className="collaborator-access-page"><section className="collaborator-access-card">
    <a className="collaborator-access-brand" href="/">LOSI <b>CONECTA</b></a>
    <span>ÁREA DO COLABORADOR</span><h1>Seu calendário. Seu ID LOSI.</h1>
    <p>Acesse suas escalas, oportunidades e seu perfil usando sua identidade de colaborador.</p>
    <form onSubmit={lookup}>
      {recovering ? <>
        <label>Nome completo cadastrado<input required autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>
        <label>WhatsApp cadastrado<input required inputMode="tel" autoComplete="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} /></label>
      </> : <label>ID LOSI<input required placeholder="LOSI-000000" value={id} onChange={e => setId(e.target.value.toUpperCase())} /></label>}
      {error && <p className="opportunity-error" role="alert">{error}</p>}
      <button disabled={loading}>{loading ? "LOCALIZANDO..." : recovering ? "RECUPERAR MEU ID" : "CONTINUAR"}</button>
      <button type="button" className="opportunity-text-button" disabled={loading} onClick={() => { setRecovering(!recovering); setError(""); setResult(null); setPersonalLink(""); }}>
        {recovering ? "JÁ SEI MEU ID LOSI" : "ESQUECI MEU ID LOSI"}
      </button>
    </form>
    {result && <div className="collaborator-found" role="status">
      {result.profile.photo_url ? <img src={result.profile.photo_url} alt="" /> : <div className="calendar-avatar">{result.profile.display_name.slice(0, 1).toUpperCase()}</div>}
      <div><small>PERFIL LOCALIZADO</small><strong>{result.profile.display_name}</strong><b>{result.profile.losi_id}</b>
        <span>{result.profile.city ? result.profile.city + (result.profile.state ? " / " + result.profile.state : "") : "Localização não informada"}</span>
        <span>WhatsApp {result.profile.whatsapp_masked}</span></div>
      <div className="collaborator-verification">
        {personalLink ? <a className="opportunity-calendar-link" href={personalLink}>ABRIR MEU CALENDÁRIO</a> : <>
          <b>Acesso ao calendário pessoal</b><p>Abra o link pessoal recebido no cadastro ou pelo fornecedor. O ID localiza seu perfil; ele não libera sua agenda e seus valores em outro dispositivo.</p>
          <p>A confirmação por código no WhatsApp ainda não está disponível.</p>
        </>}
      </div>
    </div>}
    <footer><a href="/">CONHEÇA A LOSI</a><span>Seu ID LOSI é pessoal e permanente.</span></footer>
  </section></main>;
}
