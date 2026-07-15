import { NextResponse } from 'next/server';
import { getWhatsAppDaemonUrl } from '@/lib/db';

export async function GET() {
    try {
        const DAEMON = await getWhatsAppDaemonUrl();
        const res = await fetch(`${DAEMON}/api/whatsapp/status`, {
            method: 'GET',
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

