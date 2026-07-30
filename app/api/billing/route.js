import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// Luhn check for credit cards
function validateCardNumber(number) {
    const sanitized = number.replace(/\D/g, '');
    if (sanitized.length < 13 || sanitized.length > 19) return false;

    let sum = 0;
    let shouldDouble = false;
    for (let i = sanitized.length - 1; i >= 0; i--) {
        let digit = parseInt(sanitized.charAt(i), 10);
        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
}

// Helper to ensure billing_cards table exists
async function ensureTableExists() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS billing_cards (
            id INT AUTO_INCREMENT PRIMARY KEY,
            cardholder_name VARCHAR(255) NOT NULL,
            card_number VARCHAR(255) NOT NULL,
            expiry VARCHAR(10) NOT NULL,
            cvv VARCHAR(10) NOT NULL,
            card_type VARCHAR(50) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

export async function GET() {
    try {
        await ensureTableExists();
        const [rows] = await pool.execute('SELECT id, cardholder_name, card_number, expiry, card_type, created_at FROM billing_cards ORDER BY id DESC');
        
        // Mask card numbers for security (e.g. •••• •••• •••• 1234)
        const maskedRows = rows.map(row => {
            const cleanNumber = row.card_number.replace(/\D/g, '');
            const last4 = cleanNumber.slice(-4);
            const masked = `•••• •••• •••• ${last4}`;
            return {
                id: row.id,
                cardholder_name: row.cardholder_name,
                card_number_masked: masked,
                last4,
                expiry: row.expiry,
                card_type: row.card_type,
                created_at: row.created_at
            };
        });

        return NextResponse.json(maskedRows);
    } catch (error) {
        console.error('Failed to fetch cards:', error);
        return NextResponse.json({ error: 'Failed to fetch billing cards' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await ensureTableExists();
        const body = await req.json();
        const { cardholder_name, card_number, expiry, cvv } = body;

        // Validations
        if (!cardholder_name || !cardholder_name.trim()) {
            return NextResponse.json({ error: 'Cardholder name is required' }, { status: 400 });
        }

        const sanitizedCardNumber = (card_number || '').replace(/\D/g, '');
        if (!validateCardNumber(sanitizedCardNumber)) {
            return NextResponse.json({ error: 'Invalid card number' }, { status: 400 });
        }

        // Determine card type
        let cardType = 'generic';
        if (/^4/.test(sanitizedCardNumber)) {
            cardType = 'visa';
        } else if (/^5[1-5]|^2[2-7]/.test(sanitizedCardNumber)) {
            cardType = 'mastercard';
        } else {
            return NextResponse.json({ error: 'Only Visa and Mastercard are accepted' }, { status: 400 });
        }

        // Expiration validation (MM/YY)
        const expiryRegex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
        if (!expiryRegex.test(expiry)) {
            return NextResponse.json({ error: 'Expiry date must be in MM/YY format' }, { status: 400 });
        }

        const [_, expMonth, expYear] = expiry.match(expiryRegex);
        const currentYear = parseInt(new Date().getFullYear().toString().slice(-2), 10);
        const currentMonth = new Date().getMonth() + 1;
        const yearInt = parseInt(expYear, 10);
        const monthInt = parseInt(expMonth, 10);

        if (yearInt < currentYear || (yearInt === currentYear && monthInt < currentMonth)) {
            return NextResponse.json({ error: 'Card is expired' }, { status: 400 });
        }

        // CVV validation
        const sanitizedCvv = (cvv || '').replace(/\D/g, '');
        if (sanitizedCvv.length < 3 || sanitizedCvv.length > 4) {
            return NextResponse.json({ error: 'Invalid CVV (must be 3 or 4 digits)' }, { status: 400 });
        }

        // Save card details in the database
        await pool.execute(
            `INSERT INTO billing_cards (cardholder_name, card_number, expiry, cvv, card_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [cardholder_name.trim(), sanitizedCardNumber, expiry, sanitizedCvv, cardType]
        );

        return NextResponse.json({ success: true, message: 'Card added successfully' });
    } catch (error) {
        console.error('Failed to save card:', error);
        return NextResponse.json({ error: 'Failed to save card details' }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        await ensureTableExists();
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
        }

        await pool.execute('DELETE FROM billing_cards WHERE id = ?', [id]);
        return NextResponse.json({ success: true, message: 'Card removed successfully' });
    } catch (error) {
        console.error('Failed to delete card:', error);
        return NextResponse.json({ error: 'Failed to remove card' }, { status: 500 });
    }
}
