/**
 * @swagger
 * /chats/create:
 *   post:
 *     summary: Create a new chat (direct or group)
 *     description: Use partnerId or partnerPublicId for one-on-one chats. Use userIds or userPublicIds for group chats. The current user is added automatically and becomes group admin.
 *     tags: [Chats]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               partnerId:
 *                 type: number
 *                 description: User ID for one-on-one chats
 *               partnerPublicId:
 *                 type: string
 *                 format: uuid
 *                 description: Public user UUID for one-on-one chats
 *               userIds:
 *                 type: array
 *                 description: User IDs for group chats. The current user is added automatically. Groups can have up to 50 total members.
 *                 maxItems: 49
 *                 items:
 *                   type: number
 *               userPublicIds:
 *                 type: array
 *                 description: Public user UUIDs for group chats. The current user is added automatically. Groups can have up to 50 total members.
 *                 maxItems: 49
 *                 items:
 *                   type: string
 *                   format: uuid
 *               name:
 *                 type: string
 *                 description: Optional group chat name
 *     responses:
 *       201:
 *         description: Chat created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: number
 *                 type:
 *                   type: string
 *                   enum: [dual, group]
 *                 name:
 *                   type: string
 *                   nullable: true
 *                 Users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: number
 *                       publicId:
 *                         type: string
 *                         format: uuid
 *                       username:
 *                         type: string
 *                       avatar:
 *                         type: string
 *                 Messages:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid payload, group too small, group over 50 members, or invalid public UUID
 *       404:
 *         description: One or more users not found
 */
