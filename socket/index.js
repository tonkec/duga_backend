const socketIo = require('socket.io');
const { sequelize } = require('../models');
const Message = require('../models').Message;
const users = new Map();
const userSockets = new Map();
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
      io.emit("receive-comment", data);
    });

    socket.on("delete-comment", async (data) => {
      io.emit("remove-comment", data);
    });

    socket.on('edit-comment', async (data) => {
      io.emit("update-comment", data);
    })

    socket.on("upvote-upload", async (data) => {
      io.emit("upvote-upload", data);
    })

    socket.on("downvote-upload", async (data) => {
      io.emit("downvote-upload", data);
    })

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

      // send to new chatter
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
