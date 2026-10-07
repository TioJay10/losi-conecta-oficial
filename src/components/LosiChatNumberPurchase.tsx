import { useEffect, useState } from 'react';
import { chatAction, formatLosiNumber, useLosiChatAccount } from '../lib/losi-chat';
import { formatTaxDocument } from '../lib/tax-document';
import '../losi-chat-purchase.css';
export function LosiChatNumberPurchase({businessId,initialDocument='',compact=false}:{businessId?:string;initialDocument?:string;compact?:boolean}){
 const {account,orders,loading,error,refresh}=useLosiChatAccount();
 const [document,setDocument]=useState<string|null>(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const [cancelConfirmation,setCancelConfirmation]=useState<string|null>(null);
 const pending=orders.find(o=>o.status==='pending'||o.status==='creating');
 const ready=!account?.digital_number&&orders.some(o=>o.status==='paid'&&o.kind==='initial');
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setNotice('');try{await work();await refresh();window.dispatchEvent(new Event('losi-chat-changed'));}catch(e){setNotice(e instanceof Error?e.message:'Não foi possível concluir.');}finally{setBusy(false);}}
 async function purchase(packageKey:string){await run(async()=>{
  const data=await chatAction('purchase',{packageKey,requestId:crypto.randomUUID(),document:document??initialDocument});
  setNotice(data.processing?'A cobrança está sendo conferida. Use “Verificar pagamento” antes de tentar outra compra.':data.order?.status==='paid'?'Pagamento confirmado.': 'Cobrança criada. Abra o pagamento abaixo para concluir.');
 });}
 return <section className={`lcp-card${compact?' lcp-compact':''}`} aria-label="Número digital e créditos Chat LOSI">
  <div className="lcp-heading"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 3h16v14H8l-4 4V3Z M8 8h8 M8 12h5"/></svg><div><h2>{account?.digital_number?'Seu número digital LOSI':'Número digital LOSI'}</h2><p>Converse com fornecedores e desenvolva seu networking. A compra é opcional.</p></div></div>
  {loading?<p role="status">Consultando sua conta…</p>:<>
   {account?.digital_number&&<div className="lcp-summary"><strong>{formatLosiNumber(account.digital_number)}</strong><span>{Math.max(0,Number(account.balance)).toLocaleString('pt-BR')} créditos disponíveis</span></div>}
   {ready&&<div className="lcp-pending"><p>Pagamento confirmado! Seu número está pronto para resgate.</p><button disabled={busy} onClick={()=>run(async()=>{await chatAction('claim');setNotice('Número resgatado! Ele permanecerá vinculado à sua conta.');})}>{busy?'Aguarde…':'Resgatar meu número'}</button></div>}
   {pending&&<div className="lcp-pending"><p>{pending.status==='creating'?'Conferindo a criação da cobrança':'Pagamento pendente'} · {pending.credits.toLocaleString('pt-BR')} créditos</p><div className="lcp-actions">{pending.invoice_url&&<a href={pending.invoice_url} target="_blank" rel="noopener noreferrer">Abrir pagamento</a>}<button disabled={busy} onClick={()=>run(async()=>{const d=await chatAction('refresh-payment',{orderId:pending.id});setNotice(d.order.status==='paid'?'Pagamento confirmado!':d.order.status==='cancelled'?'A cobrança foi cancelada.': 'O pagamento ainda está pendente.');})}>Verificar pagamento</button><button type="button" className="lcp-cancel" disabled={busy} onClick={()=>setCancelConfirmation(pending.id)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7"/></svg>Cancelar fatura</button></div>{cancelConfirmation===pending.id&&<div className="lcp-confirm" role="group" aria-label="Confirmar cancelamento da fatura"><p>Cancelar esta fatura pendente também no Asaas?</p><div className="lcp-actions"><button type="button" disabled={busy} onClick={()=>run(async()=>{await chatAction('cancel-payment',{orderId:pending.id});setCancelConfirmation(null);setNotice('Fatura cancelada no Asaas. Você pode escolher outro pacote.');})}>{busy?'Cancelando…':'Confirmar cancelamento'}</button><button type="button" disabled={busy} onClick={()=>setCancelConfirmation(null)}>Manter fatura</button></div></div>}</div>}
   {!pending&&!ready&&<>
    <p>{account?.digital_number?'Recarregue seus créditos e mantenha o mesmo número.':'Compre seu número digital para conversar no chat de fornecedores da LOSI.'}</p>
    <label className="lcp-document">CPF/CNPJ para o pagamento<input autoComplete="off" inputMode="text" value={document??initialDocument} onChange={e=>setDocument(formatTaxDocument(e.target.value))} placeholder="CPF ou CNPJ" maxLength={18}/></label>
    <div className="lcp-packages">{[{key:'10k',credits:'10 mil',price:'29,90'},{key:'50k',credits:'50 mil',price:'79,90'}].map(p=><div className="lcp-package" key={p.key}><span>{account?.digital_number?'Recarga':'Número +'} {p.credits} créditos</span><strong>R$ {p.price}</strong><button disabled={busy||(!businessId&&!account)} onClick={()=>purchase(p.key)}>{busy?'Aguarde…':account?.digital_number?'Recarregar':'Comprar número'}</button></div>)}</div>
    {!businessId&&!account&&<p>Salve os dados da sua empresa para comprar o número.</p>}
   </>}
   {account?.digital_number&&<><label className="lcp-visibility"><input type="checkbox" checked={account.show_public} disabled={busy} onChange={e=>{const visible=e.target.checked;void run(async()=>{await chatAction('visibility',{visible});setNotice(visible?'Número exibido no seu perfil público.':'Número ocultado do seu perfil público.');});}}/>Exibir meu número digital nos contatos do perfil público</label><a className="lcp-chat-link" href="/chat-losi">Abrir Chat LOSI</a></>}
  </>}
  {(notice||error)&&<p className="lcp-notice" role="status">{notice||error}</p>}
 </section>;
}
export function LosiChatContact({businessId}:{businessId:string}){
 const [number,setNumber]=useState<string|null>(null);
 usePublicNumber(businessId,setNumber);
 return number?<a className="lcp-public-contact" href={`/chat-losi?numero=${number}`}>Chat LOSI · {formatLosiNumber(number)}</a>:null;
}
function usePublicNumber(businessId:string,setNumber:(n:string|null)=>void){useEffect(()=>{let live=true;setNumber(null);chatAction<{number:string|null}>('public-number',{businessId}).then(d=>{if(live)setNumber(d.number);}).catch(()=>{});return()=>{live=false;};},[businessId,setNumber]);}
