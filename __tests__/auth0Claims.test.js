const { getAuth0IdentityClaims } = require('../utils/auth0Claims');

describe('getAuth0IdentityClaims', () => {
  it('reads standard Auth0 identity claims', () => {
    expect(
      getAuth0IdentityClaims({
        sub: 'auth0|user-1',
        email: 'user@example.com',
        email_verified: true,
      })
    ).toEqual({
      sub: 'auth0|user-1',
      email: 'user@example.com',
      email_verified: true,
    });
  });

  it('reads namespaced Auth0 profile claims from access tokens', () => {
    expect(
      getAuth0IdentityClaims({
        sub: 'auth0|user-1',
        'https://duga.app/email': 'user@example.com',
        'https://duga.app/email_verified': false,
      })
    ).toEqual({
      sub: 'auth0|user-1',
      email: 'user@example.com',
      email_verified: false,
    });
  });
});
