const createLowercasePhotoComments = require('../database/migrations/20250103093131-create-photoComments');
const deleteLowercasePhotoComments = require('../database/migrations/20250103093957-delete-photoComments');
const createCanonicalPhotoComments = require('../database/migrations/20250103094036-create-PhotoComments');

const Sequelize = {
  INTEGER: 'INTEGER',
  STRING: 'STRING',
  DATE: 'DATE',
  fn: jest.fn((name) => ({ fn: name })),
};

const buildQueryInterface = (tables = []) => ({
  createTable: jest.fn().mockResolvedValue(undefined),
  dropTable: jest.fn().mockResolvedValue(undefined),
  renameTable: jest.fn().mockResolvedValue(undefined),
  showAllTables: jest.fn().mockResolvedValue(tables),
});

describe('PhotoComments migration safety', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not create or drop the wrong-case photoComments table', async () => {
    const queryInterface = buildQueryInterface();

    await createLowercasePhotoComments.up(queryInterface, Sequelize);
    await createLowercasePhotoComments.down(queryInterface, Sequelize);
    await deleteLowercasePhotoComments.up(queryInterface, Sequelize);
    await deleteLowercasePhotoComments.down(queryInterface, Sequelize);

    expect(queryInterface.createTable).not.toHaveBeenCalled();
    expect(queryInterface.dropTable).not.toHaveBeenCalled();
  });

  it('renames existing wrong-case photoComments table instead of dropping it', async () => {
    const queryInterface = buildQueryInterface(['photoComments']);

    await createCanonicalPhotoComments.up(queryInterface, Sequelize);

    expect(queryInterface.renameTable).toHaveBeenCalledWith(
      'photoComments',
      'PhotoComments'
    );
    expect(queryInterface.createTable).not.toHaveBeenCalled();
    expect(queryInterface.dropTable).not.toHaveBeenCalled();
  });

  it('does nothing when canonical PhotoComments already exists', async () => {
    const queryInterface = buildQueryInterface(['PhotoComments']);

    await createCanonicalPhotoComments.up(queryInterface, Sequelize);

    expect(queryInterface.renameTable).not.toHaveBeenCalled();
    expect(queryInterface.createTable).not.toHaveBeenCalled();
    expect(queryInterface.dropTable).not.toHaveBeenCalled();
  });

  it('creates canonical PhotoComments when no comment table exists', async () => {
    const queryInterface = buildQueryInterface([]);

    await createCanonicalPhotoComments.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      'PhotoComments',
      expect.objectContaining({
        id: expect.objectContaining({ primaryKey: true }),
        userId: expect.objectContaining({
          references: { model: 'Users', key: 'id' },
        }),
        uploadId: expect.objectContaining({
          references: { model: 'Uploads', key: 'id' },
        }),
      })
    );
    expect(queryInterface.dropTable).not.toHaveBeenCalled();
  });
});
