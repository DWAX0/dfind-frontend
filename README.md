# dfind-frontend — D*Find 대시보드·관리자 페이지

Supabase에 쌓인 통합 기업·이벤트 데이터를 보여주는 **정적 HTML + 순수 JavaScript** 화면입니다.
Node.js·npm·빌드 도구를 쓰지 않습니다 (보안 정책).

| 저장소 | 내용 |
| --- | --- |
| [dfind-backend](../dfind-backend) | DB SQL, 스크래퍼, 통합 파이프라인, 전체 진행 단계 |
| **dfind-frontend** (이 저장소) | 대시보드·관리자 페이지 |

- 테스트 주소: `https://dfind-lab.github.io/dfind-frontend/` (GitHub Pages)
- 운영 배포처: 추후 결정 (비공개 전환 시 Cloudflare Pages 등으로 이전)

---

## 1. 구조 (2026-11-24 1차 구현)

```
dfind-frontend/
├─ README.md
├─ .nojekyll                  ← GitHub Pages가 파일을 가공하지 않도록 (빈 파일)
├─ index.html                 ← 첫 주소 → pages/index.html 로 바로 이동만 함
├─ pages/                     ← 화면(html)은 모두 여기 한 폴더
│  ├─ login.html              ← 메일 로그인 링크 또는 비밀번호
│  ├─ index.html              ← 01 SUMMARY (날짜 하나만 고름. 오늘의 결론은 DB 에 저장된 것을 읽음)
│  ├─ radar.html              ← 02 기업 레이더 (평가 기준 공개 + 기준일 점수·순위, 근거 펼치기)
│  ├─ company.html            ← 03 기업 정보 (?id=… / id 없으면 기업 찾기)
│  ├─ regulatory.html         ← 04 인허가·제도
│  ├─ market.html             ← 05 시장·투자 동향 (같은 사건 묶기)
│  ├─ research.html           ← 06 연구·과제
│  ├─ disclosure.html         ← 07 공시 (DART 수집 전이라 빈 화면)
│  ├─ item.html               ← 정보 한 건 자세히 (?key=…): 본문·첨부(내용 보기·내려받기)·원본 보기
│  ├─ mail.html, status.html  ← 08 메일 리포트 · 09 수집 현황 (준비 중)
│  ├─ admin-summary.html      ← 관리자: 오늘의 결론 입력 (Claude 앱에 붙여넣을 글 복사 → 답 붙여넣고 저장, API 비용 없음)
│  ├─ admin-recipients.html   ← 관리자: 메일 수신자 (추가·수정·중지·삭제)
│  ├─ admin-settings.html     ← 관리자: 기준 정보 (키워드·비슷한 말 / 언론사 RSS / 사용자·권한)
│  └─ admin-logs.html         ← 관리자: 로그 (수집 / 메일 발송 / Claude 요약 / 변경 기록)
├─ assets/
│  ├─ css/app.css             ← 큰 글자·진한 색, 분류 색 4가지 고정
│  └─ js/
│     ├─ config.js            ← SUPABASE_URL, anon 키 (공개돼도 되는 값만)
│     ├─ core.js              ← 로그인 확인, 왼쪽 메뉴, 글자 크게, 조회 막대(오늘·7일·30일·날짜 지정·기간 지정)
│     ├─ category.js          ← 분야별 화면 공통 (종류별 칸·검색·목록)
│     └─ pages/               ← 화면별 JS (html 1개 = JS 1개, 이름은 아래 표)
└─ vendor/
   ├─ supabase.js             ← supabase-js 2.119.2 UMD (npm 패키지의 dist/umd/supabase.js 그대로)
   └─ supabase.LICENSE
```

| 화면 (pages/) | JS (assets/js/pages/) |
| --- | --- |
| index · radar · company · item · login | summary · radar · company · item · login |
| regulatory · market · research · disclosure | 같은 이름 (+ assets/js/category.js) |
| mail · status | prepare |
| admin-summary · admin-recipients · admin-settings · admin-logs | summary-input · recipients · settings · logs |

- 데이터는 DB 함수로만 읽습니다: `dash_feed`, `dash_feed_counts`, `dash_company_scores`, `dash_company`
  (backend `database/42_dashboard.sql`). 로그인하고 권한(viewer·admin)이 있는 사람만 결과가 나옵니다.
- 고른 날짜·기간은 주소(`?per=7`, `?per=day&day=2026-11-20`, `?per=range&from=…&to=…`)에 남아 새로고침·공유해도 유지됩니다.
- 관리자 메뉴는 admin 에게만 보이고, 실제 차단은 DB 권한(RLS)이 합니다.

### 처음 설정

1. `assets/js/config.js` 에 Supabase **Project URL** 과 **anon(Publishable) 키**를 넣습니다. service_role·secret 키는 절대 넣지 않습니다.
2. Supabase → Authentication → URL Configuration: Site URL 과 Redirect URLs 에
   `https://dfind-lab.github.io/dfind-frontend/pages/index.html` (로그인 링크가 돌아올 곳) 이 있는지 확인합니다.
3. 사용자는 Authentication → Users → Invite user 로 초대 → 관리자 › 기준 정보 › 사용자·권한에서 권한을 줍니다.
   첫 관리자는 backend `40_roles.sql` 아래쪽 SQL 로 한 번 지정합니다.

## 2. GitHub Pages 설정 (테스트)

1. Settings → Pages → Source: **Deploy from a branch** → Branch `main`, 폴더 `/ (root)` → Save
2. 1~2분 뒤 `https://dfind-lab.github.io/dfind-frontend/` 접속 확인
3. Supabase → Authentication → URL Configuration에 위 주소가 등록돼 있는지 확인 (backend README 1단계)

빌드가 없어서 별도 워크플로 없이 `main`에 push하면 바로 반영됩니다.

**주의**
- 주소가 `/dfind-frontend/` 하위 경로입니다. 링크·스크립트는 **상대경로**로 씁니다. 화면은 모두 `pages/` 에 있으므로 화면끼리는 `radar.html`, 공통 파일은 `../assets/…`.
- Pages는 응답 헤더를 지정할 수 없어 각 HTML `<head>`에 CSP를 넣습니다.

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self';
               connect-src 'self' https://*.supabase.co wss://*.supabase.co;
               img-src 'self' data:; base-uri 'self'; form-action 'self'">
```

- Pages는 약 10분 캐시합니다. JS·CSS를 고치면 HTML의 `?v=YYYYMMDD`를 바꿉니다.
- 글꼴은 컴퓨터에 있는 글꼴(맑은 고딕 등)을 씁니다. CSP 때문에 외부 글꼴(Google Fonts)은 쓰지 않습니다.

---

## 3. 화면 작성 규칙

- HTML에 인라인 `<script>`·`onclick` 없이, 화면별 JS 파일에서 이벤트를 연결합니다 (CSP `script-src 'self'`).
- 모든 화면은 `core.js`가 먼저 로그인을 확인하고, 로그인이 없으면 `login.html`로 보냅니다.
- `admin-*.html` 화면은 관리자인지 확인하지만, **실제 차단은 DB의 RLS**가 합니다. 화면 숨김은 편의일 뿐입니다.
- 화면은 통합 테이블·뷰만 읽습니다. 출처별 원본 테이블은 관리자 화면에서만 필요한 경우 읽습니다.
- 사용자 입력·수집 데이터를 화면에 넣을 때는 `textContent`를 쓰고 `innerHTML`에 그대로 넣지 않습니다.

---

## 4. 진행 상황

| 단계 | 화면 | 상태 |
| --- | --- | --- |
| 8-1 | login, core.js, SUMMARY, 기업 레이더, 기업 정보, 분야별 4개 | ✅ 1차 (출처 원본 기반, 점수 v0) |
| 8-2 | 관리자: 메일 수신자·기준 정보·로그 | ✅ 1차 (시험 발송은 메일 발송 기능 연결 후) |
| 8-3 | 메일 리포트·수집 현황 | 준비 중 (2차) |
| 6 이후 | 통합 기업·이벤트(companies·events)로 전환, 관심 기업·매칭 검토 화면 | 통합 파이프라인 후 |

## 5. 로컬 실행

```bash
git clone https://github.com/dfind-lab/dfind-frontend.git
cd dfind-frontend
python -m http.server 8080        # http://localhost:8080
```

## 6. 비공개로 바꿀 때

무료 플랜은 비공개 저장소에서 Pages를 쓸 수 없습니다. 비공개 전환 전에 새 배포처(Cloudflare Pages 등)를 연결하고, 접근 제한(사내 이메일만)을 추가한 뒤 Supabase의 Site URL·Redirect URL을 새 주소로 바꿉니다.
