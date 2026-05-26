'use strict';
const { Model } = require('sequelize');
const config = require('../config/app');
module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      this.belongsToMany(models.Chat, {
        through: 'ChatUser',
        foreignKey: 'userId',
      });
      this.hasMany(models.ChatUser, { foreignKey: 'userId' });
      this.hasOne(models.VerificationToken, {
        as: 'verificationtoken',
        foreignKey: 'userId',
        foreignKeyConstraint: true,
      });

      this.hasMany(models.PhotoComment, {
        as: 'photoComments',
        foreignKey: 'userId',
        foreignKeyConstraint: true,
      });

      this.belongsToMany(models.PhotoComment, {
        through: models.CommentMention,
        as: 'mentionedIn',
        foreignKey: 'userId',
      });
      this.belongsToMany(models.Upload, {
        through: models.UploadMention,
        as: 'taggedInUploads',
        foreignKey: 'userId',
      });

      this.hasMany(models.Question, {
        as: 'questions',
        foreignKey: 'userId',
      });
      this.hasMany(models.Answer, {
        as: 'answers',
        foreignKey: 'userId',
      });
      this.hasMany(models.QuestionVote, {
        as: 'questionVotes',
        foreignKey: 'userId',
      });
      this.hasMany(models.AnswerReaction, {
        as: 'answerReactions',
        foreignKey: 'userId',
      });
      this.hasMany(models.AnswerReply, {
        as: 'answerReplies',
        foreignKey: 'userId',
      });
      this.hasMany(models.AnswerReplyReaction, {
        as: 'answerReplyReactions',
        foreignKey: 'userId',
      });
      this.hasMany(models.MessageReaction, {
        as: 'messageReactions',
        foreignKey: 'userId',
      });
      this.belongsToMany(models.Message, {
        through: models.MessageMention,
        as: 'mentionedInMessages',
        foreignKey: 'userId',
        otherKey: 'messageId',
      });
      this.hasMany(models.ProfileView, {
        as: 'profileViewsReceived',
        foreignKey: 'viewedUserId',
      });
      this.hasMany(models.ProfileView, {
        as: 'profileViewsMade',
        foreignKey: 'viewerId',
      });
    }
  }
  User.init(
    {
      publicId: {
        type: DataTypes.UUID,
        allowNull: false,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: true, // Allows NULL values
      },
      lookingFor: {
        type: DataTypes.ENUM(
          'friendship',
          'date',
          'marriage',
          'relationship',
          'partnership',
          'nothing',
          'idk'
        ),
        allowNull: true,
      },
      relationshipStatus: {
        type: DataTypes.ENUM(
          'single',
          'relationship',
          'marriage',
          'partnership',
          'inbetween',
          'idk',
          'divorced',
          'widowed',
          'separated',
          'open',
          'engaged'
        ),
        allowNull: true,
      },
      cigarettes: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      alcohol: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      sport: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
      },
      favoriteDayOfWeek: {
        type: DataTypes.ENUM(
          'monday',
          'tuesday',
          'wednesday',
          'thursday',
          'friday',
          'saturday',
          'sunday'
        ),
        allowNull: true,
      },
      spirituality: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      embarasement: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      tooOldFor: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      makesMyDay: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      ending: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      favoriteSong: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      favoriteMovie: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      interests: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      languages: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          isEmail: true,
        },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      gender: DataTypes.STRING,
      isVerified: DataTypes.BOOLEAN,
      bio: DataTypes.TEXT,
      sexuality: DataTypes.STRING,
      location: DataTypes.STRING,
      age: DataTypes.INTEGER,
      username: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      status: {
        type: DataTypes.ENUM('online', 'offline'),
        allowNull: false,
        defaultValue: 'offline',
      },
      avatar: {
        type: DataTypes.STRING,
        get() {
          const avatar = this.getDataValue('avatar');
          const url = `${config.appUrl}:${config.appPort}`;
          if (!avatar) {
            return 'http://placekitten.com/200/300';
          }

          return `${url}/user/${avatar}`;
        },
      },
      auth0Id: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
      },
      accept_privacy: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      },
      accept_terms: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null,
      },
      onboarding_done: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false,
      },
      first_login_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      activeSessionIdHash: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      activeSessionStartedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      sequelize,
      modelName: 'User',
    }
  );
  return User;
};
