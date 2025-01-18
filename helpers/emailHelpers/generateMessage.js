exports.generateMessage = (token, toUser, subject, text, url, html, port) => {
  const hostUrl = `${process.env.APP_URL}`;
  const msg = {
    to: toUser,
    from: 'antonija1023@gmail.com',
    subject: subject,
    text: text,
    html: `${html}: ${hostUrl}:${port}/${url}?token=${token}&email=${toUser}`,
  };

  return msg;
};
