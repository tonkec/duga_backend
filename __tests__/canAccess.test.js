jest.mock('../models', () => ({
  ChatUser: {
    findAll: jest.fn(),
  },
}));

const { ChatUser } = require('../models');
const canAccess = require('../utils/canAccess');

describe('canAccess model authorization rules', () => {
  const user = { id: 1, auth0Id: 'auth0|user-1', role: 'user' };
  const admin = { id: 99, auth0Id: 'auth0|admin', role: 'admin' };

  beforeEach(() => {
    jest.clearAllMocks();
    ChatUser.findAll.mockResolvedValue([]);
  });

  it('denies missing users or resources', async () => {
    await expect(canAccess(null, { userId: 1 })).resolves.toBe(false);
    await expect(canAccess(user, null)).resolves.toBe(false);
  });

  it('allows a user to access their own User model row by auth0Id', async () => {
    await expect(canAccess(user, { auth0Id: 'auth0|user-1' })).resolves.toBe(
      true
    );
    await expect(canAccess(user, { auth0Id: 'auth0|other' })).resolves.toBe(
      false
    );
  });

  it.each([
    ['Answer'],
    ['AnswerReply'],
    ['AnswerReaction'],
    ['AnswerReplyReaction'],
    ['ChatUser'],
    ['CommentMention'],
    ['MessageMention'],
    ['MessageReaction'],
    ['Notification'],
    ['PhotoComment'],
    ['PhotoLikes'],
    ['Question'],
    ['QuestionVote'],
    ['Upload'],
    ['UploadMention'],
    ['VerificationToken'],
  ])('allows owner access for %s through userId', async (modelName) => {
    await expect(canAccess(user, { modelName, userId: user.id })).resolves.toBe(
      true
    );
    await expect(canAccess(user, { modelName, userId: 2 })).resolves.toBe(
      false
    );
  });

  it('allows Message sender access through fromUserId', async () => {
    await expect(canAccess(user, { fromUserId: user.id })).resolves.toBe(true);
    await expect(canAccess(user, { fromUserId: 2 })).resolves.toBe(false);
  });

  it('allows chat-scoped resources only to chat members', async () => {
    const resource = { chatId: 77 };

    ChatUser.findAll.mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }]);
    await expect(canAccess(user, resource)).resolves.toBe(true);
    expect(ChatUser.findAll).toHaveBeenCalledWith({
      where: { chatId: 77 },
      attributes: ['userId'],
    });

    ChatUser.findAll.mockResolvedValueOnce([{ userId: 2 }]);
    await expect(canAccess(user, resource)).resolves.toBe(false);
  });

  it.each([
    ['Category', { id: 10 }],
    ['Chat', { id: 20 }],
    ['ProfileView', { viewerId: 1, viewedUserId: 2 }],
  ])(
    'requires admin fallback for %s resources without owner fields',
    async (_, resource) => {
      await expect(canAccess(user, resource)).resolves.toBe(false);
      await expect(canAccess(admin, resource)).resolves.toBe(true);
    }
  );
});
