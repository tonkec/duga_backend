const crypto = require('crypto');
const { Sequelize, DataTypes } = require('sequelize');
const defineQuestion = require('../models/question');
const defineAnswer = require('../models/answer');
const defineAnswerReply = require('../models/answerreply');
const { isEncryptedMessage } = require('../utils/messageEncryption');

describe('Forum model encryption', () => {
  let originalKey;
  let sequelize;
  let Question;
  let Answer;
  let AnswerReply;

  beforeEach(() => {
    originalKey = process.env.MESSAGE_ENCRYPTION_KEY;
    process.env.MESSAGE_ENCRYPTION_KEY = crypto
      .randomBytes(32)
      .toString('base64');
    sequelize = new Sequelize('postgres://user:pass@localhost:5432/test', {
      dialect: 'postgres',
      logging: false,
    });
    Question = defineQuestion(sequelize, DataTypes);
    Answer = defineAnswer(sequelize, DataTypes);
    AnswerReply = defineAnswerReply(sequelize, DataTypes);
  });

  afterEach(async () => {
    if (originalKey === undefined) {
      delete process.env.MESSAGE_ENCRYPTION_KEY;
    } else {
      process.env.MESSAGE_ENCRYPTION_KEY = originalKey;
    }
    await sequelize.close();
  });

  it('encrypts question body while leaving title searchable', () => {
    const question = Question.build({
      userId: 1,
      title: 'Searchable title',
      body: 'Private question body',
    });

    expect(question.getDataValue('title')).toBe('Searchable title');
    expect(question.getDataValue('body')).not.toBe('Private question body');
    expect(isEncryptedMessage(question.getDataValue('body'))).toBe(true);
    expect(question.body).toBe('Private question body');
  });

  it('encrypts answer body and decrypts reads', () => {
    const answer = Answer.build({
      questionId: 1,
      userId: 2,
      body: 'Private answer body',
    });

    expect(answer.getDataValue('body')).not.toBe('Private answer body');
    expect(isEncryptedMessage(answer.getDataValue('body'))).toBe(true);
    expect(answer.body).toBe('Private answer body');
  });

  it('encrypts answer reply body and decrypts reads', () => {
    const reply = AnswerReply.build({
      answerId: 1,
      userId: 3,
      body: 'Private reply body',
    });

    expect(reply.getDataValue('body')).not.toBe('Private reply body');
    expect(isEncryptedMessage(reply.getDataValue('body'))).toBe(true);
    expect(reply.body).toBe('Private reply body');
  });

  it('keeps legacy plaintext forum content readable', () => {
    const question = Question.build({
      userId: 1,
      title: 'Title',
      body: 'Body',
    });
    const answer = Answer.build({ questionId: 1, userId: 2, body: 'Body' });
    const reply = AnswerReply.build({ answerId: 1, userId: 3, body: 'Body' });

    question.setDataValue('body', 'Legacy question body');
    answer.setDataValue('body', 'Legacy answer body');
    reply.setDataValue('body', 'Legacy reply body');

    expect(question.body).toBe('Legacy question body');
    expect(answer.body).toBe('Legacy answer body');
    expect(reply.body).toBe('Legacy reply body');
  });
});
