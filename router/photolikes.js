
const router = require('express').Router();
const { authenticatedAppSession } = require('../middleware/authenticatedAppSession');
const handleUpvoteUpload = require('./likes/handlers/handleUpvoteUpload');
const handleDownvoteUpload = require('./likes/handlers/handleDownvoteUpload');
const handleGetAllUploadLikes = require('./likes/handlers/handleGetAllUploadLikes');

require('./likes/swagger/upvote.swagger');
router.post('/upvote/:id', authenticatedAppSession, handleUpvoteUpload);

require('./likes/swagger/downvote.swagger');
router.post('/downvote/:id', authenticatedAppSession, handleDownvoteUpload);

require('./likes/swagger/allLikes.swagger');
router.get('/all-likes/:photoId', authenticatedAppSession, handleGetAllUploadLikes);


module.exports = router;
