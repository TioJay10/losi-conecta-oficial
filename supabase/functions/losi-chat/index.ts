import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isValidTaxDocument, normalizeTaxDocument } from "./tax-document.ts";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const checked=(result:any)=>{if(result.error)throw new Error(result.error.message);return result.data;};
const paidStates=new Set(['CONFIRMED','RECEIVED']);
const safeOrder=(o:any)=>o?{id:o.id,status:o.status,kind:o.kind,credits:o.credits,amount_cents:o.amount_cents,invoice_url:o.invoice_url,created_at:o.created_at}:null;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({error:'Método não permitido.'},405);
 try{
  const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const body=await req.json();
  if(body.action==='public-number'){
   if(!uuid(body.businessId))return json({number:null});
   const a=checked(await admin.from('losi_chat_accounts').select('digital_number,business_id').eq('business_id',body.businessId).eq('show_public',true).maybeSingle());
   if(!a?.digital_number)return json({number:null});
   const b=checked(await admin.from('business_profiles').select('active,approval_status').eq('id',body.businessId).maybeSingle());
   return json({number:b?.active&&b.approval_status==='approved'?a.digital_number:null});
  }
  const bearer=(req.headers.get('Authorization')??'').replace(/^Bearer\s+/i,'');
  const {data:auth,error:authError}=await admin.auth.getUser(bearer);
  if(authError||!auth.user)return json({error:'Entre na sua conta para usar o Chat LOSI.'},401);
  const user=auth.user;
  const profile=checked(await admin.from('profiles').select('blocked,full_name,phone').eq('id',user.id).maybeSingle());
  if(profile?.blocked)return json({error:'Sua conta está indisponível.'},403);
  const ownAccount=async()=>checked(await admin.from('losi_chat_accounts').select('*').eq('user_id',user.id).maybeSingle());
  const asaas=async(path:string,method='GET',payload?:unknown)=>{
   const key=Deno.env.get('ASAAS_API_KEY');if(!key)throw new Error('PAGAMENTO_INDISPONIVEL');
   const r=await fetch('https://api.asaas.com/v3'+path,{method,headers:{access_token:key,'Content-Type':'application/json','User-Agent':'LOSI-Conecta'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(20000)});
   const data=await r.json();if(!r.ok)throw new Error(method==='POST'&&path==='/payments'?'COBRANCA_RECUSADA':'ASAAS_INDISPONIVEL');return data;
  };
  const settle=async(o:any,p:any)=>{
   if(p.externalReference!==o.external_reference||p.customer!==o.customer_id||Math.round(Number(p.value)*100)!==o.amount_cents||(o.asaas_payment_id&&p.id!==o.asaas_payment_id))throw new Error('PAGAMENTO_DIVERGENTE');
   checked(await admin.rpc('losi_chat_settle_order',{p_reference:o.external_reference,p_payment:p.id,p_customer:p.customer,p_amount:Math.round(Number(p.value)*100),p_state:p.deleted?'DELETED':p.status}));
  };
  if(body.action==='status'){
   const account=await ownAccount();
   const orders=checked(await admin.from('losi_chat_orders').select('*').eq('user_id',user.id).order('created_at',{ascending:false}).limit(10));
   return json({account,orders:orders.map(safeOrder)});
  }
  if(body.action==='purchase'){
   if(!uuid(body.requestId)||!['10k','50k'].includes(body.packageKey))return json({error:'Selecione um pacote válido.'},400);
   const reserved=checked(await admin.rpc('losi_chat_reserve_order',{p_user:user.id,p_request:body.requestId,p_package:body.packageKey}));
   let o=reserved.order;
   if(!reserved.created){
    if(o.status==='creating'&&o.customer_id){
     const found=await asaas('/payments?externalReference='+encodeURIComponent(o.external_reference)+'&limit=10');
     const p=found.data?.find((x:any)=>!x.deleted&&x.customer===o.customer_id);
     if(p){checked(await admin.from('losi_chat_orders').update({asaas_payment_id:p.id,invoice_url:p.invoiceUrl,status:'pending'}).eq('id',o.id).eq('status','creating'));await settle(o,p);o=checked(await admin.from('losi_chat_orders').select('*').eq('id',o.id).single());}
    }
    return json({order:safeOrder(o),processing:o.status==='creating'});
   }
   let paymentAttempted=false;
   try{
    const b=checked(await admin.from('business_profiles').select('*').eq('owner_id',user.id).single());
    let customer:any=null;
    if(b.asaas_customer_id){try{customer=await asaas('/customers/'+encodeURIComponent(b.asaas_customer_id));if(customer.deleted)customer=null;}catch{customer=null;}}
    if(!customer){const found=await asaas('/customers?externalReference='+encodeURIComponent(b.id)+'&limit=10');customer=found.data?.find((x:any)=>!x.deleted);}
    if(!customer){
     const fiscal=checked(await admin.from('business_fiscal_details').select('document').eq('business_id',b.id).maybeSingle());
     const document=normalizeTaxDocument(String(body.document||fiscal?.document||''));
     if(!isValidTaxDocument(document))throw new Error('DOCUMENTO_INVALIDO');
     customer=await asaas('/customers','POST',{name:profile?.full_name||b.business_name,cpfCnpj:document,email:user.email,mobilePhone:String(profile?.phone||b.whatsapp||b.phone||'').replace(/\D/g,''),externalReference:b.id,notificationDisabled:false});
    }
    checked(await admin.from('losi_chat_orders').update({customer_id:customer.id}).eq('id',o.id));o.customer_id=customer.id;
    paymentAttempted=true;
    const due=new Date(Date.now()+86400000).toISOString().slice(0,10);
    const p=await asaas('/payments','POST',{customer:customer.id,billingType:'UNDEFINED',value:o.amount_cents/100,dueDate:due,description:`Chat LOSI · ${o.kind==='initial'?'Número digital +':'Recarga de'} ${o.credits.toLocaleString('pt-BR')} créditos`,externalReference:o.external_reference});
    // A fast webhook may have already settled this order. Never overwrite paid/refunded.
    checked(await admin.from('losi_chat_orders').update({asaas_payment_id:p.id,invoice_url:p.invoiceUrl,status:'pending'}).eq('id',o.id).eq('status','creating'));
    await settle(o,p);
    o=checked(await admin.from('losi_chat_orders').select('*').eq('id',o.id).single());
    return json({order:safeOrder(o)});
   }catch(e){
    const code=e instanceof Error?e.message:'';
    if(!paymentAttempted||code==='COBRANCA_RECUSADA')checked(await admin.from('losi_chat_orders').update({status:'failed'}).eq('id',o.id).eq('status','creating'));
    // Unknown POST outcome: keep order reserved. Retrying looks up by reference, never charges again.
    if(paymentAttempted&&code!=='COBRANCA_RECUSADA')return json({order:safeOrder(o),processing:true});
    throw e;
   }
  }
  if(body.action==='refresh-payment'){
   if(!uuid(body.orderId))throw new Error('PEDIDO_INVALIDO');
   let o=checked(await admin.from('losi_chat_orders').select('*').eq('id',body.orderId).eq('user_id',user.id).single());
   if(!o.customer_id)return json({order:safeOrder(o),processing:o.status==='creating'});
   let p=o.asaas_payment_id?await asaas('/payments/'+encodeURIComponent(o.asaas_payment_id)):null;
   if(!p){const found=await asaas('/payments?externalReference='+encodeURIComponent(o.external_reference)+'&limit=10');p=found.data?.find((x:any)=>!x.deleted&&x.customer===o.customer_id);}
   if(p){
    if(o.status==='creating')checked(await admin.from('losi_chat_orders').update({asaas_payment_id:p.id,invoice_url:p.invoiceUrl,status:'pending'}).eq('id',o.id).eq('status','creating'));
    await settle(o,p);o=checked(await admin.from('losi_chat_orders').select('*').eq('id',o.id).single());
   }
   return json({order:safeOrder(o),confirmed:paidStates.has(p?.status),processing:o.status==='creating'});
  }
  if(body.action==='claim')return json({number:checked(await admin.rpc('losi_chat_claim',{p_user:user.id}))});
  if(body.action==='visibility'){
   const a=await ownAccount();if(!a?.digital_number)throw new Error('RESGATE_SEU_NUMERO');
   checked(await admin.from('losi_chat_accounts').update({show_public:body.visible===true}).eq('user_id',user.id));return json({success:true});
  }
  if(body.action==='open'){
   const a=await ownAccount();if(!a?.digital_number)throw new Error('RESGATE_SEU_NUMERO');
   const n=String(body.number??'').replace(/\D/g,'');if(!/^[1-9][0-9]{8}$/.test(n))throw new Error('NUMERO_INVALIDO');
   const other=checked(await admin.from('losi_chat_accounts').select('user_id,business_id').eq('digital_number',n).maybeSingle());
   if(!other||other.user_id===user.id)throw new Error('CONTATO_INDISPONIVEL');
   const b=checked(await admin.from('business_profiles').select('active').eq('id',other.business_id).single());
   const p=checked(await admin.from('profiles').select('blocked').eq('id',other.user_id).maybeSingle());
   if(!b.active||p?.blocked)throw new Error('CONTATO_INDISPONIVEL');
   const ids=[user.id,other.user_id].sort();
   checked(await admin.from('losi_chat_threads').upsert({user_a:ids[0],user_b:ids[1]},{onConflict:'user_a,user_b',ignoreDuplicates:true}));
   const t=checked(await admin.from('losi_chat_threads').select('id').eq('user_a',ids[0]).eq('user_b',ids[1]).single());return json({threadId:t.id});
  }
  const threadForUser=async(id:unknown)=>{
   if(!uuid(id))throw new Error('CONVERSA_INDISPONIVEL');
   const t=checked(await admin.from('losi_chat_threads').select('*').eq('id',id).or(`user_a.eq.${user.id},user_b.eq.${user.id}`).maybeSingle());
   if(!t)throw new Error('CONVERSA_INDISPONIVEL');return t;
  };
  if(body.action==='threads'){
   return json({threads:checked(await admin.rpc('losi_chat_list_threads',{p_user:user.id})),userId:user.id});
  }
  if(body.action==='messages'){
   await threadForUser(body.threadId);
   let query=admin.from('losi_chat_messages').select('*').eq('thread_id',body.threadId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
   if(body.before){
    if(!uuid(body.before.id)||typeof body.before.at!=='string'||!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(body.before.at)||!Number.isFinite(Date.parse(body.before.at)))throw new Error('CONVERSA_INDISPONIVEL');
    const at=body.before.at;
    query=query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${body.before.id})`);
   }
   const messages=checked(await query);
   const readAt=messages[0]?.created_at;
   if(readAt&&!body.before)checked(await admin.rpc('losi_chat_mark_read',{p_user:user.id,p_thread:body.threadId,p_read:readAt}));
   return json({messages:messages.reverse(),userId:user.id,hasMore:messages.length===100});
  }
  if(body.action==='favorite'){
   await threadForUser(body.threadId);
   checked(await admin.rpc('losi_chat_favorite',{p_user:user.id,p_thread:body.threadId,p_favorite:body.favorite===true}));return json({success:true});
  }
  if(body.action==='send'){
   if(!uuid(body.requestId)||!uuid(body.threadId)||typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)throw new Error('TEXTO_INVALIDO');
   return json(checked(await admin.rpc('losi_chat_send_text',{p_user:user.id,p_thread:body.threadId,p_request:body.requestId,p_body:body.text})));
  }
  return json({error:'Ação inválida.'},400);
 }catch(e){
  const code=e instanceof Error?e.message:'';
  const messages:Record<string,string>={DOCUMENTO_INVALIDO:'Informe um CPF/CNPJ válido para o pagamento.',RESGATE_SEU_NUMERO:'Resgate seu número digital antes de continuar.',PAGAMENTO_PENDENTE:'O pagamento ainda não foi confirmado.',SALDO_INSUFICIENTE:'Seus créditos acabaram. Faça uma recarga para enviar mensagens.',CONTATO_INDISPONIVEL:'Este número não está disponível para conversar.',NUMERO_INVALIDO:'Informe os 9 dígitos do número digital LOSI.',FORNECEDOR_INDISPONIVEL:'Cadastre sua empresa antes de comprar o número digital.',TEXTO_INVALIDO:'Escreva uma mensagem de até 4.000 caracteres.',COBRANCA_RECUSADA:'O Asaas não conseguiu criar a cobrança. Confira seus dados e tente novamente.'};
  console.error('Chat LOSI action failed',code);
  return json({error:messages[code]??'Não foi possível concluir agora. Tente novamente.'},400);
 }
});
