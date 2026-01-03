/**
 * NestJS 테스트 모듈 빌더 (필요시 확장)
 */
import { Test, TestingModule } from '@nestjs/testing';

export async function buildMockModule(
  providers: any[],
): Promise<TestingModule> {
  return Test.createTestingModule({
    providers,
  }).compile();
}
