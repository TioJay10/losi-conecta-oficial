import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { jsPDF } from "jspdf";
import "../../receipts.css";

export const Route = createFileRoute("/emitir-recibo/$token")({ component: PublicReceiptPage });
const API = "https://bpvaftobiosjesdbaany.supabase.co/functions/v1/public-receipt";

type Receipt = { id:string; issuer_name:string; issuer_document:string|null; issuer_phone:string|null; issuer_address:string|null; service:string; service_date:string|null; amount_cents:number; payment_method:string|null; description:string|null; city:string|null; signature_data:string|null; created_at:string };
type Business = { business_name:string|null; city:string|null; state:string|null; logo_url:string|null };

const money = (v:number) => (v/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const dateBR = (v:string|null) => { if(!v) return "—"; const p=v.split("-"); return p.length===3 ? p[2]+"/"+p[1]+"/"+p[0] : v; };

function downloadPdf(r:Receipt,b:Business|null){
  const d=new jsPDF({unit:"mm",format:"a4"}),W=210,M=18,C=174;
  d.setFillColor(7,26,51); d.rect(0,0,W,48,"F");
  d.setTextColor(255,255,255); d.setFont("helvetica","bold"); d.setFontSize(20); d.text("LOSI",M,20);
  d.setTextColor(240,217,154); d.setFontSize(12); d.text("CONECTA",M+18,20);
  d.setTextColor(255,255,255); d.setFont("helvetica","normal"); d.setFontSize(9); d.text("RECIBO DE PRESTAÇÃO DE SERVIÇOS",M,31);
  d.setFont("helvetica","bold"); d.setFontSize(11); d.text("RECIBO RECEBIDO",W-M,20,{align:"right"});
  let y=61; d.setTextColor(7,26,51); d.setFontSize(14); d.text("Comprovante de recebimento",M,y); y+=10;
  d.setFont("helvetica","normal"); d.setFontSize(9); d.setTextColor(95,105,120);
  d.text(d.splitTextToSize("Declaro que recebi de "+(b?.business_name||"contratante")+" a importância referente ao serviço informado.",C),M,y); y+=14;
  d.setFillColor(248,250,252); d.setDrawColor(225,229,236); d.roundedRect(M,y,C,29,3,3,"FD");
  d.setTextColor(105,115,130); d.setFontSize(8); d.text("VALOR RECEBIDO",M+7,y+8);
  d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(20); d.text(money(r.amount_cents),M+7,y+19);
  d.setFont("helvetica","normal"); d.setFontSize(8); d.setTextColor(95,105,120); d.text("Pagamento: "+(r.payment_method||"Não informado"),W-M-7,y+17,{align:"right"}); y+=39;
  d.setFillColor(255,255,255); d.setDrawColor(225,229,236); d.roundedRect(M,y,C,56,3,3,"FD");
  d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(10); d.text("DADOS DO EMITENTE",M+7,y+9);
  d.setTextColor(35,45,60); d.setFontSize(10); d.text(d.splitTextToSize(r.issuer_name,C-14).slice(0,1),M+7,y+19);
  d.setFont("helvetica","normal"); d.setFontSize(8); d.setTextColor(95,105,120);
  d.text("Documento: "+(r.issuer_document||"Não informado"),M+7,y+27); d.text("Telefone: "+(r.issuer_phone||"Não informado"),M+7,y+34);
  d.text(d.splitTextToSize(r.issuer_address||"Endereço não informado",C-14).slice(0,2),M+7,y+41); y+=65;
  d.setFillColor(255,255,255); d.roundedRect(M,y,C,55,3,3,"FD");
  d.setTextColor(7,26,51); d.setFont("helvetica","bold"); d.setFontSize(10); d.text("SERVIÇO",M+7,y+9);
  d.setTextColor(35,45,60); d.setFontSize(11); d.text(d.splitTextToSize(r.service,C-14).slice(0,2),M+7,y+19);
  d.setFont("helvetica","normal"); d.setFontSize(8); d.setTextColor(95,105,120); d.text("Data: "+dateBR(r.service_date),M+7,y+32); d.text("Local: "+(r.city||b?.city||"—"),M+7,y+39);
  d.text(d.splitTextToSize(r.description||"Sem observações adicionais.",C-14).slice(0,2),M+7,y+47); y+=65;
  if(r.signature_data){try{d.addImage(r.signature_data,"PNG",W/2-25,y,50,12)}catch{}}
  d.setDrawColor(80,90,105); d.line(W/2-35,y+15,W/2+35,y+15); d.setTextColor(80,90,105); d.setFontSize(8); d.text("Assinatura do prestador",W/2,y+21,{align:"center"});
  d.setTextColor(145,150,158); d.setFontSize(7); d.text("Documento emitido através do LOSI CONECTA.",W/2,282,{align:"center"});
  d.save("recibo-recebido-"+r.id.slice(0,8)+".pdf");
}

function Signature({onChange}:{onChange:(v:string|null)=>void}){
  const ref=useRef<HTMLCanvasElement>(null),down=useRef(false);
  const pos=(e:PointerEvent<HTMLCanvasElement>)=>{const c=ref.current!,r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};
  const start=(e:PointerEvent<HTMLCanvasElement>)=>{const p=pos(e),c=ref.current!,ctx=c.getContext("2d")!;down.current=true;e.currentTarget.setPointerCapture(e.pointerId);ctx.beginPath();ctx.moveTo(p.x,p.y)};
  const move=(e:PointerEvent<HTMLCanvasElement>)=>{if(!down.current)return;const p=pos(e),ctx=ref.current!.getContext("2d")!;ctx.lineWidth=2;ctx.lineCap="round";ctx.strokeStyle="#071a33";ctx.lineTo(p.x,p.y);ctx.stroke()};
  const end=()=>{if(down.current){down.current=false;onChange(ref.current!.toDataURL("image/png"))}};
  return <div className="public-signature"><canvas ref={ref} width={760} height={220} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><button type="button" onClick={()=>{ref.current!.getContext("2d")!.clearRect(0,0,760,220);onChange(null)}}>Limpar</button></div>;
}

function PublicReceiptPage(){
  const {token}=useParams({from:"/emitir-recibo/$token"});
  const [business,setBusiness]=useState<Business|null>(null),[receipt,setReceipt]=useState<Receipt|null>(null),[loading,setLoading]=useState(true),[sending,setSending]=useState(false),[error,setError]=useState("");
  const [name,setName]=useState(""),[document,setDocument]=useState(""),[phone,setPhone]=useState(""),[address,setAddress]=useState(""),[service,setService]=useState(""),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[amount,setAmount]=useState(""),[payment,setPayment]=useState("PIX"),[description,setDescription]=useState(""),[city,setCity]=useState(""),[signature,setSignature]=useState<string|null>(null);
  useEffect(()=>{fetch(API+"?token="+encodeURIComponent(token)).then(async x=>{const j=await x.json();if(!x.ok)throw Error(j.error);setBusiness(j.business);setReceipt(j.receipt)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[token]);
  async function send(){
    setError(""); const cents=Math.round(Number(amount.replace(/\./g,"").replace(",","."))*100);
    if(!name.trim()||!service.trim()||!Number.isFinite(cents)||cents<=0){setError("Preencha nome, serviço e valor.");return}
    setSending(true);
    try{const x=await fetch(API+"?token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({issuerName:name,issuerDocument:document,issuerPhone:phone,issuerAddress:address,service,serviceDate:date,amountCents:cents,paymentMethod:payment,description,city,signatureData:signature})});const j=await x.json();if(!x.ok)throw Error(j.error);setReceipt(j.receipt)}catch(e){setError(e instanceof Error?e.message:"Não foi possível enviar o recibo.")}finally{setSending(false)}
  }
  if(loading)return <main className="public-receipt-page"><div className="public-receipt-loading">Carregando solicitação...</div></main>;
  return <main className="public-receipt-page"><div className="public-receipt-shell">
    <header className="public-receipt-brand"><span>LOSI</span><strong>CONECTA</strong><small>RECIBOS PROFISSIONAIS</small></header>
    <section className="public-receipt-hero"><span className="receipts-kicker">RECIBO SOLICITADO</span><h1>{receipt?"Recibo enviado com sucesso":"Emita seu recibo pelo LOSI CONECTA"}</h1><p>{receipt?"Seu recibo foi enviado ao contratante. Você também pode gerar sua via em PDF.":"Você recebeu este link para emitir um recibo. Não é necessário criar cadastro."}</p></section>
    {error&&<div className="receipts-message">{error}</div>}
    {!receipt?<section className="public-receipt-card"><div className="receipts-card-head"><div><span className="receipts-kicker">DADOS DO EMITENTE</span><h2>Preencha seus dados</h2></div></div>
      <div className="receipts-form-grid public-receipt-grid">
        <label><span>Nome / Razão Social *</span><input value={name} onChange={e=>setName(e.target.value)} /></label><label><span>CPF / CNPJ</span><input value={document} onChange={e=>setDocument(e.target.value)} /></label><label><span>Telefone / WhatsApp</span><input value={phone} onChange={e=>setPhone(e.target.value)} /></label><label><span>Local de emissão</span><input value={city} onChange={e=>setCity(e.target.value)} /></label>
        <label className="wide"><span>Endereço</span><input value={address} onChange={e=>setAddress(e.target.value)} /></label><label className="wide"><span>Serviço prestado *</span><input value={service} onChange={e=>setService(e.target.value)} /></label>
        <label><span>Data do serviço</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label><span>Valor recebido *</span><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="R$ 0,00" /></label>
        <label><span>Forma de pagamento</span><select value={payment} onChange={e=>setPayment(e.target.value)}><option>PIX</option><option>Dinheiro</option><option>Transferência</option><option>Cartão</option><option>Boleto</option><option>Outro</option></select></label>
        <label className="wide"><span>Descrição / observações</span><textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} /></label>
      </div>
      <div className="public-signature-group"><span className="receipts-kicker">ASSINATURA</span><h2>Assine o recibo</h2><p>Desenhe na tela ou envie uma imagem da sua assinatura.</p><Signature onChange={setSignature}/><label className="signature-upload"><span>Enviar assinatura em imagem</span><input type="file" accept="image/png,image/jpeg" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>500000){setError("A assinatura deve ter até 500 KB.");return}const rd=new FileReader();rd.onload=()=>setSignature(String(rd.result));rd.readAsDataURL(f)}} /></label></div>
      <button className="receipts-primary public-submit" disabled={sending} onClick={send}>{sending?"Enviando...":"Enviar recibo ao contratante"}</button><p className="receipts-note">Você não precisa criar conta.</p>
    </section>:<section className="public-receipt-success"><div className="success-icon">✓</div><h2>Recibo enviado</h2><p>O contratante recebeu o recibo. Gere sua própria via em PDF.</p><div className="received-summary"><strong>{receipt.issuer_name}</strong><span>{receipt.service}</span><b>{money(receipt.amount_cents)}</b></div><button className="receipts-primary" onClick={()=>downloadPdf(receipt,business)}>Baixar minha via em PDF</button></section>}
    <footer className="public-receipt-footer">LOSI CONECTA · Recibos profissionais</footer>
  </div></main>;
}