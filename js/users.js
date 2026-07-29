(function(){
  const $=id=>document.getElementById(id); let rows=[]; let loading=false;
  async function invoke(body){
    const c=await DKCloud.waitForClient(),cfg=window.DK_CLOUD_CONFIG||{};
    if(!c)throw new Error('Cloud 라이브러리를 불러오지 못했습니다. 잠시 후 새로고침하세요.');
    const {data:sessionData,error:sessionError}=await c.auth.getSession();
    if(sessionError)throw sessionError;
    const s=sessionData?.session;
    if(!s)throw new Error('로그인이 필요합니다.');
    const response=await fetch(`${String(cfg.supabaseUrl||'').replace(/\/$/,'')}/functions/v1/admin-users`,{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':cfg.supabaseKey,'Authorization':`Bearer ${s.access_token}`},
      body:JSON.stringify(body)
    });
    let data={}; try{data=await response.json();}catch(e){}
    if(!response.ok)throw new Error(data?.error||data?.message||`사용자 서버 오류 (${response.status})`);
    if(data?.error)throw new Error(data.error);
    return data;
  }
  function render(){const body=$('userTable');if(!body)return;body.innerHTML=rows.map((u,i)=>`<tr><td>${u.username||''}</td><td>${u.display_name||''}</td><td>${window.DK_ROLE_LABELS?.[u.role]||u.role||''}</td><td>${u.is_active?'사용':'중지'}</td><td><button class="btn small-btn" onclick="DKUsers.edit(${i})">수정</button></td></tr>`).join('')||'<tr><td colspan="5" class="empty">등록된 사용자가 없습니다.</td></tr>';}
  async function load(){
    if(loading)return;
    loading=true;
    try{const data=await invoke({action:'list'});rows=data.users||[];render();$('userMessage').textContent='';}
    catch(e){if(!rows.length&&$('userMessage'))$('userMessage').textContent='사용자 조회 실패: '+(e.message||e);}
    finally{loading=false;}
  }
  function edit(i){const u=rows[i];if(!u)return;$('userId').value=u.id||'';$('userUsername').value=u.username||'';$('userName').value=u.display_name||'';$('userRole').value=u.role||'viewer';$('userActive').checked=!!u.is_active;$('userPassword').value='';}
  function clear(){['userId','userUsername','userName','userPassword'].forEach(id=>$(id).value='');$('userRole').value='viewer';$('userActive').checked=true;}
  async function save(){const id=$('userId').value,payload={action:id?'update':'create',id:id||undefined,username:$('userUsername').value.trim(),display_name:$('userName').value.trim(),role:$('userRole').value,is_active:$('userActive').checked,password:$('userPassword').value};if(!payload.username)return alert('아이디를 입력하세요.');if(!id&&!payload.password)return alert('신규 사용자의 비밀번호를 입력하세요.');try{await invoke(payload);$('userMessage').textContent='저장되었습니다.';clear();await load();}catch(e){$('userMessage').textContent='저장 실패: '+(e.message||e);}}
  async function resetPassword(){const id=$('userId').value,password=$('userPassword').value;if(!id)return alert('사용자를 먼저 선택하세요.');if(!password)return alert('새 비밀번호를 입력하세요.');try{await invoke({action:'reset-password',id,password});$('userMessage').textContent='비밀번호를 변경했습니다.';$('userPassword').value='';}catch(e){$('userMessage').textContent='변경 실패: '+(e.message||e);}}
  function renderRoleAccess(){
    const target=$('roleAccessTable');if(!target||!window.DK_MENU_DEFS)return;
    const roles=['admin','inventory','sales','viewer'];
    target.innerHTML=roles.map(role=>{
      const allowed=new Set(getRoleAccess(role));
      return `<tr><th>${DK_ROLE_LABELS[role]}</th>${DK_MENU_DEFS.map(([key,label])=>`<td><label class="role-access-check" title="${label}"><input type="checkbox" data-role="${role}" data-menu="${key}" ${allowed.has(key)?'checked':''} ${role==='admin'||key==='settings'?'disabled':''}><span>${label}</span></label></td>`).join('')}</tr>`;
    }).join('');
  }
  function saveRoleAccess(){
    state.settings=state.settings||{};state.settings.roleMenuAccess={};
    ['inventory','sales','viewer'].forEach(role=>{state.settings.roleMenuAccess[role]=[...document.querySelectorAll(`#roleAccessTable input[data-role="${role}"]:checked`)].map(x=>x.dataset.menu).filter(x=>x!=='settings');});
    state.settings.roleMenuAccess.admin=[...DK_DEFAULT_ROLE_ACCESS.admin];
    saveState('role-access');$('roleAccessMessage').textContent='권한별 메뉴 접근 설정을 저장했습니다.';renderRoleAccess();
  }
  function resetRoleAccess(){if(!confirm('권한별 메뉴 접근 설정을 기본값으로 되돌릴까요?'))return;state.settings=state.settings||{};delete state.settings.roleMenuAccess;saveState('role-access-reset');renderRoleAccess();$('roleAccessMessage').textContent='기본 권한 설정으로 되돌렸습니다.';}
  window.DKUsers={load,edit,save,clear,resetPassword,renderRoleAccess,saveRoleAccess,resetRoleAccess};
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(load,500);setTimeout(renderRoleAccess,650);});
})();
