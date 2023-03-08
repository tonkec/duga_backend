require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const { generateMessage } = require('./generateMessage');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendResetPasswordEmail = (toUser, token) => {
  const subject = 'Ne možeš se sjetit svoje lozinke?';
  const text = 'Šaljemo ti link za novu lozinku';
  const url = 'forgot-password';
  const html = 'Klikni ovaj link da napraviš novu lozinku';
  const msg = generateMessage(token, toUser, subject, text, url, html);

  sgMail.send(msg).then(
    (data) => {
      console.log(data);
    },
    (error) => {
      console.error(error);
      if (error.response) {
        console.error(error.response.body);
      }
    }
  );
};
