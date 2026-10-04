const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};const j=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});const mask=(v:string)=>{const n=v.replace(/\D/g,"");return n.length>=4?"•••• ••••-"+n.slice(-4):"••••"};
Deno.serve(async r=>{if(r.method==="OPTIONS")return new Response("ok",{headers:H});try{const {createClient}=await import("https://esm.sh/@supabase/supabase-js@2");const a=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);const b=await r.json();let id=String(b.losiId||"").trim().toUpperCase();
if(b.action==="recover"){
 const name=String(b.name||"").trim();let n=String(b.whatsapp||"").replace(/\D/g,"");if(n.length===10||n.length===11)n="55"+n;
 if(!name||n.length<12||n.length>13)return j({error:"Informe seu nome completo e WhatsApp com DDD."},400);
 const {data:p,error}=await a.from("collaborator_profiles").select("losi_id,full_name").eq("whatsapp_normalized",n).maybeSingle();
 if(error)return j({error:"Não foi possível localizar seu cadastro."},500);
 const norm=(v:string)=>v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLocaleLowerCase("pt-BR");
 if(!p||norm(p.full_name)!==norm(name))return j({error:"Não encontramos um cadastro com esse nome e WhatsApp."},404);
 id=p.losi_id;
}
if(!/^LOSI-\d{6}$/.test(id))return j({error:"Informe um ID LOSI válido."},400);const {data:p}=await a.from("collaborator_profiles").select("losi_id,professional_name,full_name,whatsapp,city,state,photo_url").eq("losi_id",id).maybeSingle();if(!p)return j({found:false});return j({found:true,profile:{losi_id:p.losi_id,display_name:p.professional_name||p.full_name.split(" ")[0],city:p.city,state:p.state,photo_url:p.photo_url,whatsapp_masked:mask(p.whatsapp)},verificationRequired:true})}catch(e){console.error(e);return j({error:"Erro interno."},500)}});
