export type CalendarFilters = { query: string; from: string; to: string };
export function matchesCalendarEvent(event: any, filters: CalendarFilters, roles: string[] = []) {
 if (!event) return false;
 const date=String(event.event_date||"");
 if(filters.from&&(!date||date<filters.from))return false;
 if(filters.to&&(!date||date>filters.to))return false;
 const norm=(value:unknown)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").trim();
 const text=[event.title,event.business_profiles?.business_name,...roles,...(event.team_event_openings||[]).map((o:any)=>o.title)].map(norm).join(" ");
 return norm(filters.query).split(/\s+/).filter(Boolean).every(term=>text.includes(term));
}
