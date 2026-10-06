import { issueSession, readSession } from "../_shared/collaborator-sessions.ts";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const j=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const phone=(v:unknown)=>{let n=String(v||"").replace(/\D/g,"");if(n.length===10||n.length===11)n="55"+n;return n};

Deno.serve(async r=>{
 if(r.method==="OPTIONS")return new Response("ok",{headers:H});
 try{
  const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");
  const a=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const b=await r.json(),token=String(b.token||"").trim();
  const {data:event,error:eventError}=await a.from("team_events").select("id,title,description,event_date,starts_at,ends_at,location_name,address,city,state,status,business_id,business_profiles(business_name)").eq("public_token",token).maybeSingle();
  if(eventError){console.error("Opportunity lookup failed",eventError.code);return j({error:"Não foi possível carregar a oportunidade. Tente novamente em instantes."},500)}
  if(!event)return j({error:"O link desta oportunidade não foi encontrado ou o evento foi excluído."},404);
  if(event.status==="draft")return j({error:"Esta oportunidade ainda não foi publicada. Peça ao fornecedor para publicar o evento e enviar o link novamente."},404);
  if(event.status!=="open")return j({error:"Esta oportunidade foi encerrada e não recebe novas candidaturas."},404);

  if(b.action==="get"){
   const {data:openings}=await a.from("team_event_openings").select("id,title,slots").eq("event_id",event.id).order("created_at");
   return j({event,openings:openings||[]});
  }

  if(b.action==="recover"){
   const name=String(b.name||"").trim(),n=phone(b.whatsapp);
   if(!name||n.length<12||n.length>13)return j({error:"Informe nome completo ou nome de tio e WhatsApp com DDD."},400);
   const {data:p,error}=await a.from("collaborator_profiles").select("id,losi_id,full_name,professional_name").eq("whatsapp_normalized",n).maybeSingle();
   if(error)return j({error:"Não foi possível localizar seu cadastro."},500);
   const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("pt-BR");
   if(!p||![p.full_name,p.professional_name].some(value=>value&&norm(value)===norm(name)))return j({error:"Não encontramos um cadastro com esse nome e WhatsApp."},404);
   return j({found:true,losiId:p.losi_id,sessionToken:await issueSession(a,p)});
  }

  if(b.action==="lookup"){
   const losi=String(b.losiId||"").trim().toUpperCase();
   if(!/^LOSI-\d{6}$/.test(losi))return j({error:"Informe um ID LOSI válido."},400);
   const {data:p}=await a.from("collaborator_profiles").select("losi_id,professional_name,city,state,photo_url,whatsapp").eq("losi_id",losi).maybeSingle();
   if(!p)return j({found:false});
   return j({found:true,profile:{losi_id:p.losi_id,professional_name:p.professional_name,city:p.city,state:p.state,photo_url:p.photo_url,whatsapp_last4:phone(p.whatsapp).slice(-4)}});
  }

  if(b.action==="apply"||b.action==="register"){
   const name=String(b.name||"").trim(),whatsapp=String(b.whatsapp||"").trim(),openingId=String(b.openingId||"").trim(),losi=String(b.losiId||"").trim().toUpperCase();
   if(b.action==="apply"){
   if(!openingId)return j({error:"Escolha a vaga desejada."},400);
   const {data:o}=await a.from("team_event_openings").select("id").eq("id",openingId).eq("event_id",event.id).maybeSingle();
   if(!o)return j({error:"Vaga inválida."},400);

   }
   let p:any=null;let validSession:any=null;
   if(losi){
    const n=phone(whatsapp);
    const z=await a.from("collaborator_profiles").select("*").eq("losi_id",losi).maybeSingle();
    p=z.data;
    if(!p)return j({error:"ID LOSI não encontrado."},404);
    validSession=await readSession(a,b.sessionToken);
    if(validSession?.profile_id!==p.id&&(!/^55\d{10,11}$/.test(n)||n!==p.whatsapp_normalized))return j({error:"O WhatsApp informado não corresponde ao cadastro deste ID LOSI."},403);
   }else{
    if(!name||!whatsapp)return j({error:"Preencha nome e WhatsApp."},400);
    const n=phone(whatsapp);
    if(n.length<12||n.length>13)return j({error:"Informe um WhatsApp válido com DDD."},400);
    const z=await a.from("collaborator_profiles").select("id,losi_id").eq("whatsapp_normalized",n).maybeSingle();
    if(z.data)return j({error:"Este WhatsApp já possui um ID LOSI. Use a opção ‘JÁ TENHO ID LOSI’."},409);
    let ins:any=null;
    for(let attempt=0;attempt<5&&!ins;attempt++){
     const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);
     const id="LOSI-"+String(bytes[0]%1000000).padStart(6,"0");
     const created=await a.from("collaborator_profiles").insert({losi_id:id,full_name:name,professional_name:String(b.professionalName||"").trim()||null,whatsapp,whatsapp_normalized:n,city:String(b.city||"").trim()||null,state:String(b.state||"").trim().toUpperCase()||null}).select().single();
     if(!created.error)ins=created.data;
     else if(created.error.code!=="23505")return j({error:"Não foi possível criar seu perfil LOSI."},500);
    }
    if(!ins)return j({error:"Não foi possível gerar seu ID LOSI. Tente novamente."},500);
    p=ins;
   }

   if(b.action==="register")return j({success:true,losiId:p.losi_id,sessionToken:validSession?.profile_id===p.id?b.sessionToken:await issueSession(a,p)});

   const existing=await a.from("team_applications").select("id,status").eq("event_id",event.id).eq("opening_id",openingId).eq("profile_id",p.id).maybeSingle();
   if(existing.data)return j({error:"Você já se candidatou a esta oportunidade.",alreadyApplied:true},409);

   const ir=await a.from("team_applications").insert({event_id:event.id,opening_id:openingId,collaborator_id:null,profile_id:p.id,candidate_name:p.full_name,candidate_whatsapp:p.whatsapp,candidate_city:p.city,candidate_state:p.state,candidate_notes:String(b.notes||"").trim()||null});
   if(ir.error)return j({error:ir.error.code==="23505"?"Você já se candidatou a esta oportunidade.":"Não foi possível enviar sua candidatura.",alreadyApplied:ir.error.code==="23505"},ir.error.code==="23505"?409:500);
   return j({success:true,losiId:p.losi_id,sessionToken:validSession?.profile_id===p.id?b.sessionToken:await issueSession(a,p)});
  }
  return j({error:"Ação inválida."},400);
 }catch(e){console.error(e);return j({error:"Erro interno."},500)}
});
