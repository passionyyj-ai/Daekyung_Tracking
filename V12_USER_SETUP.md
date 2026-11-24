# 대경 Tracking v12 사용자 관리 설정

v12는 사용자가 Supabase Dashboard에서 계정을 관리하지 않습니다. 일반 사용자는 대경 Tracking의 아이디와 비밀번호로 로그인하고, 관리자는 사이트의 `환경설정 → 사용자 관리`에서 계정을 등록·수정합니다.

## 1. 기존 Cloud 스키마 확인

기존에 실행한 `supabase_schema.sql`의 `app_state` 테이블은 그대로 사용합니다.

Supabase의 **SQL Editor**에서 `supabase_v12_users.sql` 전체를 실행해 `profiles` 테이블을 추가합니다.
현재 사용 중인 계정에 활성 `profiles` 행이 연결되어 있는지 확인한 뒤 `supabase_active_accounts.sql`을 실행합니다.

## 2. Edge Function 배포

다음 두 함수를 Supabase 프로젝트에 배포합니다.

- `supabase/functions/auth-login/index.ts`
- `supabase/functions/admin-users/index.ts`

Supabase CLI를 사용하는 경우 프로젝트 폴더에서 실행합니다.

```bash
supabase functions deploy auth-login --no-verify-jwt
supabase functions deploy admin-users --no-verify-jwt
```

Supabase Dashboard 편집기를 사용하는 경우 **Edge Functions**에서 같은 이름으로 함수를 만들고 각 `index.ts` 내용을 붙여 넣습니다.

- `auth-login`: JWT 검증을 끔(로그인 전 호출되는 공개 함수)
- `admin-users`: 게이트웨이의 Verify JWT 설정을 끔. 함수 내부에서 Supabase Auth로 사용자 토큰을 검증하고, 활성 관리자에게만 작업을 허용합니다.

두 함수 모두 코드 내부에서 권한을 다시 확인합니다. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase 함수 환경에서만 사용되며 GitHub 파일에는 절대 넣지 않습니다.

## 3. GitHub Pages 설정

`js/config.js`에는 Project URL과 publishable key만 넣습니다.

```javascript
window.DK_CLOUD_CONFIG = {
  supabaseUrl: 'https://프로젝트ID.supabase.co',
  supabaseKey: 'sb_publishable_실제키',
  workspaceId: 'daekyung-main',
  cloudEnabled: true
};
```

`sb_secret_...` 또는 `service_role` 키는 넣지 않습니다.

## 4. 최초 관리자 전환

최초 한 번만 Supabase **Authentication → Users**에 기존 관리자 이메일 사용자가 있어야 합니다.

1. **Authentication → Users**에서 관리자로 사용할 기존 계정의 UUID를 확인합니다.
2. `public.profiles`에 같은 UUID를 `id`로 쓰는 행을 등록합니다. `username`은 사용할 로그인 아이디, `display_name`은 표시 이름, `role`은 `admin`, `is_active`는 `true`로 설정합니다. 기존 활성 관리자 행이 있으면 이 단계는 건너뜁니다.
3. 등록한 `username`과 기존 Auth 비밀번호로 대경 Tracking에 로그인합니다.
4. 이후 `환경설정 → 사용자 관리`에서 일반 사용자를 아이디 방식으로 생성합니다.

최초 관리자 생성 이후 일반 사용자는 Supabase Dashboard를 사용할 필요가 없습니다.

## 5. 권한별 메뉴

- 관리자: 전체 메뉴 및 사용자 관리
- 재고담당: Dashboard, 거래, 재고, 품목, 재고 감사, 보고서
- 영업담당: Dashboard, 거래, 병원, 병원별 단가, 단가관리, 보고서
- 조회전용: Dashboard, 재고, 보고서

현재 v12의 업무 데이터는 기존과 동일하게 `app_state` 한 건을 공유하므로 메뉴 제한은 화면 접근 제어입니다. 병원별·행별 데이터 보안까지 필요하면 향후 업무 데이터를 개별 테이블로 분리하고 RLS를 적용해야 합니다.

