import { createClient } from 'npm:@supabase/supabase-js@2';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
// Paymob processed-transaction callback HMAC fields in the required lexicographic order.
const fields=['amount_cents','created_at','currency','error_occured','has_parent_transaction','id','integration_id','is_3d_secure','is_auth','is_capture','is_refunded','is_standalone_payment','is_voided','order.id','owner','pending','source_data.pan','source_data.sub_type','source_data.type','success'];
const read=(o:any,path:string)=>path.split('.').reduce((v,k)=>v?.[k],o);
const safeEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0;};
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 const secret=Deno.env.get('PAYMOB_HMAC_SECRET');if(!secret)return json({error:'Payment integration required'},503);
 try{
  const body=await req.json();const obj=body.obj;if(!obj)return json({error:'Invalid callback'},400);
  const supplied=new URL(req.url).searchParams.get('hmac')||'';
  if(fields.some(f=>read(obj,f)===undefined))return json({error:'Incomplete callback'},400);
  const data=fields.map(f=>String(read(obj,f))).join('');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-512'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(data));
  const hex=Array.from(new Uint8Array(signature)).map(b=>b.toString(16).padStart(2,'0')).join('');
  if(!safeEqual(hex,supplied.toLowerCase()))return json({error:'Invalid signature'},401);
  if(obj.currency!=='EGP'||String(obj.integration_id)!==Deno.env.get('PAYMOB_INTEGRATION_ID'))return json({error:'Invalid payment integration'},400);
  if(obj.pending===true)return json({received:true,pending:true});
  // Integration must set merchant_order_id to our orders.id when creating the Paymob payment.
  const orderId=obj.order?.merchant_order_id;
  if(!orderId||!Number.isInteger(obj.amount_cents))return json({error:'Missing order reference'},400);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
  const successful=obj.success===true&&obj.error_occured===false&&!obj.is_refunded&&!obj.is_voided&&(!obj.is_auth||obj.is_capture);
  const {data:changed,error}=await db.rpc('record_payment',{p_order:orderId,p_transaction:String(obj.id),p_amount:obj.amount_cents,p_success:successful});
  if(error){console.error(error);return json({error:'Payment could not be reconciled'},400);}
  if(changed&&successful){
   const {data:order}=await db.from('orders').select('*,customers(email)').eq('id',orderId).single();
   const resend=Deno.env.get('RESEND_API_KEY'),from=Deno.env.get('RESEND_FROM_EMAIL');
   if(resend&&from&&order?.customers?.email){
    try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${resend}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:order.customers.email,subject:'MAISON NOIR — Payment received',text:`Your payment of ${order.total} EGP for order ${orderId} has been received. Thank you for choosing Maison Noir.`})});if(!r.ok)console.error('Email notification failed',r.status);}catch(e){console.error('Email delivery error',e);}
   }else console.info('Payment notification email skipped: missing configured sender/key. Order:',orderId);
   const sid=Deno.env.get('TWILIO_SID'),token=Deno.env.get('TWILIO_TOKEN'),sender=Deno.env.get('TWILIO_FROM');
   if(sid&&token&&sender&&order?.phone){
    try{const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${sid}:${token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:sender,To:order.phone,Body:`MAISON NOIR: Payment received for order ${orderId}. Total ${order.total} EGP.`})});if(!r.ok)console.error('SMS notification failed',r.status);}catch(e){console.error('SMS delivery error',e);}
   }else console.info('SMS notification skipped: missing configuration. Order:',orderId);
  }
  return json({received:true,duplicate:!changed});
 }catch(e){console.error(e);return json({error:'Invalid callback'},400);}
});
