document.addEventListener('DOMContentLoaded',async()=>{
  const el=id=>document.getElementById(id),fields=el('resetFields'),message=el('resetMessage');
  let busy=false;
  try { await DKCloud.preparePasswordRecovery(); fields.disabled=false; message.textContent='링크를 확인했습니다. 새 비밀번호를 입력하세요.'; }
  catch { message.textContent='재설정 링크가 만료되었거나 확인할 수 없습니다. 로그인 화면에서 새 링크를 요청해 주세요.'; history.replaceState(null,'',location.pathname); }
  el('resetForm').addEventListener('submit',async event=>{
    event.preventDefault(); if(busy||fields.disabled)return;
    const password=el('newPassword').value,confirm=el('confirmPassword').value;
    if(password.length<8 || password!==confirm){message.textContent='8자 이상의 비밀번호를 입력하고 확인 값도 동일하게 입력하세요.';return;}
    busy=true; fields.disabled=true; message.textContent='비밀번호 변경 중...';
    try {
      const result=await DKCloud.updateRecoveryPassword(password,confirm);
      el('resetForm').reset();
      message.textContent=result.signedOut ? '비밀번호를 변경했습니다. 로그인 화면에서 새 비밀번호로 로그인하세요.' : '비밀번호를 변경했습니다. 현재 세션의 로그아웃을 완료하지 못했습니다. 로그인 화면으로 돌아가 로그아웃한 뒤 새 비밀번호로 확인하세요.';
    } catch(error) {
      fields.disabled=false;
      message.textContent=error.code==='weak_password' ? '비밀번호가 보안 정책을 충족하지 않습니다. 더 강력한 비밀번호를 입력하세요.' : error.code==='same_password' ? '기존 비밀번호와 다른 비밀번호를 입력하세요.' : '변경하지 못했습니다. 연결 상태와 비밀번호 정책을 확인하거나 새 재설정 링크를 요청하세요.';
    } finally { busy=false; }
  });
});
