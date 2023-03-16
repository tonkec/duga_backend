require('dotenv').config();
const sgMail = require('@sendgrid/mail');
const { generateMessage } = require('../emailHelpers/generateMessage');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.sendVerificationEmail = (toUser, token) => {
  const subject = 'Dobro došao_la na Dugu';
  const text = 'predivnu aplikaciju za upoznavanje novih ljudi';
  const url = 'verification';
  const html = 'Klikni ovaj link da potvrdiš svoj mail';
  const environment = process.env.NODE_ENV || 'development';
  const port = environment === 'development' ? `:${process.env.APP_PORT}` : '';
  const msg = generateMessage(token, toUser, subject, text, url, html, port);

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
