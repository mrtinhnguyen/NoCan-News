export interface MockSubscriber {
  id: string;
  email: string;
  is_active: boolean;
}

export const mockSubscribers: MockSubscriber[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'test1@example.com',
    is_active: true,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'test2@example.com',
    is_active: true,
  },
];
