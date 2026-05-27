jest.mock('../models', () => ({
  Upload: {
    findOne: jest.fn(),
  },
  UploadMention: {
    findAll: jest.fn(),
  },
}));

const { Op } = require('sequelize');
const { Upload, UploadMention } = require('../models');
const {
  buildUploadAccessWhere,
  findAccessibleUploadById,
  hasUploadAccess,
} = require('../utils/uploadAccess');

describe('uploadAccess authorization helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Upload.findOne.mockResolvedValue(null);
    UploadMention.findAll.mockResolvedValue([]);
  });

  it('builds owner-only access when the user is not tagged in uploads', async () => {
    await expect(buildUploadAccessWhere(1, { id: 10 })).resolves.toEqual({
      id: 10,
      [Op.or]: [{ userId: 1 }],
    });
    expect(UploadMention.findAll).toHaveBeenCalledWith({
      where: { userId: 1 },
      attributes: ['uploadId'],
    });
  });

  it('adds tagged upload ids to the access predicate', async () => {
    UploadMention.findAll.mockResolvedValue([
      { uploadId: 10 },
      { uploadId: 11 },
      { uploadId: null },
    ]);

    await expect(buildUploadAccessWhere(1, { userId: 2 })).resolves.toEqual({
      userId: 2,
      [Op.or]: [{ userId: 1 }, { id: { [Op.in]: [10, 11] } }],
    });
  });

  it('finds uploads by id using owner/tagged access conditions', async () => {
    const upload = { id: 10, userId: 2 };
    UploadMention.findAll.mockResolvedValue([{ uploadId: 10 }]);
    Upload.findOne.mockResolvedValue(upload);

    await expect(
      findAccessibleUploadById(1, 10, { include: ['taggedUsers'] })
    ).resolves.toBe(upload);

    expect(Upload.findOne).toHaveBeenCalledWith({
      include: ['taggedUsers'],
      where: {
        id: 10,
        [Op.or]: [{ userId: 1 }, { id: { [Op.in]: [10] } }],
      },
    });
  });

  it('returns null for missing upload ids without querying uploads', async () => {
    await expect(findAccessibleUploadById(1, null)).resolves.toBeNull();
    expect(Upload.findOne).not.toHaveBeenCalled();
  });

  it('reports upload access as a boolean', async () => {
    Upload.findOne
      .mockResolvedValueOnce({ id: 10 })
      .mockResolvedValueOnce(null);

    await expect(hasUploadAccess(1, 10)).resolves.toBe(true);
    await expect(hasUploadAccess(1, 11)).resolves.toBe(false);
  });
});
