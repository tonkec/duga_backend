const express = require('express');
const router = express.Router();
const { Answer, AnswerReply, Question } = require('../models');
const {
  authenticatedAppSession,
} = require('../middleware/authenticatedAppSession');
const withAccessCheck = require('../middleware/accessCheck');
const uploadForumImage = require('./forum/s3/uploadForumImage');
const {
  handleAcceptAnswer,
  handleCreateAnswer,
  handleCreateAnswerReply,
  handleCreateQuestion,
  handleDeleteAnswer,
  handleDeleteAnswerImage,
  handleDeleteAnswerReply,
  handleDeleteQuestion,
  handleDeleteQuestionImage,
  handleGetQuestionById,
  handleGetQuestions,
  handleReactToAnswer,
  handleReactToAnswerReply,
  handleRemoveAnswerReaction,
  handleRemoveAnswerReplyReaction,
  handleRemoveQuestionVote,
  handleUpdateAnswer,
  handleUpdateAnswerReply,
  handleUpdateQuestion,
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
router.post(
  '/answers/:id/reactions',
  authenticatedAppSession,
  handleReactToAnswer
);
router.delete(
  '/answers/:id/reactions',
  authenticatedAppSession,
  handleRemoveAnswerReaction
);
router.post(
  '/answer-replies/:id/reactions',
  authenticatedAppSession,
  handleReactToAnswerReply
);
router.delete(
  '/answer-replies/:id/reactions',
  authenticatedAppSession,
  handleRemoveAnswerReplyReaction
);
router.post(
  '/answers/:id/replies',
  authenticatedAppSession,
  handleCreateAnswerReply
);
router.patch(
  '/answer-replies/:id',
  [...authenticatedAppSession, withAccessCheck(AnswerReply)],
  handleUpdateAnswerReply
);
router.delete(
  '/answer-replies/:id',
  [...authenticatedAppSession, withAccessCheck(AnswerReply)],
  handleDeleteAnswerReply
);
router.patch(
  '/questions/:questionId/answers/:answerId/accept',
  authenticatedAppSession,
  handleAcceptAnswer
);

module.exports = router;
