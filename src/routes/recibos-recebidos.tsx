import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabase";
import "../receipts.css";

export const Route = createFileRoute("/recibos-recebidos")({ component: ReceivedReceiptsPage });
const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://losi-conecta-oficial.vercel.app";

type Request={id:string;public_token:string;status:string;created_at:string;submitted_at:string|null};
type Receipt={id:string;request_id:string;issuer_name:string;issuer_document:string|null;issuer_phone:string|null;issuer_address:string|null;service:string;service_date:string|null;amount_cents:number;payment_method:string|null;description:string|null;city:string|null;signature_data:string|null;created_at:string};

const money=(v:number)=>(v/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
function openReceivedReceiptPdf(r:Receipt,businessName:string){
  const d=new jsPDF({unit:"mm",format:"a4"});
  const W=210,M=18,C=W-M*2; let y=18;
  d.setFillColor(7,26,51); d.rect(0,0,W,48,"F");
  d.setTextColor(255,255,255); d.setFont("helvetica","bold"); d.setFontSize(20); d.text("LOSI",M,20);
  d.setTextColor(240,217,154); d.setFontSize(12); d.text("CONECTA",M+18,20);
  d.setTextColor(255,255,255); d.setFont("helvetica","normal"); d.setFontSize(9); d.text("RECIBO DE PRESTAÇÃO DE SERVIÇOS",M,31);
  d.setFont("helvetica","bold"); d.setFontSize(11); d.text("RECIBO RECEBIDO",W-M,20,{align:"right"});
  y=61; d.setTextColor(7,26,51); d.setFontSize(14); d.text("Comprovante de recebimento",M,y); y+=9;
  d.setFont("helvetica","normal"); d.setFontSize(9); d.setTextColor(95,105,120);
  const intro=d.splitTextToSize("Declaro que recebi de "+(businessName||"contratante")+" a importância referente ao serviço informado.",C); d.text(intro,M,y); y+=intro.length*4.2+8;
  d.setFillColor(248,250,252); d.setDrawColor(225,229,236); d.roundedRect(M,y,C,29,3,3,"FD");
  d.setTextColor(105,115,130); d.setFontSize(8); d.text("VALOR RECEBIDO",M+7,y+8);
  d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(20); d.text(money(r.amount_cents),M+7,y+19);
  d.setFont("helvetica","normal"); d.setFontSize(8); d.setTextColor(95,105,120); d.text("Pagamento: "+(r.payment_method||"Não informado"),W-M-7,y+17,{align:"right"}); y+=39;
  d.setFillColor(255,255,255); d.roundedRect(M,y,C,58,3,3,"FD"); d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(10); d.text("EMITENTE",M+7,y+9);
  d.setFont("helvetica","normal"); d.setFontSize(9); d.setTextColor(35,45,60); d.text(d.splitTextToSize(r.issuer_name,C-14).slice(0,1),M+7,y+19);
  d.setFontSize(8); d.setTextColor(95,105,120); d.text("Documento: "+(r.issuer_document||"Não informado"),M+7,y+27); d.text("Telefone: "+(r.issuer_phone||"Não informado"),M+7,y+34);
  d.text(d.splitTextToSize(r.issuer_address||"Endereço não informado",C-14).slice(0,2),M+7,y+41); y+=67;
  d.setFillColor(255,255,255); d.roundedRect(M,y,C,55,3,3,"FD"); d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(10); d.text("SERVIÇO",M+7,y+9);
  d.setTextColor(35,45,60); d.setFontSize(11); d.text(d.splitTextToSize(r.service,C-14).slice(0,2),M+7,y+19); d.setFont("helvetica","normal"); d.setFontSize(8); d.setTextColor(95,105,120);
  d.text("Data: "+(r.service_date?r.service_date.split("-").reverse().join("/"):"—"),M+7,y+32); d.text("Local: "+(r.city||"—"),M+7,y+39); d.text(d.splitTextToSize(r.description||"Sem observações adicionais.",C-14).slice(0,2),M+7,y+47); y+=65;
  if(r.signature_data){try{d.addImage(r.signature_data,"PNG",W/2-28,y-10,56,16)}catch{}}
  d.setDrawColor(80,90,105); d.line(W/2-35,y+5,W/2+35,y+5); d.setTextColor(80,90,105); d.setFontSize(8); d.text("Assinatura do prestador",W/2,y+11,{align:"center"});
  d.setTextColor(145,150,158); d.setFontSize(7); d.text("Documento recebido através do LOSI CONECTA.",W/2,282,{align:"center"});
  const url=URL.createObjectURL(d.output("blob")); const opened=window.open(url,"_blank","noopener,noreferrer");
  if(!opened){const a=document.createElement("a");a.href=url;a.download="recibo-recebido-"+r.id.slice(0,8)+".pdf";document.body.appendChild(a);a.click();a.remove();}
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}


function ReceivedReceiptsPage(){
  const navigate=useNavigate(); const [mobileMenuOpen,setMobileMenuOpen]=useState(false); const [user,setUser]=useState<string|null>(null),[requests,setRequests]=useState<Request[]>([]),[receipts,setReceipts]=useState<Record<string,Receipt>>({}),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
  useEffect(()=>{(async()=>{const {data}=await supabase.auth.getSession();if(!data.session){navigate({to:"/entrar"});return}setUser(data.session.user.id);const {data:rs,error}=await supabase.from("receipt_requests").select("id,public_token,status,created_at,submitted_at").eq("requester_user_id",data.session.user.id).order("created_at",{ascending:false});if(error){setMessage("Não foi possível carregar as solicitações.");setLoading(false);return}setRequests((rs||[]) as Request[]);if(rs?.length){const {data:rc}=await supabase.from("received_receipts").select("id,request_id,issuer_name,issuer_document,issuer_phone,issuer_address,service,service_date,amount_cents,payment_method,description,city,signature_data,created_at").eq("requester_user_id",data.session.user.id);const map:Record<string,Receipt>={};(rc||[]).forEach((x)=>{map[x.request_id]=x as Receipt});setReceipts(map)}setLoading(false)})()},[navigate]);
  async function logout(){await supabase.auth.signOut();navigate({to:"/entrar"});}
  async function createRequest(){if(!user)return;setMessage("");const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");const {data,error}=await supabase.from("receipt_requests").insert({requester_user_id:user,public_token:token}).select("id,public_token,status,created_at,submitted_at").single();if(error){setMessage("Não foi possível criar o link.");return}setRequests(v=>[data as Request,...v]);setMessage("Link criado. Copie e envie pelo WhatsApp.");}
  function share(r:Request){const url=APP_ORIGIN+"/emitir-recibo/"+r.public_token;if(navigator.share)navigator.share({title:"Emitir recibo — LOSI CONECTA",text:"Use este link para emitir seu recibo:",url}).catch(()=>{});else navigator.clipboard?.writeText(url).then(()=>setMessage("Link copiado para a área de transferência."));}
  if(loading)return <main className="receipts-state">Carregando recibos recebidos...</main>;
  return <main className="dashboard-page receipts-page">
    <div className="dashboard-sidebar-backdrop" onClick={()=>setMobileMenuOpen(false)} aria-hidden={!mobileMenuOpen}></div>
    <aside className={"dashboard-sidebar"+(mobileMenuOpen?" mobile-open":"")}>
      <div className="dashboard-sidebar-brand"><span>LOSI</span><strong>CONECTA</strong></div>
      <div className="dashboard-sidebar-caption">PAINEL PROFISSIONAL</div>
      <nav className="dashboard-sidebar-nav" aria-label="Menu do painel">
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/painel"})}}><span className="dashboard-nav-mark">01</span><span><strong>Visão geral</strong><small>Resumo da conta</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/buscar"})}}><span className="dashboard-nav-mark">02</span><span><strong>Fornecedores</strong><small>Encontrar parceiros</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/meu-perfil"})}}><span className="dashboard-nav-mark">03</span><span><strong>Meu perfil</strong><small>Dados pessoais</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/meus-servicos"})}}><span className="dashboard-nav-mark">04</span><span><strong>Minha empresa</strong><small>Serviços e presença</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/notificar-inconsistencia"})}}><span className="dashboard-nav-mark">05</span><span><strong>Notificar Inconsistências</strong><small>Falar com o administrador</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/orcamentos"})}}><span className="dashboard-nav-mark">06</span><span><strong>Orçamentos</strong><small>Solicitações e propostas</small></span></button>
        <button type="button" className="dashboard-nav-item active" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/recibos"})}}><span className="dashboard-nav-mark">07</span><span><strong>Recibos</strong><small>Comprovantes de serviço</small></span></button>
        <button type="button" className="dashboard-nav-item" onClick={()=>{setMobileMenuOpen(false);navigate({to:"/propostas"})}}><span className="dashboard-nav-mark">08</span><span><strong>Propostas</strong><small>Apresentações comerciais</small></span></button>
      </nav>
      <div className="dashboard-sidebar-footer"><div className="dashboard-sidebar-status"><span></span> Conta profissional</div><button className="dashboard-sidebar-logout" onClick={logout}>Sair da conta</button></div>
    </aside>
    <div className="dashboard-main">
      <header className="dashboard-header">
        <button type="button" className="dashboard-mobile-menu-button" onClick={()=>setMobileMenuOpen(v=>!v)} aria-label={mobileMenuOpen?"Fechar menu":"Abrir menu"} aria-expanded={mobileMenuOpen}><span></span><span></span><span></span></button>
        <div className="dashboard-header-context"><span>DOCUMENTOS PROFISSIONAIS</span><strong>Recibos recebidos</strong></div>
        <div className="dashboard-header-right"><Link to="/recibos" className="dashboard-secondary receipts-back">Voltar para Recibos</Link></div>
      </header>
      <section className="dashboard-content receipts-content">
        <div className="receipts-hero"><div><div className="dashboard-badge">RECIBOS RECEBIDOS</div><h1>Solicite recibos a quem você contratou</h1><p>Crie um link, envie para o prestador e receba o documento diretamente no seu painel. Ele não precisa ter cadastro.</p></div><div className="receipts-hero-mark"><span>LOSI</span><strong>CONECTA</strong><small>ENVIO SEM CADASTRO</small></div></div>
        {message&&<div className="receipts-message">{message}</div>}
        <section className="receipts-form-card"><div className="receipts-card-head"><div><span className="receipts-kicker">NOVA SOLICITAÇÃO</span><h2>Gerar link para o prestador</h2></div><button className="receipts-primary receipts-inline-action" onClick={createRequest}>+ Criar link</button></div><p className="receipts-note receipts-left-note">Cada link é individual e pode ser enviado diretamente pelo WhatsApp.</p></section>
        <section className="receipts-history-card"><div className="receipts-card-head"><div><span className="receipts-kicker">HISTÓRICO</span><h2>Solicitações de recibo</h2></div><span className="receipts-count">{requests.length}</span></div>{!requests.length?<div className="receipts-empty"><strong>Nenhuma solicitação criada</strong><span>Crie um link para começar.</span></div>:<div className="receipts-history-list">{requests.map(r=>{const x=receipts[r.id];const url=APP_ORIGIN+"/emitir-recibo/"+r.public_token;return <article key={r.id}><div><strong>{x?.issuer_name||"Aguardando prestador"}</strong><span>{x?.service||"Link enviado — aguardando preenchimento"}</span></div><div className="receipts-history-meta">{x&&<b>{money(x.amount_cents)}</b>}<span>{r.status==="submitted"?"Recebido":"Aguardando"}</span>{x?<><button type="button" onClick={()=>window.open(url,"_blank","noopener,noreferrer")}>Abrir recibo</button><button type="button" onClick={()=>x&&openReceivedReceiptPdf(x, "LOSI CONECTA")}>Baixar PDF</button></>:<button type="button" onClick={()=>share(r)}>Compartilhar link</button>}</div></article>})}</div>}</section>
      </section>
    </div>
  </main>;
}