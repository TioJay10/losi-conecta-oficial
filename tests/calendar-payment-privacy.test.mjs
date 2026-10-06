import {sessionHelpers,stripSessionImport} from './collaborator-session-harness.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import {webcrypto} from 'node:crypto';
const helpers=sessionHelpers();const secrets={alice:"a".repeat(64),bob:"b".repeat(64),new:"c".repeat(64)};
const tables={
 collaborator_sessions:await Promise.all(Object.entries(secrets).map(async([profile_id,token])=>({id:profile_id,profile_id,token_hash:await helpers.sessionHash(token),revoked_at:null}))),
 collaborator_profiles:[{id:'alice',calendar_token:'token-alice',losi_id:'LOSI-100001',full_name:'Alice'},{id:'bob',calendar_token:'token-bob',losi_id:'LOSI-100002',full_name:'Bob'}],
 team_collaborators:[{id:'link-a',profile_id:'alice',business_id:'business',network_status:'active'},{id:'link-b',profile_id:'bob',business_id:'business',network_status:'active'}],
 team_applications:[{id:'app-a',profile_id:'alice',status:'confirmed',agreed_value:150,payment_status:'paid',paid_at:'2026-10-06T12:00:00Z',paid_by:'private-owner',team_events:{id:'past-a'}},{id:'app-b',profile_id:'bob',status:'confirmed',agreed_value:450,payment_status:'pending',paid_at:null,team_events:{id:'past-b'}}],
 team_events:[{id:'event',public_token:'public-event',status:'open',business_id:'business',event_date:'2099-10-10',team_event_openings:[{id:'opening',title:'Recreador',slots:2,advertised_value:999}]}],
 team_event_openings:[{id:'opening',event_id:'event',title:'Recreador',slots:2,advertised_value:999}],collaborator_notifications:[],
};
const selections=[];const client={rpc:async()=>({error:null}),from(table){let filters=[],columns='',updating=false;const q={select(c){columns=c;selections.push({table,columns});return q},eq(k,v){filters.push(r=>r[k]===v);return q},in(k,v){filters.push(r=>v.includes(r[k]));return q},gte(k,v){filters.push(r=>r[k]>=v);return q},is(k,v){filters.push(r=>r[k]===v);return q},order(){return q},limit(){return q},update(){updating=true;return q},maybeSingle(){return run(true)},then(resolve,reject){return run(false).then(resolve,reject)}};async function run(single){let rows=structuredClone(tables[table].filter(r=>filters.every(f=>f(r))));if(updating)return {error:null};if(!columns.includes('advertised_value'))rows.forEach(r=>{delete r.advertised_value;if(!columns.includes('calendar_token'))delete r.calendar_token;if(!columns.includes('paid_by'))delete r.paid_by;r.team_event_openings?.forEach(o=>delete o.advertised_value)});return {data:single?rows[0]||null:rows,error:null}}return q}};
function handler(slug){let serve;const source=stripSessionImport(fs.readFileSync(`supabase/functions/${slug}/index.ts`,'utf8')).replace('import { resolveManualProfile } from "./manual-profile.ts";','').replace('await import("https://esm.sh/@supabase/supabase-js@2")','({createClient:()=>client})');vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,{...helpers,client,crypto:webcrypto,Response,console,Deno:{env:{get:()=>''},serve:f=>serve=f},resolveManualProfile:()=>{throw new Error('Unexpected fallback')}});return async body=>{const r=await serve(new Request('https://test',{method:'POST',body:JSON.stringify(body)}));return {status:r.status,data:await r.json()}}}
const calendar=handler('team-public-calendar');const alice=await calendar({sessionToken:secrets.alice,profile_id:'bob',losiId:'LOSI-100002'});assert.equal(alice.status,200);assert.deepEqual(alice.data.items.map(x=>[x.id,x.agreed_value]),[['app-a',150]]);assert.equal(JSON.stringify(alice.data).includes('450'),false);assert.equal(JSON.stringify(alice.data.opportunities).includes('advertised_value'),false);
const bob=await calendar({sessionToken:secrets.bob});assert.deepEqual(bob.data.items.map(x=>[x.id,x.agreed_value]),[['app-b',450]]);
const invalid=await calendar({token:'unknown',profile_id:'alice'});assert.equal(invalid.status,401);
const opportunity=handler('team-public-opportunity');const publicData=await opportunity({token:'public-event',action:'get'});assert.equal(publicData.status,200);assert.equal(JSON.stringify(publicData.data).includes('advertised_value'),false);assert.equal(JSON.stringify(publicData.data).includes('agreed_value'),false);
assert.ok(selections.filter(x=>x.table==='team_event_openings').every(x=>!x.columns.includes('advertised_value')));
console.log('Privacidade OK: cada calendário retorna apenas a própria diária, IDs adulterados não mudam o titular, token inválido é rejeitado e oportunidades não expõem valores.');

tables.team_events.push({id:'draft',public_token:'draft-token',status:'draft'},{id:'ended',public_token:'ended-token',status:'completed'});
const draft=await opportunity({token:'draft-token',action:'get'});assert.equal(draft.status,404);assert.match(draft.data.error,/ainda não foi publicada/);assert.equal(draft.data.event,undefined);
const ended=await opportunity({token:'ended-token',action:'get'});assert.equal(ended.status,404);assert.match(ended.data.error,/encerrada/);
const missing=await opportunity({token:'missing',action:'get'});assert.equal(missing.status,404);assert.match(missing.data.error,/não foi encontrado/);
console.log('Links OK: publicada acessível, rascunho bloqueado, encerrada bloqueada e link inexistente identificado.');

// A collaborator can discover published vacancies before joining any supplier network.
tables.collaborator_profiles.push({id:'new',calendar_token:'token-new',losi_id:'LOSI-100003',full_name:'Novo colaborador'});
const freshEvent=(id,patch={})=>({id,public_token:'public-'+id,status:'open',business_id:'another-business',event_date:'2099-10-10',team_event_openings:[{id:'opening-'+id,title:'Monitor',slots:1}],...patch});
tables.team_events.push(freshEvent('other-supplier'),freshEvent('unpublished',{status:'draft'}),freshEvent('cancelled',{status:'cancelled'}),freshEvent('past',{event_date:'2000-01-01'}),freshEvent('no-vacancies',{team_event_openings:[]}),freshEvent('no-public-link',{public_token:null}));
const newcomer=await calendar({sessionToken:secrets.new});
assert.equal(newcomer.status,200);
assert.deepEqual(newcomer.data.opportunities.map(x=>x.id),['event','other-supplier']);
assert.deepEqual(newcomer.data.items,[]);assert.deepEqual(newcomer.data.networks,[]);
assert.equal(JSON.stringify(newcomer.data).includes('agreed_value'),false);
// Existing collaborators can discover the same public vacancies without sharing private schedules.
const existing=await calendar({sessionToken:secrets.alice});
assert.deepEqual(existing.data.opportunities.map(x=>x.id),['event','other-supplier']);
tables.team_applications.push({id:'new-application',profile_id:'new',status:'pending',team_events:{id:'event'}});
const applied=await calendar({sessionToken:secrets.new});
assert.deepEqual(applied.data.opportunities.map(x=>x.id),['other-supplier']);
assert.deepEqual(applied.data.items.map(x=>x.id),['new-application']);
console.log('Descoberta OK: novo colaborador sem rede vê vagas públicas; rascunhos, canceladas, passadas, sem vagas e já candidatadas não entram na lista.');

for(const action of [undefined,'respond','updateProfile','uploadPhoto','readNotification']){
 const denied=await calendar({token:'token-alice',action,applicationId:'app-a',response:'confirmed',full_name:'Intruso'});
 assert.equal(denied.status,401);
}
assert.equal(alice.data.collaborator.calendar_token,undefined);
assert.equal((await calendar({sessionToken:secrets.alice,action:'respond',applicationId:'app-b',response:'confirmed'})).status,404);
assert.ok(selections.filter(x=>x.table==='collaborator_profiles').every(x=>!x.columns.includes('calendar_token')));
console.log('Proteção OK: links antigos não autorizam leitura nem alterações, sessão não revela token antigo, outro colaborador não pode responder pela sua escala.');

// Event membership authorizes the brief and the strictly limited roster.
tables.team_applications.push(
 {id:'own-event',event_id:'event',profile_id:'alice',status:'pending',candidate_name:'Alice'},
 {id:'peer',event_id:'event',profile_id:'bob',status:'confirmed',candidate_name:'Bob',candidate_whatsapp:'5511999999999',agreed_value:450,assigned_role:'Privado',collaborator_profiles:{id:'bob',losi_id:'LOSI-100002',full_name:'Bob',professional_name:'Tio Bob',photo_url:'https://example.test/bob.png',whatsapp:'secret-phone'}},
 {id:'manual',event_id:'event',status:'confirmed',candidate_name:'Manual',team_collaborators:{name:'Manual',collaborator_profiles:{professional_name:'Tia Manual',photo_url:'https://example.test/manual.png'}}},
 {id:'not-working',event_id:'event',status:'confirmed',candidate_name:'Indisponivel',attendance_status:'unavailable'},
 {id:'only-approved',event_id:'event',status:'approved',candidate_name:'Nao escalado'},
 {id:'other-day',event_id:'another-event',status:'confirmed',candidate_name:'Outro dia'}
);
const details=await calendar({action:'eventDetails',eventId:'event',sessionToken:secrets.alice});
assert.equal(details.status,200);
assert.deepEqual(details.data.escalados,[{name:'Tio Bob',photo_url:'https://example.test/bob.png'},{name:'Tia Manual',photo_url:'https://example.test/manual.png'}]);
for(const member of details.data.escalados)assert.deepEqual(Object.keys(member).sort(),['name','photo_url']);
for(const forbidden of ['LOSI-100002','5511999999999','450','secret-phone','Privado','Outro dia','Indisponivel','Nao escalado'])assert.equal(JSON.stringify(details.data).includes(forbidden),false);
assert.equal((await calendar({action:'eventDetails',eventId:'event',sessionToken:secrets.new,profile_id:'alice'})).status,404);
assert.equal((await calendar({action:'eventDetails',eventId:'another-event',sessionToken:secrets.alice})).status,404);
assert.equal((await calendar({action:'eventDetails',eventId:'event',token:'token-alice'})).status,401);
tables.team_applications.find(x=>x.id==='own-event').status='removed';
assert.equal((await calendar({action:'eventDetails',eventId:'event',sessionToken:secrets.alice})).status,404);
const rosterSelections=selections.filter(x=>x.table==='team_applications'&&x.columns.includes('candidate_name,'));
assert.ok(rosterSelections.length>0);assert.ok(rosterSelections.every(x=>!x.columns.includes('whatsapp')&&!x.columns.includes('agreed_value')&&!x.columns.includes('losi_id')));
console.log('Escalados OK: apenas nome e foto, mesmo evento e dia, exclusão de indisponíveis, sem IDs/telefones/diárias; acesso negado a estranhos e removidos.');

assert.equal(alice.data.items[0].payment_status,'paid');assert.equal(alice.data.items[0].paid_at,'2026-10-06T12:00:00Z');
assert.equal(bob.data.items[0].payment_status,'pending');assert.equal(alice.data.items[0].paid_by,undefined);
assert.equal(JSON.stringify(details.data).includes('payment_status'),false);
assert.equal(JSON.stringify(details.data).includes('paid_at'),false);
console.log('Pagamentos OK: status e data apenas no calendário do titular, sem ator interno ou dados financeiros na lista de escalados.');
