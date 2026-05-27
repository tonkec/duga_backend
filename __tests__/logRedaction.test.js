const { REDACTED, redactForLogs } = require('../utils/logRedaction');

describe('log redaction', () => {
  it('redacts authorization fields and bearer strings', () => {
    expect(
      redactForLogs({
        headers: {
          authorization: 'Bearer real-token',
          cookie: 'session=secret',
        },
        message: 'request failed with Bearer another-token',
      })
    ).toEqual({
      headers: {
        authorization: REDACTED,
        cookie: REDACTED,
      },
      message: `request failed with Bearer ${REDACTED}`,
    });
  });

  it('redacts token query strings from logged URLs', () => {
    expect(
      redactForLogs(
        '/uploads/files/photo.jpg?access_token=secret-token&size=large'
      )
    ).toBe(`/uploads/files/photo.jpg?access_token=${REDACTED}&size=large`);
  });

  it('redacts axios-style errors before logging', () => {
    const error = new Error('Request failed with Bearer request-token');
    error.config = {
      headers: {
        Authorization: 'Bearer config-token',
        'x-request-id': 'request-1',
      },
      url: 'https://example.com?client_secret=secret',
    };
    error.response = {
      status: 401,
      data: { access_token: 'response-token', detail: 'Unauthorized' },
      headers: { 'set-cookie': 'session=secret' },
    };

    expect(redactForLogs(error)).toMatchObject({
      message: `Request failed with Bearer ${REDACTED}`,
      config: {
        headers: {
          Authorization: REDACTED,
          'x-request-id': 'request-1',
        },
        url: `https://example.com?client_secret=${REDACTED}`,
      },
      response: {
        status: 401,
        data: { access_token: REDACTED, detail: 'Unauthorized' },
        headers: { 'set-cookie': REDACTED },
      },
    });
  });
});
