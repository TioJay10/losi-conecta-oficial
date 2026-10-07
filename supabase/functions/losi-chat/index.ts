import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isValidTaxDocument, normalizeTaxDocument } from "./tax-document.ts";
import { mediaMetadata, verifyMedia } from "./media-rules.ts";
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
   checked(await admin.rpc('losi_chat_settle_order',{p_reference:o.external_reference,p_payment:p.id,p_customer:p.customer,p_amount:Math.round(Number(p.value)*100),p_state:paidStates.has(p.status)?p.status:p.deleted?'DELETED':p.status}));
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
  if(body.action==='cancel-payment'){
   if(!uuid(body.orderId))throw new Error('PEDIDO_INVALIDO');
   let o=checked(await admin.from('losi_chat_orders').select('*').eq('id',body.orderId).eq('user_id',user.id).single());
   if(o.status==='cancelled')return json({order:safeOrder(o),cancelled:true});
   if(!['pending','creating'].includes(o.status))throw new Error('FATURA_NAO_CANCELAVEL');
   if(!o.customer_id)throw new Error('COBRANCA_EM_CONFERENCIA');
   let p=o.asaas_payment_id?await asaas('/payments/'+encodeURIComponent(o.asaas_payment_id)):null;
   if(!p){const found=await asaas('/payments?externalReference='+encodeURIComponent(o.external_reference)+'&limit=10');p=found.data?.find((x:any)=>x.externalReference===o.external_reference&&x.customer===o.customer_id);}
   if(!p)throw new Error('COBRANCA_EM_CONFERENCIA');
   // Reconcile before deletion: never turn a confirmed payment into a local cancellation.
   await settle(o,p);
   if(paidStates.has(p.status))throw new Error('FATURA_NAO_CANCELAVEL');
   if(!p.deleted&&!['PENDING','OVERDUE'].includes(p.status))throw new Error('FATURA_NAO_CANCELAVEL');
   if(!p.deleted){
    const removed=await asaas('/payments/'+encodeURIComponent(p.id),'DELETE');
    if(removed.deleted!==true||(removed.id&&removed.id!==p.id))throw new Error('CANCELAMENTO_NAO_CONFIRMADO');
    await settle(o,{...p,deleted:true});
   }
   o=checked(await admin.from('losi_chat_orders').select('*').eq('id',o.id).eq('user_id',user.id).single());
   if(o.status!=='cancelled')throw new Error('FATURA_NAO_CANCELAVEL');
   return json({order:safeOrder(o),cancelled:true});
  }
  const groupPhotoUrl=async(path:string|null)=>path?checked(await admin.storage.from('losi-chat-attachments').createSignedUrl(path,3600)).signedUrl:null;
  const uploadGroupPhoto=async(groupId:string,photo:unknown)=>{
   if(photo===null)return null;
   if(typeof photo!=='string'||photo.length>700000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo))throw new Error('FOTO_GRUPO_INVALIDA');
   const bytes=Uint8Array.from(atob(photo.split(',')[1]),c=>c.charCodeAt(0));
   if(bytes.length>512000||!verifyMedia(bytes,'image/jpeg'))throw new Error('FOTO_GRUPO_INVALIDA');
   const path='group-photos/'+groupId+'/'+crypto.randomUUID()+'.jpg';
   checked(await admin.storage.from('losi-chat-attachments').upload(path,bytes,{contentType:'image/jpeg',upsert:false}));
   return path;
  };
  if(body.action==='group-edit'){
   if(!uuid(body.groupId))throw new Error('GRUPO_INDISPONIVEL');
   const g=checked(await admin.rpc('losi_chat_group_details',{p_user:user.id,p_group:body.groupId}));
   if(!g.isOwner)throw new Error('APENAS_ADMIN_GRUPO');
   const changePhoto=Object.hasOwn(body,'photo');
   const old=checked(await admin.from('losi_chat_groups').select('photo_path').eq('id',body.groupId).single());
   const path=changePhoto?await uploadGroupPhoto(body.groupId,body.photo):null;
   try{checked(await admin.rpc('losi_chat_edit_group',{p_user:user.id,p_group:body.groupId,p_name:body.name,p_description:body.description,p_change_photo:changePhoto,p_photo_path:path}));}
   catch(e){if(path)await admin.storage.from('losi-chat-attachments').remove([path]);throw e;}
   if(changePhoto&&old.photo_path)await admin.storage.from('losi-chat-attachments').remove([old.photo_path]);
   return json({success:true});
  }
  if(body.action==='acknowledge'||body.action==='receipt-status'){
   if(!Array.isArray(body.ids)||body.ids.length>100||!body.ids.every(uuid))throw new Error('ANEXO_INVALIDO');
   if(body.action==='acknowledge'){
    if(typeof body.read!=='boolean')throw new Error('ANEXO_INVALIDO');
    checked(await admin.rpc('losi_chat_acknowledge',{p_user:user.id,p_ids:body.ids,p_read:body.read}));
    return json({success:true});
   }
   return json({receipts:checked(await admin.rpc('losi_chat_receipt_status',{p_user:user.id,p_ids:body.ids}))});
  }
  if(body.action==='group-create'){
   if(!uuid(body.requestId)||typeof body.name!=='string'||typeof body.description!=='string'||!Array.isArray(body.numbers)||body.numbers.length>99||!body.numbers.every((n:any)=>typeof n==='string'&&/^[1-9][0-9]{8}$/.test(n)))throw new Error('GRUPO_DADOS_INVALIDOS');
   const groupId=checked(await admin.rpc('losi_chat_create_group',{p_user:user.id,p_request:body.requestId,p_name:body.name,p_description:body.description,p_numbers:body.numbers}));
   if(body.photo){
    const g=checked(await admin.rpc('losi_chat_group_details',{p_user:user.id,p_group:groupId}));
    if(!g.isOwner)throw new Error('APENAS_ADMIN_GRUPO');
    const old=checked(await admin.from('losi_chat_groups').select('photo_path').eq('id',groupId).single());
    const path=await uploadGroupPhoto(groupId,body.photo);
    try{checked(await admin.rpc('losi_chat_edit_group',{p_user:user.id,p_group:groupId,p_name:body.name,p_description:body.description,p_change_photo:true,p_photo_path:path}));}
    catch(e){if(path)await admin.storage.from('losi-chat-attachments').remove([path]);throw e;}
    if(old.photo_path)await admin.storage.from('losi-chat-attachments').remove([old.photo_path]);
   }
   return json({groupId});
  }
  if(body.action==='group-details'){
   if(!uuid(body.groupId))throw new Error('GRUPO_INDISPONIVEL');
   const group=checked(await admin.rpc('losi_chat_group_details',{p_user:user.id,p_group:body.groupId}));
   const row=checked(await admin.from('losi_chat_groups').select('photo_path').eq('id',body.groupId).single());
   return json({group:{...group,photo:await groupPhotoUrl(row.photo_path)}});
  }
  if(body.action==='group-manage'){
   if(!uuid(body.groupId)||!['add','remove','promote','transfer','leave','rename'].includes(body.operation))throw new Error('GRUPO_DADOS_INVALIDOS');
   if(['add','remove','promote','transfer'].includes(body.operation)&&!/^[1-9][0-9]{8}$/.test(String(body.number??'')))throw new Error('NUMERO_INVALIDO');
   checked(await admin.rpc('losi_chat_manage_group',{p_user:user.id,p_group:body.groupId,p_action:body.operation,p_number:body.number??null,p_name:body.name??null,p_description:body.description??null}));
   return json({success:true});
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
  const decorate=async(messages:any[])=>{
   messages=messages.map(m=>m.deleted_at?{id:m.id,thread_id:m.thread_id,group_id:m.group_id,sender_id:m.sender_id,created_at:m.created_at,body:'',deleted_at:m.deleted_at}:m);
   const ids=messages.map(m=>m.attachment_id).filter(Boolean);
   const senderIds=[...new Set(messages.map(m=>m.sender_id).filter(Boolean))];
   const [uploadRows,senderRows]=await Promise.all([
    ids.length?Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,i)=>admin.from('losi_chat_uploads').select('id,file_name,kind,mime,byte_size').in('id',ids.slice(i*100,(i+1)*100)))).then(rows=>rows.flatMap(checked)):Promise.resolve([]),
    senderIds.length?checked(await admin.from('business_profiles').select('owner_id,logo_url,business_name').in('owner_id',senderIds)):Promise.resolve([])
   ]);
   const ownIds=messages.filter(m=>m.sender_id===user.id).map(m=>m.id);
   const receipts=ownIds.length?checked(await admin.rpc('losi_chat_receipt_status',{p_user:user.id,p_ids:ownIds})):{};
   const replyIds=messages.filter(m=>m.reply_to).map(m=>m.id);
   const replies=replyIds.length?checked(await admin.rpc('losi_chat_reply_previews',{p_user:user.id,p_ids:replyIds})):{};
   const map=new Map(uploadRows.map((u:any)=>[u.id,u])),senders=new Map(senderRows.map((s:any)=>[s.owner_id,s]));
   return messages.map(m=>({...m,reply:replies[m.id],receipt:receipts[m.id],sender_photo:senders.get(m.sender_id)?.logo_url??null,sender_name:m.sender_name??senders.get(m.sender_id)?.business_name,attachment:m.attachment_id?map.get(m.attachment_id)??null:null}));
  };
  const mediaTarget=async(id:string,group:boolean)=>{
   if(!uuid(id))throw new Error('ANEXO_INVALIDO');
   if(group)checked(await admin.rpc('losi_chat_group_details',{p_user:user.id,p_group:id}));else await threadForUser(id);
  };
  if(body.action==='prepare-media'){
   if(!uuid(body.uploadId))throw new Error('ANEXO_INVALIDO');
   await mediaTarget(body.threadId,body.group===true);
   const a=await ownAccount();if(!a?.digital_number)throw new Error('RESGATE_SEU_NUMERO');
   const meta=mediaMetadata(body.fileName,body.size);
   const minCost=meta.kind==='audio'?1:meta.kind==='video'?10:meta.kind==='image'?2:meta.byte_size<=2097152?2:meta.byte_size<=5242880?3:meta.byte_size<=10485760?4:8;
   if(Number(a.balance)<minCost)throw new Error('SALDO_INSUFICIENTE');
   // Bounded cleanup after signed upload capabilities expire; never delete sent media.
   const expired=checked(await admin.rpc('losi_chat_expired_uploads',{p_user:user.id}));
   if(expired.length){const removed=await admin.storage.from('losi-chat-attachments').remove(expired.map((x:any)=>x.path));if(!removed.error)checked(await admin.from('losi_chat_uploads').delete().in('id',expired.map((x:any)=>x.id)).eq('sent',false));}
   let u=checked(await admin.from('losi_chat_uploads').select('*').eq('id',body.uploadId).maybeSingle());
   if(u){if(u.user_id!==user.id||u.file_name!==meta.file_name||u.byte_size!==meta.byte_size||u.mime!==meta.mime||(body.group===true?u.group_id:u.thread_id)!==body.threadId||u.sent||Date.parse(u.expires_at)<Date.now())throw new Error('ANEXO_INVALIDO');}
   else{
    const pending=checked(await admin.from('losi_chat_uploads').select('id').eq('user_id',user.id).eq('sent',false).limit(21));if(pending.length>=20)throw new Error('ANEXO_LIMITE');
    u=checked(await admin.from('losi_chat_uploads').insert({id:body.uploadId,user_id:user.id,thread_id:body.group===true?null:body.threadId,group_id:body.group===true?body.threadId:null,kind:meta.kind,file_name:meta.file_name,mime:meta.mime,byte_size:meta.byte_size,path:user.id+'/'+body.uploadId+'.'+meta.ext}).select('*').single());
   }
   // Refresh expiry BEFORE granting another two-hour upload capability.
   checked(await admin.from('losi_chat_uploads').update({expires_at:new Date(Date.now()+125*60000).toISOString()}).eq('id',u.id).eq('sent',false));
   const signed=checked(await admin.storage.from('losi-chat-attachments').createSignedUploadUrl(u.path,{upsert:false}));
   return json({path:u.path,token:signed.token,mime:u.mime,signedUrl:signed.signedUrl});
  }
  if(body.action==='send-media'){
   if(!uuid(body.uploadId)||!uuid(body.requestId)||typeof body.text!=='string'||body.text.length>4000)throw new Error('ANEXO_INVALIDO');
   const u=checked(await admin.from('losi_chat_uploads').select('*').eq('id',body.uploadId).eq('user_id',user.id).single());
   await mediaTarget(u.group_id??u.thread_id,Boolean(u.group_id));
   if(!u.sent){
    if(Date.parse(u.expires_at)<Date.now())throw new Error('ANEXO_INVALIDO');
    const blob=checked(await admin.storage.from('losi-chat-attachments').download(u.path));
    if(blob.size!==u.byte_size||blob.size>20971520)throw new Error('ANEXO_INVALIDO');
    if(!verifyMedia(new Uint8Array(await blob.arrayBuffer()),u.mime))throw new Error('ANEXO_FORMATO');
    checked(await admin.from('losi_chat_uploads').update({verified:true}).eq('id',u.id).eq('sent',false));
   }
   if(body.replyTo!=null&&!uuid(body.replyTo))throw new Error('RESPOSTA_INVALIDA');
   const data=checked(await admin.rpc(body.replyTo?'losi_chat_send_reply':'losi_chat_send_media',{p_user:user.id,p_upload:u.id,p_request:body.requestId,p_body:body.text,...(body.replyTo?{p_target:u.group_id??u.thread_id,p_group:Boolean(u.group_id),p_reply:body.replyTo}:{})}));
   data.message=(await decorate([data.message]))[0];return json(data);
  }
  if(body.action==='delete-media'){
   if(!uuid(body.messageId)||typeof body.everyone!=='boolean')throw new Error('ANEXO_INVALIDO');
   checked(await admin.rpc('losi_chat_delete_media',{p_user:user.id,p_message:body.messageId,p_everyone:body.everyone}));
   return json({success:true});
  }
  if(body.action==='media-url'){
   if(!uuid(body.messageId))throw new Error('ANEXO_INVALIDO');
   const m=checked(await admin.from('losi_chat_messages').select('*').eq('id',body.messageId).single());
   if(m.group_id){const me=checked(await admin.from('losi_chat_group_members').select('joined_at').eq('group_id',m.group_id).eq('user_id',user.id).eq('active',true).lte('joined_at',m.created_at).maybeSingle());if(!me)throw new Error('GRUPO_INDISPONIVEL');}
   else await threadForUser(m.thread_id);
   const hidden=checked(await admin.from('losi_chat_hidden_messages').select('message_id').eq('user_id',user.id).eq('message_id',m.id).maybeSingle());
   if(m.deleted_at||hidden)throw new Error('ANEXO_INVALIDO');
   const u=checked(await admin.from('losi_chat_uploads').select('*').eq('id',m.attachment_id).eq('sent',true).single());
   const signed=checked(await admin.storage.from('losi-chat-attachments').createSignedUrl(u.path,60,body.download===true||u.kind==='document'?{download:u.file_name}:{}));
   return json({url:signed.signedUrl});
  }
  if(body.action==='threads'){
   const [privateChats,groups]=await Promise.all([admin.rpc('losi_chat_list_threads',{p_user:user.id}),admin.rpc('losi_chat_list_groups',{p_user:user.id})]);
   const groupThreads=checked(groups);
   const groupRows=groupThreads.length?checked(await admin.from('losi_chat_groups').select('id,photo_path,owner_id,creator_id').in('id',groupThreads.map((g:any)=>g.id))):[];
   const adminMemberships=groupThreads.length?checked(await admin.from('losi_chat_group_members').select('group_id,is_admin').eq('user_id',user.id).eq('active',true).in('group_id',groupThreads.map((g:any)=>g.id))):[];
   const photos=new Map(await Promise.all(groupRows.map(async(g:any)=>[g.id,await groupPhotoUrl(g.photo_path)])));
   const threads=[...checked(privateChats),...groupThreads.map((g:any)=>({...g,photo:photos.get(g.id)??null,isOwner:groupRows.some((row:any)=>row.id===g.id&&(row.owner_id===user.id||row.creator_id===user.id||adminMemberships.some((m:any)=>m.group_id===g.id&&m.is_admin)))}))];threads.sort((a:any,b:any)=>String(b.last?.created_at??'').localeCompare(String(a.last?.created_at??'')));
   const lastMessages=await decorate(threads.map((t:any)=>t.last).filter(Boolean));const lastById=new Map(lastMessages.map((m:any)=>[m.id,m]));
   return json({threads:threads.map((t:any)=>({...t,last:lastById.get(t.last?.id)??t.last})),userId:user.id});
  }
  if(body.action==='messages'){
   if(body.group===true){
    if(!uuid(body.threadId)||body.before&&(!uuid(body.before.id)||typeof body.before.at!=='string'||!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(body.before.at)||!Number.isFinite(Date.parse(body.before.at))))throw new Error('GRUPO_DADOS_INVALIDOS');
    const data=checked(await admin.rpc('losi_chat_group_messages',{p_user:user.id,p_group:body.threadId,p_before_at:body.before?.at??null,p_before_id:body.before?.id??null}));
    const next=data.messages[0];const nextCursor=next?{at:next.created_at,id:next.id}:null;
    const hiddenIds=checked(await admin.rpc('losi_chat_hidden_ids',{p_user:user.id,p_target:body.threadId,p_group:true}));
    return json({...data,hiddenIds,nextCursor,messages:await decorate(data.messages.filter((m:any)=>!hiddenIds.includes(m.id))),userId:user.id});
   }
   await threadForUser(body.threadId);
   let query=admin.from('losi_chat_messages').select('*').eq('thread_id',body.threadId).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(100);
   if(body.before){
    if(!uuid(body.before.id)||typeof body.before.at!=='string'||!/^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/.test(body.before.at)||!Number.isFinite(Date.parse(body.before.at)))throw new Error('CONVERSA_INDISPONIVEL');
    const at=body.before.at;
    query=query.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${body.before.id})`);
   }
   const messages=checked(await query);
   const next=messages.at(-1);const nextCursor=next?{at:next.created_at,id:next.id}:null;
   const readAt=messages[0]?.created_at;
   if(readAt&&!body.before)checked(await admin.rpc('losi_chat_mark_read',{p_user:user.id,p_thread:body.threadId,p_read:readAt}));
   const hiddenIds=checked(await admin.rpc('losi_chat_hidden_ids',{p_user:user.id,p_target:body.threadId,p_group:false}));
   return json({messages:await decorate(messages.reverse().filter((m:any)=>!hiddenIds.includes(m.id))),hiddenIds,nextCursor,userId:user.id,hasMore:messages.length===100});
  }
  if(body.action==='favorite'){
   if(body.group===true){if(!uuid(body.threadId))throw new Error('GRUPO_INDISPONIVEL');checked(await admin.rpc('losi_chat_group_favorite',{p_user:user.id,p_group:body.threadId,p_favorite:body.favorite===true}));return json({success:true});}
   await threadForUser(body.threadId);
   checked(await admin.rpc('losi_chat_favorite',{p_user:user.id,p_thread:body.threadId,p_favorite:body.favorite===true}));return json({success:true});
  }
  if(body.action==='send'){
   if(!uuid(body.requestId)||!uuid(body.threadId)||typeof body.text!=='string'||!body.text.trim()||body.text.length>4000)throw new Error('TEXTO_INVALIDO');
   if(body.replyTo!=null&&!uuid(body.replyTo))throw new Error('RESPOSTA_INVALIDA');
   if(body.replyTo){const data=checked(await admin.rpc('losi_chat_send_reply',{p_user:user.id,p_target:body.threadId,p_group:body.group===true,p_request:body.requestId,p_body:body.text,p_reply:body.replyTo}));return json({...data,message:(await decorate([data.message]))[0]});}
   return json(checked(await admin.rpc(body.group===true?'losi_chat_send_group_text':'losi_chat_send_text',{p_user:user.id,...(body.group===true?{p_group:body.threadId}:{p_thread:body.threadId}),p_request:body.requestId,p_body:body.text})));
  }
  return json({error:'Ação inválida.'},400);
 }catch(e){
  const code=e instanceof Error?e.message:'';
  const messages:Record<string,string>={RESPOSTA_INVALIDA:'A mensagem original não está disponível. Cancele a resposta e tente novamente.',CRIADOR_GRUPO_PROTEGIDO:'O criador do grupo não pode ser removido por outro administrador.',FOTO_GRUPO_INVALIDA:'Selecione uma foto JPG, PNG ou WEBP válida.',EXCLUSAO_NAO_PERMITIDA:'Somente quem enviou pode excluir para todos.',ANEXO_INVALIDO:'Arquivo inválido ou expirado. Selecione novamente um arquivo de até 20 MB.',ANEXO_FORMATO:'Use JPG, PNG, WEBP, GIF, PDF, TXT, DOCX, XLSX PPTX, MP4, MOV, WEBM, M4A ou WEBA válidos.',ANEXO_LIMITE:'Há muitos arquivos aguardando envio. Tente novamente após a expiração das prévias.',FATURA_NAO_CANCELAVEL:'Esta fatura não pode ser cancelada: o pagamento pode já ter sido confirmado.',COBRANCA_EM_CONFERENCIA:'A cobrança ainda está em conferência. Verifique o pagamento e tente cancelar novamente.',CANCELAMENTO_NAO_CONFIRMADO:'O Asaas ainda não confirmou o cancelamento. Verifique a fatura antes de tentar outra compra.',GRUPO_INDISPONIVEL:'Você não participa mais deste grupo ou ele está indisponível.',GRUPO_DADOS_INVALIDOS:'Informe um nome de até 80 caracteres e números LOSI válidos.',GRUPO_LIMITE:'O grupo pode ter até 100 participantes.',APENAS_ADMIN_GRUPO:'Somente quem administra o grupo pode fazer esta alteração.',TRANSFIRA_ADMINISTRACAO:'Adicione outro administrador antes de sair do grupo.',DOCUMENTO_INVALIDO:'Informe um CPF/CNPJ válido para o pagamento.',RESGATE_SEU_NUMERO:'Resgate seu número digital antes de continuar.',PAGAMENTO_PENDENTE:'O pagamento ainda não foi confirmado.',SALDO_INSUFICIENTE:'Seus créditos acabaram. Faça uma recarga para enviar mensagens.',CONTATO_INDISPONIVEL:'Este número não está disponível para conversar.',NUMERO_INVALIDO:'Informe os 9 dígitos do número digital LOSI.',FORNECEDOR_INDISPONIVEL:'Cadastre sua empresa antes de comprar o número digital.',TEXTO_INVALIDO:'Escreva uma mensagem de até 4.000 caracteres.',COBRANCA_RECUSADA:'O Asaas não conseguiu criar a cobrança. Confira seus dados e tente novamente.'};
  console.error('Chat LOSI action failed',code);
  return json({error:messages[code]??'Não foi possível concluir agora. Tente novamente.'},400);
 }
});
