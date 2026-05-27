process.env.NODE_ENV = 'test';

jest.mock('multer', () =>
  jest.fn((config) => ({
    config,
    array: jest.fn(() => (req, res, next) => next()),
  }))
);

jest.mock('sharp', () =>
  jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('image')),
  }))
);

const uploadProfileImages = require('../router/uploads/s3/uploadProfileImages');

describe('uploadProfileImages S3 key construction', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(1234567890);
  });

  afterEach(() => {
    Date.now.mockRestore();
  });

  it('builds profile image keys from the authenticated user id', () => {
    const key = uploadProfileImages.buildProfileImageKey(
      {
        auth: { user: { id: 'user-1' } },
        body: { userId: 'user-1' },
      },
      { originalname: '../profile.jpg' }
    );

    expect(key).toBe('test/user/user-1/1234567890/profile.jpg');
  });

  it('rejects mismatched client supplied userId values', () => {
    expect(() =>
      uploadProfileImages.buildProfileImageKey(
        {
          auth: { user: { id: 'user-1' } },
          body: { userId: 'user-2' },
        },
        { originalname: 'profile.jpg' }
      )
    ).toThrow('Profile upload userId does not match authenticated user');
  });

  it('does not require client supplied userId when auth user is present', () => {
    const key = uploadProfileImages.buildProfileImageKey(
      {
        auth: { user: { id: 'user-1' } },
        body: {},
      },
      { originalname: 'profile.jpg' },
      'thumbnail-'
    );

    expect(key).toBe('test/user/user-1/1234567890/thumbnail-profile.jpg');
  });
});
