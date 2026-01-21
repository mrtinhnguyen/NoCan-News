/**
 * Exponential backoff를 사용한 재시도 유틸리티
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * 함수 실행에 실패하면 exponential backoff로 재시도
 *
 * @param fn 실행할 비동기 함수
 * @param options 재시도 옵션
 * @returns 성공 시 함수 반환값
 * @throws 모든 재시도 실패 시 마지막 에러
 *
 * @example
 * const result = await withRetry(
 *   () => apiCall(),
 *   { maxRetries: 3, baseDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries, baseDelayMs, onRetry } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 마지막 시도였으면 더 이상 재시도하지 않음
      if (attempt > maxRetries) {
        break;
      }

      // 재시도 콜백 호출
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Exponential backoff: 1초 → 2초 → 4초
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * 지정된 시간(ms) 동안 대기
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
