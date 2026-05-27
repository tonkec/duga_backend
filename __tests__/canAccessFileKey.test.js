jest.mock('../models', () => ({
  Answer: {
    findOne: jest.fn(),
  },
  ChatUser: {
    findOne: jest.fn(),
  },
  CommentMention: {
    findOne: jest.fn(),
  },
  Message: {
    findOne: jest.fn(),
  },
  PhotoComment: {
    findOne: jest.fn(),
  },
  Question: {
    findOne: jest.fn(),
  },
  Upload: {
    findOne: jest.fn(),
  },
  UploadMention: {
    findOne: jest.fn(),
  },
}));

const {
  Answer,
  ChatUser,
  CommentMention,
  Message,
  PhotoComment,
  Question,
  Upload,
  UploadMention,
} = require('../models');
const canAccessFileKey = require('../utils/canAccessFileKey');

describe('canAccessFileKey', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    jest.clearAllMocks();

    Answer.findOne.mockResolvedValue(null);
    ChatUser.findOne.mockResolvedValue(null);
    CommentMention.findOne.mockResolvedValue(null);
    Message.findOne.mockResolvedValue(null);
    PhotoComment.findOne.mockResolvedValue(null);
    Question.findOne.mockResolvedValue(null);
    Upload.findOne.mockResolvedValue(null);
    UploadMention.findOne.mockResolvedValue(null);
  });

  it('denies unknown keys by default', async () => {
    await expect(canAccessFileKey(1, 'test/private/missing.jpg')).resolves.toBe(
      false
    );
  });

  it('allows upload owners', async () => {
    Upload.findOne.mockResolvedValue({ id: 10, userId: 1 });

    await expect(canAccessFileKey(1, 'test/user/1/photo.jpg')).resolves.toBe(
      true
    );
  });

  it('allows users tagged on uploads', async () => {
    Upload.findOne.mockResolvedValue({ id: 10, userId: 2 });
    UploadMention.findOne.mockResolvedValue({ uploadId: 10, userId: 1 });

    await expect(canAccessFileKey(1, 'test/user/2/photo.jpg')).resolves.toBe(
      true
    );
    expect(UploadMention.findOne).toHaveBeenCalledWith({
      where: { uploadId: 10, userId: 1 },
    });
  });

  it('allows comment images through comment ownership', async () => {
    PhotoComment.findOne.mockResolvedValue({
      id: 20,
      userId: 1,
      uploadId: 10,
      imageUrl: 'comment/photo.jpg',
    });

    await expect(canAccessFileKey(1, 'test/comment/photo.jpg')).resolves.toBe(
      true
    );
  });

  it('allows comment images through comment tags', async () => {
    PhotoComment.findOne.mockResolvedValue({
      id: 20,
      userId: 2,
      uploadId: 10,
      imageUrl: 'comment/photo.jpg',
    });
    CommentMention.findOne.mockResolvedValue({ commentId: 20, userId: 1 });

    await expect(canAccessFileKey(1, 'test/comment/photo.jpg')).resolves.toBe(
      true
    );
  });

  it('allows comment images through parent upload access', async () => {
    PhotoComment.findOne.mockResolvedValue({
      id: 20,
      userId: 2,
      uploadId: 10,
      imageUrl: 'comment/photo.jpg',
    });
    Upload.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 10, userId: 1 });

    await expect(canAccessFileKey(1, 'test/comment/photo.jpg')).resolves.toBe(
      true
    );
  });

  it('allows forum question and answer images to authenticated users', async () => {
    Question.findOne.mockResolvedValueOnce({
      id: 30,
      imageUrl: 'forum/question/1/photo.jpg',
    });

    await expect(
      canAccessFileKey(1, 'test/forum/question/1/photo.jpg')
    ).resolves.toBe(true);

    Question.findOne.mockResolvedValue(null);
    Answer.findOne.mockResolvedValueOnce({
      id: 40,
      imageUrl: 'forum/answer/1/photo.jpg',
    });

    await expect(
      canAccessFileKey(2, 'test/forum/answer/1/photo.jpg')
    ).resolves.toBe(true);
  });

  it('allows message images only to chat members', async () => {
    Message.findOne.mockResolvedValue({ id: 50, chatId: 99 });
    ChatUser.findOne.mockResolvedValueOnce({ chatId: 99, userId: 1 });

    await expect(canAccessFileKey(1, 'test/messages/photo.jpg')).resolves.toBe(
      true
    );

    ChatUser.findOne.mockResolvedValueOnce(null);

    await expect(canAccessFileKey(2, 'test/messages/photo.jpg')).resolves.toBe(
      false
    );
  });

  it('allows direct chat-scoped keys only to chat members', async () => {
    ChatUser.findOne.mockResolvedValueOnce({ chatId: 99, userId: 1 });

    await expect(canAccessFileKey(1, 'test/chat/99/photo.jpg')).resolves.toBe(
      true
    );

    ChatUser.findOne.mockResolvedValueOnce(null);

    await expect(canAccessFileKey(2, 'test/chat/99/photo.jpg')).resolves.toBe(
      false
    );
  });
});
