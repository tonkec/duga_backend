const attachSecureUrl = (baseUrl, fileKey) => {
  return `${baseUrl}/uploads/files/${encodeURIComponent(fileKey)}`;
};

const addSecureUrlsToList = (items, baseUrl, key = 'url', outputKey = 'securePhotoUrl') => {
  return items.map((item) => {
    const plain = item.toJSON?.() || item;
    const value = plain[key];

    if (value && !value.startsWith('http')) {
      plain[outputKey] = attachSecureUrl(baseUrl, value);
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
}

module.exports = {
  attachSecureUrl,
  addSecureUrlsToList,
  extractKeyFromUrl,
};