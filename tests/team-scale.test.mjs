import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/team-scale.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const openings=[{id:'r',title:'Recreador',slots:6},{id:'c',title:'Coordenador',slots:2}];
const people=Array.from({length:4},(_,i)=>({id:String(i),opening_id:'r',status:'confirmed',assigned_role:'Monitoria',attendance_status:i===0?'confirmed':i===1?'unavailable':null}));
let result=exports.getTeamScale(openings,people);assert.equal(result.totals.slots,8);assert.equal(result.totals.filled,4);assert.equal(result.totals.remaining,4);assert.equal(result.roles[0].filled,4);assert.equal(result.roles[0].remaining,2);assert.equal(result.roles[1].remaining,2);assert.equal(result.roles[0].assigned[0].assigned_role,'Monitoria');assert.equal(result.totals.unavailable,1);
// Labels, accents and duplicated titles cannot change which vacancy is occupied.
result=exports.getTeamScale([{id:'a',title:'Guia',slots:1},{id:'b',title:'Guia',slots:2}],[{id:'member',opening_id:'b',status:'confirmed',assigned_role:'Guia turístico'}]);assert.equal(result.roles[0].filled,0);assert.equal(result.roles[1].filled,1);assert.equal(result.totals.remaining,2);
result=exports.getTeamScale(openings,[...people,{opening_id:'c',status:'approved'},{opening_id:'c',status:'pending'},{opening_id:'c',status:'removed'},{opening_id:'c',status:'withdrawn'}]);assert.equal(result.totals.filled,4);
// Removing a person frees the vacancy; a replacement keeps the original vacancy.
result=exports.getTeamScale(openings,[...people.slice(1),{opening_id:'r',status:'removed',assigned_role:'Monitoria'},{opening_id:'r',status:'confirmed',assigned_role:'Monitoria aquática'}]);assert.equal(result.roles[0].filled,4);assert.equal(result.totals.remaining,4);
result=exports.getTeamScale([{id:'r',title:'Recreador',slots:2}],people);assert.equal(result.totals.remaining,0);assert.equal(result.roles[0].over,2);assert.equal(result.roles[0].remaining,0);
result=exports.getTeamScale(openings,[]);assert.equal(result.totals.remaining,8);
console.log('Escala OK: 4 pessoas em 8 vagas deixam 4 disponíveis; função livre, vínculo por ID, títulos duplicados, estados, substituição e excedentes.');
