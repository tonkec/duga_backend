export const attachSecureUrl = (baseUrl, fileKey) => {
  return `${baseUrl}/uploads/files/${encodeURIComponent(fileKey)}`;
};

export const addSecureUrlsToList = (items, baseUrl, key = 'url') => {
  return items.map((item) => {
    const plain = item.toJSON?.() || item;
    const value = plain[key];

    // ⛔ Skip if it's already a full URL
    if (value && !value.startsWith('http')) {
      plain.securePhotoUrl = attachSecureUrl(baseUrl, value);
    } else {
      plain.securePhotoUrl = null; // Or just leave it undefined
    }

    return plain;
  });
};


export const extractKeyFromUrl = (url) => {
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