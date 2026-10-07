import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
export type ChatAccount={user_id:string;business_id:string;digital_number:string|null;balance:number;show_public:boolean};
export type ChatOrder={id:string;status:string;kind:string;credits:number;amount_cents:number;invoice_url:string|null;created_at:string};
export type ChatMessage={id:string;thread_id:string;sender_id:string;body:string;created_at:string};
export type ChatThread={id:string;name:string;number:string;photo:string|null;last:ChatMessage|null;unread:number;favorite:boolean};
export function formatLosiNumber(n:string|null|undefined){return n?n.replace(/(\d{3})(\d{3})(\d{3})/,'$1.$2.$3'):'Ainda não resgatado';}
export async function chatAction<T=any>(action:string,body:Record<string,unknown>={}):Promise<T>{
 const {data,error}=await supabase.functions.invoke('losi-chat',{body:{action,...body}});
 if(error){let message='Não foi possível concluir agora. Tente novamente.';try{const result=await error.context?.json();if(result?.error)message=result.error;}catch{/* Response may already be read. */}throw new Error(message);}
 if(data?.error)throw new Error(data.error);return data;
}
export function useLosiChatAccount(){
 const [account,setAccount]=useState<ChatAccount|null>(null),[orders,setOrders]=useState<ChatOrder[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const d=await chatAction<{account:ChatAccount|null;orders:ChatOrder[]}>('status');setAccount(d.account);setOrders(d.orders);setError('');}catch(e){setError(e instanceof Error?e.message:'Erro ao consultar o saldo.');}finally{setLoading(false);}},[]);
 useEffect(()=>{const changed=()=>{void refresh();};window.addEventListener('losi-chat-changed',changed);void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);return()=>{clearInterval(timer);window.removeEventListener('losi-chat-changed',changed);};},[refresh]);
 return {account,orders,loading,error,refresh};
}
