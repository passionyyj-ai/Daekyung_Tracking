# 대경 Tracking Cloud v11 설치 가이드

## 1. Supabase 프로젝트 생성
1. Supabase에서 새 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase_schema.sql` 전체를 실행합니다.
3. Authentication > Users에서 사용할 이메일 사용자를 생성합니다.
4. Project Settings > API에서 Project URL과 publishable key(또는 legacy anon key)를 확인합니다.

## 2. v11 설정
`js/config.js`를 열고 아래 두 값을 변경합니다.

```js
supabaseUrl: 'https://실제프로젝트.supabase.co',
supabaseKey: '실제 publishable 또는 anon key',
```

`service_role` 또는 secret key는 절대로 입력하지 마세요.

## 3. GitHub Pages 배포
1. GitHub 저장소를 생성합니다.
2. `Daekyung Tracking System` 폴더 안의 파일 전체를 저장소 루트에 업로드합니다.
3. Settings > Pages > Build and deployment에서 `Deploy from a branch`를 선택합니다.
4. Branch를 `main`, 폴더를 `/(root)`로 선택하고 Save 합니다.
5. 발급된 GitHub Pages 주소에서 `login.html` 또는 `index.html`을 엽니다.

## 4. 데이터 동작
- LocalStorage: 오프라인 캐시 및 즉시 자동저장
- Supabase `app_state`: 회사 공용 공식 데이터
- 로그인 후 원격 데이터가 더 최신이면 자동으로 내려받습니다.
- 로컬 데이터가 더 최신이면 Supabase로 자동 동기화합니다.
- 인터넷이 끊기면 LocalStorage에 계속 저장하고 온라인 복귀 시 동기화를 재시도합니다.

## 5. v10 데이터 이전
v10에서 JSON 백업을 내려받은 뒤 v11에서 JSON 복원을 실행하면 로컬에 반영되고 Supabase로 자동 업로드됩니다.

## 중요
v11은 기존 기능 안정성을 위해 전체 AppState를 JSONB 1건으로 동기화하는 1차 Cloud 버전입니다. 여러 사용자가 같은 순간에 수정하면 마지막 저장 데이터가 우선할 수 있습니다. 다음 단계에서는 `product_master`, `hospital_master`, `inventory_transaction`, `inventory_balance`, `hospital_sale_price`, `inventory_audit` 등 테이블별 저장으로 전환하는 것을 권장합니다.

## 계정 복구 추가본 (요청 산출물명 v11.4)

이번 ZIP의 실제 기준은 사용자가 제공한 `Daekyung_Tracking-main.zip`의 v12 계열입니다. v11로 다운그레이드하지 않았으며 기존 아이디 로그인, 사용자 관리, 동기화 및 샘플을 보존했습니다. 기존 운영 사이트 업데이트 시 위의 최초 설치 SQL을 다시 실행하지 마세요.

### 배포 및 URL 설정
1. 기존 `js/config.js`를 백업하고 운영 중인 URL/key 값을 유지합니다. 이번 추가본은 첨부 원본의 config를 변경하지 않았습니다.
2. ZIP을 풀고 `login.html`, `reset-password.html`, `js/` 등이 저장소 루트에 위치하도록 업로드합니다.
3. Supabase Dashboard → Authentication → URL Configuration에서 다음을 설정합니다.
   - Site URL: `https://passionyyj-ai.github.io/Daekyung_Tracking/`
   - Redirect URLs에 정확히 추가: `https://passionyyj-ai.github.io/Daekyung_Tracking/reset-password.html`
4. 다른 도메인/저장소 이름을 사용하면 두 주소를 실제 주소로 변경합니다. 대소문자도 일치해야 합니다. 로컬 HTTP 테스트 주소는 필요한 경우 별도로 허용합니다.
5. 재설정 이메일 템플릿은 Supabase 기본 `{{ .ConfirmationURL }}` 링크를 사용해야 합니다. 임의로 SiteURL에 토큰을 붙이는 템플릿은 이 흐름과 호환되지 않습니다.
6. Supabase의 이메일 발송 설정/SMTP와 발송 제한을 확인합니다. 기본 발송 서비스의 수신자 제한이 있다면 운영용 SMTP를 설정합니다.
7. 배포 완료 후 강력 새로고침합니다. 로그인 → 비밀번호 찾기 → 이메일 링크 → 새 비밀번호 입력 → 기존 아이디와 새 비밀번호로 로그인을 확인합니다.

### 현재 아이디 계정의 이메일 조건
- 첨부본의 사용자 생성 기능은 `아이디@daekyung.local` 내부 주소를 사용합니다. 이 주소는 메일 수신이 불가능하므로 이메일 복구를 사용할 수 없습니다. 해당 계정은 기존 환경설정 → 사용자 관리의 관리자 비밀번호 초기화를 사용합니다.
- 이메일 복구를 사용하려면 권한 있는 관리자가 Supabase Authentication → Users에서 **기존 사용자 ID를 유지한 채** 해당 사용자의 Auth 이메일을 본인 소유의 수신 가능한 주소로 변경하고 확인 절차를 완료해야 합니다. 사용자를 삭제하거나 재생성하지 마세요.
- profiles의 username(로그인 아이디)은 그대로 유지합니다. 기존 auth-login 함수는 사용자 ID로 Auth 이메일을 조회하므로 이메일이 바뀌어도 같은 아이디로 로그인합니다.
- 복구 입력란에는 로그인 아이디가 아니라 Auth에 등록된 실제 이메일을 입력합니다. 계정 존재 여부는 화면에서 공개하지 않습니다.

### 동작 및 검증
- 공통 로직: `js/cloud.js`의 `sendPasswordReset`, `preparePasswordRecovery`, `updateRecoveryPassword`, `signIn`, `signOut`.
- 현재 페이지의 폴더 URL을 기준으로 reset-password.html을 생성합니다. 프로젝트 이름이나 origin 루트를 고정하지 않습니다.
- PASSWORD_RECOVERY 이벤트와 서버 사용자 확인을 통과해야 변경할 수 있습니다. 평소 로그인 세션만으로는 재설정 화면을 사용할 수 없습니다.
- 성공 후 현재 브라우저 세션을 로그아웃합니다. 다른 장치 세션의 강제 종료는 이 기능에서 별도로 수행하지 않습니다.
- 주소에서 토큰을 제거하므로 재설정 화면을 새로고침하거나 링크가 만료/소비된 경우 새 이메일을 요청해야 합니다.
- 실제 메일 발송 및 운영 Supabase 변경은 이번 제작 중 수행하지 않았습니다. 운영 URL 설정 후 별도 테스트 계정으로 최종 확인하세요.

공식 참고: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail 및 https://supabase.com/docs/reference/javascript/auth-updateuser

## 후속 수정: 사용자 관리에서 이메일 등록
이번 이메일 등록 수정본은 `README_EMAIL_REGISTRATION.md`를 우선 따릅니다.
신규 계정은 실제 복구 이메일로 생성하고, 기존 계정도 사용자 관리 → 수정에서 이메일을 저장할 수 있습니다.
Supabase admin-users 함수 배포가 반드시 필요하며 GitHub 업로드만으로는 서버 코드가 변경되지 않습니다.
