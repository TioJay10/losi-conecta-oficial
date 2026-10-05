import { supabase } from "./supabase";
export type AiResult = { title:string; description:string; objective:string; methodology:string; notes:string; content:string };
export type AiStatus = {
 configured:boolean; access:{allowed:boolean;periodStart?:string;periodEnd?:string;proposalLimit?:number;materialLimit?:number};
 used:{proposal:number;material:number};
};
export async function callLosiAi(body:Record<string,unknown>) {
 const {data,error}=await supabase.functions.invoke("losi-ai-content",{body});
 if(error){
  let message="Não foi possível conectar ao assistente. Tente novamente.";
  if(error.context instanceof Response){
   const result=await error.context.json().catch(()=>null);
   if(result?.error) message=result.error;
  }
  throw new Error(message);
 }
 if(!data?.success) throw new Error(data?.error||"Não foi possível concluir a solicitação.");
 return data;
}
