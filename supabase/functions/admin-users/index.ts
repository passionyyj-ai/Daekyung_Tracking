import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}})
const roles=new Set(['admin','inventory','sales','viewer'])
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors})
  if(req.method!=='POST')return json({error:'POST 요청만 허용됩니다.'},405)
  try{
    const token=/^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization')||'')?.[1]
    if(!token)return json({error:'로그인이 필요합니다.'},401)
    const url=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}})
    const {data:caller,error:authError}=await admin.auth.getUser(token)
    if(authError&&(!authError.status||authError.status>=500))return json({error:'인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도하세요.'},503)
    if(authError||!caller.user)return json({error:'로그인이 필요합니다.'},401)
    const {data:callerProfile,error:profileError}=await admin.from('profiles').select('role,is_active').eq('id',caller.user.id).maybeSingle()
    if(profileError)throw profileError
    if(!callerProfile?.is_active||callerProfile.role!=='admin')return json({error:'관리자 권한이 필요합니다.'},403)
    const body=await req.json().catch(()=>null)
    if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'요청 형식이 올바르지 않습니다.'},400)
    const {action}=body
    if((action==='update'||action==='reset-password')&&(typeof body.id!=='string'||!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.id)))return json({error:'수정할 사용자를 선택하세요.'},400)
    const username=typeof body.username==='string'?body.username.trim().toLowerCase():''
    const role=body.role??'viewer'
    if(action==='create'||action==='update'){
      if(!username)return json({error:'아이디를 입력하세요.'},400)
      if(!roles.has(role)||typeof body.is_active!=='boolean'&&body.is_active!==undefined)return json({error:'권한 또는 사용 상태가 올바르지 않습니다.'},400)
    }
    if((action==='create'||action==='reset-password')&&(typeof body.password!=='string'||!body.password.length))return json({error:'비밀번호를 입력하세요.'},400)
    const email=typeof body.email==='string'?body.email.trim().toLowerCase():''
    if((action==='create'||action==='update') && email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/@daekyung\.local$/i.test(email)))return json({error:'수신 가능한 복구 이메일을 입력하세요.'},400)
    if(action==='create'&&!email)return json({error:'복구 이메일이 필요합니다.'},400)
    if(action==='list'){
      const {data,error}=await admin.from('profiles').select('id,username,display_name,role,is_active,created_at,updated_at').order('username')
      if(error)throw error
      const users=[]
      for(const profile of data||[]){
        const {data:account,error:accountError}=await admin.auth.admin.getUserById(profile.id)
        if(accountError)throw accountError
        const email=account.user?.email||''
        users.push({...profile,email:/@daekyung\.local$/i.test(email)?'':email})
      }
      return json({users,recovery_email_supported:true})
    }
    if(action==='create'){
      const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:body.password,email_confirm:true})
      if(createError)throw createError
      const {error:profileError}=await admin.from('profiles').insert({id:created.user.id,username,display_name:body.display_name||username,role,is_active:body.is_active!==false})
      if(profileError){await admin.auth.admin.deleteUser(created.user.id);throw profileError}
      return json({ok:true,id:created.user.id})
    }
    if(action==='update'){
      // Only the authenticated active administrator above can set a verified address.
      // Keep the same Auth ID, profile, username login and business data.
      const {data:existing,error:lookupError}=await admin.from('profiles').select('id').eq('id',body.id).single()
      if(lookupError||!existing)return json({error:'수정할 사용자를 찾을 수 없습니다.'},404)
      let emailChanged=false
      if(email){
        const {error:emailError}=await admin.auth.admin.updateUserById(body.id,{email,email_confirm:true})
        if(emailError)throw emailError
        emailChanged=true
      }
      const {error}=await admin.from('profiles').update({username,display_name:body.display_name||username,role,is_active:body.is_active!==false,updated_at:new Date().toISOString()}).eq('id',body.id)
      if(error)return json({error:emailChanged?'이메일은 저장되었으나 나머지 사용자 정보 저장에 실패했습니다. 목록을 새로고침하여 확인하세요.':error.message},500)
      return json({ok:true})
    }
    if(action==='reset-password'){
      const {error}=await admin.auth.admin.updateUserById(body.id,{password:body.password})
      if(error)throw error
      return json({ok:true})
    }
    return json({error:'지원하지 않는 요청입니다.'},400)
  }catch(e){
    const error=e as {status?:number,code?:string,message?:string}
    if(error?.code==='23505')return json({error:'이미 사용 중인 아이디입니다.'},409)
    if(error?.status&&[400,404,409,422,429].includes(error.status))return json({error:error.message||'계정 정보를 확인하세요.'},error.status)
    console.error('admin-users failed',e)
    return json({error:'사용자 관리 요청을 처리하지 못했습니다.'},500)
  }
})
