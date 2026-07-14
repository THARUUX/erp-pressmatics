const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();
const PORT = process.env.WHATSAPP_PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // large enough for base64-encoded PDFs



let sock = null;
let connectionState = 'DISCONNECTED';
let qrCode = null;
let profileInfo = null;
let isConnecting = false;

// Format phone number to WhatsApp JID
function formatWhatsAppJID(phone) {
    if (!phone) return null;
    // remove all non-digits
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 9) {
        digits = '94' + digits;
    } else if (digits.length === 10 && digits.startsWith('0')) {
        digits = '94' + digits.substring(1);
    }
    return digits + '@s.whatsapp.net';
}

async function connectToWhatsApp() {
    if (isConnecting || connectionState === 'CONNECTED') return;
    isConnecting = true;
    connectionState = 'CONNECTING';
    qrCode = null;
    profileInfo = null;

    console.log('Initializing WhatsApp connection...');

    try {
        const authPath = path.join(__dirname, 'whatsapp_auth_info');
        const { state, saveCreds } = await useMultiFileAuthState(authPath);

        let version = [2, 3000, 1015901307]; // fallback default version
        try {
            const { version: latestVersion, isLatest } = await fetchLatestBaileysVersion();
            console.log(`Using WhatsApp version ${latestVersion.join('.')}, isLatest: ${isLatest}`);
            version = latestVersion;
        } catch (verErr) {
            console.error('Failed to fetch latest WhatsApp version, using fallback:', verErr);
        }

        sock = makeWASocket({
            auth: state,
            version,
            logger: pino({ level: 'silent' }),
            browser: ['Ubuntu', 'Chrome', '110.0.5481.100']
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                connectionState = 'QR';
                qrCode = qr;
                console.log('New QR code received');
            }

            if (connection === 'close') {
                isConnecting = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode || (lastDisconnect?.error instanceof Boom ? lastDisconnect.error.output.statusCode : null);
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(`Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`);

                if (shouldReconnect) {
                    connectionState = 'CONNECTING';
                    setTimeout(() => connectToWhatsApp(), 5000);
                } else {
                    connectionState = 'DISCONNECTED';
                    qrCode = null;
                    profileInfo = null;
                    sock = null;

                    // Clean up session folder
                    try {
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true });
                        }
                    } catch (e) {
                        console.error('Failed to clean up credentials directory:', e);
                    }
                }
            } else if (connection === 'open') {
                isConnecting = false;
                connectionState = 'CONNECTED';
                qrCode = null;
                const user = sock.user;
                profileInfo = {
                    id: user.id,
                    name: user.name || 'WhatsApp Linked Account',
                    number: user.id.split(':')[0]
                };
                console.log('WhatsApp connection successfully opened for number:', profileInfo.number);
            }
        });

        // ── Incoming Message Listener ──────────────────────────────────────────
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify') return; // only real-time messages, not history

            for (const msg of messages) {
                if (msg.key.fromMe) continue; // ignore messages sent by us
                if (!msg.message) continue;

                const from = msg.key.remoteJid;
                const body =
                    msg.message?.conversation ||
                    msg.message?.extendedTextMessage?.text ||
                    msg.message?.imageMessage?.caption ||
                    msg.message?.documentMessage?.caption ||
                    '';

                if (!body) continue;

                console.log(`[WA Incoming] From: ${from} | Message: "${body.substring(0, 60)}"`);

                // Forward to Next.js webhook for storage and matching
                try {
                    const nextjsBase = process.env.NEXTJS_BASE_URL || 'http://localhost:3000';
                    await fetch(`${nextjsBase}/api/whatsapp/incoming`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ from, message: body })
                    });
                } catch (err) {
                    console.error('[WA Incoming] Failed to forward to Next.js:', err.message);
                }
            }
        });

    } catch (err) {
        console.error('Failed to initialize Baileys connection:', err);
        isConnecting = false;
        connectionState = 'DISCONNECTED';
    }
}

// REST Endpoints
app.get('/api/whatsapp/status', async (req, res) => {
    let qrDataUrl = null;
    if (connectionState === 'QR' && qrCode) {
        try {
            qrDataUrl = await QRCode.toDataURL(qrCode);
        } catch (err) {
            console.error('Failed to generate QR data URL:', err);
        }
    }

    res.json({
        state: connectionState,
        qr: qrDataUrl,
        profile: profileInfo
    });
});

app.post('/api/whatsapp/connect', (req, res) => {
    if (connectionState === 'CONNECTED') {
        return res.json({ success: true, message: 'Already connected' });
    }
    connectToWhatsApp();
    res.json({ success: true, message: 'Connection sequence started' });
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
    console.log('Disconnect requested...');
    try {
        if (sock) {
            await sock.logout();
        }
    } catch (e) {
        console.error('Error logging out from socket:', e);
    }

    connectionState = 'DISCONNECTED';
    qrCode = null;
    profileInfo = null;
    sock = null;
    isConnecting = false;

    try {
        const authPath = path.join(__dirname, 'whatsapp_auth_info');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    } catch (e) {
        console.error('Failed to clear credentials directory:', e);
    }

    res.json({ success: true, message: 'Disconnected successfully' });
});

app.post('/api/whatsapp/send', async (req, res) => {
    const { number, message, media } = req.body;

    if (connectionState !== 'CONNECTED' || !sock) {
        return res.status(400).json({ error: 'WhatsApp is not connected' });
    }

    if (!number) {
        return res.status(400).json({ error: 'Missing phone number' });
    }

    const jid = formatWhatsAppJID(number);

    try {
        let result;
        if (media && media.data) {
            console.log(`Sending media to ${jid} with filename ${media.filename}`);
            const buffer = Buffer.from(media.data, 'base64');
            result = await sock.sendMessage(jid, {
                document: buffer,
                mimetype: media.mimetype || 'application/pdf',
                fileName: media.filename || 'document.pdf',
                caption: message || ''
            });
        } else {
            if (!message) {
                return res.status(400).json({ error: 'Missing message content' });
            }
            console.log(`Sending message to ${jid}: "${message.substring(0, 30)}..."`);
            result = await sock.sendMessage(jid, { text: message });
        }
        res.json({ success: true, messageId: result.key.id });
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
        res.status(500).json({ error: 'Failed to send message', details: err.message });
    }
});

// Auto-boot if credentials exist
const authPath = path.join(__dirname, 'whatsapp_auth_info');
if (fs.existsSync(path.join(authPath, 'creds.json'))) {
    console.log('Stored WhatsApp credentials detected. Auto-connecting...');
    connectToWhatsApp();
} else {
    console.log('No WhatsApp credentials detected. Waiting for user to connect.');
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp microservice listening on http://localhost:${PORT}`);
});
