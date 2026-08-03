(function(){
  const cfg = window.DK_CLOUD_CONFIG || {};
  const configured = cfg.cloudEnabled !== false && cfg.supabaseUrl && !cfg.supabaseUrl.includes('YOUR_PROJECT') && cfg.supabaseKey && !cfg.supabaseKey.includes('YOUR_SUPABASE');
  let client = null;
  let timer = null;
  let idleHandle = null;
  let pendingReason = '';
  let syncing = false;
  let lastError = '';
  const PROFILE_KEY='DK_AUTH_PROFILE_V12';
  let profileCache=null;
  let profileRefreshed=false;
  try{profileCache=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null');}catch(e){}
  const status = { configured, authenticated:false, email:'', profile:profileCache, online:navigator.onLine, syncing:false, lastSyncAt:'', lastError:'' };

  function emit(){ window.dispatchEvent(new CustomEvent('dk-cloud-status',{detail:{...status}})); }
  function getClient(){
    if(!configured || !window.supabase) return null;
    if(!client) client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    return client;
  }
  let sdkLoading=null;
  async function waitForClient(timeout=8000){
    let c=getClient(); if(c)return c;
    if(!window.supabase && !sdkLoading){
      sdkLoading=new Promise(resolve=>{
        const script=document.createElement('script');
        script.src='https://unpkg.com/@supabase/supabase-js@2';
        script.onload=()=>resolve(true); script.onerror=()=>resolve(false);
        document.head.appendChild(script);
      });
    }
    const started=Date.now();
    while(Date.now()-started<timeout){
      if(sdkLoading)await Promise.race([sdkLoading,new Promise(r=>setTimeout(r,250))]);
      c=getClient(); if(c)return c;
      await new Promise(r=>setTimeout(r,200));
    }
    return null;
  }
  async function session(){
    const c=await waitForClient(); if(!c) return null;
    const {data,error}=await c.auth.getSession();
    if(error) throw error;
    const s=data.session || null;
    status.authenticated=!!s; status.email=profileCache?.username||s?.user?.email||'';
    if(s && !profileRefreshed){
      const {data:profile}=await c.from('profiles').select('id,username,display_name,role,is_active').eq('id',s.user.id).maybeSingle();
      profileRefreshed=true;
      if(profile){profileCache=profile;status.profile=profile;status.email=profile.username||s.user.email||'';localStorage.setItem(PROFILE_KEY,JSON.stringify(profile));}
    }
    emit();
    return s;
  }
  async function requireAuth(){
    if(!configured) return true;
    const s=await session();
    const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
    if(!s && page!=='login.html') { location.replace('login.html'); return false; }
    if(s && page==='login.html') { location.replace(localStorage.getItem('DK_LAST_PAGE_V10')||'index.html'); return false; }
    return true;
  }
  async function signIn(username,password){
    const c=await waitForClient(); if(!c) throw new Error('Cloud 라이브러리를 불러오지 못했습니다. 잠시 후 새로고침하세요.');
    const loginBody={action:'login',op:'login',username,loginId:username,login_id:username,identifier:username,id:username,password};
    const response=await fetch(`${String(cfg.supabaseUrl).replace(/\/$/,'')}/functions/v1/auth-login`,{
      method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseKey,'Authorization':`Bearer ${cfg.supabaseKey}`},body:JSON.stringify(loginBody)
    });
    let data={}; try{data=await response.json();}catch(e){}
    if(!response.ok) throw new Error(data?.error||data?.message||`로그인 서버 오류 (${response.status})`);
    if(!data?.access_token||!data?.refresh_token) throw new Error(data?.error||'로그인 응답을 확인할 수 없습니다.');
    const {data:sessionData,error:sessionError}=await c.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
    if(sessionError) throw sessionError;
    profileCache=data.profile||null; profileRefreshed=!!profileCache; status.profile=profileCache;
    if(profileCache)localStorage.setItem(PROFILE_KEY,JSON.stringify(profileCache));
    await session();
    return Object.assign({},sessionData,{profile:data.profile||null});
  }
  async function signOut(){ const c=getClient(); if(c) await c.auth.signOut(); profileCache=null;status.profile=null;localStorage.removeItem(PROFILE_KEY);location.replace('login.html'); }
  async function pullState(){
    const c=await waitForClient(); const s=await session(); if(!c||!s) return null;
    const {data,error}=await c.from('app_state').select('state_data,updated_at,last_reason').eq('workspace_id',cfg.workspaceId).maybeSingle();
    if(error) throw error;
    const {data:backups,error:backupError}=await c.from('app_state').select('workspace_id,state_data,updated_at,last_reason').like('workspace_id',`${cfg.workspaceId}:backup:%`).order('updated_at',{ascending:false}).limit(10);
    if(backupError)console.warn('Cloud backup lookup failed',backupError);
    status.lastSyncAt=new Date().toISOString(); status.lastError=''; emit();
    return data?Object.assign({},data,{backup_states:backups||[]}):null;
  }
  function mergeRows(base,incoming,keyFn){
    const map=new Map();
    (Array.isArray(base)?base:[]).forEach((row,index)=>map.set(keyFn(row,index),row));
    (Array.isArray(incoming)?incoming:[]).forEach((row,index)=>{const key=keyFn(row,index),old=map.get(key);map.set(key,old&&typeof old==='object'&&typeof row==='object'?Object.assign({},old,row):row);});
    return [...map.values()];
  }
  function eventSignature(row){
    if(!row||typeof row!=='object')return JSON.stringify(row);
    const copy=Object.assign({},row);delete copy.id;delete copy._id;delete copy.updatedAt;
    return JSON.stringify(copy);
  }
  function eventIdentitySignature(row){
    const value=row&&typeof row==='object'?row:{};
    return [value.date||'',value.location||'',value.type||'',value.productId||'',Number(value.qty||0),value.memo||'',value.status||''].join('\u001f');
  }
  function shortStableHash(value){
    let hash=2166136261;
    const text=String(value||'');
    for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
    return (hash>>>0).toString(36);
  }
  function normalizeEventIds(rows,prefix){
    const occurrences=new Map();
    return (Array.isArray(rows)?rows:[]).map(row=>{
      if(row&&row.id)return row;
      const signature=eventIdentitySignature(row);
      const occurrence=(occurrences.get(signature)||0)+1;
      occurrences.set(signature,occurrence);
      return Object.assign({},row,{id:`legacy-${prefix}-${shortStableHash(signature)}-${occurrence}`});
    });
  }
  function mergeEventRows(base,incoming,prefix='event'){
    const baseRows=normalizeEventIds(base,prefix);
    const incomingRows=normalizeEventIds(incoming,prefix);
    return mergeRows(baseRows,incomingRows,(row,index)=>String(row?.id||eventSignature(row)||`event-${index}`));
  }
  function normalizeProductName(value){
    return String(value||'').normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');
  }
  function canonicalProductId(value,aliases){
    let id=String(value||''),guard=0;
    while(id&&aliases&&aliases[id]&&aliases[id]!==id&&guard<20){id=String(aliases[id]);guard++;}
    return id;
  }
  function remapProductRows(rows,aliases){
    return (Array.isArray(rows)?rows:[]).map(row=>row&&typeof row==='object'?Object.assign({},row,{productId:canonicalProductId(row.productId,aliases)}):row);
  }
  function safeMergeState(remote,incoming){
    if(!remote||typeof remote!=='object')return incoming;
    if(!incoming||typeof incoming!=='object')return remote;
    const out=Object.assign({},remote,incoming);
    const aliases=Object.assign({},remote.settings?.productIdAliases||{},incoming.settings?.productIdAliases||{});
    out.settings=Object.assign({},remote.settings||{},incoming.settings||{},{productIdAliases:aliases});
    out.products=mergeRows(remote.products,incoming.products,(x,i)=>normalizeProductName(x?.name)||String(x?.id||`product-${i}`));
    out.hospitals=mergeRows(remote.hospitals,incoming.hospitals,(x,i)=>String(x?.code||x?.name||`hospital-${i}`));
    out.hospitalPrices=mergeRows(remapProductRows(remote.hospitalPrices,aliases),remapProductRows(incoming.hospitalPrices,aliases),(x,i)=>`${x?.hospitalName||''}::${x?.productId||i}`);
    out.monthlyClosings=mergeRows(remote.monthlyClosings,incoming.monthlyClosings,(x,i)=>String(x?.month||x?.id||`closing-${i}`)).map(closing=>Object.assign({},closing,{lines:remapProductRows(closing?.lines,aliases)}));
    out.deletedTransactionIds=[...new Set([...(remote.deletedTransactionIds||[]),...(incoming.deletedTransactionIds||[])].map(String))];
    out.transactions=mergeEventRows(remapProductRows(remote.transactions,aliases),remapProductRows(incoming.transactions,aliases),'tx').filter(row=>!out.deletedTransactionIds.includes(String(row?.id||'')));
    out.overuses=mergeEventRows(remapProductRows(remote.overuses,aliases),remapProductRows(incoming.overuses,aliases),'overuse');
    out.history=mergeEventRows(remote.history,incoming.history,'history').slice(0,1000);
    const remoteAudit=remote.audit||{},incomingAudit=incoming.audit||{};
    out.audit=Object.assign({},remoteAudit,incomingAudit);
    ['system','physical','result'].forEach(key=>{out.audit[key]=mergeRows(remapProductRows(remoteAudit[key],aliases),remapProductRows(incomingAudit[key],aliases),(x,i)=>String(x?.id||JSON.stringify(x)||`${key}-${i}`));});
    const inboundMappings=Object.assign({},remote.settings?.inboundMappings||{},incoming.settings?.inboundMappings||{});
    Object.keys(inboundMappings).forEach(key=>{inboundMappings[key]=canonicalProductId(inboundMappings[key],aliases);});
    out.settings.inboundMappings=inboundMappings;
    return out;
  }
  async function pushState(state,reason){
    const c=await waitForClient(); const s=await session(); if(!c||!s||!navigator.onLine) return false;
    if(syncing){ pendingReason=reason||pendingReason||'queued'; return false; }
    syncing=true; status.syncing=true; emit();
    try{
      const {data:current,error:currentError}=await c.from('app_state').select('state_data,updated_at,last_reason').eq('workspace_id',cfg.workspaceId).maybeSingle();
      if(currentError)throw currentError;
      const reasonText=String(reason||'');
      const destructiveReason=reasonText==='restore'||reasonText.startsWith('reset');
      const finalState=destructiveReason?state:safeMergeState(current?.state_data,state);
      if(current?.state_data && !destructiveReason){
        const slot=Math.floor(Date.now()/60000)%10;
        const backupPayload={workspace_id:`${cfg.workspaceId}:backup:${slot}`,state_data:current.state_data,updated_by:s.user.id,last_reason:`before-${reason||'auto'}`,updated_at:new Date().toISOString()};
        const {error:backupError}=await c.from('app_state').upsert(backupPayload,{onConflict:'workspace_id'});
        if(backupError)console.warn('Cloud backup save failed',backupError);
      }
      const payload={workspace_id:cfg.workspaceId,state_data:finalState,updated_by:s.user.id,last_reason:reason||'auto',updated_at:new Date().toISOString()};
      const {error}=await c.from('app_state').upsert(payload,{onConflict:'workspace_id'}); if(error) throw error;
      status.lastSyncAt=new Date().toISOString(); status.lastError='';
      window.dispatchEvent(new CustomEvent('dk-cloud-push-success',{detail:{updatedAt:status.lastSyncAt,reason:reason||'auto',stateData:finalState}}));
      return true;
    }catch(e){ lastError=e.message||String(e); status.lastError=lastError; console.error('Cloud sync failed',e); return false; }
    finally{
      syncing=false; status.syncing=false; emit();
      if(pendingReason){ const nextReason=pendingReason; pendingReason=''; queuePush(window.state||state,nextReason); }
    }
  }
  async function replaceAllState(state,reason='reset'){
    const c=await waitForClient(),s=await session();if(!c||!s||!navigator.onLine)return false;
    clearTimeout(timer);if(idleHandle&&window.cancelIdleCallback)cancelIdleCallback(idleHandle);pendingReason='';
    const started=Date.now();while(syncing&&Date.now()-started<15000)await new Promise(resolve=>setTimeout(resolve,120));
    if(syncing){status.lastError='기존 Cloud 동기화가 끝나지 않아 초기화를 중단했습니다.';emit();return false;}
    syncing=true;status.syncing=true;emit();
    try{
      const now=new Date().toISOString();
      const rows=[{workspace_id:cfg.workspaceId,state_data:state,updated_by:s.user.id,last_reason:reason,updated_at:now}];
      for(let slot=0;slot<10;slot++)rows.push({workspace_id:`${cfg.workspaceId}:backup:${slot}`,state_data:state,updated_by:s.user.id,last_reason:`${reason}-backup-clear`,updated_at:now});
      const {error}=await c.from('app_state').upsert(rows,{onConflict:'workspace_id'});if(error)throw error;
      status.lastSyncAt=now;status.lastError='';
      window.dispatchEvent(new CustomEvent('dk-cloud-push-success',{detail:{updatedAt:now,reason,stateData:state}}));
      return true;
    }catch(e){status.lastError=e.message||String(e);console.error('Cloud replacement failed',e);return false;}
    finally{syncing=false;status.syncing=false;pendingReason='';emit();}
  }
  function queuePush(state,reason){
    if(!configured) return;
    pendingReason=reason||pendingReason||'auto';
    clearTimeout(timer);
    if(idleHandle && window.cancelIdleCallback) cancelIdleCallback(idleHandle);
    timer=setTimeout(()=>{
      const run=()=>{ const nextReason=pendingReason; pendingReason=''; pushState(window.state||state,nextReason); };
      if(window.requestIdleCallback) idleHandle=requestIdleCallback(run,{timeout:2500});
      else run();
    },1500);
  }
  async function bootstrap(){
    status.online=navigator.onLine; emit();
    if(!configured) return {mode:'local'};
    const ok=await requireAuth(); if(!ok) return {mode:'redirect'};
    const remote=await pullState(); return {mode:'cloud',remote};
  }
  window.addEventListener('online',()=>{status.online=true;emit(); if(window.state) queuePush(window.state,'online');});
  window.addEventListener('offline',()=>{status.online=false;emit();});
  window.DKCloud={configured,status,getClient,waitForClient,session,requireAuth,signIn,signOut,pullState,pushState,replaceAllState,queuePush,bootstrap,safeMergeState};
})();
