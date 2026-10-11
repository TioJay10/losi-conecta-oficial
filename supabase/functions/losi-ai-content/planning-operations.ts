export type ActivityRule = {activity:string;role:string;method:"ratio"|"throughput"|"fixed";demand:number|null;capacity:number|null;hours:number|null;fixedPeople:number|null;basis:"researched"|"informed"|"assumption";explanation:string;sourceUrls:string[]};
export type CostLine = {label:string;unit:string;quantity:number;unitCost:number|null;activityIndex:number|null;unitsPerPerson:number;basis:"researched"|"informed"|"estimate"|"quote_required";explanation:string;sourceUrls:string[]};
export type Operations = {scenario:string;activities:ActivityRule[];costs:CostLine[];contingencyPercent:number;taxPercent:number;marginPercent:number};
export class OperationsError extends Error {}
const opString=(v:unknown,max=800)=>typeof v==="string"&&v.trim().length<=max;
const opNumber=(v:unknown,max=1000000)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max;
const opOptional=(v:unknown)=>v===null||opNumber(v);
export function isOperations(v:unknown):v is Operations {
 const o=v as Operations;
 return !!o&&opString(o.scenario,300)&&!!o.scenario.trim()&&Array.isArray(o.activities)&&o.activities.length<=20&&o.activities.every(a=>a&&opString(a.activity,160)&&!!a.activity.trim()&&opString(a.role,160)&&["ratio","throughput","fixed"].includes(a.method)&&["researched","informed","assumption"].includes(a.basis)&&[a.demand,a.capacity,a.hours,a.fixedPeople].every(opOptional)&&opString(a.explanation)&&Array.isArray(a.sourceUrls)&&a.sourceUrls.length<=8&&a.sourceUrls.every(u=>opString(u,2048)&&/^https?:\/\//i.test(u)))&&Array.isArray(o.costs)&&o.costs.length<=40&&o.costs.every(c=>c&&opString(c.label,160)&&!!c.label.trim()&&opString(c.unit,100)&&opNumber(c.quantity)&&opOptional(c.unitCost)&&opNumber(c.unitsPerPerson,1000)&&["researched","informed","estimate","quote_required"].includes(c.basis)&&opString(c.explanation)&&Array.isArray(c.sourceUrls)&&c.sourceUrls.length<=8&&c.sourceUrls.every(u=>opString(u,2048)&&/^https?:\/\//i.test(u))&&(c.activityIndex===null||Number.isInteger(c.activityIndex)&&c.activityIndex>=0&&c.activityIndex<o.activities.length))&&[o.contingencyPercent,o.taxPercent,o.marginPercent].every(n=>opNumber(n,100));
}
export function calculateOperations(o:Operations){
 if(!isOperations(o))throw new OperationsError("Parâmetros de dimensionamento ou custos inválidos.");
 const activities=o.activities.map(a=>{
  const count=a.method==="fixed"?a.fixedPeople:a.demand===null||!a.capacity||a.method==="throughput"&&!a.hours?null:a.demand/(a.capacity*(a.method==="throughput"?a.hours!:1));
  const people=count===null?null:Math.ceil(count);
  return {...a,people:people!==null&&people<=10000?people:null};
 });
 const costs=o.costs.map(c=>{
  const quantity=c.activityIndex===null?c.quantity:activities[c.activityIndex].people===null?null:activities[c.activityIndex].people!*c.unitsPerPerson;
  const total=quantity===null||c.unitCost===null?null:Math.round(quantity*c.unitCost*100)/100;
  if(total!==null&&total>1e12)throw new OperationsError("O custo ultrapassou o limite de cálculo.");
  return {...c,quantity,total};
 });
 const subtotal=Math.round(costs.reduce((sum,c)=>sum+(c.total??0),0)*100)/100;
 const reserve=Math.round(subtotal*o.contingencyPercent)/100;
 const totalCost=Math.round((subtotal+reserve)*100)/100;
 const incomplete=!costs.length||costs.some(c=>c.total===null)||activities.some(a=>a.people===null);
 const denominator=1-(o.marginPercent+o.taxPercent)/100;
 const suggestedPrice=!incomplete&&denominator>0&&totalCost>0?Math.round(totalCost/denominator*100)/100:null;
 return {activities,costs,subtotal,reserve,totalCost,incomplete,suggestedPrice,invalidMargin:denominator<=0,people:activities.some(a=>a.people===null)?null:activities.reduce((n,a)=>n+a.people!,0)};
}
export const OPERATION_MARKER="\n\nDIMENSIONAMENTO E CUSTOS CALCULADOS\n";
export function operationalText(o:Operations){
 const r=calculateOperations(o),money=(n:number)=>n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
 const activities=r.activities.map(a=>`${a.activity} - ${a.role}: ${a.people===null?"quantidade a definir":a.people+" profissional(is)"}. Regra: ${a.method==="fixed"?"quantidade fixa "+(a.fixedPeople??"a definir"):a.method==="ratio"?`${a.demand??"demanda a definir"} / ${a.capacity??"capacidade a definir"}`:`${a.demand??"demanda a definir"} / (${a.capacity??"capacidade a definir"} por hora x ${a.hours??"horas a definir"})`}. Arredondamento para cima. ${a.basis==="researched"?"Premissa pesquisada":a.basis==="informed"?"Premissa informada no briefing":"Hipótese operacional a confirmar"}. ${a.explanation}${a.sourceUrls.length?" Fontes: "+a.sourceUrls.join(" | "):""}`).join("\n\n");
 const costs=r.costs.map(c=>`${c.label}: ${c.quantity??"quantidade a definir"} ${c.unit} x ${c.unitCost===null?"custo a cotar":money(c.unitCost)} = ${c.total===null?"a definir":money(c.total)}. ${c.basis==="researched"?"Custo pesquisado":c.basis==="informed"?"Custo informado":c.basis==="estimate"?"Estimativa":"Cotação pendente"}. ${c.explanation}${c.sourceUrls.length?" Fontes: "+c.sourceUrls.join(" | "):""}`).join("\n");
 return `Cenário: ${o.scenario}.
Contas verificadas pelo sistema; premissas devem ser revisadas. Não certifica proporções legais ou a segurança da atividade. Equipes são somadas sem reaproveitamento entre atividades; confirme simultaneidade e turnos.\n\n${activities||"Atividades e equipe ainda a definir."}\n\nCOMPOSIÇÃO DE CUSTOS\n${costs||"Custos ainda a definir."}\n\n${r.incomplete?"Subtotal parcial de custos conhecidos":"Subtotal de custos"}: ${money(r.subtotal)}\nReserva (${o.contingencyPercent}%): ${money(r.reserve)}\nCusto ${r.incomplete?"parcial":"total"}: ${money(r.totalCost)}\nTributos: ${o.taxPercent}%. Margem sobre venda: ${o.marginPercent}%.\nPreço sugerido: ${r.suggestedPrice===null?"a definir; complete os custos e use tributos + margem abaixo de 100%":money(r.suggestedPrice)}. Fórmula: custo com reserva / (1 - tributos - margem). Custos de contratação e preços de venda são referências distintas.`;
}
export function replaceOperationalSection(content:string,o:Operations){return content.split(OPERATION_MARKER)[0]+OPERATION_MARKER+operationalText(o);}
export function operationsSchema(){
 const string={type:"string"},number={type:"number"},nullable={type:["number","null"]},urls={type:"array",items:string};
 const object=(properties:Record<string,unknown>)=>({type:"object",properties,required:Object.keys(properties),additionalProperties:false});
 return object({scenario:string,activities:{type:"array",items:object({activity:string,role:string,method:{type:"string",enum:["ratio","throughput","fixed"]},demand:nullable,capacity:nullable,hours:nullable,fixedPeople:nullable,basis:{type:"string",enum:["researched","informed","assumption"]},explanation:string,sourceUrls:urls})},costs:{type:"array",items:object({label:string,unit:string,quantity:number,unitCost:nullable,activityIndex:{type:["integer","null"]},unitsPerPerson:number,basis:{type:"string",enum:["researched","informed","estimate","quote_required"]},explanation:string,sourceUrls:urls})},contingencyPercent:number,taxPercent:number,marginPercent:number});
}
export function validateOperationSources(o:Operations,sources:{url:string}[]){
 if(!isOperations(o))throw new OperationsError("O plano não retornou parâmetros válidos de dimensionamento e custos.");
 const known=new Set(sources.map(s=>s.url));
 for(const row of [...o.activities,...o.costs]){
  row.sourceUrls=row.sourceUrls.filter(u=>known.has(u));
  if(row.basis==="researched"&&!row.sourceUrls.length)throw new OperationsError("Uma premissa pesquisada ficou sem fonte verificável.");
  if(!row.explanation.trim())throw new OperationsError("Uma premissa ficou sem justificativa.");
 }
 for(const cost of o.costs)if(cost.basis==="quote_required")cost.unitCost=null;
 calculateOperations(o);
 return o;
}
