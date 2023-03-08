exports.generateMessage = (token, toUser, subject, text, url, html) => {
  const environment = process.env.NODE_ENV || 'development';
  const port = environment === 'development' ? `:${process.env.APP_PORT}` : '';
  const hostUrl = `${process.env.APP_URL}`;
  const msg = {
    to: toUser,
    from: 'admin@duga.app',
    subject: subject,
    text: text,
    html: `${html}: ${hostUrl}${port}/${url}?token=${token}&email=${toUser}`,
  };

  return msg;
};
