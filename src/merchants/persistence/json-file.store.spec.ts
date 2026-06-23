import { reviveDates } from './json-file.store';

describe('json-file.store', () => {
  it('revives ISO date strings into Date objects', () => {
    const revived = reviveDates<{
      createdAt: Date;
      nested: { updatedAt: Date };
    }>({
      createdAt: '2026-06-23T10:00:00.000Z',
      nested: { updatedAt: '2026-06-23T11:00:00.000Z' },
    });

    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.nested.updatedAt).toBeInstanceOf(Date);
  });
});
