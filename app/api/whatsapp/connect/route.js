import { NextResponse } from 'next/server';

const DAEMON = process.env.WHATSAPP_DAEMON_URL || 'http://localhost:5001';

export async function POST() {
    try {
        const res = await fetch(`${DAEMON}/api/whatsapp/connect`, {
            method: 'POST',
            headers: { 'Cache-Control': 'no-cache' },
            cache: 'no-store'
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'WhatsApp service offline', details: error.message }, { status: 502 });
    }
}
export const dynamic = 'force-dynamic';

