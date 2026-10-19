-- Existing installations only; no data, stock, or order history is deleted.
begin;
alter table public.orders add column if not exists idempotency_key uuid;
alter table public.orders add column if not exists request_fingerprint text;
alter table public.orders add column if not exists payment_collected_at timestamptz;
alter table public.orders add column if not exists payment_collected_by uuid references auth.users(id) on delete set null;
create unique index if not exists orders_checkout_request on public.orders(customer_id,idempotency_key) where idempotency_key is not null;
create or replace function public.create_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); item jsonb; p public.products%rowtype; cp public.coupons%rowtype; qty int; unit int; sub int:=0; ship int; disc int:=0; result uuid; snapshot jsonb:='[]'; wrap boolean:=coalesce((payload->>'gift_wrap')::boolean,false); coupon_code text:=upper(trim(coalesce(payload->>'discount_code',''))); gov text:=payload->>'governorate'; request_key uuid; fingerprint text; previous public.orders%rowtype;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if coalesce(payload->>'idempotency_key','')='' then raise exception 'Checkout request key required'; end if;
 request_key:=(payload->>'idempotency_key')::uuid;
 fingerprint:=md5((payload-'idempotency_key'-'total'-'subtotal')::text);
 -- Serialize this customer's requests before stock/coupon locks; also covers concurrent retries.
 perform id from public.customers where id=uid for update;
 if not found then raise exception 'Customer profile required'; end if;
 select * into previous from public.orders where customer_id=uid and idempotency_key=request_key;
 if found then
  if previous.request_fingerprint is distinct from fingerprint then raise exception 'Checkout request changed; start a new request'; end if;
  return jsonb_build_object('id',previous.id,'total',previous.total,'payment_status',previous.payment_status);
 end if;
 if coalesce(payload->>'payment_method','')<>'cod' then raise exception 'Payment gateway integration required'; end if;
 if jsonb_typeof(payload->'items') is distinct from 'array' then raise exception 'Invalid cart'; end if;
 if jsonb_array_length(payload->'items') not between 1 and 100 then raise exception 'Invalid cart size'; end if;
 if length(coalesce(payload->>'name','')) not between 1 and 200 or length(coalesce(payload->>'phone','')) not between 5 and 30 or length(coalesce(payload->>'address','')) not between 5 and 1000 or length(coalesce(gov,'')) not between 1 and 100 then raise exception 'Complete delivery details are required'; end if;
 if length(coalesce(payload->>'gift_card_text',''))>300 then raise exception 'Gift message too long'; end if;
 if (select count(distinct x->>'id') from jsonb_array_elements(payload->'items') x) <> jsonb_array_length(payload->'items') then raise exception 'Duplicate cart items'; end if;
 -- Consistent lock order prevents deadlocks.
 perform id from public.products where id in (select (x->>'id')::uuid from jsonb_array_elements(payload->'items') x) order by id for update;
 for item in select * from jsonb_array_elements(payload->'items') loop
  qty:=(item->>'qty')::int;
  if qty is null or qty not between 1 and 100 then raise exception 'Invalid quantity'; end if;
  select * into p from public.products where id=(item->>'id')::uuid;
  if not found then raise exception 'Product not found'; end if;
  if p.stock<qty then raise exception 'Insufficient stock: %',p.name_en; end if;
  unit:=round(p.price*(1-p.discount/100.0)); sub:=sub+unit*qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('id',p.id,'name',p.name_en,'name_ar',p.name_ar,'quantity',qty,'price',unit,'image',p.image_url));
 end loop;
 select price into ship from public.shipping_rates where governorate=gov; ship:=coalesce(ship,75);
 if coupon_code<>'' then
  select * into cp from public.coupons where public.coupons.code=coupon_code for update;
  if not found or not cp.active or cp.expires_at<=now() or cp.used_count>=cp.max_uses then raise exception 'Coupon is invalid or expired'; end if;
  disc:=round(sub*cp.discount_percent/100.0);
  update public.coupons set used_count=used_count+1 where id=cp.id;
 end if;
 insert into public.orders(customer_id,items,subtotal,shipping_cost,discount_code,total,payment_method,gift_wrap,gift_card_text,governorate,name,phone,address,idempotency_key,request_fingerprint)
 values(uid,snapshot,sub,ship,nullif(coupon_code,''),sub+ship+case when wrap then 50 else 0 end-disc,'cod',wrap,payload->>'gift_card_text',gov,payload->>'name',payload->>'phone',payload->>'address',request_key,fingerprint) returning id into result;
 for item in select * from jsonb_array_elements(snapshot) loop
  insert into public.order_items(order_id,product_id,quantity,price) values(result,(item->>'id')::uuid,(item->>'quantity')::int,(item->>'price')::int);
  update public.products set stock=stock-(item->>'quantity')::int,sales=sales+(item->>'quantity')::int where id=(item->>'id')::uuid;
 end loop;
 update public.customers set name=payload->>'name',phone=payload->>'phone',address=payload->>'address',governorate=gov where id=uid;
 delete from public.carts where customer_id=uid;
 return jsonb_build_object('id',result,'total',sub+ship+case when wrap then 50 else 0 end-disc,'payment_status','pending');
end;$$;
revoke all on function public.create_order(jsonb) from public,anon;
grant execute on function public.create_order(jsonb) to authenticated;


-- Delivery does not imply collection: an administrator must explicitly confirm the cash receipt.
create or replace function public.collect_cod_payment(p_order uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype; collected timestamptz;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access required'; end if;
 select * into o from public.orders where id=p_order for update;
 if not found or o.payment_method<>'cod' or o.order_status<>'delivered' then raise exception 'Only delivered cash-on-delivery orders can be collected'; end if;
 if o.payment_status='paid' then return jsonb_build_object('changed',false,'payment_collected_at',o.payment_collected_at); end if;
 collected:=now();
 update public.orders set payment_status='paid',payment_collected_at=collected,payment_collected_by=auth.uid() where id=p_order;
 insert into public.payment_events(transaction_id,order_id) values('cod:'||p_order::text,p_order);
 return jsonb_build_object('changed',true,'payment_collected_at',collected);
end;$$;
revoke all on function public.collect_cod_payment(uuid) from public,anon;
grant execute on function public.collect_cod_payment(uuid) to authenticated;

commit;
