import { supabase } from "./supabase";
export async function teamRequest(body: Record<string, unknown>): Promise<any> {
 const { data, error } = await supabase.functions.invoke("team-network-directory", { body });
 if(error){let message=error.message;try{const response=await error.context?.json();message=response?.error||message;}catch{}throw new Error(message||"Não foi possível carregar os dados.");}
 return data;
}
export function matchesTeamSearch(query: string, values: unknown[]): boolean {
 const norm=(v:unknown)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");
 const q=norm(query).trim();if(!q)return true;
 if(/^[\d\s()+-]+$/.test(q)){const digits=q.replace(/\D/g,"");return values.some(value=>norm(value).includes(q)||String(value||"").replace(/\D/g,"").includes(digits));}
 return values.some(value=>norm(value).includes(q));
}
