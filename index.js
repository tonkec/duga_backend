const express = require('express');
const config = require('./config/app');
const router = require('./router');
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const http = require('http');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(router);
app.use(express.static(__dirname + '/public'));
app.use(express.static(__dirname + '/uploads'));

const port = process.env.PORT || config.appPort;

const server = http.createServer(app);
const SocketServer = require('./socket');
SocketServer(server, app);

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
