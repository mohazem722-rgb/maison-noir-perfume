import { createClient } from 'npm:@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!;
const anon=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':Deno.env.get('SITE_ORIGIN')||'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 try{
  const body=await req.json();const {action}=body;
  const admin=createClient(url,service,{auth:{persistSession:false}});
  if(action==='coupons/validate'){
   const code=String(body.code||'').trim().toUpperCase();if(!code||code.length>100)return json({error:'Invalid coupon'},400);
   const {data,error}=await admin.from('coupons').select('discount_percent,active,expires_at,max_uses,used_count').eq('code',code).maybeSingle();
   if(error||!data||!data.active||new Date(data.expires_at)<=new Date()||data.used_count>=data.max_uses)return json({error:'Coupon is invalid or expired'},400);
   return json({discount_percent:data.discount_percent});
  }
  const token=req.headers.get('Authorization');if(!token)return json({error:'Authentication required'},401);
  const client=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false}});
  const {data:{user},error:authError}=await client.auth.getUser();if(authError||!user)return json({error:'Authentication required'},401);
  if(action==='orders/create'){
   const {action:_,...payload}=body;
   const {data,error}=await client.rpc('create_order',{payload});
   if(error)return json({error:error.message},400);return json(data,201);
  }
  if(action==='reviews/add'){
   const rating=Number(body.rating);const comment=String(body.comment||'').trim();
   if(!Number.isInteger(rating)||rating<1||rating>5||comment.length<1||comment.length>1500)return json({error:'Invalid review'},400);
   const {data,error}=await client.from('reviews').insert({product_id:body.product_id,customer_id:user.id,rating,comment}).select().single();
   if(error)return json({error:error.message},400);return json(data,201);
  }
  return json({error:'Unknown endpoint'},404);
 }catch(err){console.error(err);return json({error:'Invalid request'},400);}
});
