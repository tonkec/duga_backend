require('dotenv').config();
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendVerificationEmail = (toUser, token) => {
  const hostUrl = `${process.env.APP_URL}:${process.env.APP_PORT}`;
  const msg = {
    to: toUser,
    from: 'admin@duga.app', // Use the email address or domain you verified above
    subject: 'Dobro došao_la na Dugu',
    text: 'predivnu aplikaciju gdje možeš upoznati zanimljive ljude',
    html: `Click on this link to verify your email ${hostUrl}/verification?token=${token}&email=${toUser}`,
  };

  sgMail.send(msg).then(
    (data) => {
      console.log('data', data);
    },
    (error) => {
      console.error(error);

      if (error.response) {
        console.error(error.response.body);
      }
    }
  );
};
