# 로그인 및 사용자 관리 수정본 배포

1. 기존 GitHub 저장소의 최신 `main`과 ZIP 내용을 비교합니다. ZIP을 풀면 `settings.html`, `js/`, `supabase/`가 나오는 위치가 저장소 루트입니다. 그 위치에 업데이트를 적용하고, 기존 `js/config.js`의 운영 프로젝트 값을 유지합니다. 이전 커밋에서 저장소 루트에 올린 `users.js`는 삭제합니다. 화면은 `js/users.js`를 사용합니다.
2. 운영 Supabase 프로젝트에 `supabase/functions/auth-login/index.ts`와 `supabase/functions/admin-users/index.ts`를 각각 배포합니다. Dashboard에서 두 함수의 게이트웨이 **Verify JWT**를 끕니다. `admin-users`는 함수 내부에서 Supabase Auth의 사용자 토큰과 활성 관리자 권한을 확인합니다. CLI 명령은 `V12_USER_SETUP.md`를 참고하세요.
3. `public.profiles`에서 기존 정상 계정들이 Auth 사용자 UUID와 연결되어 있고 사용 상태가 활성인지 확인합니다. 활성 관리자도 한 명 이상 있어야 합니다. 이후 Supabase SQL Editor에서 `supabase_active_accounts.sql`을 실행합니다. 이 정책은 비활성 계정의 업무 데이터 조회와 저장을 차단합니다.
4. GitHub Pages 배포가 끝나면 운영 사이트를 새로고침합니다. 관리자 계정으로 로그인한 뒤 테스트 계정의 기본 정보 저장, 비밀번호 변경 및 새 비밀번호로 로그인, 비활성화 후 로그인 거부를 확인합니다. 일반 계정에서는 사용자 관리가 거부되는지, 등록된 이메일의 복구 링크는 정상 작동하는지도 확인합니다.

사용자 정보 수정과 비밀번호 재설정은 `사용자 저장`과 `비밀번호 변경` 버튼에서 각각 수행합니다. 복구 이메일을 비워 두면 기존 주소를 유지합니다.
