import { PaymentStatus } from "./PaymentStatus";
import { useState } from "react";
import { supabase } from "../lib/supabase";
import { matchesTeamSearch } from "../lib/team-management";
import "../team-payments.css";
export type PaymentRow={id:string;status:string;candidate_name:string;assigned_role:string|null;agreed_value:number|null;payment_status?:string;paid_at?:string|null};
export type PaymentUpdate={id:string;payment_status:string;paid_at:string|null;agreed_value:number|null};
const money=(amount:number)=>amount.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function TeamPayments({rows,onChange,onEditValue}:{rows:PaymentRow[];onChange:(data:PaymentUpdate)=>void;onEditValue:(id:string)=>void}) {
 const [query,setQuery]=useState(""),[filter,setFilter]=useState("all"),[busy,setBusy]=useState("");
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const payments=rows.filter(row=>["confirmed","removed"].includes(row.status));
 const missing=payments.filter(row=>row.agreed_value==null).length;
 const visible=payments.filter(row=>(filter==="all"||(row.payment_status||"pending")===filter)&&matchesTeamSearch(query,[row.candidate_name,row.assigned_role]));
 const total=(status:string)=>payments.filter(row=>(row.payment_status||"pending")===status).reduce((sum,row)=>sum+Number(row.agreed_value||0),0);
 async function update(row:PaymentRow){
  if(busy)return;const status=row.payment_status==="paid"?"pending":"paid";
  if(status==="pending"&&!window.confirm(`Reabrir o pagamento de ${row.candidate_name} como pendente?`))return;
  setBusy(row.id);setError("");setNotice("");
  try{
   const {data,error}=await supabase.rpc("set_team_payment",{p_application_id:row.id,p_status:status,p_expected_status:row.payment_status||"pending"});
   if(error)throw error;onChange(data as PaymentUpdate);
   setNotice(status==="paid"?`Pagamento de ${row.candidate_name} registrado como pago.`:`Pagamento de ${row.candidate_name} reaberto como pendente.`);
  }catch(e){setError(e instanceof Error?e.message:(e as {message?:string})?.message||"Não foi possível registrar o pagamento.")}
  finally{setBusy("")}
 }
 return <section className="team-section team-payments"><div className="team-section-head"><div><h2>Pagamentos dos colaboradores</h2><p className="team-section-help">Registre os pagamentos deste evento. Cada colaborador vê apenas o próprio valor e status no calendário.</p></div></div>
  <div className="team-payment-totals"><div><span>Pendente</span><strong>{money(total("pending"))}</strong></div><div><span>Pago</span><strong>{money(total("paid"))}</strong></div><p>{missing} {missing===1?"participação com valor a definir":"participações com valor a definir"}. Os totais incluem apenas valores informados.</p></div>
  <div className="team-payment-filters"><label>Buscar colaborador ou função<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome ou função neste evento"/></label><label>Pagamento<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">Todos</option><option value="pending">Pendentes</option><option value="paid">Pagos</option></select></label></div>
  {error&&<p role="alert" className="team-payment-error">{error}</p>}{notice&&<p role="status" className="team-payment-notice">{notice}</p>}
  <div className="team-payment-list">{visible.length?visible.map(row=><article key={row.id}><div className="team-payment-person"><strong>{row.candidate_name}</strong><span>{row.assigned_role||"Função não informada"}{row.status==="removed"?" · Removido da escala":""}</span></div><strong className="team-payment-amount">{row.agreed_value==null?"Valor a definir":money(Number(row.agreed_value))}</strong><PaymentStatus {...row}/><button type="button" className={row.payment_status==="paid"?"team-secondary":"team-primary"} disabled={!!busy} onClick={()=>row.agreed_value==null?onEditValue(row.id):void update(row)}>{busy===row.id?"Salvando...":row.payment_status==="paid"?"Reabrir pagamento":row.agreed_value==null?"Definir valor":"Marcar pago"}</button></article>):<div className="team-empty">{payments.length?"Nenhum pagamento neste filtro.":"Inclua colaboradores na escala para acompanhar os pagamentos."}</div>}</div>
  <p className="team-payment-help">Este controle registra o pagamento que você realizou. Nenhum dinheiro é transferido ao clicar em Marcar pago.</p>
 </section>;
}
