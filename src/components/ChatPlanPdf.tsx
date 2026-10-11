import { useState } from "react";
import PlanningPdfTools from "./PlanningPdfTools";
import type { PlanKind } from "../lib/planning-link";
export default function ChatPlanPdf({title,content,kind,company:initialCompany,onClose}:{title:string;content:string;kind:PlanKind;company?:string;onClose:()=>void}){
 const [layout,setLayout]=useState<"classic"|"geometric">("classic"),[company,setCompany]=useState(initialCompany||"");
 return <div className="lia-chat-pdf-panel"><div className="lia-chat-pdf-heading"><h2>Seu plano em PDF</h2><button type="button" onClick={onClose}>Voltar à conversa</button></div><p>Baixe esta resposta da Lia diretamente. Para editar os cálculos ou preparar uma proposta, aplique o conteúdo ao plano.</p><PlanningPdfTools plan={{title,kind,document:"internal",generatedContent:content,description:"",client:"",city:"",state:"",date:"",duration:"",participants:"",audience:"",location:"",services:[],team:"",budget:"",notes:""}} layout={layout} company={company} onLayout={setLayout} onCompany={setCompany} onPrice={()=>{}} onTerms={()=>{}}/></div>;
}
