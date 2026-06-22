import { mapCapabilities } from './mollie.capabilities.mapper';
import { MollieCapabilitiesResponseDto } from './mollie.types';

describe('mapCapabilities', () => {
  const sampleResponse: MollieCapabilitiesResponseDto = {
    count: 2,
    _embedded: {
      capabilities: [
        {
          resource: 'capability',
          name: 'payments',
          status: 'pending',
          requirements: [
            {
              id: 'provide-stakeholder-information',
              status: 'currently-due',
              dueDate: '2026-06-01',
              _links: {
                dashboard: {
                  href: 'https://my.mollie.com/dashboard/onboarding/stakeholders',
                  type: 'text/html',
                },
              },
            },
            {
              id: 'upload-identification',
              status: 'requested',
              dueDate: null,
              _links: {
                dashboard: {
                  href: 'https://my.mollie.com/dashboard/onboarding/id',
                  type: 'text/html',
                },
              },
            },
            {
              id: 'needs-data',
              status: 'completed',
            },
          ],
        },
        {
          resource: 'capability',
          name: 'settlements',
          status: 'disabled',
          requirements: [
            {
              id: 'add-bank-account',
              status: 'currently-due',
              _links: {
                dashboard: {
                  href: 'https://my.mollie.com/dashboard/onboarding/bank',
                  type: 'text/html',
                },
              },
            },
          ],
        },
      ],
    },
  };

  it('maps open requirements with Danish labels and dashboard links', () => {
    const summary = mapCapabilities(sampleResponse);

    expect(summary.payments.enabled).toBe(false);
    expect(summary.payments.status).toBe('pending');
    expect(summary.settlements.status).toBe('disabled');
    expect(summary.requirements).toHaveLength(3);

    const stakeholder = summary.requirements.find(
      (r) => r.requirementId === 'provide-stakeholder-information',
    );
    expect(stakeholder?.label).toContain('Ejerstruktur');
    expect(stakeholder?.dashboardUrl).toContain('stakeholders');

    const bank = summary.requirements.find((r) => r.requirementId === 'add-bank-account');
    expect(bank?.label).toContain('Bankkonto');
    expect(bank?.capabilityLabel).toBe('Udbetalinger');
  });

  it('ignores completed requirements and enabled capabilities', () => {
    const summary = mapCapabilities({
      count: 1,
      _embedded: {
        capabilities: [
          {
            resource: 'capability',
            name: 'payments',
            status: 'enabled',
            requirements: [
              { id: 'needs-data', status: 'completed' },
            ],
          },
        ],
      },
    });

    expect(summary.payments.enabled).toBe(true);
    expect(summary.requirements).toHaveLength(0);
  });

  it('humanizes unknown requirement IDs', () => {
    const summary = mapCapabilities({
      count: 1,
      _embedded: {
        capabilities: [
          {
            resource: 'capability',
            name: 'payments',
            status: 'pending',
            requirements: [{ id: 'custom-requirement-id', status: 'currently-due' }],
          },
        ],
      },
    });

    expect(summary.requirements[0].label).toContain('Custom Requirement Id');
  });
});
