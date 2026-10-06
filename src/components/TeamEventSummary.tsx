import { useId, useMemo, useState } from "react";
import { eventSummary, type SummaryEvent, type SummaryOpening, type SummaryApplication, type SummaryCategory, type SummaryItem } from "../lib/team-event-summary";
import "../team-event-summary.css";
const categories: {key:SummaryCategory;label:string;help:string}[]=[{key:"events",label:"Eventos ativos",help:"Em planejamento ou publicados"},{key:"vacancies",label:"Vagas a preencher",help:"Veja as funções e os eventos"},{key:"pending",label:"Candidaturas pendentes",help:"Aguardando sua análise"},{key:"waiting",label:"Sem resposta de presença",help:"Sem resposta no calendário"},{key:"unavailable",label:"Não podem comparecer",help:"Exigem ajuste na escala"}];
export function TeamEventSummary({events,openings,applications,loading,error,onRetry,onOpen}:{events:SummaryEvent[];openings:SummaryOpening[];applications:SummaryApplication[];loading:boolean;error:string;onRetry:()=>void;onOpen:(item:SummaryItem,category:SummaryCategory)=>void}) {
 const [selected,setSelected]=useState<SummaryCategory|null>(null);
 const region=useId();
 const {rows,counts}=useMemo(()=>eventSummary(events,openings,applications),[events,openings,applications]);
 const title=categories.find(c=>c.key===selected)?.label;
 return <section className="team-dashboard team-summary"><div className="team-dashboard-title"><div><h2>Resumo dos eventos</h2></div><p>Selecione um card para consultar os detalhes.</p></div>
  <div className="team-summary-cards">{categories.map(c=><button key={c.key} id={`${region}-${c.key}`} type="button" aria-expanded={selected===c.key} aria-controls={`${region}-details`} className={selected===c.key?"selected":""} onClick={()=>setSelected(selected===c.key?null:c.key)}><span>{c.label}</span><strong>{c.key!=="events"&&(loading||error)?"—":counts[c.key]}</strong><small>{c.help}</small><span className="team-summary-card-link">{selected===c.key?"Recolher detalhes":"Ver detalhes"}<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d={selected===c.key?"m6 15 6-6 6 6":"m6 9 6 6 6-6"}/></svg></span></button>)}</div>
  <div id={`${region}-details`} hidden={!selected} className="team-summary-details" role="region" aria-labelledby={selected?`${region}-${selected}`:undefined} aria-busy={loading}>
   <div className="team-summary-detail-heading"><h3>{title}</h3><div><button type="button" disabled={loading} onClick={onRetry}>Atualizar</button><button type="button" onClick={()=>setSelected(null)}>Fechar</button></div></div>
   {selected&&selected!=="events"&&loading?<p role="status">Carregando detalhes…</p>:selected&&selected!=="events"&&error?<p className="team-summary-error" role="alert">{error} Clique em Atualizar para tentar novamente.</p>:selected&&rows[selected].length?<ul>{rows[selected].map(item=><li key={item.id}><div><strong>{item.name}</strong><span>{selected!=="events"&&`${item.eventTitle} · `}{new Date(item.date+"T12:00:00").toLocaleDateString("pt-BR")}</span><small>{item.detail}</small></div><button type="button" onClick={()=>onOpen(item,selected)}>{selected==="events"?"Abrir evento":selected==="vacancies"?"Ver vagas":selected==="pending"?"Analisar candidatura":"Ver escala"}</button></li>)}</ul>:<p>Nenhum registro nesta categoria nos seus eventos ativos.</p>}
  </div>
 </section>;
}
