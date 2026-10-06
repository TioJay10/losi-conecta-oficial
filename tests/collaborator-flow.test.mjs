import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

function database() {
  const tables = { team_events: [{ id: 'event-1', public_token: 'event-token', status: 'open' }], team_event_openings: [{ id: 'opening-1', event_id: 'event-1' }], collaborator_profiles: [], team_applications: [] };
  return { tables, from(table) {
    const filters=[]; let payload; let inserting=false;
    const query = {
      select(){return query}, eq(k,v){filters.push(row=>row[k]===v);return query}, order(){return query},
      insert(value){payload=value;inserting=true;return query},
      async maybeSingle(){return execute(true)},async single(){return execute(true)},
      then(resolve,reject){return execute(false).then(resolve,reject)},
    };
    async function execute(single) {
      if(inserting){
        if(table==='collaborator_profiles'&&tables[table].some(p=>p.whatsapp_normalized===payload.whatsapp_normalized||p.losi_id===payload.losi_id))return {data:null,error:{code:'23505'}};
        const row={id:`record-${tables[table].length}`,calendar_token:'11111111-1111-4111-8111-111111111111',...payload};tables[table].push(row);return {data:single?row:[row],error:null};
      }
      const rows=tables[table].filter(row=>filters.every(f=>f(row)));
      return {data:single?rows[0]||null:rows,error:null};
    }
    return query;
  } };
}
function handler(slug, db) {
  let serve;
  const source = fs.readFileSync(`supabase/functions/${slug}/index.ts`,'utf8').replace('await import("https://esm.sh/@supabase/supabase-js@2")','({createClient:()=>db})');
  const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  vm.runInNewContext(js,{ db,Response,crypto:webcrypto,console,Deno:{env:{get:()=>''},serve:callback=>{serve=callback}}});
  return async body=>{const response=await serve(new Request('https://example.test',{method:'POST',body:JSON.stringify(body)}));return {status:response.status,body:await response.json()}};
}
const db=database();const call=handler('team-public-opportunity',db);
const registration=await call({token:'event-token',action:'register',name:'João Teste',whatsapp:'(55) 99999-1234',professionalName:'Tio Teste',city:'Cotia'});
assert.equal(registration.status,200);assert.match(registration.body.losiId,/^LOSI-\d{6}$/);assert.ok(registration.body.calendarToken);
assert.equal(db.tables.collaborator_profiles.length,1);assert.equal(db.tables.team_applications.length,0);
assert.equal(db.tables.collaborator_profiles[0].whatsapp_normalized,'5555999991234');
const id=registration.body.losiId, token=registration.body.calendarToken;
const recovery=await call({token:'event-token',action:'recover',name:' joao  teste ',whatsapp:'5555999991234'});
assert.equal(recovery.body.losiId,id);assert.equal(recovery.body.calendarToken,token);
assert.equal((await call({token:'event-token',action:'recover',name:'Outra Pessoa',whatsapp:'5555999991234'})).status,404);
assert.equal((await call({token:'event-token',action:'apply',losiId:id,openingId:'opening-1'})).status,403);
const application=await call({token:'event-token',action:'apply',losiId:id,calendarToken:token,openingId:'opening-1'});
assert.equal(application.status,200);assert.equal(application.body.losiId,id);assert.equal(application.body.calendarToken,token);
assert.equal(db.tables.collaborator_profiles.length,1);assert.equal(db.tables.team_applications[0].candidate_name,'João Teste');
assert.equal((await call({token:'event-token',action:'apply',losiId:id,calendarToken:token,openingId:'opening-1'})).status,409);
db.tables.team_events.push({id:'event-2',public_token:'second-event',status:'open'});db.tables.team_event_openings.push({id:'opening-2',event_id:'event-2'});
const otherDevice=await call({token:'second-event',action:'apply',losiId:id,whatsapp:'5555999991234',openingId:'opening-2'});
assert.equal(otherDevice.status,200);assert.equal(otherDevice.body.calendarToken,token);assert.equal(db.tables.collaborator_profiles.length,1);
assert.equal((await call({token:'event-token',action:'register',name:'João Teste',whatsapp:'5555999991234'})).status,409);
const access=handler('team-collaborator-access',db);
const found=await access({action:'recover',name:'joao teste',whatsapp:'5555999991234'});
assert.equal(found.body.profile.losi_id,id);assert.equal(found.body.calendarToken,token);assert.equal(found.body.profile.whatsapp,undefined);
console.log('OK: primeiro cadastro, ID único, DDD 55, recuperação, token pessoal, nova oportunidade, duplicidade e proteção do calendário.');

const alias=await access({action:'recover',name:' tio  teste ',whatsapp:'(55) 99999-1234'});
assert.equal(alias.status,200);assert.equal(alias.body.calendarToken,token);
assert.equal((await access({losiId:id})).status,403);
assert.equal((await access({losiId:id,whatsapp:'11999990000'})).status,403);
const verified=await access({losiId:id,whatsapp:'(55) 99999-1234'});
assert.equal(verified.status,200);assert.equal(verified.body.calendarToken,token);
assert.equal((await access({losiId:id,calendarToken:token})).status,200);
const standalone=await access({action:'register',name:'Maria Teste',professionalName:'Tia Sol',whatsapp:'11999991234',city:'Cotia'});
assert.equal(standalone.status,200);assert.match(standalone.body.profile.losi_id,/^LOSI-\d{6}$/);
assert.equal(standalone.body.created,true);assert.equal(db.tables.team_applications.length,2);
assert.equal((await access({action:'register',name:'Maria Teste',whatsapp:'11999991234'})).status,409);
assert.equal((await access({action:'register',name:'Maria',whatsapp:'123'})).status,400);
assert.equal((await access({action:'recover',name:'Outra Pessoa',whatsapp:'11999991234'})).status,404);
console.log('OK: cadastro independente, nome de tio, novo dispositivo, WhatsApp incorreto e ID sem credencial bloqueados.');
