const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 10000;
app.use(express.static('public'));

const activeBroadcasters = new Map();

function getBroadcasterList() {
    return Array.from(activeBroadcasters.values());
}

io.on('connection', socket => {
    socket.on('broadcaster', (data) => {
        const streamName = (data && data.name) ? data.name : `Camera (${socket.id.substring(0, 4)})`;
        activeBroadcasters.set(socket.id, { id: socket.id, name: streamName });
        io.emit('broadcasterList', getBroadcasterList());
        console.log(`Broadcaster registered: "${streamName}"`);
    });

    socket.on('getBroadcasters', () => {
        socket.emit('broadcasterList', getBroadcasterList());
    });

    socket.on('watcher', (broadcasterId) => {
        if (activeBroadcasters.has(broadcasterId)) {
            // Join the specific broadcast's chat room
            socket.join(broadcasterId);
            socket.to(broadcasterId).emit('watcher', socket.id);
            console.log(`Watcher ${socket.id} joined stream ${broadcasterId}`);
        }
    });

    // Handle leaving the room so chats don't cross over
    socket.on('leaveStream', (broadcasterId) => {
        socket.leave(broadcasterId);
    });

    // Broadcast chat messages to everyone in the specific stream's room
    socket.on('chatMessage', (data) => {
        // data contains: { broadcasterId, name, text }
        io.to(data.broadcasterId).emit('chatMessage', data);
    });

    socket.on('offer', (id, message) => socket.to(id).emit('offer', socket.id, message));
    socket.on('answer', (id, message) => socket.to(id).emit('answer', socket.id, message));
    socket.on('candidate', (id, message) => socket.to(id).emit('candidate', socket.id, message));

    socket.on('disconnect', () => {
        if (activeBroadcasters.has(socket.id)) {
            activeBroadcasters.delete(socket.id);
            io.emit('broadcasterList', getBroadcasterList());
            io.emit('disconnectPeer', socket.id);
        } else {
            socket.broadcast.emit('disconnectPeer', socket.id);
        }
    });
});

http.listen(port, () => console.log(`Server running on port ${port}`));
