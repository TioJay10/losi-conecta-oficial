import { useState } from "react";
import { LosiPdfPreview } from "./LosiPdfPreview";
import { PanelMenuIcon } from "./PanelMenuIcon";
import { PDF_LAYOUTS, downloadPdf, materialPdf, type PdfLayout } from "../lib/lia-pdfs";
import { planningDocumentText, type PlanningDocument } from "../lib/planning-pdf";
export default function PlanningPdfTools({plan,layout,company,onLayout,onCompany,onPrice,onTerms}:{plan:PlanningDocument;layout:PdfLayout;company:string;onLayout:(value:PdfLayout)=>void;onCompany:(value:string)=>void;onPrice:(value:string)=>void;onTerms:(value:string)=>void}) {
  const [preview,setPreview]=useState(false);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const doc=planningDocumentText(plan);
  const canGenerate=Boolean(plan.title.trim() && (plan.generatedContent?.trim()||plan.description.trim()));
  async function download(){
    if(!canGenerate||busy)return;
    setError("");setBusy(true);
    try{downloadPdf(materialPdf(doc.title,doc.content,company.trim()||"LOSI CONECTA",layout),doc.title);}
    catch{setError("Não foi possível gerar o PDF. Tente novamente.");}
    finally{setBusy(false);}
  }
  return <section className="wp-pdf-tools" aria-labelledby="wp-pdf-tools-title">
    <h3 id="wp-pdf-tools-title">{plan.document==="commercial"?"Proposta em PDF":"Plano em PDF"}</h3>
    <p>O PDF utiliza todo o conteúdo revisado acima. Escolha um modelo da LOSI. Prévia e download não consomem gerações.</p>
    <label>Sua empresa<input maxLength={200} value={company} onChange={e=>onCompany(e.target.value)} placeholder="Nome da empresa responsável"/></label>
    <label>Modelo do PDF<select value={layout} onChange={e=>onLayout(e.target.value as PdfLayout)}>{Object.entries(PDF_LAYOUTS).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
    {plan.document==="commercial"&&<><label>Valor da proposta (R$)<input type="number" min="0" max="1000000000" step="0.01" value={plan.quotedPrice||""} onChange={e=>onPrice(e.target.value)} placeholder="Valor definido por você"/></label><label>Condições comerciais<textarea maxLength={4000} rows={4} value={plan.commercialTerms||""} onChange={e=>onTerms(e.target.value)} placeholder="Pagamento, validade, inclusões e condições acordadas"/></label><p>Preços pesquisados são referências de mercado. Defina aqui o valor que deseja apresentar ao cliente.</p></>}
    <div className="wp-pdf-actions"><button type="button" className="wp-button wp-outline" disabled={!canGenerate||busy} onClick={()=>setPreview(value=>!value)}><PanelMenuIcon name="eye"/>{preview?"Fechar prévia":"Ver prévia do PDF"}</button><button type="button" className="wp-button wp-gold" disabled={!canGenerate||busy} onClick={()=>void download()}><PanelMenuIcon name="forms"/>{busy?"Gerando PDF…":plan.document==="commercial"?"Baixar proposta em PDF":"Baixar plano em PDF"}</button></div>
    {!canGenerate&&<p>Preencha o título e o conteúdo do plano para gerar o PDF.</p>}
    {error&&<p role="alert">{error}</p>}
    {preview&&<LosiPdfPreview title={doc.title} content={doc.content} company={company.trim()||"LOSI CONECTA"} layout={layout}/>}
  </section>;
}
