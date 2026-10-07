const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const source=fs.readFileSync('supabase/functions/losi-chat/index.ts','utf8').replace(/^import .*;\n/gm,'');
const built=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});assert.equal(built.diagnostics.length,0);
const user='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',biz='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',reqId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
async function scenario(mode,requests){
 let handler,postPayments=0,settles=0,deletes=0,remoteDeleted=false;const writes=[],calls=[];
 const db={profiles:[{id:user,blocked:false,full_name:'Test Provider'}],business_profiles:[{id:biz,owner_id:user,active:true,approval_status:'approved',business_name:'Test business',asaas_customer_id:'cus_existing'}],business_fiscal_details:[{business_id:biz,document:'123'}],losi_chat_accounts:[],losi_chat_orders:[],losi_chat_threads:[]};
 const admin={auth:{getUser:async(token)=>token==='good'?{data:{user:{id:user,email:'test@example.test'}},error:null}:{data:{user:null},error:{}}},from(table){
  let op='select',value,filters=[],single=false;
  const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},or(){return q},order(){return q},limit(){return q},update(v){op='update';value=v;return q},insert(v){op='insert';value=v;return q},upsert(v){op='insert';value=v;return q},single(){single=true;return q},maybeSingle(){single=true;return q},then(resolve,reject){
   let rows=(db[table]||[]).filter(r=>filters.every(f=>f(r)));
   if(op==='update'){writes.push({table,value});for(const r of rows)Object.assign(r,value);}
   if(op==='insert'){writes.push({table,value});db[table].push(value);rows=[value];}
   return Promise.resolve({data:single?rows[0]??null:rows,error:single&&!rows.length&&table==='losi_chat_orders'?{message:'not found'}:null}).then(resolve,reject);
  }};return q;
 },rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='losi_chat_reserve_order'){
   assert.equal(args.p_user,user);let o=db.losi_chat_orders.find(x=>['creating','pending'].includes(x.status));
   if(o)return {data:{order:{...o},created:false}};
   o={id:args.p_request,user_id:user,package_key:args.p_package,credits:args.p_package==='10k'?10000:50000,amount_cents:args.p_package==='10k'?2990:7990,kind:'initial',status:'creating',external_reference:'losi_chat:'+args.p_request};db.losi_chat_orders.push(o);return {data:{order:{...o},created:true}};
  }
  if(name==='losi_chat_settle_order'){settles++;if(mode==='bad-amount')throw Error('should reject before RPC');if(['CONFIRMED','RECEIVED'].includes(args.p_state))db.losi_chat_orders[0].status='paid';if(args.p_state==='DELETED')db.losi_chat_orders[0].status='cancelled';return {data:true};}
  if(name==='losi_chat_create_group'){assert.equal(args.p_user,user);return {data:args.p_request};}
  if(name==='losi_chat_manage_group'){assert.equal(args.p_user,user);return {data:null};}
  if(name==='losi_chat_send_text'||name==='losi_chat_send_group_text'){assert.equal(args.p_user,user);return {data:{message:{id:args.p_request},balance:99}};}
  throw Error('Unexpected RPC '+name);
 }};
 const context={Request,Response,AbortSignal,Date,console:{error(){}},createClient:()=>admin,isValidTaxDocument:()=>mode!=='invalid-document',normalizeTaxDocument:x=>x, Deno:{env:{get:()=> 'mock'},serve:fn=>handler=fn},fetch:async(url,options)=>{
  const u=new URL(url),p=u.pathname;
  if(p.startsWith('/v3/customers'))return new Response(JSON.stringify(mode==='needs-document'?{data:[],deleted:true}:{id:'cus_existing'}));
  if(options.method==='POST'&&p==='/v3/payments'){
   postPayments++;const v=JSON.parse(options.body);assert.equal(v.value,29.9);assert.equal(v.externalReference,'losi_chat:'+reqId);assert.equal(v.customer,'cus_existing');
   if(mode==='uncertain')throw new Error('network timeout');
   if(mode==='rejected')return new Response('{}',{status:400});
   return new Response(JSON.stringify({id:'pay_test',customer:'cus_existing',externalReference:v.externalReference,value:mode==='bad-amount'?1:v.value,status:'PENDING',invoiceUrl:'https://www.asaas.com/i/test'}));
  }
  if(p==='/v3/payments')return new Response(JSON.stringify({data:[]}));
  if(p==='/v3/payments/pay_test'&&options.method==='DELETE'){deletes++;remoteDeleted=true;if(mode==='cancel-timeout')throw new Error('delete result lost');return new Response(JSON.stringify({deleted:true,id:'pay_test'}));}
  if(p==='/v3/payments/pay_test')return new Response(JSON.stringify({id:'pay_test',customer:mode==='cancel-wrong-customer'?'cus_other':'cus_existing',externalReference:'losi_chat:'+reqId,value:29.9,status:mode.startsWith('cancel')&&mode!=='cancel-paid-deleted'?'PENDING':'RECEIVED',deleted:remoteDeleted||mode==='cancel-paid-deleted'}));
  throw Error('Unexpected fetch '+url);
 }};
 vm.createContext(context);vm.runInContext(built.outputText,context);
 const results=[];for(const body of requests){const r=await handler(new Request('https://test.example',{method:'POST',headers:{Authorization:mode==='unauth'?'Bearer bad':'Bearer good','Content-Type':'application/json'},body:JSON.stringify(body)}));results.push({status:r.status,data:await r.json()});}
 return {results,postPayments,settles,deletes,writes,calls,db};
}
(async()=>{
 const purchase={action:'purchase',packageKey:'10k',requestId:reqId,amount:0,credits:999999};
 let r=await scenario('ok',[purchase,{...purchase,requestId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'},{action:'refresh-payment',orderId:reqId}]);assert.equal(r.postPayments,1);assert.equal(r.results[2].data.order.status,'paid');assert(!r.writes.some(w=>w.table==='business_profiles'));assert.equal(r.db.losi_chat_orders[0].amount_cents,2990);
 r=await scenario('unauth',[purchase]);assert.equal(r.results[0].status,401);assert.equal(r.postPayments,0);assert.equal(r.calls.length,0);
 r=await scenario('ok',[{...purchase,packageKey:'free'}]);assert.equal(r.results[0].status,400);assert.equal(r.postPayments,0);
 r=await scenario('uncertain',[purchase,purchase,{action:'refresh-payment',orderId:reqId}]);assert.equal(r.postPayments,1);assert(r.results[0].data.processing);assert.equal(r.db.losi_chat_orders[0].status,'creating');
 r=await scenario('rejected',[purchase]);assert.equal(r.results[0].status,400);assert.equal(r.db.losi_chat_orders[0].status,'failed');
 r=await scenario('bad-amount',[purchase]);assert.equal(r.settles,0);assert.notEqual(r.db.losi_chat_orders[0].status,'paid');
 r=await scenario('ok',[{action:'send',requestId:reqId,threadId:biz,text:'Olá',userId:'attacker'}]);assert.equal(r.calls[0].args.p_user,user);
 r=await scenario('ok',[{action:'send',requestId:reqId,threadId:biz,text:'x'.repeat(4001)}]);assert.equal(r.results[0].status,400);assert.equal(r.calls.length,0);
 r=await scenario('unauth',[{action:'public-number',businessId:biz}]);assert.deepEqual(r.results[0].data,{number:null});assert.equal(r.calls.length,0);
 r=await scenario('cancel',[purchase,{action:'cancel-payment',orderId:reqId},{action:'cancel-payment',orderId:reqId}]);assert.equal(r.deletes,1);assert.equal(r.results[1].data.order.status,'cancelled');assert.equal(r.results[2].data.cancelled,true);
 r=await scenario('ok',[purchase,{action:'cancel-payment',orderId:reqId}]);assert.equal(r.deletes,0);assert.equal(r.results[1].status,400);assert.equal(r.db.losi_chat_orders[0].status,'paid');
 r=await scenario('cancel-paid-deleted',[purchase,{action:'cancel-payment',orderId:reqId}]);assert.equal(r.deletes,0);assert.equal(r.results[1].status,400);assert.equal(r.db.losi_chat_orders[0].status,'paid');
 r=await scenario('cancel-wrong-customer',[purchase,{action:'cancel-payment',orderId:reqId}]);assert.equal(r.deletes,0);assert.equal(r.results[1].status,400);assert.equal(r.db.losi_chat_orders[0].status,'pending');
 r=await scenario('cancel',[purchase,{action:'cancel-payment',orderId:biz}]);assert.equal(r.deletes,0);assert.equal(r.results[1].status,400);
 r=await scenario('cancel-timeout',[purchase,{action:'cancel-payment',orderId:reqId},{action:'cancel-payment',orderId:reqId}]);assert.equal(r.deletes,1);assert.equal(r.results[1].status,400);assert.equal(r.results[2].data.cancelled,true);
 r=await scenario('ok',[{action:'group-create',requestId:reqId,name:'Parceiros',description:'',numbers:['154444566'],userId:'forged'}]);assert.equal(r.calls[0].args.p_user,user);assert.equal(r.results[0].data.groupId,reqId);
 r=await scenario('ok',[{action:'group-create',requestId:reqId,name:'Parceiros',description:'',numbers:['INVALID']}]);assert.equal(r.calls.length,0);assert.equal(r.results[0].status,400);
 r=await scenario('ok',[{action:'send',group:true,requestId:reqId,threadId:biz,text:'Grupo'}]);assert.equal(r.calls[0].name,'losi_chat_send_group_text');assert.equal(r.calls[0].args.p_group,biz);
 const webhook=fs.readFileSync('supabase/functions/asaas-webhook/index.ts','utf8');const start=webhook.indexOf('    if (paymentExternalReference.startsWith("losi_chat:"))'),end=webhook.indexOf('\n\n    if (\n      isAdsCreditPurchase');const original=(webhook.slice(0,start)+webhook.slice(end)).replace(/\n\n\n/g,'\n\n');assert.equal(require('node:crypto').createHash('sha256').update(original).digest('hex'),'b8e7547a7875e0c9a2b9638bf316e066412c0f64a97b3bfa95198feee9def3c5'); // Existing ADS/subscription flow remains unchanged.
 console.log('PASS: auth, fixed price, one charge, unknown payment outcome, rejection, mismatch, text boundaries, public privacy, webhook scope, cancellation/retry/ownership, group input/auth/routing');
})().catch(e=>{console.error(e);process.exit(1)});
