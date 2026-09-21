# 계정 복구 변경내역 — 요청 버전 v11.4

기준 파일: Daekyung_Tracking-main.zip (실제 소스는 v12 계열).
산출물 이름만 요청에 따라 v11.4를 사용하며 기존 v12 기능은 유지했습니다.

- 로그인 화면에 비밀번호 찾기 및 별도 이메일 입력 추가.
- Supabase resetPasswordForEmail을 통한 복구 요청 및 프로젝트 경로 자동 계산.
- reset-password.html 추가: 유효한 복구 세션 확인, 비밀번호/확인 입력, updateUser 호출, 현재 세션 로그아웃.
- js/cloud.js에서 기존 인증과 복구 로직 공통 관리. 로그인 화면 스크립트는 js/login.js로 분리.
- 관리자 도움말은 접힌 간단 안내로 제공.
- 설정 파일, 데이터 처리 로직, Edge Functions, 샘플 파일 및 다운로드 경로 유지.
- HTML의 cloud.js 버전 문자열 갱신으로 이전 인증 코드 캐시 방지.

배포 전 GITHUB_SUPABASE_SETUP.md의 '계정 복구 추가본'을 읽으세요.
특히 내부 @daekyung.local 계정은 이메일을 수신할 수 없으므로 기존 관리자 초기화가 필요합니다.

검증: JavaScript 문법 검사, 모의 Auth 기반 복구/오류/경로 테스트, 원본 파일 비교.
실제 Supabase 메일 발송과 운영 로그인을 수행하지 않았습니다.
