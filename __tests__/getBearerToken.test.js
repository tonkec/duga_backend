const getBearerToken = require('../utils/getBearerToken');

describe('getBearerToken', () => {
  it('reads bearer tokens from the Authorization header', () => {
    expect(
      getBearerToken({
        headers: { authorization: 'Bearer header-token' },
        query: { access_token: 'query-token' },
      })
    ).toBe('header-token');
  });

  it('does not accept access_token query strings', () => {
    expect(
      getBearerToken({
        headers: {},
        query: { access_token: 'query-token' },
      })
    ).toBeNull();
  });
});
