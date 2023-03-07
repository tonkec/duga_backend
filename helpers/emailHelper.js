require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendVerificationEmail = (toUser, token) => {
  const environment = process.env.NODE_ENV || 'development';
  const port = environment === 'development' ? `:${process.env.APP_PORT}` : '';
  const hostUrl = `${process.env.APP_URL}`;
  const msg = {
    to: toUser,
    from: 'admin@duga.app',
    subject: 'Dobro došao_la na Dugu',
    text: 'na predivnu aplikaciju gdje možeš upoznati zanimljive ljude',
    html: `Klikni ovaj link da potvrdiš svoj email: ${hostUrl}${port}/verification?token=${token}&email=${toUser}`,
  };

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
