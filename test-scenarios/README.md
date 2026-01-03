# 테스트 시나리오 실행 가이드

NoCan News의 품질 게이트 및 메트릭 기능을 실제 AI/RSS/DB 호출 없이 테스트하는 시뮬레이터입니다.

## 설치

```bash
cd test-scenarios
npm install
```

## 실행 방법

### 개별 시나리오 실행

```bash
npm run scenario 1   # 시나리오 1: 정상 발송
npm run scenario 2   # 시나리오 2: 뉴스 부족
npm run scenario 3   # 시나리오 3: 스크래핑 실패
npm run scenario 4   # 시나리오 4: AI 인사이트 실패
npm run scenario 5   # 시나리오 5: 사설 누락
```

### 모든 시나리오 실행

```bash
npm run scenario all
```

## 시나리오 설명

### 시나리오 1: 정상 발송 ✅
- **목적**: 모든 단계가 정상적으로 작동하는 케이스
- **결과**: 품질 게이트 통과 → 이메일 발송
- **확인 사항**: 메트릭 출력에서 "Quality Gate: ✅ PASSED" 확인

### 시나리오 2: 뉴스 부족 ❌
- **목적**: 최종 뉴스 개수가 8개 미만인 케이스
- **원인**: RSS 부족 + AI 인사이트 일부 실패
- **결과**: 품질 게이트 실패 → 발송 중단
- **확인 사항**: "Insufficient news count: X < 8" 메시지 확인

### 시나리오 3: 스크래핑 실패 ❌
- **목적**: 스크래핑 성공률이 60% 미만인 케이스
- **원인**: 본문 추출 실패
- **결과**: 품질 게이트 실패 → 발송 중단
- **확인 사항**: "Low scraping success rate: 50.0% < 60%" 메시지 확인

### 시나리오 4: AI 인사이트 실패 ⚠️
- **목적**: 인사이트 생성 실패로 기사 일부 제외
- **특징**: 랜덤 실패이므로 결과가 매번 다를 수 있음
- **결과**: 운에 따라 통과/실패 (경계 케이스)
- **확인 사항**: "Insight generation failed for..." 경고 로그 확인

### 시나리오 5: 사설 누락 ✅
- **목적**: 사설이 없어도 뉴스레터는 발송되는지 확인
- **결과**: 품질 게이트 통과 → 이메일 발송 (사설 섹션 없이)
- **확인 사항**: "Match Found: No" 확인

## 메트릭 확인

각 시나리오 실행 후 다음 메트릭이 출력됩니다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Newsletter Generation Metrics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📰 RSS Collection:
   Total Scanned: 312
   Business: 78
   Tech: 82
   Policy: 75
   World: 77

🤖 AI Selection (Toxicity Filter):
   Total Filtered: 312
   Toxic Blocked: 45 (Crime: 12, Gossip: 18, Political: 15)
   Selected: 12

📄 Scraping:
   Attempted: 12
   Succeeded: 10
   Success Rate: 83.3%

💡 AI Insights:
   Attempted: 10
   Succeeded: 9
   Failed (Excluded): 1

📝 Editorial Analysis:
   Match Found: Yes
   Synthesis Success: Yes

✨ Final Result:
   News Count: 9
   Quality Gate: ✅ PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 커스텀 시나리오 추가

새로운 시나리오를 추가하려면:

1. `/scenarios/scenario-6-custom.ts` 파일 생성
2. `runScenario()` 함수로 mock 설정
3. `/run-scenario.ts`에 시나리오 등록

```typescript
// scenario-6-custom.ts
export async function scenario6() {
  await runScenario({
    name: '커스텀 시나리오',
    mocks: {
      rss: { scenario: 'success' },
      ai: { selectionMode: 'success', insightFailureRate: 0.2 },
      scraper: { successRate: 0.9 },
    },
  });
}
```

## 트러블슈팅

### "Cannot find module" 에러
- `npm install` 실행 확인
- `tsconfig.json`의 paths 설정 확인

### Mock 서비스 동작 안 함
- Mock 클래스가 실제 서비스 인터페이스와 일치하는지 확인
- NestJS 의존성 주입이 올바른지 확인

## 추가 참고

- Mock 데이터 수정: `/fixtures/*.fixture.ts`
- Mock 서비스 수정: `/mocks/*.service.ts`
- 시나리오 로직 수정: `/scenarios/*.scenario.ts`
