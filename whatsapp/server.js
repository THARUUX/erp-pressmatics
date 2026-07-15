const express = require('express');
const cors = require('cors');
const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    BufferJSON, 
    initAuthCreds,
    proto 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const app = express();
const PORT = process.env.WHATSAPP_PORT || 5001;

app.use(cors());
app.use(express.json({ limit: '20mb' })); // large enough for base64-encoded PDFs

// Database Connection Pool
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '4000', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
    },
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
});

let sock = null;
let connectionState = 'DISCONNECTED';
let qrCode = null;
let profileInfo = null;
let isConnecting = false;

// Format phone number to WhatsApp JID
function formatWhatsAppJID(phone) {
    if (!phone) return null;
    let digits = phone.replace(/\D/g, '');
    if (digits.length === 9) {
        digits = '94' + digits;
    } else if (digits.length === 10 && digits.startsWith('0')) {
        digits = '94' + digits.substring(1);
    }
    return digits + '@s.whatsapp.net';
}

// Custom DB Auth State Handler with file auto-migration
const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');

async function useDatabaseAuthState(sessionId, pool, authPath) {
    const writeData = async (data, file) => {
        const dataId = fixFileName(file);
        const jsonString = JSON.stringify(data, BufferJSON.replacer);
        await pool.execute(
            `INSERT INTO whatsapp_sessions (session_id, data_id, data_json) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE data_json = ?`,
            [sessionId, dataId, jsonString, jsonString]
        );
    };

    const readData = async (file) => {
        const dataId = fixFileName(file);

        // 1. Try reading from the database
        try {
            const [rows] = await pool.execute(
                `SELECT data_json FROM whatsapp_sessions WHERE session_id = ? AND data_id = ?`,
                [sessionId, dataId]
            );
            if (rows.length > 0) {
                return JSON.parse(rows[0].data_json, BufferJSON.reviver);
            }
        } catch (dbErr) {
            console.error(`Database read error for ${dataId}:`, dbErr);
        }

        // 2. Fallback: Try migrating from file system
        if (authPath) {
            const filePath = path.join(authPath, dataId);
            if (fs.existsSync(filePath)) {
                try {
                    const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
                    const parsed = JSON.parse(fileContent, BufferJSON.reviver);
                    console.log(`[Auto-Migration] Migrating ${dataId} to database...`);
                    await writeData(parsed, file);
                    fs.unlinkSync(filePath);
                    return parsed;
                } catch (fsErr) {
                    console.error(`Failed to migrate file ${dataId}:`, fsErr);
                }
            }
        }
        return null;
    };

    const removeData = async (file) => {
        const dataId = fixFileName(file);
        try {
            await pool.execute(
                `DELETE FROM whatsapp_sessions WHERE session_id = ? AND data_id = ?`,
                [sessionId, dataId]
            );
        } catch (dbErr) {
            console.error(`Database delete error for ${dataId}:`, dbErr);
        }

        // Clean up fallback file if it exists
        if (authPath) {
            const filePath = path.join(authPath, dataId);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                } catch (fsErr) {
                    // ignore
                }
            }
        }
    };

    const creds = (await readData('creds.json')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}.json`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, 'creds.json');
        }
    };
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
        const { state, saveCreds } = await useDatabaseAuthState('default', dbPool, authPath);

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

                    // Clean up DB session
                    try {
                        await dbPool.execute(`DELETE FROM whatsapp_sessions WHERE session_id = 'default'`);
                        console.log('Cleared session from database.');
                    } catch (dbErr) {
                        console.error('Failed to clear session from database:', dbErr);
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

                // 1. Log incoming message to DB
                try {
                    const messageId = msg.key.id;
                    const senderName = msg.pushName || 'WhatsApp User';
                    const chatNumber = from.split(':')[0].split('@')[0];

                    let mediaMime = null;
                    let mediaFilename = null;
                    let messageType = 'text';

                    if (msg.message?.imageMessage) {
                        messageType = 'image';
                        mediaMime = msg.message.imageMessage.mimetype;
                    } else if (msg.message?.documentMessage) {
                        messageType = 'document';
                        mediaMime = msg.message.documentMessage.mimetype;
                        mediaFilename = msg.message.documentMessage.fileName;
                    }

                    await dbPool.execute(
                        `INSERT INTO whatsapp_messages 
                         (id, chat_id, from_me, sender_name, message_body, message_type, media_mime, media_filename, status)
                         VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'received')
                         ON DUPLICATE KEY UPDATE status = 'received'`,
                        [messageId, chatNumber, senderName, body, messageType, mediaMime, mediaFilename]
                    );
                } catch (dbErr) {
                    console.error('[WA Incoming] Failed to save message to database:', dbErr.message);
                }

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

    try {
        await dbPool.execute(`DELETE FROM whatsapp_sessions WHERE session_id = 'default'`);
        console.log('Cleared session from database.');
    } catch (dbErr) {
        console.error('Failed to clear session from database:', dbErr);
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
        let messageType = 'text';
        let mediaMime = null;
        let mediaFilename = null;

        if (media && media.data) {
            console.log(`Sending media to ${jid} with filename ${media.filename}`);
            const buffer = Buffer.from(media.data, 'base64');
            messageType = 'document';
            mediaMime = media.mimetype || 'application/pdf';
            mediaFilename = media.filename || 'document.pdf';

            result = await sock.sendMessage(jid, {
                document: buffer,
                mimetype: mediaMime,
                fileName: mediaFilename,
                caption: message || ''
            });
        } else {
            if (!message) {
                return res.status(400).json({ error: 'Missing message content' });
            }
            console.log(`Sending message to ${jid}: "${message.substring(0, 30)}..."`);
            result = await sock.sendMessage(jid, { text: message });
        }

        // Log outgoing message to database
        try {
            const messageId = result.key.id;
            const chatNumber = number.replace(/\D/g, '');

            await dbPool.execute(
                `INSERT INTO whatsapp_messages 
                 (id, chat_id, from_me, sender_name, message_body, message_type, media_mime, media_filename, status)
                 VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'sent')
                 ON DUPLICATE KEY UPDATE status = 'sent'`,
                [
                    messageId,
                    chatNumber,
                    profileInfo?.name || 'Self',
                    message || '',
                    messageType,
                    mediaMime,
                    mediaFilename
                ]
            );
        } catch (dbErr) {
            console.error('[WA Outgoing] Failed to save sent message to database:', dbErr.message);
        }

        res.json({ success: true, messageId: result.key.id });
    } catch (err) {
        console.error('Failed to send WhatsApp message:', err);
        res.status(500).json({ error: 'Failed to send message', details: err.message });
    }
});

// Auto-boot if credentials exist in database or filesystem
const authPath = path.join(__dirname, 'whatsapp_auth_info');
async function autoBoot() {
    try {
        const [rows] = await dbPool.execute(
            `SELECT 1 FROM whatsapp_sessions WHERE session_id = 'default' AND data_id = 'creds.json' LIMIT 1`
        );
        const hasDbCreds = rows.length > 0;
        const hasFileCreds = fs.existsSync(path.join(authPath, 'creds.json'));

        if (hasDbCreds || hasFileCreds) {
            console.log('Stored WhatsApp credentials detected. Auto-connecting...');
            connectToWhatsApp();
        } else {
            console.log('No WhatsApp credentials detected. Waiting for user to connect.');
        }
    } catch (err) {
        console.error('Error checking credentials for auto-boot:', err);
        // fallback
        if (fs.existsSync(path.join(authPath, 'creds.json'))) {
            connectToWhatsApp();
        }
    }
}
autoBoot();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`WhatsApp microservice listening on http://localhost:${PORT}`);
});
