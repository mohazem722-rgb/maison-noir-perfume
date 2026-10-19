-- MAISON NOIR — run once in the Supabase SQL Editor, then run seed.sql.
create extension if not exists pgcrypto;
create type public.product_category as enum ('men','women','unisex','oriental','home','gift');
create table public.products (
 id uuid primary key default gen_random_uuid(), name_ar text not null, name_en text not null,
 brand text not null, size text not null, price integer not null check(price>=0),
 category public.product_category not null, image_url text not null default '', images jsonb not null default '[]',
 stock integer not null default 0 check(stock>=0), discount integer not null default 0 check(discount between 0 and 100),
 rating float not null default 0 check(rating between 0 and 5), reviews_count integer not null default 0,
 sales integer not null default 0, created_at timestamptz not null default now()
);
create table public.categories (id uuid primary key default gen_random_uuid(),slug text unique not null,name_ar text not null,name_en text not null,image text,products_count integer default 0);
create table public.customers (id uuid primary key references auth.users on delete cascade,name text,phone text,email text,address text,governorate text,created_at timestamptz not null default now());
create table public.admins (id uuid primary key references auth.users on delete cascade,role text not null default 'admin' check(role='admin'));
create table public.shipping_rates (id uuid primary key default gen_random_uuid(),governorate text unique not null,price integer not null check(price>=0),estimated_days text not null default '2–5');
create table public.coupons (id uuid primary key default gen_random_uuid(),code text unique not null,discount_percent integer not null check(discount_percent between 1 and 100),max_uses integer not null default 100 check(max_uses>0),used_count integer not null default 0 check(used_count>=0),expires_at timestamptz not null,active boolean not null default true);
create table public.orders (
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers,
 items jsonb not null,subtotal integer not null,shipping_cost integer not null,discount_code text,total integer not null,
 payment_method text not null check(payment_method in ('vodafone_cash','visa','instapay','cod')),
 payment_status text not null default 'pending' check(payment_status in ('pending','paid','failed')),
 order_status text not null default 'preparing' check(order_status in ('preparing','shipped','delivered')),
 gift_wrap boolean not null default false,gift_card_text text,governorate text not null,name text not null,phone text not null,address text not null,
 created_at timestamptz not null default now()
);
create table public.order_items (id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete cascade,product_id uuid not null references public.products,quantity integer not null check(quantity>0),price integer not null check(price>=0));
create table public.reviews (id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete cascade,customer_id uuid not null references public.customers on delete cascade,rating integer not null check(rating between 1 and 5),comment text not null check(char_length(comment) between 1 and 1500),created_at timestamptz not null default now(),unique(product_id,customer_id));
create table public.carts (customer_id uuid primary key references auth.users on delete cascade,items jsonb not null default '[]',updated_at timestamptz not null default now());
create table public.subscribers (id uuid primary key default gen_random_uuid(),email text unique not null check(email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),sms boolean not null default false,phone text,created_at timestamptz not null default now(),check(not sms or length(phone)>5));
create table public.contact_messages (id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 200),phone text not null check(length(phone) between 5 and 30),message text not null check(length(message) between 1 and 2000),created_at timestamptz not null default now());
create table public.payment_events (transaction_id text primary key,order_id uuid not null references public.orders,created_at timestamptz default now());
create index products_category on public.products(category);
create index orders_customer on public.orders(customer_id,created_at desc);
create index reviews_product on public.reviews(product_id);

create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.admins where id=auth.uid()); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into public.customers(id,name,phone,email) values(new.id,new.raw_user_meta_data->>'name',new.raw_user_meta_data->>'phone',new.email); return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- All tables protected. Service-role keys are NEVER used in browser code.
alter table public.products enable row level security;
alter table public.categories enable row level security;
alter table public.customers enable row level security;
alter table public.admins enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupons enable row level security;
alter table public.reviews enable row level security;
alter table public.carts enable row level security;
alter table public.subscribers enable row level security;
alter table public.contact_messages enable row level security;
alter table public.payment_events enable row level security;
create policy public_read on public.products for select using(true);
create policy public_read on public.categories for select using(true);
create policy public_read on public.shipping_rates for select using(true);
create policy public_read on public.reviews for select using(true);
create policy admin_all on public.products for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.shipping_rates for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.coupons for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.customers for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.orders for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.order_items for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy admin_all on public.reviews for all to authenticated using(public.is_admin()) with check(public.is_admin());
create policy own_profile on public.customers for select to authenticated using(id=auth.uid());
create policy update_profile on public.customers for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_admin_role on public.admins for select to authenticated using(id=auth.uid());
create policy own_orders on public.orders for select to authenticated using(customer_id=auth.uid());
create policy own_order_items on public.order_items for select to authenticated using(exists(select 1 from public.orders where id=order_id and customer_id=auth.uid()));
-- Orders MUST go through create_order() / Edge Function. Direct customer INSERT is deliberately disallowed to prevent price/status tampering.
create policy own_cart on public.carts for all to authenticated using(customer_id=auth.uid()) with check(customer_id=auth.uid());
create policy own_review on public.reviews for insert to authenticated with check(customer_id=auth.uid());
create policy subscribe on public.subscribers for insert to anon,authenticated with check(true);
create policy contact on public.contact_messages for insert to anon,authenticated with check(true);
create policy admin_read on public.subscribers for select to authenticated using(public.is_admin());
create policy admin_read on public.contact_messages for select to authenticated using(public.is_admin());

-- Atomic server-authoritative order creation: locks products/coupon, recalculates all amounts, rejects unknown stock/quantity.
create or replace function public.create_order(payload jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); item jsonb; p public.products%rowtype; cp public.coupons%rowtype; qty int; unit int; sub int:=0; ship int; disc int:=0; result uuid; snapshot jsonb:='[]'; wrap boolean:=coalesce((payload->>'gift_wrap')::boolean,false); coupon_code text:=upper(trim(coalesce(payload->>'discount_code',''))); gov text:=payload->>'governorate';
begin
 if uid is null then raise exception 'Authentication required'; end if;
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
 insert into public.orders(customer_id,items,subtotal,shipping_cost,discount_code,total,payment_method,gift_wrap,gift_card_text,governorate,name,phone,address)
 values(uid,snapshot,sub,ship,nullif(coupon_code,''),sub+ship+case when wrap then 50 else 0 end-disc,'cod',wrap,payload->>'gift_card_text',gov,payload->>'name',payload->>'phone',payload->>'address') returning id into result;
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

-- Rating updates after genuine reviews.
create or replace function public.update_product_rating() returns trigger language plpgsql security definer set search_path=public as $$
declare pid uuid:=coalesce(new.product_id,old.product_id);
begin update public.products set rating=coalesce((select avg(rating) from public.reviews where product_id=pid),0),reviews_count=(select count(*) from public.reviews where product_id=pid) where id=pid;return null;end;$$;
create trigger update_rating after insert or update or delete on public.reviews for each row execute function public.update_product_rating();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,2097152,array['image/jpeg','image/webp']) on conflict(id) do nothing;
create policy product_images_read on storage.objects for select using(bucket_id='product-images');
create policy product_images_admin_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and (storage.foldername(name))[1]='products' and public.is_admin());
create policy product_images_admin_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and (storage.foldername(name))[1]='products' and public.is_admin());
create policy product_images_admin_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());

-- Realtime: new products and tracking changes update connected clients.
alter publication supabase_realtime add table public.products, public.orders;

-- Only the verified service-side webhook can record an online payment.
create or replace function public.record_payment(p_order uuid,p_transaction text,p_amount integer,p_success boolean) returns boolean
language plpgsql security definer set search_path=public as $$
declare o public.orders%rowtype;
begin
 select * into o from public.orders where id=p_order for update;
 if not found or o.payment_method='cod' or o.total*100<>p_amount then raise exception 'Payment does not match order'; end if;
 if exists(select 1 from public.payment_events where transaction_id=p_transaction) then return false; end if;
 if o.payment_status='paid' then return false; end if;
 insert into public.payment_events(transaction_id,order_id) values(p_transaction,p_order);
 update public.orders set payment_status=case when p_success then 'paid' else 'failed' end where id=p_order;
 return true;
end;$$;
revoke all on function public.record_payment(uuid,text,integer,boolean) from public,anon,authenticated;
grant execute on function public.record_payment(uuid,text,integer,boolean) to service_role;

-- Explicit API grants; RLS above remains the authorization boundary.
grant usage on schema public to anon,authenticated;
grant select on public.products,public.categories,public.shipping_rates,public.reviews to anon,authenticated;
grant insert on public.subscribers,public.contact_messages to anon,authenticated;
grant select,insert,update,delete on public.products,public.categories,public.customers,public.admins,public.shipping_rates,public.orders,public.order_items,public.coupons,public.reviews,public.carts,public.subscribers,public.contact_messages,public.payment_events to authenticated;
