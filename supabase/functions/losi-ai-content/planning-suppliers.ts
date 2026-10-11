export type SupplierSearch = {categoryIds:string[];terms:string[];city:string;state:string};
export type SupplierMatch = {id:string;name:string;slug:string;city:string;state:string;services:string[];reason:string};
export type SupplierResult = {status:"matched"|"empty"|"unavailable";searchedAt:string;items:SupplierMatch[];message:string};
export function isSupplierResult(v:unknown):v is SupplierResult {
 const r=v as SupplierResult;return !!r&&["matched","empty","unavailable"].includes(r.status)&&typeof r.searchedAt==="string"&&typeof r.message==="string"&&Array.isArray(r.items)&&r.items.length<=6&&r.items.every(s=>s&&[s.id,s.name,s.slug,s.city,s.state,s.reason].every(v=>typeof v==="string")&&Array.isArray(s.services)&&s.services.every(v=>typeof v==="string"));
}
const supplierNormalize=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
export function supplierSearchSchema(){return {type:"object",additionalProperties:false,properties:{categoryIds:{type:"array",items:{type:"string"}},terms:{type:"array",items:{type:"string"}},city:{type:"string"},state:{type:"string"}},required:["categoryIds","terms","city","state"]};}
export async function planningCategories(admin:any){
 try{const {data,error}=await admin.from("categories").select("id,name").eq("active",true).order("name").limit(300).abortSignal(AbortSignal.timeout(5000));if(error)throw error;return {categories:data||[],available:true};}
 catch{return {categories:[],available:false};}
}
export async function findPlanningSuppliers(admin:any,search:SupplierSearch,catalog:{categories:{id:string;name:string}[];available:boolean},userId?:string):Promise<SupplierResult>{
 const searchedAt=new Date().toISOString();
 const unavailable:SupplierResult={status:"unavailable",searchedAt,items:[],message:"Não foi possível consultar o catálogo LOSI agora. Tente atualizar o plano mais tarde."};
 if(!catalog.available)return unavailable;
 if(!search||!Array.isArray(search.categoryIds)||!Array.isArray(search.terms)||typeof search.city!=="string"||typeof search.state!=="string")throw new Error("invalid supplier search");
 const ids=search.categoryIds.filter(id=>catalog.categories.some(c=>c.id===id)).slice(0,12);
 const terms=[...new Set(search.terms.filter(t=>typeof t==="string"&&t.trim().length>=3&&t.length<=80).map(t=>t.trim()))].slice(0,6);
 const empty:SupplierResult={status:"empty",searchedAt,items:[],message:"Nenhum fornecedor aprovado com serviço correspondente foi encontrado. Amplie o briefing ou consulte a busca da LOSI."};
 if(!ids.length&&!terms.length)return empty;
 try{
  const query=()=>admin.from("services").select("id,business_id,name,category_id").eq("active",true);
  const requests=terms.map(t=>query().ilike("name","%"+t.replace(/[\\%_]/g,"\\$&")+"%").order("id").limit(80).abortSignal(AbortSignal.timeout(5000)));
  if(ids.length)requests.push(query().in("category_id",ids).order("id").limit(160).abortSignal(AbortSignal.timeout(5000)));
  const results=await Promise.all(requests);if(results.some(r=>r.error))return unavailable;
  const services=[...new Map(results.flatMap(r=>r.data||[]).filter((s:any)=>catalog.categories.some(c=>c.id===s.category_id)).map((s:any)=>[s.id,s])).values()] as {id:string;business_id:string;name:string;category_id:string}[];
  if(!services.length)return empty;
  let ownId:string|undefined;
  if(userId){const own=await admin.from("business_profiles").select("id").eq("owner_id",userId).limit(1).abortSignal(AbortSignal.timeout(5000));if(own.error)return unavailable;ownId=own.data?.[0]?.id;}
  const businessIds=[...new Set(services.map(s=>s.business_id))].filter(id=>id!==ownId);
  if(!businessIds.length)return empty;
  const {data,error}=await admin.from("business_profiles_public").select("id,business_name,slug,city,state").eq("active",true).eq("approval_status","approved").in("id",businessIds).order("business_name").limit(200).abortSignal(AbortSignal.timeout(5000));
  if(error)return unavailable;
  const city=supplierNormalize(search.city),state=supplierNormalize(search.state);
  const ranked=(data||[]).filter((b:any)=>b.slug&&b.business_name).map((b:any)=>{
   const offered=services.filter(s=>s.business_id===b.id),local=!!city&&supplierNormalize(b.city||"")===city&&(!state||supplierNormalize(b.state||"")===state),regional=!!state&&supplierNormalize(b.state||"")===state;
   return {score:offered.filter(s=>terms.some(t=>supplierNormalize(s.name).includes(supplierNormalize(t)))).length*2+(local?100:regional?30:0),item:{id:b.id,name:b.business_name,slug:b.slug,city:b.city||"",state:b.state||"",services:[...new Set(offered.map(s=>s.name))].slice(0,6),reason:(local?"Na cidade informada":regional?"No estado informado":city||state?"Em outra região; confirme deslocamento":"Local do evento não informado")+"; serviço ativo correspondente no cadastro."}};
  }).sort((a:any,b:any)=>b.score-a.score||a.item.name.localeCompare(b.item.name,"pt-BR"));
  const items=ranked.slice(0,6).map((r:any)=>r.item);
  return items.length?{status:"matched",searchedAt,items,message:"Correspondência por serviços e categoria, priorizando cidade e estado. Confirme disponibilidade, deslocamento e orçamento diretamente no perfil."}:empty;
 }catch{return unavailable;}
}
export function supplierText(result:SupplierResult){return "\n\nFORNECEDORES CADASTRADOS NA LOSI\n"+result.message+"\nConsulta em "+new Date(result.searchedAt).toLocaleDateString("pt-BR")+".\n"+result.items.map(s=>`${s.name} - ${[s.city,s.state].filter(Boolean).join(" / ")}\nServiços cadastrados: ${s.services.join(", ")}\n${s.reason}\nhttps://www.losiconecta.com.br/fornecedor/${encodeURIComponent(s.slug)}`).join("\n\n");}
