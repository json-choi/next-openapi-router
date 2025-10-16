import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JWTPayload {
    sub: string; // user id
    email: string;
    role: string;
    permissions: string[];
    iat?: number;
    exp?: number;
}

export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN,
    });
}

export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        console.error('JWT verification error:', error);
        return null;
    }
}

export function decodeToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.decode(token) as JWTPayload;
        return decoded;
    } catch (error) {
        console.error('JWT decode error:', error);
        return null;
    }
}

export function isTokenExpired(token: string): boolean {
    const decoded = decodeToken(token);
    if (!decoded || !decoded.exp) {
        return true;
    }

    return Date.now() >= decoded.exp * 1000;
}

export function refreshToken(token: string): string | null {
    const decoded = verifyToken(token);
    if (!decoded) {
        return null;
    }

    // Create new token with same payload but new expiration
    const { iat, exp, ...payload } = decoded;
    return signToken(payload);
}
