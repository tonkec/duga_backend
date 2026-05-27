const { Writable } = require('stream');

jest.mock('../utils/s3', () => ({
  getObject: jest.fn(),
}));

jest.mock('../models', () => ({
  Upload: {
    findOne: jest.fn(),
  },
  PhotoComment: {
    findOne: jest.fn(),
  },
  Message: {
    findOne: jest.fn(),
  },
}));

const { Readable } = require('stream');
const { Upload, PhotoComment, Message } = require('../models');
const s3 = require('../utils/s3');
const streamS3File = require('../router/uploads/utils/streamS3File');
const { SVG_CSP, sanitizeSvg } = require('../utils/svgSecurity');

const buildResponse = () => {
  const res = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });
  res.headers = {};
  res.setHeader = jest.fn((key, value) => {
    res.headers[key] = value;
  });
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('SVG security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    Upload.findOne.mockResolvedValue(null);
    PhotoComment.findOne.mockResolvedValue(null);
    Message.findOne.mockResolvedValue(null);
    s3.getObject.mockReturnValue({
      createReadStream: () => Readable.from(['<svg></svg>']),
    });
  });

  it('sanitizes scripts, event handlers, and remote links from SVG input', () => {
    const sanitized = sanitizeSvg(`
      <svg onload="alert(1)">
        <script>alert(1)</script>
        <a href="javascript:alert(1)">bad</a>
        <image href="https://evil.example/pixel.png" />
        <circle style="background:url(https://evil.example)" />
      </svg>
    `).toString('utf8');

    expect(sanitized).not.toContain('<script');
    expect(sanitized).not.toContain('onload');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('https://evil.example');
    expect(sanitized).not.toContain('style=');
  });

  it('rejects SVG documents with doctypes or entities', () => {
    expect(() =>
      sanitizeSvg(
        '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg />'
      )
    ).toThrow('Unsafe SVG');
  });

  it('serves SVG with attachment disposition and strict CSP', async () => {
    const res = buildResponse();
    Upload.findOne.mockResolvedValue({
      url: 'test/user/1/avatar.svg',
      filetype: 'image/svg+xml',
    });

    await streamS3File('test/user/1/avatar.svg', res);

    expect(res.headers['Content-Type']).toBe('image/svg+xml; charset=utf-8');
    expect(res.headers['Content-Disposition']).toBe(
      'attachment; filename="avatar.svg"'
    );
    expect(res.headers['Content-Security-Policy']).toBe(SVG_CSP);
    expect(res.headers['X-Content-Type-Options']).toBe('nosniff');
  });
});
