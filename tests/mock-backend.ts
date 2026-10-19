import type { Page } from "@playwright/test";

export const userA = "11111111-1111-4111-8111-111111111111";
export const userB = "22222222-2222-4222-8222-222222222222";
export const productA = "00000000-0000-4000-8000-000000000001";
export const productB = "00000000-0000-4000-8000-000000000002";

/** Isolated browser-only SDK simulation. Never shipped to production or sent to a real service. */
export async function mockBackend(
  page: Page,
  options: {
    initialUser?: string | null;
    admin?: boolean;
    loseFirstOrderResponse?: boolean;
    cartDelay?: number;
    orderResponseDelay?: number;
    failCatalog?: boolean;
  } = {},
) {
  await page.route(/\/src\/lib\.ts(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
    import {stored} from '/src/storage.ts'; export {stored};
    import {seedProducts} from '/src/data.ts';
    const A=${JSON.stringify(userA)}, B=${JSON.stringify(userB)};
    const options=${JSON.stringify(options)};
    const user = id => id ? ({id,email:id===A?'a@example.invalid':'b@example.invalid'}) : null;
    let actor=user(options.initialUser===undefined?A:options.initialUser);
    const listeners=new Set();
    const orderId='44444444-4444-4444-8444-444444444444';
    window.audit={
      carts:{[A]:{items:[{id:${JSON.stringify(productA)},qty:1}]},[B]:{items:[{id:${JSON.stringify(productB)},qty:1}]}},
      writes:[],requests:JSON.parse(sessionStorage.getItem("audit-requests")||"[]"),recovery:[],passwords:[],receipts:[],
      failCatalog:options.failCatalog,
      orders:[{id:orderId,customer_id:A,items:[],total:3260,payment_method:'cod',payment_status:'pending',order_status:'delivered',created_at:new Date().toISOString(),name:'Audit customer',phone:'01012345678',address:'Audit address',governorate:'Cairo'}],
      login(id){actor=user(id);for(const cb of listeners)cb('SIGNED_IN',{user:actor})},
      async logout(){actor=null;for(const cb of listeners)cb('SIGNED_OUT',null);return{error:null}}
    };
    export const supabase={
      auth:{
        getUser:()=>Promise.resolve({data:{user:actor}}),
        onAuthStateChange(cb){listeners.add(cb);return{data:{subscription:{unsubscribe(){listeners.delete(cb)}}}}},
        signOut:()=>window.audit.logout(),
        resetPasswordForEmail(email,details){window.audit.recovery.push({email,...details});return Promise.resolve({error:null})},
        updateUser(value){window.audit.passwords.push(value.password);return Promise.resolve({error:null})}
      },
      channel(){return{on(){return this},subscribe(){return this}}},removeChannel(){},
      rpc(name,args){window.audit.receipts.push({name,args});return Promise.resolve({data:{changed:true,payment_collected_at:new Date().toISOString()},error:null})},
      from(table){
        let id;let values;
        const query={
          select(){return this},eq(key,value){if(key==='customer_id'||key==='id')id=value;return this},
          maybeSingle(){
            const data=table==='carts'?structuredClone(window.audit.carts[id]??null):table==='admins'&&options.admin?{id:actor?.id}:null;
            return new Promise(resolve=>setTimeout(()=>resolve({data,error:null}),table==='carts'&&id===A?options.cartDelay||0:0));
          },
          order(){return Promise.resolve({data:table==='orders'?window.audit.orders:[],error:null})},
          upsert(row){window.audit.writes.push(structuredClone(row));window.audit.carts[row.customer_id]={items:structuredClone(row.items)};return Promise.resolve({error:null})},
          update(row){values=row;return this},
          then(resolve,reject){
            if(table==='orders'&&values)window.audit.orders=window.audit.orders.map(o=>o.id===id?{...o,...values}:o);
            if(table==='products'&&window.audit.failCatalog)return Promise.resolve({data:null,error:{message:'Catalog unavailable'}}).then(resolve,reject);
            const data=table==='products'?seedProducts:table==='shipping_rates'?null:table==='coupons'?[]:null;
            return Promise.resolve({data,error:null}).then(resolve,reject);
          }
        };return query;
      }
    };
    export async function api(action,body){
      window.audit.requests.push(structuredClone({action,...body}));
      sessionStorage.setItem('audit-requests',JSON.stringify(window.audit.requests));
      if(action==='orders/create'){
        if(options.loseFirstOrderResponse&&window.audit.requests.length===1)throw Error('Order response lost; please retry');
        if(options.orderResponseDelay)await new Promise(resolve=>setTimeout(resolve,options.orderResponseDelay));
        return{id:orderId,total:3260,payment_status:'pending'};
      }
      throw Error('Unsupported audit endpoint');
    }
  `,
    }),
  );
}
