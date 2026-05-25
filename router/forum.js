const express = require('express');
const router = express.Router();
const { Answer, Question } = require('../models');
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const uploadForumImage = require('./forum/s3/uploadForumImage');
const {
  handleAcceptAnswer,
  handleCreateAnswer,
  handleCreateQuestion,
  handleDeleteAnswer,
  handleDeleteAnswerImage,
  handleDeleteQuestion,
  handleDeleteQuestionImage,
  handleGetQuestionById,
  handleGetQuestions,
  handleRemoveAnswerVote,
  handleRemoveQuestionVote,
  handleUpdateAnswer,
  handleUpdateQuestion,
  handleVoteAnswer,
  handleVoteQuestion,
} = require('./forum/handlers');

router.get('/questions', authenticatedAppSession, handleGetQuestions);
router.get('/questions/:id', authenticatedAppSession, handleGetQuestionById);
router.post(
  '/questions',
  [...authenticatedAppSession, ...uploadForumImage('question')],
  handleCreateQuestion
);
router.patch(
  '/questions/:id',
  [
    ...authenticatedAppSession,
    withAccessCheck(Question),
    ...uploadForumImage('question'),
  ],
  handleUpdateQuestion
);
router.delete(
  '/questions/:id/image',
  [...authenticatedAppSession, withAccessCheck(Question)],
  handleDeleteQuestionImage
);
router.delete(
  '/questions/:id',
  [...authenticatedAppSession, withAccessCheck(Question)],
  handleDeleteQuestion
);
router.post(
  '/questions/:id/votes',
  authenticatedAppSession,
  handleVoteQuestion
);
router.delete(
  '/questions/:id/votes',
  authenticatedAppSession,
  handleRemoveQuestionVote
);
router.post(
  '/questions/:questionId/answers',
  [...authenticatedAppSession, ...uploadForumImage('answer')],
  handleCreateAnswer
);
router.patch(
  '/answers/:id',
  [
    ...authenticatedAppSession,
    withAccessCheck(Answer),
    ...uploadForumImage('answer'),
  ],
  handleUpdateAnswer
);
router.delete(
  '/answers/:id',
  [...authenticatedAppSession, withAccessCheck(Answer)],
  handleDeleteAnswer
);
router.delete(
  '/answers/:id/image',
  [...authenticatedAppSession, withAccessCheck(Answer)],
  handleDeleteAnswerImage
);
router.post('/answers/:id/votes', authenticatedAppSession, handleVoteAnswer);
router.delete(
  '/answers/:id/votes',
  authenticatedAppSession,
  handleRemoveAnswerVote
);
router.patch(
  '/questions/:questionId/answers/:answerId/accept',
  authenticatedAppSession,
  handleAcceptAnswer
);

module.exports = router;
