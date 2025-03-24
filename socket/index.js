const socketIo = require('socket.io');
const { sequelize } = require('../models');
const Message = require('../models').Message;
const users = new Map();
const userSockets = new Map();
const Notification = require('../models').Notification;
const SocketServer = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: '*',
      methods: 'GET, HEAD, PUT, PATCH, POST, DELETE',
      allowedHeaders: ['Content-Type'],
    },
  });

  io.on('connection', (socket) => {
    console.log('New client connected');
    socket.on('join', async (user) => {
      setUsers(user, socket);
    });

    socket.on("send-comment", async (data) => {
      try {
        const { userId, uploadId } = data.data; 
    
        const parsedUploadId = parseInt(uploadId);
        if (isNaN(parsedUploadId)) {
          console.error("❌ Invalid uploadId:", uploadId);
          return;
        }
    
        io.emit("receive-comment", data);

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
    

    socket.on("delete-comment", async (data) => {
      io.emit("remove-comment", data);
    });

    socket.on('edit-comment', async (data) => {
      io.emit("update-comment", data);
    })

    socket.on("upvote-upload", async (data) => {
      try {
        const like = data[0];
        const { userId, photoId } = like;
    
        io.emit("upvote-upload", {
          uploadId: photoId,
          likes: data,
        });
    
        const parsedPhotoId = parseInt(photoId);
        if (isNaN(parsedPhotoId)) {
          console.error("Invalid photoId:", photoId);
          return;
        }
    
        const [results] = await sequelize.query(
          `SELECT "userId" FROM "Uploads" WHERE id = :uploadId`,
          {
            replacements: { uploadId: parsedPhotoId },
            type: sequelize.QueryTypes.SELECT,
          }
        );
    
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
        const {  uploadId } = likeData;
    
        if (!uploadId) {
          console.error("❌ Missing uploadId in downvote-upload");
          return;
        }
    
        const [likes] = await sequelize.query(
          `SELECT * FROM "PhotoLikes" WHERE "photoId" = :uploadId`,
          {
            replacements: { uploadId: parseInt(uploadId) },
            type: sequelize.QueryTypes.SELECT,
          }
        );
    
        io.emit("downvote-upload", {
          uploadId,
          likes,
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
                    io.to(socket).emit('offline', user);
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
    users.set(user.id, existingUser);
    sockets = existingUser.sockets;
  } else {
    users.set(user.id, { id: user.id, sockets: [socket.id] });
    sockets = [socket.id];
  }
  userSockets.set(socket.id, user.id);
  return sockets;
};


module.exports = SocketServer;
