const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_ESCAPE_PATTERN = /[&<>"']/g;

const sanitizePlainText = (value) => {
  if (typeof value !== 'string') return value;

  return value
    .trim()
    .replace(HTML_ESCAPE_PATTERN, (character) => HTML_ESCAPE_MAP[character]);
};

module.exports = {
  sanitizePlainText,
};
