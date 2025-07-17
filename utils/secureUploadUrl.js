export const attachSecureUrl = (baseUrl, fileKey) => {
  return `${baseUrl}/uploads/files/${encodeURIComponent(fileKey)}`;
};

export const addSecureUrlsToList = (items, baseUrl, key = 'url') => {
  return items.map((item) => {
    const plain = item.toJSON?.() || item;
    if (plain[key]) {
      plain.secureUrl = attachSecureUrl(baseUrl, plain[key]);
    }
    return plain;
  });
};