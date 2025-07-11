const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'https://tic-tac-toe-multiplayer-9jw0gax9h-tosif-shaikhs-projects.vercel.app',
            'https://tic-tac-toe-multiplayer-lhdhg5yj1-tosif-shaikhs-projects.vercel.app',
            'http://localhost:8000',
            'http://localhost:5500'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const rooms = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('createRoom', () => {
        const roomId = `room-${Math.random().toString(36).slice(2, 9)}`;
        rooms.set(roomId, {
            board: Array(9).fill(''),
            players: [socket.id],
            currentPlayer: 'X'
        });
        socket.join(roomId);
        socket.emit('roomCreated', roomId);
        console.log(`Room created: ${roomId}`);
    });

    socket.on('joinRoom', () => {
        let joined = false;
        for (const [roomId, room] of rooms) {
            if (room.players.length === 1) {
                room.players.push(socket.id);
                socket.join(roomId);
                socket.emit('roomCreated', roomId);
                socket.emit('player', room.players.length === 1 ? 'X' : 'O');
                io.to(roomId).emit('start');
                joined = true;
                console.log(`Player ${socket.id} joined room ${roomId}`);
                break;
            }
        }
        if (!joined) {
            socket.emit('status', rooms.size === 0 ? 'No rooms available' : 'All rooms are full');
            socket.disconnect();
        }
    });

    socket.on('move', ({ roomId, index }) => {
        const room = rooms.get(roomId);
        if (!room || !room.players.includes(socket.id)) return;
        if (room.board[index] === '' && room.players.length === 2) {
            room.board[index] = room.currentPlayer;
            io.to(roomId).emit('move', { index, player: room.currentPlayer });
            if (checkWin(room.board)) {
                io.to(roomId).emit('win', room.currentPlayer);
                room.board = Array(9).fill('');
            } else if (room.board.every(cell => cell !== '')) {
                io.to(roomId).emit('draw');
                room.board = Array(9).fill('');
            } else {
                room.currentPlayer = room.currentPlayer === 'X' ? 'O' : 'X';
            }
        }
    });

    socket.on('reset', (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.board = Array(9).fill('');
            room.currentPlayer = 'X';
            io.to(roomId).emit('reset');
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        rooms.forEach((room, roomId) => {
            room.players = room.players.filter(id => id !== socket.id);
            if (room.players.length === 0) {
                rooms.delete(roomId);
            } else {
                io.to(roomId).emit('status', 'Opponent disconnected. Waiting for new opponent...');
            }
        });
    });
});

function checkWin(board) {
    const wins = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    return wins.some(combo => combo.every(i => board[i] === board[combo[0]] && board[i] !== ''));
}

server.listen(process.env.PORT || 3000, () => console.log('Server running'));
