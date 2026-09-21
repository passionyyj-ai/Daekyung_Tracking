/* UI only. Shared authentication remains in DKCloud. */
document.addEventListener('DOMContentLoaded', () => {
  const el=id=>document.getElementById(id);
  DKCloud.requireAuth().catch(()=>{el('loginMessage').textContent='인증 연결을 확인해 주세요.';});
  el('loginForm').addEventListener('submit',async event=>{
    event.preventDefault(); const button=el('loginBtn'); if(button.disabled)return;
    button.disabled=true; el('loginMessage').textContent='로그인 확인 중...';
    try {
      await DKCloud.signIn(el('loginUsername').value.trim(),el('loginPassword').value);
      location.replace(localStorage.getItem('DK_LAST_PAGE_V10')||'index.html');
    } catch { el('loginMessage').textContent='로그인하지 못했습니다. 아이디·비밀번호 또는 연결 상태를 확인하세요.'; }
    finally { button.disabled=false; }
  });
  el('forgotBtn').addEventListener('click',()=>{
    const panel=el('recoveryPanel'); panel.hidden=!panel.hidden;
    el('forgotBtn').setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)el('recoveryEmail').focus();
  });
  el('recoveryForm').addEventListener('submit',async event=>{
    event.preventDefault(); const button=el('sendResetBtn'); if(button.disabled)return;
    button.disabled=true; el('recoveryMessage').textContent='요청 처리 중...';
    try {
      await DKCloud.sendPasswordReset(el('recoveryEmail').value);
      el('recoveryMessage').textContent='등록된 수신 가능 계정이면 재설정 이메일이 발송됩니다. 스팸함도 확인해 주세요. 메일이 오지 않으면 관리자에게 문의하세요.';
    } catch(error) {
      el('recoveryMessage').textContent=/@daekyung\.local$/i.test(el('recoveryEmail').value.trim())
        ? '이메일을 사용할 수 없는 계정은 관리자에게 초기화를 요청하세요.'
        : '이메일 요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의하세요.';
    } finally { button.disabled=false; }
  });
});
