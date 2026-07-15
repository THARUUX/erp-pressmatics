import { NextResponse } from 'next/server';
import pool, { getWhatsAppDaemonUrl } from '@/lib/db';

function normalizePhone(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('94') && digits.length === 11) return digits;
    if (digits.length === 10 && digits.startsWith('0')) return '94' + digits.substring(1);
    if (digits.length === 9) return '94' + digits;
    return digits;
}

export async function POST(req) {
    try {
        const body = await req.json();
        const DAEMON = await getWhatsAppDaemonUrl();
        const res = await fetch(`${DAEMON}/api/whatsapp/send`, {

            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(body)
        });
        const data = await res.json();

        // If this was a quotation send and it succeeded, log it so replies can be matched
        if (res.ok && body.quotation_id && body.number) {
            const phone = normalizePhone(body.number);
            try {
                await pool.execute(
                    'INSERT INTO whatsapp_quote_sends (quotation_id, customer_phone) VALUES (?, ?)',
                    [body.quotation_id, phone]
                );
            } catch (dbErr) {
                console.error('[WA Send] Failed to log quote send:', dbErr.message);
            }
        }

        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        return NextResponse.json({ error: 'WhatsApp service offline', details: error.message }, { status: 502 });
    }
}

export const dynamic = 'force-dynamic';

// Raise the body size limit — base64 PDF payloads can exceed the default 1 MB
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
        },
    },
};

