import { NextResponse } from 'next/server';
import QRCode from 'qrcode';

export async function GET(req, { params }) {
    const { id } = await params;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const url = `${baseUrl}/jobs/${id}`;

    const png = await QRCode.toBuffer(url, {
        type: 'png',
        width: 300,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' }
    });

    return new Response(png, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}
