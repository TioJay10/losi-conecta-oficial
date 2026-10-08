import {chatAction,type ChatReaction} from './losi-chat';

export const reactionEmojis=[
 ['👍','Aprovado'],['❤️','Gostei'],['👏','Parabéns'],['🤝','Parceria'],['✅','Confirmado'],['💡','Ideia'],['🎉','Comemoração'],
 ['💼','Negócios'],['🏆','Conquista'],['🚀','Crescimento'],['🎯','Meta'],['📈','Resultados'],['📊','Relatório'],['💰','Pagamento'],['💵','Dinheiro'],['🧾','Recibo'],['📄','Proposta'],['📝','Anotação'],['📅','Agenda'],['⏰','Prazo'],['📌','Importante'],['📎','Anexo'],['✍️','Assinatura'],['📞','Ligação'],['📧','E-mail'],['💻','Tecnologia'],['🛠️','Serviço'],['⚙️','Operação'],['📦','Entrega'],['🚚','Logística'],['🏢','Empresa'],['🌟','Destaque'],['🔥','Excelente'],['🙌','Sucesso'],['😊','Satisfeito'],['💪','Vamos juntos'],['🙏','Obrigado'],['🎤','Apresentação'],['🎪','Evento'],['🎨','Criatividade'],['🎁','Presente'],['📣','Divulgação'],
] as const;
export const reactionLabel=(emoji:string)=>reactionEmojis.find(e=>e[0]===emoji)?.[1]??'Reação';
export async function setMessageReaction(messageId:string,emoji:string|null){
 const data=await chatAction<{reactions:ChatReaction[]}>('reaction-set',{messageId,emoji});
 window.dispatchEvent(new CustomEvent('losi-chat-reactions',{detail:{messageId,reactions:data.reactions}}));
 return data.reactions;
}
