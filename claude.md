# Project: NoCan News (News Noise Canceling)

## 1. Project Overview

- **Description:** 불안을 파는 뉴스를 차단하고, 안도감과 통찰을 파는 이메일 큐레이션 서비스.
- **Core Value:** "세상의 소음은 끄고, 구조적 맥락만 남긴다 (Noise Off, Context On)."
- **Target Audience:** 자극적인 정보에 지쳤지만, 세상의 흐름은 놓치고 싶지 않은 지적 욕구가 있는 개인.
- **Platform:**
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

| 구분 | 역할 | 저장소명 (예시) | 기술 스택 | 배포 환경 |
|------|------|----------------|-----------|-----------|
| Consumer | Frontend (Web) | NoCan-News-Web | Next.js, Tailwind CSS | Vercel (Serverless) |
| Producer | Backend (Worker) | NoCan-News-Worker | NestJS (Standalone) | GitHub Actions (Cron) |
| Storage | Database | (Common Resource) | Supabase (PostgreSQL) | Cloud Hosted |

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

### 4.2 Security Policy (RLS)

- **Frontend (Anon Key):** INSERT only. (누구나 구독 신청 가능, 조회 불가)
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

---

## 6. Data & AI Strategy

### 6.1 Data Collection

- **Source:** Google News RSS (Topics + Custom Queries)
- **Libraries:** `rss-parser`, `axios`, `cheerio`
- **Constants:** `constants.ts`에 정의된 RSS URL 활용.

### 6.2 AI Prompt Engineering (Gemini 2.5 Flash)

- **Role 1 (Filter/Detox):** `isToxic` 판별 및 건조한 제목 재작성.
- **Role 2 (Synthesis):** 사설 비교 분석. 감정적 어휘 삭제, 논리적 쟁점 추출.

### 6.3 Gemini API Limits (Free Tier)

| 제한 항목 | 값 |
|-----------|-----|
| 분당 최대 요청 수 | 5 |
| 분당 최대 입력 토큰 수 | 250k |
| 일일 최대 요청 수 | 20 |

---

## 7. Development Roadmap (Updated)

### Phase 1: Landing Page & DB (Completed)

- [x] Supabase 프로젝트 생성 및 `subscribers` 테이블 구축.
- [x] RLS 정책 설정 (Anon: Insert Only).
- [x] Next.js 프로젝트 생성 (NoCan-News-Web).
- [x] 랜딩 페이지 디자인 (Digital Brutalism) 및 구독 폼 연동.
- [x] Vercel 배포 완료.

### Phase 2: Worker Logic Implementation (Current)

- [ ] NestJS 프로젝트 (NoCan-News-Worker) DB 연동 (Supabase Client 주입).
- [ ] `rss-parser` 및 Google News 수집 로직 구현.
- [ ] Gemini API 연동 및 프롬프트 튜닝 (Filter/Detox).
- [ ] Nodemailer 템플릿 작성 (Unsubscribe 링크 포함).

### Phase 3: Automation & Launch

- [ ] GitHub Actions 워크플로우 작성 (`cron: '0 22 * * *'`).
- [ ] 실제 이메일 발송 테스트 (Whitelist).
- [ ] Service Launch (MVP Open).
