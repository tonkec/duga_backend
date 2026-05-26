const normalizeMentionUserIds = (mentions) => {
  if (mentions === undefined || mentions === null) return [];
  if (!Array.isArray(mentions)) return null;

  return [
    ...new Set(
      mentions.map((mention) => {
        if (mention && typeof mention === 'object') {
          return Number(mention.userId ?? mention.id);
        }
        return Number(mention);
      })
    ),
  ];
};

const hasInvalidMentionUserIds = (mentionUserIds) =>
  mentionUserIds.some((userId) => !Number.isInteger(userId) || userId <= 0);

const getMentionUserIdsOutsideChat = (mentionUserIds, memberIds) => {
  const memberIdSet = new Set(memberIds.map((id) => Number(id)));
  return mentionUserIds.filter((userId) => !memberIdSet.has(Number(userId)));
};

const buildMentionRows = (messageId, mentionUserIds) =>
  mentionUserIds.map((userId) => ({ messageId, userId }));

module.exports = {
  buildMentionRows,
  getMentionUserIdsOutsideChat,
  hasInvalidMentionUserIds,
  normalizeMentionUserIds,
};
