const express = require('express');
const router = express.Router();
const { Answer, Question } = require('../models');
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const {
  handleAcceptAnswer,
  handleCreateAnswer,
  handleCreateQuestion,
  handleDeleteAnswer,
  handleDeleteQuestion,
  handleGetQuestionById,
  handleGetQuestions,
  handleRemoveAnswerVote,
  handleRemoveQuestionVote,
  handleUpdateAnswer,
  handleUpdateQuestion,
  handleVoteAnswer,
  handleVoteQuestion,
} = require('./forum/handlers');

router.get('/questions', handleGetQuestions);
router.get('/questions/:id', handleGetQuestionById);
router.post('/questions', authenticatedAppSession, handleCreateQuestion);
router.patch(
  '/questions/:id',
  [...authenticatedAppSession, withAccessCheck(Question)],
  handleUpdateQuestion
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
  authenticatedAppSession,
  handleCreateAnswer
);
router.patch(
  '/answers/:id',
  [...authenticatedAppSession, withAccessCheck(Answer)],
  handleUpdateAnswer
);
router.delete(
  '/answers/:id',
  [...authenticatedAppSession, withAccessCheck(Answer)],
  handleDeleteAnswer
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
