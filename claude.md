# Project: NoCan News (News Noise Canceling)

> **중요:** 프로젝트 구조, 설정, 로직 등에 변경이 있을 때마다 이 문서(CLAUDE.md)도 함께 업데이트해야 합니다.

---

## 1. Project Overview

- 현재 Production 운영 중

* **Description:** 불안을 파는 뉴스를 차단하고, 안도감과 통찰을 파는 이메일 큐레이션 서비스.
* **Core Value:** "세상의 소음은 끄고, 구조적 맥락만 남긴다 (Noise Off, Context On)."
* **Target Audience:** 자극적인 정보에 지쳤지만, 세상의 흐름은 놓치고 싶지 않은 지적 욕구가 있는 개인.
* **Platform:**
  - **Landing:** Web (Next.js) - 구독 및 철학 소개.
  - **Service:** Daily Email Newsletter - 매일 아침 7시 자동 발송.

---

## 2. Core Philosophy (Based on Peter Wessel Zapffe)

1. **Isolation (고립):**
   - 살인, 성범죄, 연예 가십, 정치적 비방 등 '독성 정보(Toxic Info)'를 AI가 사전 차단.
   - "오늘 당신은 300건의 쓰레기 정보로부터 보호받았습니다"라는 효능감 제공.

2. **Anchoring (고착):**
   - 불안을 유발하는 낚시성 헤드라인을 '건조한 팩트'로 중화(Neutralize).
   - 파편화된 정보를 [현상-맥락-함의]의 구조로 묶어 독자에게 지적 통제감 제공.

---

## 3. Architecture & Tech Stack (Updated)

> "가게(Frontend)"와 "공장(Backend)"이 분리된 **Producer-Consumer 아키텍처**.

### 3.1 Repository Structure (Dual Repo)

| 구분     | 역할             | 저장소명 (예시)   | 기술 스택             | 배포 환경             |
| -------- | ---------------- | ----------------- | --------------------- | --------------------- |
| Consumer | Frontend (Web)   | NoCan-News-Web    | Next.js, Tailwind CSS | Vercel (Serverless)   |
| Producer | Backend (Worker) | NoCan-News-Worker | NestJS (Standalone)   | GitHub Actions (Cron) |
| Storage  | Database         | (Common Resource) | Supabase (PostgreSQL) | Cloud Hosted          |

### 3.2 Detailed Stack

**Frontend (Web):**

- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS (Digital Brutalism Design)
- **Auth/DB:** `@supabase/supabase-js` (Anon Key 사용)

**Backend (Worker):**

- **Framework:** NestJS (Standalone Mode for Batch Processing)
- **Scraping:** `rss-parser` (Google News), `cheerio` (본문)
- **AI Engine:** Gemini API (`gemini-2.5-flash`)
- **Email:** `nodemailer` (Gmail SMTP)
- **DB Access:** Supabase Client (Service Role Key 사용 - RLS 우회)

### 3.3 End-to-End System Flow

1. **Subscribe (Web):** 사용자 랜딩 페이지 접속 -> 이메일 입력 -> Supabase INSERT (Next.js).
2. **Trigger (Worker):** 매일 07:00 KST, GitHub Actions가 NestJS 워커 실행.
3. **Fetch Users:** Supabase에서 `is_active: true`인 구독자 목록 SELECT.
4. **Collect Data:** Google News RSS 수집 (Business, Tech, Policy, Editorial).
5. **AI Process:**
   - **Filter:** 독성 뉴스(살인, 비방 등) 제거.
   - **Detox:** 헤드라인 중화 및 [Fact-Context-Implication] 요약.
   - **Synthesis:** 좌우 사설 통합 분석 (정반합 구조화).
6. **Send:** Nodemailer로 HTML 이메일 발송 (Footer에 unsubscribe 링크 포함).
7. **Unsubscribe (Web):** 사용자가 메일 하단 링크 클릭 -> Next.js 숨겨진 페이지에서 `UPDATE is_active = false` 처리.

---

## 4. Database Strategy (Supabase)

### 4.1 Schema (`public.subscribers`)

```sql
create table public.subscribers (
  id uuid not null default gen_random_uuid (),
  email text not null,
  is_active boolean not null default true, -- 구독 상태 (Soft Delete)
  created_at timestamp with time zone not null default now(),
  constraint subscribers_pkey primary key (id),
  constraint subscribers_email_key unique (email)
);
```

### 4.2 Schema (`public.newsletters`) - Updated

```sql
create table public.newsletters (
  id uuid not null default gen_random_uuid(),
  send_date date not null,
  title text not null,
  content_html text not null,
  content_data jsonb not null,
  all_keywords text[] default '{}',  -- AI 추출 키워드 (이슈 추적용)
  created_at timestamp with time zone not null default now(),
  constraint newsletters_pkey primary key (id),
  constraint newsletters_send_date_key unique (send_date)
);

-- GIN 인덱스 (키워드 검색용)
create index idx_newsletters_keywords on newsletters using gin (all_keywords);
```

### 4.3 Schema (`public.issue_tracks`)

```sql
create table public.issue_tracks (
  id uuid not null default gen_random_uuid(),
  keyword text not null,              -- 추적 키워드 (예: "의대 증원")
  display_title text not null,        -- 화면 표시 제목
  is_active boolean not null default true,
  last_report_html text,              -- AI 생성 리포트 HTML
  last_report_data jsonb,             -- API 접근용 구조화 데이터
  last_updated_at timestamp with time zone default now(),
  created_at timestamp with time zone not null default now(),
  constraint issue_tracks_pkey primary key (id),
  constraint issue_tracks_keyword_key unique (keyword)
);
```

### 4.4 Schema (`public.payment_intent_logs`)

```sql
create table public.payment_intent_logs (
  id uuid not null default gen_random_uuid(),
  issue_track_id uuid references issue_tracks(id),
  target_issue text not null,         -- 클릭한 이슈 키워드
  ip_address inet,
  user_agent text,
  referrer text,
  clicked_at timestamp with time zone not null default now(),
  constraint payment_intent_logs_pkey primary key (id)
);
```

### 4.5 Security Policy (RLS)

- **Frontend (Anon Key):** INSERT only (subscribers), SELECT only (newsletters, issue_tracks)
- **Backend (Service Role Key):** SELECT, UPDATE all. (모든 데이터 접근 가능)

---

## 5. Key Features (Content Structure)

### Part 1. Protection Log (방어 로그)

- **목적:** Isolation의 가시화.
- **형태:**
  > "오늘 AI가 총 2,450건을 스캔하여 **살인/범죄 120건, 정치비방 340건**을 차단했습니다."

### Part 2. Headline Detox & Micro-Briefing (뉴스 중화)

- **목적:** Anchoring. 클릭 없이 맥락 이해.
- **구성:**
  - **[AI 수정]** 삼성전자, 업황 둔화로 52주 신저가 기록 (건조한 톤)
  - **3-Line Insight:** Fact / Context / Implication

### Part 3. Editorial Synthesis (사설 통합)

- **목적:** 편향 제거 및 구조적 쟁점 파악.
- **로직:** 보수 vs 진보 사설 매칭 -> AI가 **[쟁점 - 양측 논리 - 구조적 본질]** 리포트 작성.

### Part 4. Hidden Feature (Unsubscribe)

- **목적:** 사용자의 자유 의지 존중 및 스팸 처리 방지.
- **구현:** 이메일 Footer에 개별 수신 거부 링크 제공 -> Next.js `/unsubscribe` 페이지로 연결.

### Part 5. Issue Deep Dive (이슈 심층 분석) - NEW

- **목적:** Pre-baked AI 리포트로 이슈의 시간적 흐름 파악
- **데이터 흐름:**
  1. 관리자가 `issue_tracks`에 키워드 등록
  2. 매일 뉴스레터 발송 후, 관련 뉴스가 있으면 리포트 자동 갱신
  3. 프론트엔드에서 미리 생성된 HTML 즉시 렌더링
- **Fake Door 테스트:** 프리미엄 콘텐츠 버튼 클릭 시 `payment_intent_logs` 기록

```
[관리자] → issue_tracks 테이블에 키워드 등록
                ↓
[Daily Cron] → 뉴스레터 발송 완료
                ↓
[Worker] → 새 뉴스에서 키워드 추출 → newsletters.all_keywords 저장
                ↓
[Worker] → 활성 이슈 중 새 뉴스 있으면 → AI 리포트 재생성
                ↓
[Frontend] → 사용자가 이슈 클릭 → last_report_html 즉시 표시
                ↓
[Frontend] → "프리미엄" 버튼 클릭 → payment_intent_logs 기록 → 무료 공개
```

---

## 6. Data & AI Strategy

### 6.1 Data Collection

- **Source:** Google News RSS (Topics + Custom Queries)
- **Libraries:** `rss-parser`, `axios`, `cheerio`
- **Constants:** `constants.ts`에 정의된 RSS URL 활용.

### 6.2 AI Prompt Engineering (Gemini 2.5 Flash)

- **Role 1 (Filter/Detox):** `isToxic` 판별 및 건조한 제목 재작성.
- **Role 2 (Synthesis):** 사설 비교 분석. 감정적 어휘 삭제, 논리적 쟁점 추출.
- **Role 3 (Keywords):** 뉴스 목록에서 이슈 추적용 키워드 추출 (고유명사 우선, 지속 추적 가능한 이슈).

### 6.3 Gemini API 구성

| 환경       | 요금제        | 비고                                      |
| ---------- | ------------- | ----------------------------------------- |
| Production | Pay-as-you-go | `GEMINI_API_KEY` 사용, 사용량 기반 과금   |
| Dev        | Free Tier     | `GEMINI_API_KEY_DEV` 사용, 일일 20회 제한 |

### 6.4 AI 에러 처리 및 재시도

- **재시도 메커니즘:** 모든 AI API 호출에 exponential backoff 적용 (1초 → 2초 → 4초, 최대 3회)
- **Fallback 처리:** 3회 재시도 후에도 실패 시 기본값 사용, `isFallback: true` 플래그 설정
- **메트릭 구분:** 성공/Fallback/실패를 분리하여 로그 출력

---

## 7. Development Roadmap (Updated)

### Phase 1: Landing Page & DB (Completed)

- [x] Supabase 프로젝트 생성 및 `subscribers` 테이블 구축.
- [x] RLS 정책 설정 (Anon: Insert Only).
- [x] Next.js 프로젝트 생성 (NoCan-News-Web).
- [x] 랜딩 페이지 디자인 (Digital Brutalism) 및 구독 폼 연동.
- [x] Vercel 배포 완료.

### Phase 2: Worker Logic Implementation (Current)

- [x] NestJS 프로젝트 (NoCan-News-Worker) DB 연동 (Supabase Client 주입).
- [x] `rss-parser` 및 Google News 수집 로직 구현.
- [x] Gemini API 연동 및 프롬프트 튜닝 (Filter/Detox).
- [x] Nodemailer 템플릿 작성 (Unsubscribe 링크 포함).

### Phase 3: Automation & Launch

- [x] GitHub Actions 워크플로우 작성 (`cron: '0 22 * * *'`).
- [x] 실제 이메일 발송 테스트 (Whitelist).
- [x] Service Launch (MVP Open).

### Phase 4: Issue Tracking Feature (Current)

- [x] DB 마이그레이션 (`newsletters.all_keywords`, `issue_tracks`, `payment_intent_logs`)
- [x] AI 키워드 추출 로직 (`ai.service.ts`)
- [x] Issue Tracking 모듈 (`src/modules/issue-tracking/`)
- [x] 키워드 백필 스크립트 (`scripts/backfill-keywords.ts`)
- [ ] 프론트엔드 이슈 리스트/상세 페이지 (NoCan-News-Web)
- [ ] Fake Door 테스트 UI 구현

---

## 8. 실행 모드

### 8.1 NPM Scripts

| 스크립트             | AI   | 이메일 | 리포트 | 용도             |
| -------------------- | ---- | ------ | ------ | ---------------- |
| `npm run dev`        | Mock | Skip   | O      | 빠른 로컬 테스트 |
| `npm run dev:ai`     | Real | Skip   | O      | AI 품질 확인     |
| `npm run start:prod` | Real | Send   | X      | 프로덕션         |

### 8.2 환경 변수

| 변수                 | 기본값 | 설명                                 |
| -------------------- | ------ | ------------------------------------ |
| `DEV_MODE`           | false  | 개발 모드 (리포트 생성, verbose log) |
| `DEV_AI_ENABLED`     | false  | dev mode에서 AI 활성화               |
| `NEWSLETTER_DRY_RUN` | false  | 이메일 발송 스킵                     |
| `GEMINI_API_KEY`     | -      | 프로덕션 Gemini API 키               |
| `GEMINI_API_KEY_DEV` | -      | 개발용 Gemini API 키                 |

### 8.3 Quality Gate (품질 게이트)

뉴스레터 발송 전 품질 검증 기준:

| 검증 항목       | 기준                     | 실패 시 동작     |
| --------------- | ------------------------ | ---------------- |
| 뉴스 개수       | 8개 이상                 | 이메일 발송 중단 |
| 스크래핑 성공률 | 60% 이상                 | 이메일 발송 중단 |
| AI 인사이트     | 실패 시 해당 기사만 제외 | 계속 진행        |
| 사설 매칭       | 선택 사항                | 없어도 발송      |

### 8.4 Selection Report (AI 선별 리포트)

DEV_MODE에서 자동 생성되는 HTML 리포트:

- 위치: `reports/selection-report-YYYY-MM-DD-HHMM.html`
- 내용: 카테고리별 전체 기사 목록 + AI 선별 결과 + 필터링 통계
- 용도: AI 선별 품질 확인

### 8.5 Issue Tracking 스크립트

| 스크립트 | 용도 |
|----------|------|
| `npx ts-node scripts/backfill-keywords.ts` | 기존 뉴스레터에 키워드 소급 적용 |

**백필 스크립트 환경 변수:**
- `SUPABASE_URL`, `SUPABASE_SECRET_KEY`: 필수
- `GEMINI_API_KEY`: AI 키워드 추출용
