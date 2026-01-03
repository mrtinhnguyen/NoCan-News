import { Injectable } from '@nestjs/common';
import { mockSubscribers } from '../fixtures/subscribers.fixture';

@Injectable()
export class MockSupabaseService {
  async getActiveSubscribers() {
    console.log(`[MockSupabaseService] getActiveSubscribers`);
    return mockSubscribers.filter((s) => s.is_active);
  }
}
