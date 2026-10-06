import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";
import "../admin-credits.css";

type Supplier = {id:string;business_name:string;slug:string;city:string|null;state:string|null;owner_name?:string|null};
type Kind = "ads"|"proposal"|"material";
type Balance = {business:Supplier;adsBalance:number;access:{allowed:boolean;proposalLimit?:number;materialLimit?:number;proposalExtraRemaining?:number;materialExtraRemaining?:number};used:{proposal:number;material:number};history:Array<{kind:Kind;amount:number;reason:string;created_at:string}>};
const labels:Record<Kind,string>={ads:"LOSI ADS",proposal:"Propostas com IA",material:"Materiais com IA"};
export function supplierSlugFromLink(value:string,origin:string):string {
 const url=new URL(value.trim(),origin);
 if(![new URL(origin).hostname,"losiconecta.com.br","www.losiconecta.com.br"].includes(url.hostname)||!["https:","http:"].includes(url.protocol))throw new Error("Use o link público de um fornecedor do LOSI CONECTA.");
 const match=url.pathname.match(/^\/fornecedor\/([^/]+)\/?$/);
 if(!match)throw new Error("O link precisa apontar para /fornecedor/nome-do-perfil.");
 return decodeURIComponent(match[1]);
}
function errorText(error:unknown){
 const code=(error as {message?:string})?.message||"";
 if(code.includes("ADMIN_REQUIRED"))return "Somente administradores ativos podem gerenciar créditos.";
 if(code.includes("SUPPLIER_BLOCKED"))return "A conta deste fornecedor está bloqueada. Revise-a antes de adicionar créditos.";
 if(code.includes("SUPPLIER_NOT_FOUND"))return "Fornecedor não encontrado. Faça uma nova busca.";
 return "Não foi possível concluir a operação. Confira os dados e tente novamente.";
}
export function AdminCreditCenter({mode}:{mode:"ads"|"ai"}){
 const [query,setQuery]=useState("");const [link,setLink]=useState("");
 const [results,setResults]=useState<Supplier[]>([]);const [searched,setSearched]=useState(false);
 const [selected,setSelected]=useState<Supplier|null>(null);const [balance,setBalance]=useState<Balance|null>(null);
 const [kind,setKind]=useState<Kind>(mode==="ads"?"ads":"proposal");
 const [amount,setAmount]=useState("");const [reason,setReason]=useState("");
 const [searching,setSearching]=useState(false);const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");const [success,setSuccess]=useState("");
 const sequence=useRef(0);const searchingSequence=useRef(0);const inFlight=useRef(false);
 const request=useRef<{signature:string;id:string}|null>(null);
 useEffect(()=>()=>{sequence.current++;searchingSequence.current++;},[]);
 async function search(byLink=false){
  setError("");setSuccess("");let slug:string|undefined;
  if(byLink){try{slug=supplierSlugFromLink(link,window.location.origin);}catch(e){setError((e as Error).message);return;}}
  sequence.current++;setSelected(null);setBalance(null);setLoading(false);request.current=null;
  const seq=++searchingSequence.current;setSearching(true);
  try{
   const {data,error}=await supabase.rpc("admin_supplier_credits",{p_action:"search",p_query:byLink?null:query.trim(),p_slug:slug??null});
   if(seq!==searchingSequence.current)return;
   if(error)throw error;setResults(data??[]);setSearched(true);
   if(byLink&&data?.length===1)void selectSupplier(data[0]);
  }catch(e){if(seq===searchingSequence.current)setError(errorText(e));}
  finally{if(seq===searchingSequence.current)setSearching(false);}
 }
 async function selectSupplier(person:Supplier){
  const seq=++sequence.current;setSelected(person);setBalance(null);setLoading(true);setAmount("");setReason("");setError("");setSuccess("");request.current=null;
  try{
   const {data,error}=await supabase.rpc("admin_supplier_credits",{p_action:"status",p_business_id:person.id});
   if(seq!==sequence.current)return;
   if(error)throw error;setBalance(data);
  }catch(e){if(seq===sequence.current)setError(errorText(e));}
  finally{if(seq===sequence.current)setLoading(false);}
 }
 async function grant(event:FormEvent){
  event.preventDefault();if(inFlight.current||!selected||!balance)return;
  const count=Number(amount);if(!Number.isInteger(count)||count<1||count>1000||reason.trim().length<3){setError("Informe de 1 a 1.000 créditos e um motivo de pelo menos 3 caracteres.");return;}
  const signature=JSON.stringify([selected.id,kind,count,reason.trim()]);
  if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  const seq=sequence.current;inFlight.current=true;setSaving(true);setError("");setSuccess("");
  try{
   const {data,error}=await supabase.rpc("admin_supplier_credits",{p_action:"grant",p_business_id:selected.id,p_kind:kind,p_amount:count,p_reason:reason.trim(),p_request_id:request.current.id});
   if(error)throw error;if(seq!==sequence.current)return;
   setBalance(data);setSuccess(`${count} crédito(s) de ${labels[kind]} adicionado(s) para ${selected.business_name}.`);setAmount("");setReason("");request.current=null;
  }catch(e){if(seq===sequence.current)setError(errorText(e));}
  finally{inFlight.current=false;setSaving(false);}
 }
 const history=balance?.history.filter(item=>mode==="ads"?item.kind==="ads":item.kind!=="ads")??[];
 return <div className="admin-credit-center">
  <section className="admin-credit-search">
   <h2>Encontre o fornecedor</h2>
   <p>Busque pelo nome da empresa, responsável, cidade ou telefone, ou cole o link do perfil público.</p>
   <form onSubmit={e=>{e.preventDefault();void search();}} className="admin-credit-search-row">
    <label>Buscar fornecedor<input value={query} onChange={e=>setQuery(e.target.value)} maxLength={100} placeholder="Nome, empresa, cidade ou telefone" disabled={saving}/></label>
    <button className="admin-action-button" disabled={searching||saving}>{searching?"Buscando…":"Buscar"}</button>
   </form>
   <form onSubmit={e=>{e.preventDefault();void search(true);}} className="admin-credit-search-row">
    <label>Link do perfil público<input type="url" value={link} onChange={e=>setLink(e.target.value)} placeholder="https://losiconecta.com.br/fornecedor/nome" required disabled={saving}/></label>
    <button className="admin-action-button" disabled={searching||saving}>Encontrar pelo link</button>
   </form>
   {searched&&<div className="admin-credit-results" aria-label="Fornecedores encontrados">
    {results.length===0?<p>Nenhum fornecedor encontrado. Confira a busca ou o link informado.</p>:<>
     <p>{results.length} resultado(s){results.length===30?" · Refine a busca para encontrar outros fornecedores.":""}</p>
     {results.map(person=><button type="button" key={person.id} disabled={saving} aria-pressed={selected?.id===person.id} className={"admin-credit-result"+(selected?.id===person.id?" is-selected":"")} onClick={()=>void selectSupplier(person)}>
      <strong>{person.business_name}</strong><span>{person.owner_name||"Responsável"} · {person.city||"Cidade não informada"}{person.state?` — ${person.state}`:""}</span>
     </button>)}
    </>}
   </div>}
  </section>
  {error&&<div className="admin-credit-error" role="alert">{error}</div>}
  {success&&<div className="admin-credit-success" role="status">{success}</div>}
  {selected&&<section className="admin-credit-selected" aria-busy={loading}>
   <h2>{selected.business_name}</h2><p>{selected.city||"Cidade não informada"}{selected.state?` — ${selected.state}`:""}</p>
   <a href={`/fornecedor/${encodeURIComponent(selected.slug)}`} target="_blank" rel="noreferrer">Ver perfil público ↗</a>
   {loading?<p role="status">Carregando saldos…</p>:balance?<>
    <div className="admin-credit-balances">
     {mode==="ads"?<article><span>Saldo LOSI ADS</span><strong>{balance.adsBalance}</strong><small>créditos disponíveis</small></article>:(["proposal","material"] as const).map(k=><article key={k}><span>{labels[k]}</span><strong>{Math.max(0,(balance.access[k+"Limit" as "proposalLimit"|"materialLimit"]??0)-balance.used[k])}</strong><small>gerações disponíveis · {balance.access[k+"ExtraRemaining" as "proposalExtraRemaining"|"materialExtraRemaining"]??0} extras</small></article>)}
    </div>
    <p>{mode==="ads"?"Os créditos serão adicionados à carteira LOSI ADS da conta responsável pelo fornecedor.":"1 crédito libera 1 geração com IA. Os extras são usados depois da franquia mensal, não expiram e retornam ao saldo se a geração falhar. Créditos extras também liberam a geração para uma conta sem franquia ativa."}</p>
    <form onSubmit={grant} className="admin-credit-grant">
     {mode==="ai"&&<label>Tipo de conteúdo<select value={kind} onChange={e=>setKind(e.target.value as Kind)} disabled={saving}><option value="proposal">Propostas com IA</option><option value="material">Materiais com IA</option></select></label>}
     <label>Quantidade de créditos<input type="number" min={1} max={1000} step={1} value={amount} onChange={e=>setAmount(e.target.value)} required disabled={saving}/></label>
     <label>Motivo da adição<textarea value={reason} onChange={e=>setReason(e.target.value)} minLength={3} maxLength={300} required placeholder="Ex.: crédito de cortesia ou ajuste solicitado" disabled={saving}/></label>
     <p className="admin-credit-grant-summary">Destino: <strong>{selected.business_name}</strong> · {Number(amount)||0} crédito(s) de {labels[kind]}</p>
     <button type="submit" className="admin-primary-button" disabled={saving}>{saving?"Adicionando…":"Adicionar créditos"}</button>
    </form>
    <div className="admin-credit-history"><h3>Adições manuais recentes</h3>
     {history.length===0?<p>Nenhum crédito manual registrado para esta conta nesta categoria.</p>:history.map((item,i)=><article key={`${item.created_at}-${i}`}><strong>+{item.amount} · {labels[item.kind]}</strong><p>{item.reason}</p><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small></article>)}
    </div>
   </>:<button type="button" className="admin-secondary-button" onClick={()=>void selectSupplier(selected)}>Atualizar saldo</button>}
  </section>}
 </div>;
}
