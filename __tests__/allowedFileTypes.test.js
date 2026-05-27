const allowedMimeTypes = require('../consts/allowedFileTypes');

describe('allowed image upload types', () => {
  it('rejects SVG uploads everywhere the shared allowlist is used', () => {
    expect(allowedMimeTypes).toEqual(['image/png', 'image/jpg', 'image/jpeg']);
    expect(allowedMimeTypes).not.toContain('image/svg+xml');
  });
});
