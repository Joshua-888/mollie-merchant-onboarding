import { resolveClientLinkHref } from './mollie.mapper';
import { MollieClientLinkResponseDto } from './mollie.types';

describe('mollie.mapper', () => {
  describe('resolveClientLinkHref', () => {
    it('reads authorize URL from _links.clientLink.href', () => {
      const dto: MollieClientLinkResponseDto = {
        resource: 'client-link',
        id: 'cl_abc123',
        _links: {
          clientLink: {
            href: 'https://my.mollie.com/dashboard/client-link/cl_abc123',
            type: 'text/html',
          },
        },
      };

      expect(resolveClientLinkHref(dto)).toBe(
        'https://my.mollie.com/dashboard/client-link/cl_abc123',
      );
    });

    it('returns undefined when link is missing', () => {
      const dto: MollieClientLinkResponseDto = {
        resource: 'client-link',
        id: 'cl_abc123',
        _links: {} as MollieClientLinkResponseDto['_links'],
      };

      expect(resolveClientLinkHref(dto)).toBeUndefined();
    });
  });
});
