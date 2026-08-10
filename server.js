const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

app.use(express.static('public'));

let broadcaster = null;
const watchers = new Set();

io.on('connection', socket => {
    // 1. Broadcaster registers
    socket.on('broadcaster', () => {
        broadcaster = socket.id;
        socket.broadcast.emit('broadcaster');
        console.log(`Broadcaster registered: ${broadcaster}`);
    });

    // 2. Viewer registers desire to watch
    socket.on('watcher', () => {
        watchers.add(socket.id);
        if (broadcaster) {
            socket.to(broadcaster).emit('watcher', socket.id);
            console.log(`Watcher connected and requested stream: ${socket.id}`);
        }
    });

    // 3. WebRTC signaling relay
    socket.on('offer', (id, message) => {
        socket.to(id).emit('offer', socket.id, message);
    });

    socket.on('answer', (id, message) => {
        socket.to(id).emit('answer', socket.id, message);
    });

    socket.on('candidate', (id, message) => {
        socket.to(id).emit('candidate', socket.id, message);
    });

    // 4. Cleanup on disconnect
    socket.on('disconnect', () => {
        if (socket.id === broadcaster) {
            console.log('Broadcaster disconnected.');
            broadcaster = null;
            socket.broadcast.emit('disconnectPeer');
        } else if (watchers.has(socket.id)) {
            watchers.delete(socket.id);
            if (broadcaster) {
                socket.to(broadcaster).emit('disconnectPeer', socket.id);
            }
            console.log(`Watcher disconnected: ${socket.id}`);
        }
    });
});

http.listen(port, () => {
    console.log(`Signaling server running on http://localhost:${port}`);
});
