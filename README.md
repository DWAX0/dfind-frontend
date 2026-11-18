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

## 1. 구조

```
dfind-frontend/
├─ README.md
├─ .nojekyll                  ← GitHub Pages가 파일을 가공하지 않도록 (빈 파일)
├─ index.html                 ← 대시보드 메인 (마지막 수집 이후 신규 이벤트)
├─ companies.html             ← 기업 목록·순위
├─ company.html               ← 기업 페이지 (?id=… 카테고리별 타임라인·점수 근거)
├─ regulatory.html            ← 의료기기 허가·인증
├─ market.html                ← 시장·투자 동향
├─ research.html              ← 연구·과제·공시
├─ status.html                ← 수집 현황 (v_crawl_status)
├─ login.html
├─ admin/
│  ├─ keywords.html           ← 키워드 사전·동의어
│  ├─ assignments.html        ← 수집 대상별 키워드 배정 (뉴스는 신호별)
│  ├─ targets.html            ← 수집 대상 사용/중지
│  ├─ matching.html           ← 기업 매칭 검토 (pending)
│  ├─ companies.html          ← 관심 기업·별칭·제외
│  ├─ manual-events.html      ← 수동 확인 이벤트
│  ├─ weights.html            ← 이벤트 유형 가중치
│  └─ users.html              ← 사용자 권한
├─ assets/
│  ├─ css/app.css
│  └─ js/
│     ├─ config.js            ← SUPABASE_URL, anon 키 (공개돼도 되는 값만)
│     ├─ core.js              ← 로그인 확인, 메뉴, 공통 UI, admin 화면 접근 확인
│     ├─ api.js               ← 조회·저장 함수
│     └─ pages/               ← 화면별 JS (HTML 1개 = JS 1개)
└─ vendor/
   └─ supabase.js             ← 버전 고정한 supabase-js UMD 단일 파일
```

---

## 2. GitHub Pages 설정 (테스트)

1. Settings → Pages → Source: **Deploy from a branch** → Branch `main`, 폴더 `/ (root)` → Save
2. 1~2분 뒤 `https://dfind-lab.github.io/dfind-frontend/` 접속 확인
3. Supabase → Authentication → URL Configuration에 위 주소가 등록돼 있는지 확인 (backend README 1단계)

빌드가 없어서 별도 워크플로 없이 `main`에 push하면 바로 반영됩니다.

**주의**
- 주소가 `/dfind-frontend/` 하위 경로입니다. 링크·스크립트는 **상대경로**로 씁니다 (`assets/js/core.js`, 관리자 화면에서는 `../assets/js/core.js`).
- Pages는 응답 헤더를 지정할 수 없어 각 HTML `<head>`에 CSP를 넣습니다.

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self';
               connect-src 'self' https://<프로젝트ID>.supabase.co wss://<프로젝트ID>.supabase.co;
               img-src 'self' data:; base-uri 'self'; form-action 'self'">
```

- Pages는 약 10분 캐시합니다. JS·CSS를 고치면 HTML의 `?v=YYYYMMDD`를 바꿉니다.

---

## 3. 화면 작성 규칙

- HTML에 인라인 `<script>`·`onclick` 없이, 화면별 JS 파일에서 이벤트를 연결합니다 (CSP `script-src 'self'`).
- 모든 화면은 `core.js`가 먼저 로그인을 확인하고, 로그인이 없으면 `login.html`로 보냅니다.
- `admin/` 화면은 `is_admin()`을 확인하지만, **실제 차단은 DB의 RLS**가 합니다. 화면 숨김은 편의일 뿐입니다.
- 화면은 통합 테이블·뷰만 읽습니다. 출처별 원본 테이블은 관리자 화면에서만 필요한 경우 읽습니다.
- 사용자 입력·수집 데이터를 화면에 넣을 때는 `textContent`를 쓰고 `innerHTML`에 그대로 넣지 않습니다.

---

## 4. 만드는 순서

| 단계 | 화면 | 이유 |
| --- | --- | --- |
| 7-1 | login, core.js, api.js | 공통 틀 |
| 7-2 | admin/keywords, admin/assignments, admin/targets | 수집 품질을 좌우하므로 먼저 |
| 7-3 | admin/matching, admin/companies | 기업 매칭 검토 |
| 7-4 | admin/manual-events, admin/weights, admin/users | |
| 8-1 | status | 수집이 잘 되는지 바로 확인 |
| 8-2 | index, companies, company | 핵심 대시보드 |
| 8-3 | regulatory, market, research | 카테고리 화면 |

---

## 5. 로컬 실행

```bash
git clone https://github.com/dfind-lab/dfind-frontend.git
cd dfind-frontend
python -m http.server 8080        # http://localhost:8080
```

## 6. 비공개로 바꿀 때

무료 플랜은 비공개 저장소에서 Pages를 쓸 수 없습니다. 비공개 전환 전에 새 배포처(Cloudflare Pages 등)를 연결하고, 접근 제한(사내 이메일만)을 추가한 뒤 Supabase의 Site URL·Redirect URL을 새 주소로 바꿉니다.
