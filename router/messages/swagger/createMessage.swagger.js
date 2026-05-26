/**
 * @swagger
 * /messages:
 *   post:
 *     summary: Send a chat message
 *     description: Sends a message to a dual or group chat. Mentions must reference users who are members of the chat.
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - chatId
 *             properties:
 *               chatId:
 *                 type: number
 *               message:
 *                 type: string
 *                 description: Required unless messagePhotoUrl is provided
 *               type:
 *                 type: string
 *                 default: text
 *                 enum: [text, image, gif]
 *               messagePhotoUrl:
 *                 type: string
 *                 nullable: true
 *               mentions:
 *                 type: array
 *                 description: Internal user IDs to mention. Each mentioned user must be a chat member.
 *                 items:
 *                   type: number
 *     responses:
 *       201:
 *         description: Message created and emitted to chat members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     chatId:
 *                       type: number
 *                     fromUserId:
 *                       type: number
 *                     type:
 *                       type: string
 *                     message:
 *                       type: string
 *                       nullable: true
 *                     messagePhotoUrl:
 *                       type: string
 *                       nullable: true
 *                     mentionedUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           publicId:
 *                             type: string
 *                             format: uuid
 *                           username:
 *                             type: string
 *                           avatar:
 *                             type: string
 *       400:
 *         description: Invalid chatId, empty message, invalid mentions, or mentioned user is not a chat member
 *       403:
 *         description: Current user is not a member of the chat
 */
