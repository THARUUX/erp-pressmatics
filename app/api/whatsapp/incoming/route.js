import { NextResponse } from 'next/server';
import pool from '@/lib/db';

const ACCEPTANCE_KEYWORDS = [
    'accept', 'accepted', 'yes', 'ok', 'okay', 'confirm', 'confirmed',
    'approved', 'approve', 'agree', 'agreed', 'proceed', 'go ahead',
    'sounds good', 'looks good', 'fine', 'done', 'sure',
];

function normalizePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('94') && digits.length === 11) return digits;
    if (digits.length === 10 && digits.startsWith('0')) return '94' + digits.substring(1);
    if (digits.length === 9) return '94' + digits;
    return digits;
}

function isAcceptance(body) {
    const lower = (body || '').toLowerCase().trim();
    return ACCEPTANCE_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * POST /api/whatsapp/incoming
 * Called by the WhatsApp daemon whenever a message arrives.
 * Body: { from: "94771234567@s.whatsapp.net", message: "Accept" }
 */
export async function POST(req) {
    try {
        const { from, message } = await req.json();
        if (!from || !message) {
            return NextResponse.json({ ignored: true, reason: 'missing fields' });
        }

        // Extract digits from JID (e.g. "94771234567:12@s.whatsapp.net" → "94771234567")
        const rawNumber = from.split(':')[0].split('@')[0];
        const normalized = normalizePhone(rawNumber);

        if (!isAcceptance(message)) {
            return NextResponse.json({ ignored: true, reason: 'not an acceptance keyword' });
        }

        // Find the most recently sent quotation to this phone number
        const [sends] = await pool.execute(
            `SELECT wqs.quotation_id, q.code as quotation_code, q.customer_name
             FROM whatsapp_quote_sends wqs
             LEFT JOIN quotations q ON q.id = wqs.quotation_id
             WHERE wqs.customer_phone = ?
             ORDER BY wqs.sent_at DESC
             LIMIT 1`,
            [normalized]
        );

        const match = sends[0] || null;

        await pool.execute(
            `INSERT INTO whatsapp_notifications 
             (from_number, message_body, quotation_id, quotation_code, customer_name, is_read)
             VALUES (?, ?, ?, ?, ?, 0)`,
            [
                normalized,
                message,
                match?.quotation_id || null,
                match?.quotation_code || null,
                match?.customer_name || null,
            ]
        );

        console.log(`[WA Incoming] Acceptance from ${normalized} — Quotation: ${match?.quotation_code || 'unknown'}`);
        return NextResponse.json({ success: true, matched_quotation: match?.quotation_code || null });
    } catch (err) {
        console.error('[WA Incoming]', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
