import express from 'express';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { applyAction, publicSnapshot, createInitialState } from '../shared/platform-core.mjs';

class ApiError extends Error { constructor(status,message) { super(message);this.status=status; } }
const storageError=()=>new ApiError(503,'Kho dữ liệu chưa sẵn sàng. Vui lòng thử lại sau.');
const checksum=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
// Exactly one API process per data file. A transactional database is required for multiple instances.
export class PlatformStore {
  #state; #ready; #queue=Promise.resolve(); #loadError;
  constructor(storagePath=path.resolve('.runtime/platform.json')) {this.storagePath=storagePath;this.#ready=this.#load().catch(()=>{this.#loadError=storageError();});}
  async #load() {
    const initial=createInitialState(false);let raw;
    try {raw=await readFile(this.storagePath,'utf8');}
    catch(error){if(error.code!=='ENOENT')throw error;await this.#persist(initial);this.#state=initial;return;}
    const envelope=JSON.parse(raw);
    if(envelope?.version!==1||envelope.checksum!==checksum(envelope.state))throw storageError();
    for(const [key,value] of Object.entries(initial))if(!(key in envelope.state)||typeof envelope.state[key]!==typeof value||Array.isArray(envelope.state[key])!==Array.isArray(value))throw storageError();
    this.#state=envelope.state;
  }
  async #persist(state) {
    const directory=path.dirname(this.storagePath);await mkdir(directory,{recursive:true,mode:0o700});
    const temporary=path.join(directory,`.platform.${process.pid}.${randomUUID()}.tmp`);
    try {await writeFile(temporary,JSON.stringify({version:1,checksum:checksum(state),state}),{encoding:'utf8',flag:'wx',mode:0o600});await rename(temporary,this.storagePath);}
    catch(error){await unlink(temporary).catch(()=>{});throw error;}
  }
  async #ensureReady(){await this.#ready;if(this.#loadError)throw this.#loadError;}
  async snapshot(actor=null){await this.#ensureReady();await this.#queue;return publicSnapshot(this.#state,actor);}
  mutate(action,actor){
    const operation=this.#queue.then(async()=>{await this.#ensureReady();let next;
      try {next=applyAction(this.#state,action,actor);}catch(error){throw new ApiError(error.status>=400&&error.status<500?error.status:400,String(error.message||'Yêu cầu không hợp lệ.').slice(0,300));}
      try {await this.#persist(next);}catch{throw storageError();}
      this.#state=next;return publicSnapshot(next,actor);
    });this.#queue=operation.then(()=>undefined,()=>undefined);return operation;
  }
}
async function verifySupabaseToken(token) {
  const baseUrl=process.env.SUPABASE_URL,anonKey=process.env.SUPABASE_ANON_KEY;
  if(!baseUrl||!anonKey)throw new ApiError(503,'Dịch vụ đăng nhập chưa được cấu hình.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try {const endpoint=new URL('/auth/v1/user',baseUrl);if(!['http:','https:'].includes(endpoint.protocol))throw new Error();
    const response=await fetch(endpoint,{headers:{apikey:anonKey,Authorization:`Bearer ${token}`},signal:controller.signal,redirect:'error'});
    if(response.status===401||response.status===403)return null;
    if(!response.ok)throw new Error();return await response.json();
  }catch{throw new ApiError(503,'Chưa thể xác thực tài khoản. Vui lòng thử lại.');}finally{clearTimeout(timer);}
}
function assertJson(value,depth=0,budget={remaining:20000}) {
  if(--budget.remaining<0||depth>24)throw new ApiError(400,'Nội dung quá phức tạp.');
  if(!value||typeof value!=='object')return;
  for(const [key,item] of Object.entries(value)){if(['__proto__','prototype','constructor'].includes(key))throw new ApiError(400,'Nội dung không hợp lệ.');assertJson(item,depth+1,budget);}
}
export function createPlatformRouter({storagePath,verifyToken=verifySupabaseToken}={}) {
  const router=express.Router(),store=new PlatformStore(storagePath);
  let configuredOrigin=null;try {if(process.env.APP_URL)configuredOrigin=new URL(process.env.APP_URL).origin;}catch{/* Optional origin must be a valid URL. */}
  async function authenticate(req,required){
    const header=req.get('authorization');if(!header&&!required)return null;
    const match=/^Bearer ([^\s]{1,16384})$/i.exec(header||'');if(!match)throw new ApiError(401,'Vui lòng đăng nhập để tiếp tục.');
    const user=await verifyToken(match[1]);if(!user||typeof user.id!=='string'||!user.id||user.id.length>128)throw new ApiError(401,'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
    return {id:user.id,name:String(user.user_metadata?.full_name||'Thành viên').slice(0,80),role:user.app_metadata?.role==='admin'?'admin':'user'};
  }
  const handle=fn=>async(req,res)=>{res.set('Cache-Control','no-store');res.vary('Authorization');res.vary('Origin');try{await fn(req,res);}catch(error){res.status(error instanceof ApiError?error.status:500).json({error:error instanceof ApiError?error.message:'Không thể xử lý yêu cầu lúc này.'});}};
  router.get('/',handle(async(req,res)=>res.json(await store.snapshot(await authenticate(req,false)))));
  router.post('/',handle(async(req,res)=>{
    if(!/^application\/json(?:\s*;|$)/i.test(req.get('content-type')||''))throw new ApiError(415,'Yêu cầu cần dùng định dạng JSON.');
    const origin=req.get('origin');if(origin&&origin!==`${req.protocol}://${req.get('host')}`&&origin!==configuredOrigin)throw new ApiError(403,'Nguồn gửi yêu cầu không được cho phép.');
    if(!origin&&req.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Nguồn gửi yêu cầu không được cho phép.');
    const actor=await authenticate(req,true);if(!req.body||typeof req.body.type!=='string'||req.body.type.length>100)throw new ApiError(400,'Thao tác không hợp lệ.');
    assertJson(req.body);res.json(await store.mutate(req.body,actor));
  }));return router;
}
