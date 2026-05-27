const { Transform } = require('stream');
const path = require('path');

const SVG_CONTENT_TYPE = 'image/svg+xml';
const SVG_CSP =
  "default-src 'none'; script-src 'none'; style-src 'none'; sandbox";

const isSvgFile = (file = {}) =>
  file.mimetype === SVG_CONTENT_TYPE ||
  path.extname(file.originalname || '').toLowerCase() === '.svg';

const isSvgKey = (key = '') =>
  path.extname(String(key)).toLowerCase() === '.svg';

const sanitizeSvg = (input) => {
  let svg = Buffer.isBuffer(input)
    ? input.toString('utf8')
    : String(input || '');

  svg = svg.replace(/^\uFEFF/, '').trim();

  if (!/<svg[\s>]/i.test(svg)) {
    throw new Error('Invalid SVG');
  }

  if (/<!doctype|<!entity/i.test(svg)) {
    throw new Error('Unsafe SVG');
  }

  svg = svg
    .replace(/<\?(?!xml\b)[\s\S]*?\?>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(
      /<(script|foreignObject|iframe|object|embed|link|style|audio|video|source|canvas)\b[\s\S]*?<\/\1>/gi,
      ''
    )
    .replace(
      /<(script|foreignObject|iframe|object|embed|link|style|audio|video|source|canvas)\b[^>]*\/?>/gi,
      ''
    )
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+style\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(
      /\s+(href|src|xlink:href)\s*=\s*(["']?)\s*(javascript:|data:|https?:|\/\/)[^"'\s>]*\2/gi,
      ''
    );

  return Buffer.from(svg, 'utf8');
};

const createSvgSanitizerStream = () => {
  const chunks = [];

  return new Transform({
    transform(chunk, encoding, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
    flush(callback) {
      try {
        this.push(sanitizeSvg(Buffer.concat(chunks)));
        callback();
      } catch (error) {
        callback(error);
      }
    },
  });
};

const buildContentDisposition = (key) => {
  const filename = path.basename(String(key || 'image.svg')).replace(/"/g, '');
  return `attachment; filename="${filename}"`;
};

const applySvgResponseHeaders = (res, key) => {
  res.setHeader('Content-Type', `${SVG_CONTENT_TYPE}; charset=utf-8`);
  res.setHeader('Content-Disposition', buildContentDisposition(key));
  res.setHeader('Content-Security-Policy', SVG_CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

module.exports = {
  SVG_CONTENT_TYPE,
  SVG_CSP,
  applySvgResponseHeaders,
  createSvgSanitizerStream,
  isSvgFile,
  isSvgKey,
  sanitizeSvg,
};
