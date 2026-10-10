export type PlanningDocument = {
  title: string; kind: "work"|"business"; document: "internal"|"commercial";
  generatedContent?: string; description: string; client: string; city: string; state: string;
  date: string; duration: string; participants: string; audience: string; location: string;
  services: string[]; team: string; budget: string; notes: string;
  quotedPrice?: string; commercialTerms?: string;
};
export function planningDocumentText(plan: PlanningDocument) {
  const label = plan.document === "commercial" ? "Proposta comercial" : plan.kind === "business" ? "Plano de negócios" : "Plano de trabalho";
  const facts = [
    ["Cliente",plan.client], ["Local",[plan.city,plan.state].filter(Boolean).join(" / ")],
    ["Data",plan.date ? new Date(plan.date+"T12:00:00").toLocaleDateString("pt-BR") : ""],
    ["Duração",plan.duration?plan.duration+" horas":""], ["Participantes",plan.participants], ["Público",plan.audience], ["Espaço",plan.location],
  ].filter(([,value])=>value).map(([key,value])=>key+": "+value);
  const commercial = plan.document === "commercial" ? ["CONDIÇÕES COMERCIAIS", "Investimento proposto: "+(plan.quotedPrice && Number(plan.quotedPrice)>0 ? Number(plan.quotedPrice).toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) : "A confirmar pelo responsável"), plan.commercialTerms || "Prazo, pagamento, validade e demais condições: a confirmar pelo responsável."] : [];
  const briefing = [plan.description,plan.services.length?"Serviços no escopo: "+plan.services.join(", "):"",plan.team?"Equipe e estrutura informadas: "+plan.team:"",plan.notes?"Observações: "+plan.notes:""];
  return {title: label+" - "+plan.title, content: [facts.join("\n"),commercial.join("\n"),plan.generatedContent?.trim() || briefing.filter(Boolean).join("\n\n")].filter(Boolean).join("\n\n")};
}
