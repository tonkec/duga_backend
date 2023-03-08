exports.generateMessage = (token, toUser, subject, text, url, html, port) => {
  const tokenInUrl = typeof token === 'undefined' ? '' : `token=${token}&`;
  const hostUrl = `${process.env.APP_URL}`;
  const msg = {
    to: toUser,
    from: 'admin@duga.app',
    subject: subject,
    text: text,
    html: `${html}: ${hostUrl}:${port}/${url}?${tokenInUrl}email=${toUser}`,
  };

  return msg;
};
