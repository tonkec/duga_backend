process.env.NODE_ENV = 'test';

const mockDetectModerationLabelsPromise = jest
  .fn()
  .mockResolvedValue({ ModerationLabels: [] });
const mockDetectModerationLabels = jest.fn(() => ({
  promise: mockDetectModerationLabelsPromise,
}));

jest.mock('../utils/rekognition', () => ({
  detectModerationLabels: mockDetectModerationLabels,
}));

const mockSharpChain = {
  resize: jest.fn().mockReturnThis(),
  toFormat: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('normalized-image')),
};
const mockSharp = jest.fn(() => mockSharpChain);
jest.mock('sharp', () => mockSharp);

jest.mock('../models', () => ({
  ChatUser: {
    findOne: jest.fn(),
  },
}));

const { ChatUser } = require('../models');
const uploadMessageImage = require('../router/uploads/s3/uploadMessageImage');

const buildReq = () => ({
  auth: { user: { id: 42 } },
  body: {
    chatId: '77',
    timestamp: '../../client-controlled',
  },
  files: [
    {
      originalname: 'Vacation Photo.png',
      mimetype: 'image/png',
      buffer: Buffer.from('raw-image'),
    },
  ],
});

const buildRes = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };

  return res;
};

describe('uploadMessageImage middleware', () => {
  let s3;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
    s3 = {
      putObject: jest.fn(() => ({
        promise: jest.fn().mockResolvedValue({}),
      })),
    };
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  it('rejects message images before S3 upload when user is not a chat member', async () => {
    ChatUser.findOne.mockResolvedValue(null);
    const [, processAndUpload] = uploadMessageImage(s3);
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    await processAndUpload(req, res, next);

    expect(ChatUser.findOne).toHaveBeenCalledWith({
      where: { chatId: 77, userId: 42 },
      attributes: ['id'],
    });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Forbidden' });
    expect(mockSharp).not.toHaveBeenCalled();
    expect(mockDetectModerationLabels).not.toHaveBeenCalled();
    expect(s3.putObject).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('builds message image keys from verified chatId and server timestamp', async () => {
    ChatUser.findOne.mockResolvedValue({ id: 1 });
    const [, processAndUpload] = uploadMessageImage(s3);
    const req = buildReq();
    const res = buildRes();
    const next = jest.fn();

    await processAndUpload(req, res, next);

    expect(s3.putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'duga-user-photo',
        Key: 'test/chat/77/1234567890/0-vacationphoto.jpg',
        Body: Buffer.from('normalized-image'),
        ContentType: 'image/jpeg',
        ACL: 'private',
      })
    );
    expect(s3.putObject.mock.invocationCallOrder[0]).toBeGreaterThan(
      ChatUser.findOne.mock.invocationCallOrder[0]
    );
    expect(req.files[0].transforms).toEqual([
      {
        id: 'original',
        key: 'test/chat/77/1234567890/0-vacationphoto.jpg',
      },
    ]);
    expect(req.files[0].mimetype).toBe('image/jpeg');
    expect(next).toHaveBeenCalledWith();
  });
});
