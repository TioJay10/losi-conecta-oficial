const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),ts=require("typescript"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../supabase/functions/losi-ai-content/index.ts"),"utf8").replace(/^import .*;\n/gm,"");
const built=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.equal(built.diagnostics.length,0);
const result={title:"Treinamento",description:"Proposta",objective:"Objetivo",methodology:"Método",notes:"Notas",content:"Conteúdo do material"};
async function run(mode,kind="material",action="generate"){
 let handler,providerCalls=0,reserves=0;const writes=[];
 const admin={auth:{getUser:async()=>({data:{user:{id:"owner"}}})},
  rpc:async(name,args)=>{
   assert.equal(args.p_user_id,"owner");
   if(name==="losi_ai_entitlement")return {data:{allowed:mode!=="no-access",periodStart:"2026-10-01T00:00:00Z",periodEnd:"2026-11-01T00:00:00Z",proposalLimit:4,materialLimit:5}};
   assert.equal(name,"losi_ai_reserve");reserves++;
   return {data:mode==="quota"?{error:"QUOTA_EXHAUSTED"}:mode==="cached"?{cached:true,result}:{reserved:true}};
  },
  from(table){
   assert.equal(table,"losi_ai_generations");let write;
   const query={select(){return query;},eq(){return query;},in(){return query;},
    update(value){write=value;writes.push(value);return query;},
    async maybeSingle(){return {data:mode==="db-error"?null:{id:"saved"},error:mode==="db-error"?{}:null};},
    then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};
   return query;
  }};
 const context={Request,Response,AbortSignal,Date,console:{error(){}},createClient:()=>admin,
  Deno:{env:{get:key=>key==="OPENAI_API_KEY"&&mode==="unconfigured"?undefined:"mock-only"},serve:fn=>{handler=fn;}},
  fetch:async(url,options)=>{
   providerCalls++;assert.equal(url,"https://api.openai.com/v1/chat/completions");
   const request=JSON.parse(options.body);assert.equal(request.model,"gpt-4.1-mini-2025-04-14");
   assert.equal(request.max_completion_tokens,kind==="material"?4000:2000);
   assert.equal(request.store,false);assert.equal(request.response_format.json_schema.strict,true);
   const input=JSON.parse(request.messages[1].content);
   assert(!("recipientContact" in input.context));
   if(mode==="provider-error")return Response.json({error:{code:"mock"}},{status:429});
   return Response.json({choices:[{finish_reason:mode==="truncated"?"length":"stop",message:{content:mode==="malformed"?"bad JSON":JSON.stringify(result)}}],usage:{prompt_tokens:100,completion_tokens:200}});
  }};
 vm.runInNewContext(built.outputText,context);
 const unauth=await handler(new Request("https://example.invalid",{method:"POST",body:"{}"}));assert.equal(unauth.status,401);
 const response=await handler(new Request("https://example.invalid",{method:"POST",headers:{Authorization:"Bearer test"},
  body:JSON.stringify({action,kind,requestId:"11111111-1111-4111-8111-111111111111",instructions:mode==="short"?"bad":"Crie um treinamento da equipe.",context:{company:"Test",recipientContact:"do-not-send"}})}));
 return {response,data:await response.json(),providerCalls,reserves,writes};
}
(async()=>{
 for(const kind of ["proposal","material"]){const r=await run("ok",kind);assert.equal(r.response.status,200);assert.equal(r.providerCalls,1);assert(r.writes.some(w=>w.status==="completed"));assert(!r.writes.some(w=>w.status==="failed"));}
 for(const mode of ["unconfigured","no-access","quota","short"]){const r=await run(mode);assert(r.response.status>=400);assert.equal(r.providerCalls,0);assert.equal(r.writes.length,0);}
 for(const mode of ["provider-error","truncated","malformed","db-error"]){const r=await run(mode);assert.equal(r.response.status,502);assert(r.writes.some(w=>w.status==="failed"));}
 const cached=await run("cached");assert.equal(cached.data.cached,true);assert.equal(cached.providerCalls,0);
 const status=await run("unconfigured","material","status");assert.equal(status.data.configured,false);assert.equal(status.providerCalls,0);assert.equal(status.reserves,0);
 console.log("PASS: auth, access/quota, disabled activation, structured content, output limits, privacy filtering, cached requests and failure releases (mocked OpenAI).");
})().catch(e=>{console.error(e);process.exit(1)});
