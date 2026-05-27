const { sanitizePlainText } = require('../utils/plainText');

describe('plain text sanitization', () => {
  it('escapes HTML-sensitive characters and trims user content', () => {
    expect(
      sanitizePlainText('  <img src=x onerror="alert(1)"> & \'test\'  ')
    ).toBe(
      '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;'
    );
  });
});
