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
    // 1. Broadcaster Registration
    socket.on('broadcaster', (data) => {
        const streamName = (data && data.name) ? data.name : `Camera (${socket.id.substring(0, 4)})`;
        activeBroadcasters.set(socket.id, { id: socket.id, name: streamName });

        // BUG FIX: Broadcaster joins a dedicated chat room so it doesn't break private signaling
        socket.join(socket.id + "_chat");

        io.emit('broadcasterList', getBroadcasterList());
        console.log(`Broadcaster registered: "${streamName}"`);
    });

    // 2. Viewer Directory
    socket.on('getBroadcasters', () => {
        socket.emit('broadcasterList', getBroadcasterList());
    });

    // 3. Viewer connects to stream
    socket.on('watcher', (broadcasterId) => {
        if (activeBroadcasters.has(broadcasterId)) {
            // BUG FIX: Viewers join the separate chat room, NOT the private Socket ID
            socket.join(broadcasterId + "_chat");

            // BUG FIX: Directly ping the private socket ID for the WebRTC video handshake
            io.to(broadcasterId).emit('watcher', socket.id);
        }
    });

    // 4. Chat Routing (Isolated from Video)
    socket.on('leaveStream', (broadcasterId) => {
        socket.leave(broadcasterId + "_chat");
    });

    socket.on('chatMessage', (data) => {
        io.to(data.broadcasterId + "_chat").emit('chatMessage', data);
    });

    // 5. Explicit Point-to-Point WebRTC Signaling
    // BUG FIX: Using io.to(id) guarantees direct delivery, avoiding any room collisions
    socket.on('offer', (id, message) => io.to(id).emit('offer', socket.id, message));
    socket.on('answer', (id, message) => io.to(id).emit('answer', socket.id, message));
    socket.on('candidate', (id, message) => io.to(id).emit('candidate', socket.id, message));

    // 6. Cleanup
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
