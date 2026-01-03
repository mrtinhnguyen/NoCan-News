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

---

## 8. Testing Strategy

### 8.1 Test Simulator (Mock-based Scenarios)

**Location:** `/test-scenarios/`

뉴스레터 생성 파이프라인을 실제 AI/RSS/DB 호출 없이 테스트할 수 있는 시뮬레이터.

**주요 구성요소:**
- **Fixtures:** Mock 데이터 (RSS, AI 응답, 스크래핑 결과, 구독자 목록)
- **Mocks:** Mock 서비스 (AiService, RssService, ScraperService, EmailService)
- **Scenarios:** 5가지 시나리오 (정상, 뉴스 부족, 스크래핑 실패, 인사이트 실패, 사설 누락)

**실행 방법:**
```bash
# 개별 시나리오 실행
npm run scenario 1   # 정상 발송
npm run scenario 2   # 뉴스 부족 (품질 게이트 차단)
npm run scenario 3   # 스크래핑 실패 (품질 게이트 차단)
npm run scenario 4   # AI 인사이트 실패 (경계 케이스)
npm run scenario 5   # 사설 누락 (정상 발송)

# 전체 시나리오 실행
npm run scenario all
```

### 8.2 Quality Gate (품질 게이트)

뉴스레터 발송 전 품질 검증 기준:

| 검증 항목 | 기준 | 실패 시 동작 |
|-----------|------|-------------|
| 뉴스 개수 | 8개 이상 | 이메일 발송 중단 |
| 스크래핑 성공률 | 60% 이상 | 이메일 발송 중단 |
| AI 인사이트 | 실패 시 해당 기사만 제외 | 계속 진행 |
| 사설 매칭 | 선택 사항 | 없어도 발송 |

### 8.3 Development Workflow

**⚠️ IMPORTANT: 새로운 기능 추가 시 필수 작업**

1. **인터페이스 변경 시:**
   - `src/common/interfaces/` 수정 후 반드시 해당 Mock fixture 업데이트
   - 예: `SelectionResult` 변경 → `test-scenarios/fixtures/ai-responses.fixture.ts` 수정

2. **서비스 로직 변경 시:**
   - Mock 서비스의 메서드 시그니처 동기화 필수
   - 예: `AiService.selectNewsForCategory()` 변경 → `MockAiService` 동일하게 수정

3. **새로운 실패 케이스 추가 시:**
   - `/test-scenarios/scenarios/` 에 새 시나리오 추가
   - `/test-scenarios/run-scenario.ts` 에 시나리오 등록

4. **품질 게이트 기준 변경 시:**
   - `NewsletterService.validateQualityGate()` 수정
   - 관련 시나리오의 `expectedResult` 업데이트

**테스트 실행 주기:**
- 기능 추가/수정 후 즉시 `npm run scenario all` 실행
- PR 생성 전 필수 검증
- GitHub Actions에서 자동 실행 (추후 추가 예정)

**Mock 데이터 관리:**
- Fixture는 실제 인터페이스와 100% 일치해야 함
- TypeScript 컴파일 에러 발생 시 즉시 수정
- Mock 데이터는 실제 API 응답을 최대한 반영
