import { phone, providerSlug, publicCollaborator } from "./helpers.ts";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const j=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
Deno.serve(async request=>{
 if(request.method==="OPTIONS")return new Response("ok",{headers:H});
 if(request.method!=="POST")return j({error:"Método não permitido."},405);
 try{
  const jwt=request.headers.get("Authorization")?.replace(/^Bearer\s+/i,"");if(!jwt)return j({error:"Entre na conta do fornecedor."},401);
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const {data:auth,error:authError}=await client.auth.getUser(jwt);if(authError||!auth.user)return j({error:"Sessão inválida. Entre novamente."},401);
  const b=await request.json();
  const {data:business,error:businessError}=await client.from("business_profiles").select("id").eq("id",String(b.businessId||"")).eq("owner_id",auth.user.id).maybeSingle();
  if(businessError)throw businessError;if(!business)return j({error:"Você não tem acesso a esta empresa."},403);
  const {data:owner,error:ownerError}=await client.from("profiles").select("blocked").eq("id",auth.user.id).maybeSingle();if(ownerError)throw ownerError;if(owner?.blocked)return j({error:"Conta bloqueada."},403);
  if(b.action==="provider"||b.action==="addProvider"){
   const slug=providerSlug(b.url);if(!slug)return j({error:"Cole o link completo de um perfil público da LOSI Conecta."},400);
   const {data:provider,error}=await client.from("business_profiles").select("id,owner_id,business_name,slug,whatsapp,phone,city,state,logo_url").eq("slug",slug).eq("active",true).eq("approval_status","approved").maybeSingle();
   if(error)throw error;if(!provider)return j({error:"Perfil público não encontrado."},404);if(provider.id===business.id)return j({error:"Escolha o perfil de outro fornecedor."},400);
   const {data:providerOwner,error:providerOwnerError}=await client.from("profiles").select("blocked").eq("id",provider.owner_id).maybeSingle();if(providerOwnerError)throw providerOwnerError;if(providerOwner?.blocked)return j({error:"Este perfil está indisponível."},404);
   const whatsapp=phone(provider.whatsapp)||phone(provider.phone);if(!/^55\d{10,11}$/.test(whatsapp))return j({error:"O perfil precisa ter um WhatsApp válido para ser adicionado à rede."},400);
   const {data:contacts,error:contactsError}=await client.from("team_collaborators").select("id,whatsapp").eq("business_id",business.id);if(contactsError)throw contactsError;
   const existing=(contacts||[]).find((p:any)=>phone(p.whatsapp)===whatsapp);
   const summary={business_name:provider.business_name,slug:provider.slug,city:provider.city,state:provider.state,logo_url:provider.logo_url,whatsapp};
   if(b.action==="provider")return j({provider:summary,alreadyInNetwork:!!existing});
   if(existing)return j({success:true,alreadyInNetwork:true});
   const {error:insertError}=await client.from("team_collaborators").insert({business_id:business.id,name:provider.business_name,whatsapp,city:provider.city,state:provider.state,notes:"Fornecedor incluído pelo perfil público: https://losiconecta.com.br/fornecedor/"+provider.slug,network_status:"active"});
   if(insertError&&insertError.code!=="23505")throw insertError;
   return j({success:true,alreadyInNetwork:insertError?.code==="23505"});
  }
  const {data:links,error:linksError}=await client.from("team_collaborators").select("id,profile_id,whatsapp").eq("business_id",business.id);if(linksError)throw linksError;
  if(b.action==="context"){
   const {data:events,error:eventsError}=await client.from("team_events").select("id").eq("business_id",business.id);if(eventsError)throw eventsError;
   let applications:any[]=[];
   if(events?.length){const found=await client.from("team_applications").select("id,event_id,profile_id,candidate_name,candidate_whatsapp,assigned_role").in("event_id",events.map((e:any)=>e.id));if(found.error)throw found.error;applications=found.data||[];}
   const ids=[...new Set([...(links||[]).map((p:any)=>p.profile_id),...applications.map(p=>p.profile_id)].filter(Boolean))];
   const phones=[...new Set((links||[]).map((p:any)=>phone(p.whatsapp)).filter((n:string)=>/^55\d{10,11}$/.test(n)))];
   const profiles:any[]=[];
   if(ids.length){const found=await client.from("collaborator_profiles").select("id,losi_id,professional_name,whatsapp_normalized").in("id",ids);if(found.error)throw found.error;profiles.push(...found.data||[]);}
   if(phones.length){const found=await client.from("collaborator_profiles").select("id,losi_id,professional_name,whatsapp_normalized").in("whatsapp_normalized",phones);if(found.error)throw found.error;profiles.push(...found.data||[]);}
   return j({network:(links||[]).map((link:any)=>{const p=profiles.find(p=>p.id===link.profile_id||p.whatsapp_normalized===phone(link.whatsapp));return {id:link.id,losi_id:p?.losi_id||null,professional_name:p?.professional_name||null};}),eventPeople:applications.map(a=>({...a,losi_id:profiles.find(p=>p.id===a.profile_id||p.whatsapp_normalized===phone(a.candidate_whatsapp))?.losi_id||null,professional_name:profiles.find(p=>p.id===a.profile_id||p.whatsapp_normalized===phone(a.candidate_whatsapp))?.professional_name||null}))});
  }
  if(b.action!=="directory")return j({error:"Ação inválida."},400);
  const page=Math.max(0,Math.min(10000,Math.floor(Number(b.page)||0))),query=String(b.query||"").trim().slice(0,120);
  let q=client.from("collaborator_profiles").select("id,losi_id,full_name,professional_name,city,state,photo_url,created_at,whatsapp_normalized",{count:"exact"});
  const linkedIds=(links||[]).map((p:any)=>p.profile_id).filter(Boolean),phones=(links||[]).map((p:any)=>phone(p.whatsapp)).filter((n:string)=>/^55\d{10,11}$/.test(n));
  if(linkedIds.length)q=q.not("id","in","("+linkedIds.join(",")+")");
  if(phones.length)q=q.not("whatsapp_normalized","in","("+phones.join(",")+")");
  if(query){const n=phone(query);if(/^[\d\s()+-]+$/.test(query)&&/^55\d{10,11}$/.test(n))q=q.eq("whatsapp_normalized",n);else{const clean=query.replace(/[^\p{L}\p{N}\s-]/gu,"");if(!clean)return j({people:[],total:0,page});q=q.or(["full_name","professional_name","losi_id","city"].map(field=>field+".ilike.*"+clean+"*").join(","));}}
  const {data,count,error}=await q.order("created_at",{ascending:false}).order("id").range(page*25,page*25+24);if(error)throw error;
  return j({people:(data||[]).map(publicCollaborator),total:count||0,page});
 }catch(error){console.error(error);return j({error:"Não foi possível concluir. Tente novamente."},500);}
});
