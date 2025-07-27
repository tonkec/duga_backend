
const { checkJwt } = require('../middleware/auth');
const router = require('express').Router();
const attachCurrentUser = require("../middleware/attachCurrentUser");
const handleUpvoteUpload = require('./likes/handlers/handleUpvoteUpload');
const handleDownvoteUpload = require('./likes/handlers/handleDownvoteUpload');
const handleGetAllUploadLikes = require('./likes/handlers/handleGetAllUploadLikes');

require('./likes/swagger/upvote.swagger');
router.post('/upvote/:id', [checkJwt, attachCurrentUser], handleUpvoteUpload);

require('./likes/swagger/downvote.swagger');
router.post('/downvote/:id', [checkJwt, attachCurrentUser], handleDownvoteUpload);


require('./likes/swagger/allLikes.swagger');
router.get('/all-likes/:photoId', [checkJwt], handleGetAllUploadLikes);


module.exports = router;
