export type SummaryEvent = {id:string;title:string;event_date:string;status:string};
export type SummaryOpening = {id:string;event_id:string;title:string;slots:number};
export type SummaryApplication = {id:string;event_id:string;opening_id:string;candidate_name:string;status:string;attendance_status:string|null;assigned_role:string|null};
export type SummaryCategory = "events"|"vacancies"|"pending"|"waiting"|"unavailable";
export type SummaryItem = {id:string;eventId:string;eventTitle:string;date:string;name:string;detail:string;quantity:number;area:"links"|"candidates"|"scale"};
export function eventSummary(events:SummaryEvent[],openings:SummaryOpening[],applications:SummaryApplication[]) {
 const active=events.filter(e=>!["completed","cancelled"].includes(e.status));
 const byEvent=new Map(active.map(e=>[e.id,e]));
 const byOpening=new Map(openings.map(o=>[o.id,o]));
 const rows:Record<SummaryCategory,SummaryItem[]>={events:[],vacancies:[],pending:[],waiting:[],unavailable:[]};
 for(const event of active) rows.events.push({id:event.id,eventId:event.id,eventTitle:event.title,date:event.event_date,name:event.title,detail:event.status==="draft"?"Em planejamento":"Evento ativo",quantity:1,area:"links"});
 const occupied=new Map<string,number>();
 for(const app of applications) {
  const event=byEvent.get(app.event_id);if(!event)continue;
  if(app.status==="confirmed")occupied.set(app.opening_id,(occupied.get(app.opening_id)||0)+1);
  const category=app.status==="pending"?"pending":app.status==="confirmed"&&app.attendance_status==="unavailable"?"unavailable":app.status==="confirmed"&&!app.attendance_status?"waiting":null;
  if(category)rows[category].push({id:app.id,eventId:event.id,eventTitle:event.title,date:event.event_date,name:app.candidate_name,detail:app.assigned_role||byOpening.get(app.opening_id)?.title||"Função a definir",quantity:1,area:category==="pending"?"candidates":"scale"});
 }
 for(const opening of openings) {
  const event=byEvent.get(opening.event_id);if(!event)continue;
  const remaining=Math.max(0,Number(opening.slots)-(occupied.get(opening.id)||0));
  if(remaining)rows.vacancies.push({id:opening.id,eventId:event.id,eventTitle:event.title,date:event.event_date,name:opening.title,detail:`${remaining} de ${opening.slots} vagas disponíveis`,quantity:remaining,area:"links"});
 }
 for(const list of Object.values(rows))list.sort((a,b)=>a.date.localeCompare(b.date)||a.eventTitle.localeCompare(b.eventTitle,"pt-BR")||a.name.localeCompare(b.name,"pt-BR"));
 return {rows,counts:{events:rows.events.length,vacancies:rows.vacancies.reduce((n,r)=>n+r.quantity,0),pending:rows.pending.length,waiting:rows.waiting.length,unavailable:rows.unavailable.length}};
}
