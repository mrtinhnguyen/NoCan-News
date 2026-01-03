import { Injectable } from '@nestjs/common';
import { mockRssData, mockEditorials } from '../fixtures/rss-data.fixture';

@Injectable()
export class MockRssService {
  private scenario: 'success' | 'insufficient' = 'success';

  setScenario(scenario: 'success' | 'insufficient') {
    this.scenario = scenario;
  }

  async fetchAllCategories() {
    console.log(`[MockRssService] fetchAllCategories (${this.scenario})`);
    return mockRssData[this.scenario];
  }

  async fetchEditorials(type: 'conservative' | 'liberal') {
    console.log(`[MockRssService] fetchEditorials (${type})`);
    return mockEditorials[type];
  }
}
