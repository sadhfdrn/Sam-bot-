const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');

async function sendSessionId(phone, sessionId) {
  const filePath = path.resolve(__dirname, 'system_auth.json');
  const { state, saveState } = useSingleFileAuthState(filePath);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveState);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      const jid = `${phone}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: `Your Session ID is: *${sessionId}*` });
      console.log('Session ID sent successfully');
      await sock.logout();
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        console.log('Reconnecting...');
        sendSessionId(phone, sessionId);
      }
    }
  });
}

module.exports = sendSessionId;
