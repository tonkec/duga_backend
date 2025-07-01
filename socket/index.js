const socketIo = require('socket.io');
const { sequelize } = require('../models');
const Message = require('../models').Message;
const User = require('../models').User;
const users = new Map();
const userSockets = new Map();
const Notification = require('../models').Notification;
const PhotoLikes = require("../models").PhotoLikes;
const socketCanAccess = require('../utils/socketAccess');

const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

const client = jwksClient({
  jwksUri: `https://${AUTH0_DOMAIN}/.well-known/jwks.json`,
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

const SocketServer = (server, app) => {
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
      allowedHeaders: ['Content-Type'],
    },
  });

  app.set('io', io);


  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Missing token'));
    }

   jwt.verify(
    token,
    getKey,
    {
      audience: AUTH0_AUDIENCE,
      issuer: `https://${AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    },
    (err, decoded) => {
      if (err) {
        console.error('❌ JWT verification failed:', err.message);
        return next(new Error('Unauthorized'));
      }

      socket.user = decoded;
      next();
    }
  );
});

  io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('join', async () => {
      const auth0Id = socket.user?.sub;
      const user = await User.findOne({ where: { auth0Id } });
      setUsers(user, socket);
      const chatters = await getChatters(user.id);
      chatters.forEach((chatterId) => {
        if (users.has(chatterId)) {
          users.get(chatterId).sockets.forEach((sockId) => {
            io.to(sockId).emit('status-update', {
              userId: user.id,
              status: 'online',
            });
          });
        }
      });

      if (users.has(user.id)) {
        users.get(user.id).status = 'online';
      }
    });

    socket.on("send-comment", async (data) => {
      try {
        const { userId, uploadId } = data.data;
        const parsedUploadId = parseInt(uploadId);
        if (isNaN(parsedUploadId)) {
          console.error("❌ Invalid uploadId:", uploadId);
          return;
        }
    
        io.emit("receive-comment", { data: data.data});
    
        const [results] = await sequelize.query(
          `SELECT "userId" FROM "Uploads" WHERE id = :uploadId`,
          {
            replacements: { uploadId: parsedUploadId },
            type: sequelize.QueryTypes.SELECT,
          }
        );
    
        const photoOwnerId = results?.userId;
    
        if (photoOwnerId && parseInt(photoOwnerId) !== parseInt(userId)) {
          const notification = await Notification.create({
            userId: photoOwnerId,
            type: 'comment',
            content: `Novi komentar na tvojoj fotografiji.`,
            actionId: parsedUploadId,
            actionType: 'upload',
          });
    
          if (users.has(photoOwnerId)) {
            users.get(photoOwnerId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
              });
            });
          }
        }
      } catch (error) {
        console.error("🔥 Error in send-comment:", error);
      }
    });

    socket.on("markAsRead", async (data) => {
      const { userId, chatId } = data;
      try {
        if (!userId || !chatId) {
          console.error("❌ Missing userId or chatId in markAsRead");
          return;
        }

       const [lastNotification] = await sequelize.query(
          `SELECT * FROM "Notifications" WHERE "chatId" = :chatId
          ORDER BY "createdAt" DESC
          LIMIT 1`,
          {
            replacements: { chatId },
            type: sequelize.QueryTypes.SELECT,
          }
        );

        if (lastNotification.length === 0) {
          console.error("❌ No unread notifications found for chatId:", chatId);
          return;
        }

        const notificationId = lastNotification.id 
      
        if (!notificationId) {
          console.error("❌ No notificationId found for chatId:", chatId);
          return;
        }

        console.log("🔍 Notification ID to mark as read:", notificationId);
        
        const notification = await Notification.findByPk(notificationId);
        if (!notification) {
          console.error("❌ Notification not found:", notificationId);
          return;
        }
    
        notification.isRead = true;
        await notification.save();
    
        if (users.has(userId)) {
          users.get(userId).sockets.forEach((sockId) => {
            io.to(sockId).emit('markAsRead', notification);
          });
        }
        
        return notification;
      } catch (error) {
        console.error("🔥 Error in markAsRead:", error);
      }
    }
    );

    socket.on('set-status', async ({ status }) => {
      const auth0Id = socket.user?.sub;
      const user = await User.findOne({ where: { auth0Id } });
      const userId = user.id;
      if (users.has(userId)) {
        users.get(userId).status = status;
      }
    
      await User.update({ status }, { where: { id: userId } });
    
      const chatters = await getChatters(userId);
      chatters.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((sockId) => {
            io.to(sockId).emit('status-update', { userId, status });
          });
        }
      });
    
      if (users.has(userId)) {
        users.get(userId).sockets.forEach((sockId) => {
          io.to(sockId).emit('status-update', { userId, status });
        });
      }
    });  
    
    socket.on("delete-comment", async (data) => {
      io.emit("remove-comment", data);
    });

    socket.on('edit-comment', async (data) => {
      io.emit("update-comment", data);
    })

    socket.on("upvote-upload", async (data) => {
      try {
        const like = data[0];
        const { photoId } = like;
        const auth0Id = socket.user?.sub;
        const user = await User.findOne({ where: { auth0Id } });
        const userId = user.id;
        if (!user) {
          console.error('User not found');
          return;
        }

        const photoLike = await PhotoLikes.findOne({
          where: {
            photoId,
            userId,
          },
        });

        if (!photoLike) {
          console.error('PhotoLike not found in upvote');
          return;
        }
        const hasAccess = await socketCanAccess({ socket, model: PhotoLikes, resourceId: photoLike.id });

        if (!hasAccess) {
          throw new Error('Forbidden: You cannot like this upload.');
        }
    
        const parsedPhotoId = parseInt(photoId);
        if (isNaN(parsedPhotoId)) {
          console.error("Invalid photoId:", photoId);
          return;
        }
    
       const results = await sequelize.query(
        `
          SELECT 
            "PhotoLikes".*,
            json_build_object('username', "Users"."username") AS user
          FROM "PhotoLikes"
          JOIN "Users" ON "PhotoLikes"."userId" = "Users"."id"
          WHERE "PhotoLikes"."photoId" = :parsedPhotoId AND "PhotoLikes"."userId" = :userId
        `,
        {
          replacements: {
            uploadId: parseInt(parsedPhotoId),
            userId: parseInt(user.id),
          },
          type: sequelize.QueryTypes.SELECT,
        }
      );
         io.emit("upvote-upload", {
          uploadId: photoId,
          likes: results,
         });
        const photoOwnerId = results?.userId;
    
        if (photoOwnerId && parseInt(photoOwnerId) !== parseInt(userId)) {
          const notification = await Notification.create({
            userId: photoOwnerId,
            type: 'like',
            content: `Netko je lajkao tvoju fotografiju.`,
            actionId: parsedPhotoId,
            actionType: 'upload',
          });
    
          if (users.has(photoOwnerId)) {
            users.get(photoOwnerId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
              });
            });
          }
        }
      } catch (error) {
        console.error("🔥 Error in upvote-upload notification:", error);
      }
    });
    
    socket.on("downvote-upload", async (likeData) => {
      try {
        const { uploadId } = likeData;
        const auth0Id = socket.user?.sub;
        const user = await User.findOne({ where: { auth0Id } });
        if (!user) {
          console.error('User not found');
          return;
        }

        const photoLike = await PhotoLikes.findOne({
          where: {
            photoId: Number(uploadId),
            userId: user.id,
          },
        });

        if (!photoLike) {
          console.error('PhotoLike not found in downvote');
          return;
        }

        const hasAccess = await socketCanAccess({ socket, model: PhotoLikes, resourceId: photoLike.id });
        if (!hasAccess) {
          throw new Error('Forbidden: You cannot dislike this photo.');
        }
    
        if (!uploadId) {
          console.error("❌ Missing uploadId in downvote-upload");
          return;
        }

        const results = await sequelize.query(
          `
            SELECT 
              "PhotoLikes".*,
              json_build_object('username', "Users"."username") AS user
            FROM "PhotoLikes"
            JOIN "Users" ON "PhotoLikes"."userId" = "Users"."id"
            WHERE "PhotoLikes"."photoId" = :uploadId AND "PhotoLikes"."userId" = :userId
          `,
          {
            replacements: {
              uploadId: parseInt(parsedPhotoId),
              userId: parseInt(user.id),
            },
            type: sequelize.QueryTypes.SELECT,
          }
        );

        io.emit("downvote-upload", {
          uploadId,
          likes: results,
        });
      } catch (err) {
        console.error("🔥 Error in downvote-upload:", err);
      }
    });
    
  
    socket.on('message', async (message) => {
      let sockets = setUsers(message.fromUser, socket);
    
      if (users.length > 0) {
        if (users.has(message.fromUser.id)) {
          sockets = users.get(message.fromUser.id).sockets;
        }
      }
    
      message.toUserId.forEach((id) => {
        if (users.has(id)) {
          sockets = [...sockets, ...users.get(id).sockets];
        }
      });
    
      try {
        const msg = {
          type: message.type,
          fromUserId: message.fromUser.id,
          chatId: message.chatId,
          message: message.message,
          messagePhotoUrl: message.messagePhotoUrl,
        };
    
        const savedMessage = await Message.create(msg);
    
        message.User = message.fromUser;
        message.fromUserId = message.fromUser.id;
        message.id = savedMessage.id;
        message.message = savedMessage.message;
        message.createdAt = savedMessage.createdAt;
        message.type = savedMessage.type;
        message.messagePhotoUrl = savedMessage.messagePhotoUrl;
        delete message.fromUser;
    
        for (const recipientId of message.toUserId) {
          const notification = await Notification.create({
            userId: recipientId,
            type: 'message',
            content: `Nova poruka od ${message.User.username || 'someone'}`,
            actionId: savedMessage.chatId,
            actionType: 'message',
            chatId: savedMessage.chatId,
          });
    
          if (users.has(recipientId)) {
            users.get(recipientId).sockets.forEach((sockId) => {
              io.to(sockId).emit('new_notification', {
                id: notification.id,
                type: notification.type,
                content: notification.content,
                actionId: notification.actionId,
                actionType: notification.actionType,
                isRead: notification.isRead,
                createdAt: notification.createdAt,
                chatId: notification.chatId,
              });
            });
          }
        }
    
        sockets.forEach((socket) => {
          io.to(socket).emit('received', message);
        });
    
      } catch (e) {
        console.log(e);
      }
    });
    

    socket.on('typing', (data) => {
      data.toUserId.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((socket) => {
            io.to(socket).emit('typing', data);
          });
        }

      });
    });

    socket.on('stop-typing', (data) => {
      data.toUserId.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((socket) => {
            io.to(socket).emit('stop-typing', data);
          });
        }
      });
    } );

    socket.on('add-friend', (chats) => {
      try {
        let online = 'offline';
        if (users.has(chats[1].Users[0].id)) {
          online = 'online';
          chats[0].Users[0].status = 'online';
          users.get(chats[1].Users[0].id).sockets.forEach((socket) => {
            io.to(socket).emit('new-chat', chats[0]);
          });
        }

        if (users.has(chats[0].Users[0].id)) {
          chats[1].Users[0].status = online;
          users.get(chats[0].Users[0].id).sockets.forEach((socket) => {
            io.to(socket).emit('new-chat', chats[1]);
          });
        }
      } catch (e) {}
    });

    socket.on('add-user-to-group', ({ chat, newChatter }) => {
      if (users.has(newChatter.id)) {
        newChatter.status = 'online';
      }

      // old users
      chat.Users.forEach((user, index) => {
        if (users.has(user.id)) {
          chat.Users[index].status = 'online';
          users.get(user.id).sockets.forEach((socket) => {
            try {
              io.to(socket).emit('added-user-to-group', {
                chat,
                chatters: [newChatter],
              });
            } catch (e) {}
          });
        }
      });

      if (users.has(newChatter.id)) {
        users.get(newChatter.id).sockets.forEach((socket) => {
          try {
            io.to(socket).emit('added-user-to-group', {
              chat,
              chatters: chat.Users,
            });
          } catch (e) {}
        });
      }
    });

    socket.on('leave-current-chat', (data) => {
      const { chatId, userId, currentUserId, notifyUsers } = data;

      notifyUsers.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((socket) => {
            try {
              io.to(socket).emit('remove-user-from-chat', {
                chatId,
                userId,
                currentUserId,
              });
            } catch (e) {}
          });
        }
      });
    });

    socket.on('delete-chat', (data) => {
      const { chatId, notifyUsers } = data;

      notifyUsers.forEach((id) => {
        if (users.has(id)) {
          users.get(id).sockets.forEach((socket) => {
            try {
              io.to(socket).emit('delete-chat', parseInt(chatId));
            } catch (e) {}
          });
        }
      });
    });

    socket.on('disconnect', async () => {
      console.log('Client disconnected');
      if (userSockets.has(socket.id)) {
        const user = users.get(userSockets.get(socket.id));
        if (user) {
          if (user.sockets.length > 1) {
            user.sockets = user.sockets.filter((sock) => {
              if (sock !== socket.id) return true;
              userSockets.delete(sock);
              return false;
            });

            users.set(user.id, user);
          } else {
            const chatters = await getChatters(user.id);

            for (let i = 0; i < chatters.length; i++) {
              if (users.has(chatters[i])) {
                users.get(chatters[i]).sockets.forEach((socket) => {
                  try {
                    io.to(socket).emit('status-update', {
                      userId: user.id,
                      status: 'offline',
                    });
                  } catch (e) {
                    console.log(e);
                  }
                });
              }
            }

            userSockets.delete(socket.id);
            users.delete(user.id);
          }
        }
      }
    });
  });
};

const getChatters = async (userId) => {
  try {
    const [results, metadata] = await sequelize.query(`
      select "cu"."userId" from "ChatUsers" as cu
      inner join (
          select "c"."id" from "Chats" as c
          where exists (
              select "u"."id" from "Users" as u
              inner join "ChatUsers" on u.id = "ChatUsers"."userId"
              where u.id = ${parseInt(userId)} and c.id = "ChatUsers"."chatId"
          )
      ) as cjoin on cjoin.id = "cu"."chatId"
      where "cu"."userId" != ${parseInt(userId)}
  `);

    return results.length > 0 ? results.map((el) => el.userId) : [];
  } catch (e) {
    console.log(e);
    return [];
  }
};

const setUsers = (user, socket) => {
  let sockets = [];
  if (users.has(user.id)) {
    const existingUser = users.get(user.id);
    existingUser.sockets = Array.from(new Set([...existingUser.sockets, socket.id]));
    existingUser.status = existingUser.status || 'online';
    users.set(user.id, existingUser);
    sockets = existingUser.sockets;
  } else {
    users.set(user.id, {
      id: user.id,
      sockets: [socket.id],
      status: 'online'
    });

    sockets = [socket.id];
  }

  userSockets.set(socket.id, user.id);

  return sockets;
};



module.exports = SocketServer;
