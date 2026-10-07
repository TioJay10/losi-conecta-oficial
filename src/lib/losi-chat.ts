import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
export type ChatAccount={user_id:string;business_id:string;digital_number:string|null;balance:number;show_public:boolean};
export type ChatOrder={id:string;status:string;kind:string;credits:number;amount_cents:number;invoice_url:string|null;created_at:string};
export type ChatAttachment={id:string;file_name:string;kind:'image'|'document'|'video'|'audio';mime:string;byte_size:number};
export type ChatReceipt={status:'sent'|'delivered'|'read';recipients:number;delivered:number;read:number};
export type ChatMessage={id:string;thread_id:string|null;group_id?:string|null;sender_id:string;sender_name?:string;sender_photo?:string|null;attachment_id?:string|null;attachment?:ChatAttachment|null;body:string;created_at:string;deleted_at?:string|null;receipt?:ChatReceipt;reply_to?:string|null;reply?:{name?:string;text?:string;kind?:ChatAttachment['kind'];unavailable?:boolean}};
export type ChatThread={id:string;name:string;number:string|null;photo:string|null;last:ChatMessage|null;unread:number;favorite:boolean;group?:boolean;memberCount?:number;isOwner?:boolean};
export function formatLosiNumber(n:string|null|undefined){return n?n.replace(/(\d{3})(\d{3})(\d{3})/,'$1.$2.$3'):'Ainda não resgatado';}
export async function chatAction<T=any>(action:string,body:Record<string,unknown>={}):Promise<T>{
 let timeout:ReturnType<typeof setTimeout>|undefined;
 const {data,error}=await Promise.race([
  supabase.functions.invoke('losi-chat',{body:{action,...body}}),
  new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('A solicitação demorou demais. Tente novamente.')),60000);})
 ]).finally(()=>clearTimeout(timeout));
 if(error){let message='Não foi possível concluir agora. Tente novamente.';try{const result=await error.context?.json();if(result?.error)message=result.error;}catch{/* Response may already be read. */}throw new Error(message);}
 if(data?.error)throw new Error(data.error);return data;
}
export function useLosiChatAccount(){
 const [account,setAccount]=useState<ChatAccount|null>(null),[orders,setOrders]=useState<ChatOrder[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const d=await chatAction<{account:ChatAccount|null;orders:ChatOrder[]}>('status');setAccount(d.account);setOrders(d.orders);setError('');}catch(e){setError(e instanceof Error?e.message:'Erro ao consultar o saldo.');}finally{setLoading(false);}},[]);
 useEffect(()=>{const changed=()=>{void refresh();};window.addEventListener('losi-chat-changed',changed);void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);return()=>{clearInterval(timer);window.removeEventListener('losi-chat-changed',changed);};},[refresh]);
 return {account,orders,loading,error,refresh};
}

export async function acknowledgeChatMessages(messages:ChatMessage[],userId:string,read:boolean){
 const ids=messages.filter(m=>m.sender_id!==userId&&!m.deleted_at).map(m=>m.id);
 for(let offset=0;offset<ids.length;offset+=100)await chatAction('acknowledge',{ids:ids.slice(offset,offset+100),read});
}
