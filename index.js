const express = require('express');
const config = require('./config/app');
const router = require('./router');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const http = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerJSDoc = require('swagger-jsdoc');
const port = process.env.PORT || config.appPort;

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: { title: 'Duga API', version: '1.0.0' },
    servers: [{ url: `http://localhost:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./router/**/*.js'],
};

const swaggerDocs = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(router);
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/uploads'));


const server = http.createServer(app);
const SocketServer = require('./socket');
SocketServer(server, app);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
