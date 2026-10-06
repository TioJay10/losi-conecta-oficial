import { useEffect, useState } from "react";
import type { CalendarFilters } from "../lib/calendar-search";
import "../calendar-explorer.css";
export function CalendarSearch({value,onChange,label}:{value:CalendarFilters;onChange:(value:CalendarFilters)=>void;label:string}) {
 const invalid=!!(value.from&&value.to&&value.from>value.to);
 return <div className="calendar-search" role="search" aria-label={label}>
  <label>Buscar empresa, evento ou vaga<input type="search" placeholder="Ex.: Thermas, recreador..." value={value.query} onChange={e=>onChange({...value,query:e.target.value})}/></label>
  <label>De<input type="date" value={value.from} onChange={e=>onChange({...value,from:e.target.value})}/></label>
  <label>Até<input type="date" min={value.from||undefined} value={value.to} onChange={e=>onChange({...value,to:e.target.value})}/></label>
  <button type="button" disabled={!value.query&&!value.from&&!value.to} onClick={()=>onChange({query:"",from:"",to:""})}>Limpar filtros</button>
  {invalid&&<p role="alert">A data final deve ser igual ou posterior à inicial.</p>}
 </div>;
}
type Details={event:{title:string;description:string|null;event_date:string;starts_at:string|null;ends_at:string|null;location_name:string|null;address:string|null;city:string|null;state:string|null;business_name:string;vacancies:string[]};escalados:{name:string;photo_url:string|null}[]};
export function CalendarEventDetails({eventId,sessionToken,onClose,onUnauthorized}:{eventId:string;sessionToken:string;onClose:()=>void;onUnauthorized:()=>void}) {
 const [data,setData]=useState<Details|null>(null),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();setData(null);setError("");
  void fetch("https://bpvaftobiosjesdbaany.supabase.co/functions/v1/team-public-calendar",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"eventDetails",eventId,sessionToken}),signal:controller.signal})
   .then(async response=>{const result=await response.json();if(response.status===401){onUnauthorized();return}if(!response.ok)throw new Error(result.error||"Não foi possível carregar os detalhes.");if(!controller.signal.aborted)setData(result)})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message)});
  return()=>controller.abort();
 },[eventId,sessionToken,retry]);
 return <div className="calendar-event-details" aria-label="Resumo do evento" aria-live="polite">
  <div className="calendar-details-heading"><h3>{data?.event.title||"Resumo do evento"}</h3><button type="button" onClick={onClose}>Fechar resumo</button></div>
  {error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(n=>n+1)}>Tentar novamente</button></div>:!data?<p>Carregando resumo e escalados...</p>:<>
   <dl><div><dt>Empresa</dt><dd>{data.event.business_name}</dd></div><div><dt>Dia e horário</dt><dd>{new Date(data.event.event_date+"T12:00:00").toLocaleDateString("pt-BR")}{data.event.starts_at?" · "+data.event.starts_at.slice(0,5):" · Horário a definir"}{data.event.ends_at?" às "+data.event.ends_at.slice(0,5):""}</dd></div><div><dt>Local</dt><dd>{[data.event.location_name,data.event.address,data.event.city,data.event.state].filter(Boolean).join(" · ")||"Local a definir"}</dd></div>{data.event.vacancies.length>0&&<div><dt>Vagas do evento</dt><dd>{data.event.vacancies.join(", ")}</dd></div>}</dl>
   <p className="calendar-event-description">{data.event.description||"O fornecedor ainda não adicionou um resumo para este evento."}</p>
   <h4>Escalados</h4><p className="calendar-roster-help">Colaboradores incluídos na escala deste evento e dia.</p>
   {data.escalados.length?<ul className="calendar-roster">{data.escalados.map((person,index)=><li key={index}>{person.photo_url?<img src={person.photo_url} alt="" loading="lazy"/>:<span className="calendar-roster-avatar" aria-hidden="true">{person.name.slice(0,1).toUpperCase()}</span>}<strong>{person.name}</strong></li>)}</ul>:<p>Ainda não há colaboradores escalados para este evento.</p>}
  </>}
 </div>;
}
