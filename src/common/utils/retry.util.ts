/**
 * Tiện ích thử lại sử dụng Exponential backoff
 */

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Thử lại với exponential backoff nếu hàm thực thi thất bại
 *
 * @param fn Hàm bất đồng bộ cần thực thi
 * @param options Tùy chọn thử lại
 * @returns Giá trị trả về của hàm khi thành công
 * @throws Lỗi cuối cùng nếu tất cả các lần thử lại đều thất bại
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

      // Không thử lại nếu là lần thử cuối cùng
      if (attempt > maxRetries) {
        break;
      }

      // Gọi callback thử lại
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Exponential backoff: 1s → 2s → 4s
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Chờ trong khoảng thời gian chỉ định (ms)
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
