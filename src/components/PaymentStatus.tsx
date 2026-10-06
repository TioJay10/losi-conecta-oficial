import "../team-payments.css";
export function PaymentStatus({payment_status,paid_at,agreed_value}:{payment_status?:string;paid_at?:string|null;agreed_value?:number|null}) {
 return <span className={`team-payment-status ${payment_status==="paid"?"paid":"pending"}`}>
  {payment_status==="paid"?"Pago":agreed_value==null?"Pendente · valor a definir":"Pagamento pendente"}
  {payment_status==="paid"&&paid_at&&<small>Registrado em {new Date(paid_at).toLocaleDateString("pt-BR")}</small>}
 </span>;
}
