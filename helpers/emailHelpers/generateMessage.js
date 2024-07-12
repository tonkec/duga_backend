exports.generateMessage = (token, toUser, subject, text, url, html, port) => {
  const hostUrl = `${process.env.APP_URL}`;
  const msg = {
    to: toUser,
    from: 'admin@duga.app',
    subject: subject,
    text: text,
    html: `${html}: ${hostUrl}:${port}/${url}?token=${token}&email=${toUser}`,
  };

  return msg;
};
