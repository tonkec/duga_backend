const appendAccessToken = (url, accessToken) => {
  if (!accessToken || !url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}access_token=${encodeURIComponent(accessToken)}`;
};

const attachSecureUrl = (baseUrl, fileKey, accessToken) => {
  const url = `${baseUrl}/uploads/files/${encodeURIComponent(fileKey)}`;
  return appendAccessToken(url, accessToken);
};

const addSecureUrlsToList = (
  items,
  baseUrl,
  key = 'url',
  outputKey = 'securePhotoUrl',
  accessToken = null
) => {
  return items.map((item) => {
    const plain = item.toJSON?.() || item;
    const value = plain[key];

    if (value && !value.startsWith('http')) {
      plain[outputKey] = attachSecureUrl(baseUrl, value, accessToken);
    } else {
      plain[outputKey] = null;
    }

    return plain;
  });
};

const extractKeyFromUrl = (url) => {
  console.log('🔍 Extracting key from URL:', url);
  if (!url) return null;

  if (!url.startsWith('http')) return url;

  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch (e) {
    return null;
  }
};

module.exports = {
  appendAccessToken,
  attachSecureUrl,
  addSecureUrlsToList,
  extractKeyFromUrl,
};
