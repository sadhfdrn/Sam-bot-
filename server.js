const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const { v4: uuidv4 } = require('uuid');
const pino = require('pino');
const path = require('path');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static('public'));
app.use(express.json());

let currentSocket = null;

wss.on('connection', ws => {
  console.log('WebSocket client connected');
  currentSocket = ws;

  ws.on('message', async message => {
    const data = JSON.parse(message);
    if (!data.phone || !data.method) return;

    const sessionId = `Samuel>${uuidv4().split('-')[0]}`;
    const sessionPath = path.join(__dirname, 'sessions', sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
      },
      browser: ['Baileys', 'Chrome', '10.0'],
    });

    sock.ev.on('connection.update', update => {
      const { qr, pairingCode, connection } = update;
      if (qr && data.method === 'qr' && currentSocket?.readyState === 1) {
        currentSocket.send(JSON.stringify({ type: 'qr', qr }));
      } else if (pairingCode && data.method === 'pair' && currentSocket?.readyState === 1) {
        currentSocket.send(JSON.stringify({ type: 'pair', pairingCode }));
      } else if (connection === 'open') {
        console.log(`Connected: ${sessionId}`);
        if (currentSocket?.readyState === 1) {
          currentSocket.send(JSON.stringify({ type: 'connected', sessionId }));
        }
      }
    });

    sock.ev.on('creds.update', saveCreds);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});