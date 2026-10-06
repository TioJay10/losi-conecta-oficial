export const phone = (value: unknown) => {let n=String(value||"").replace(/\D/g,"");if(n.length===10||n.length===11)n="55"+n;return n;};
export function providerSlug(value: unknown) {
 try {const url=new URL(String(value||"").trim());if(url.protocol!=="https:"||!["losiconecta.com.br","www.losiconecta.com.br"].includes(url.hostname))return null;const match=url.pathname.match(/^\/fornecedor\/([^/]+)\/?$/);return match?decodeURIComponent(match[1]):null;}catch{return null;}
}
export function publicCollaborator(p: any) {
 return {id:p.id,losi_id:p.losi_id,full_name:p.full_name,professional_name:p.professional_name,city:p.city,state:p.state,photo_url:p.photo_url,created_at:p.created_at,whatsapp_masked:"•••• ••••-"+phone(p.whatsapp_normalized).slice(-4)};
}
