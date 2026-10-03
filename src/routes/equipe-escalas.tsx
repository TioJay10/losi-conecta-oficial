import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import "../equipe-escalas.css";

type EventRow={id:string;title:string;event_date:string;status:string;city:string|null};
type Collaborator={id:string;name:string;city:string|null;network_status:string};

export const Route=createFileRoute("/equipe-escalas")({component:EquipeEscalasPage});

function EquipeEscalasPage(){
 const navigate=useNavigate();
 const [businessId,setBusinessId]=useState("");
 const [businessName,setBusinessName]=useState("");
 const [events,setEvents]=useState<EventRow[]>([]);
 const [people,setPeople]=useState<Collaborator[]>([]);
 const [loading,setLoading]=useState(true);
 const [creating,setCreating]=useState(false);
 const [form,setForm]=useState({title:"",description:"",event_date:"",starts_at:"",ends_at:"",location_name:"",address:"",city:"",state:""});

 async function load(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){navigate({to:"/entrar"});return}
  const {data:b}=await supabase.from("business_profiles").select("id,business_name").eq("owner_id",user.id).maybeSingle();
  if(!b){setLoading(false);return}
  setBusinessId(b.id);setBusinessName(b.business_name);
  const [{data:e},{data:p}]=await Promise.all([
   supabase.from("team_events").select("id,title,event_date,status,city").eq("business_id",b.id).order("event_date",{ascending:true}),
   supabase.from("team_collaborators").select("id,name,city,network_status").eq("business_id",b.id).order("name")
  ]);
  setEvents((e||[]) as EventRow[]);setPeople((p||[]) as Collaborator[]);setLoading(false);
 }
 useEffect(()=>{void load()},[]);
 const upcoming=useMemo(()=>events.filter(e=>e.status!=="cancelled"&&e.status!=="completed"),[events]);

 async function createEvent(ev:FormEvent){
  ev.preventDefault(); if(!businessId||!form.title||!form.event_date)return;
  setCreating(true);
  const payload={business_id:businessId,...form,starts_at:form.starts_at||null,ends_at:form.ends_at||null,status:"draft"};
  const {error}=await supabase.from("team_events").insert(payload);
  setCreating(false);
  if(error){alert("Não foi possível criar o evento: "+error.message);return}
  setForm({title:"",description:"",event_date:"",starts_at:"",ends_at:"",location_name:"",address:"",city:"",state:""});
  await load();
 }
 if(loading)return <main className="team-page team-loading">Carregando Equipe & Escalas...</main>;
 return <main className="team-page">
  <header className="team-topbar"><button onClick={()=>navigate({to:"/painel"})}>← Painel</button><div><span>LOSI CONECTA</span><strong>Equipe & Escalas</strong></div></header>
  <section className="team-hero"><div><span>OPERAÇÃO PROFISSIONAL</span><h1>Sua rede. Seus eventos. Sua escala.</h1><p>Organize colaboradores em rede, publique oportunidades e monte cada escala mantendo função e valor final sob seu controle.</p></div><strong>{businessName}</strong></section>
  <section className="team-section"><div className="team-section-head"><div><span>MINHA EQUIPE</span><h2>Rede de colaboradores</h2></div><b>{people.length} na rede</b></div>
   <div className="team-flow"><div className="team-flow-owner"><small>FORNECEDOR</small><strong>{businessName||"Sua empresa"}</strong></div><div className="team-flow-line"/><div className="team-flow-people">{people.length?people.map(p=><article key={p.id}><span>{p.name.slice(0,1).toUpperCase()}</span><strong>{p.name}</strong><small>{p.city||"Cidade não informada"}</small></article>):<div className="team-empty">Sua rede começa aqui. Os candidatos aprovados aparecerão neste fluxograma.</div>}</div></div>
  </section>
  <section className="team-grid">
   <div className="team-section"><div className="team-section-head"><div><span>ESCALAS</span><h2>Próximos eventos</h2></div><b>{upcoming.length}</b></div>
    <div className="team-events">{upcoming.length?upcoming.map(e=><article key={e.id}><time>{new Date(e.event_date+"T12:00:00").toLocaleDateString("pt-BR")}</time><div><strong>{e.title}</strong><small>{e.city||"Local a definir"} · {e.status==="draft"?"Rascunho":e.status}</small></div></article>):<div className="team-empty">Nenhum evento criado ainda.</div>}</div>
   </div>
   <form className="team-section team-form" onSubmit={createEvent}><div className="team-section-head"><div><span>NOVA ESCALA</span><h2>Criar evento</h2></div></div>
    <label>Nome do evento<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex.: Festa infantil — Aniversário da Laura"/></label>
    <label>Descrição<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Descreva o evento, orientações e informações importantes."/></label>
    <div className="team-form-row"><label>Data<input required type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/></label><label>Início<input type="time" value={form.starts_at} onChange={e=>setForm({...form,starts_at:e.target.value})}/></label><label>Fim<input type="time" value={form.ends_at} onChange={e=>setForm({...form,ends_at:e.target.value})}/></label></div>
    <label>Local<input value={form.location_name} onChange={e=>setForm({...form,location_name:e.target.value})} placeholder="Ex.: Espaço Jardim"/></label>
    <label>Endereço<input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
    <div className="team-form-row"><label>Cidade<input value={form.city} onChange={e=>setForm({...form,city:e.target.value})}/></label><label>UF<input maxLength={2} value={form.state} onChange={e=>setForm({...form,state:e.target.value.toUpperCase()})}/></label></div>
    <button className="team-primary" disabled={creating}>{creating?"CRIANDO...":"CRIAR EVENTO"}</button>
    <small className="team-form-note">Depois de criar o evento, as vagas (Apoio, Monitor, Recreador, Coordenador etc.) e seus valores anunciados serão adicionadas à escala.</small>
   </form>
  </section>
 </main>
}