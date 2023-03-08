require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const { generateMessage } = require('./generateMessage');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendResetPasswordEmail = (toUser) => {
  const subject = 'Ne možeš se sjetit svoje lozinke?';
  const text = 'Šaljemo ti link za novu lozinku';
  const url = 'reset-password';
  const html = 'Klikni ovaj link da napraviš novu lozinku';
  const port = process.env.APP_FRONTEND_PORT;

  const msg = generateMessage(
    undefined,
    toUser,
    subject,
    text,
    url,
    html,
    port
  );

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
