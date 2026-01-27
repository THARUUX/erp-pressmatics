import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-prod';

export async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}
