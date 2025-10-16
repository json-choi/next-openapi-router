import { NextResponse } from 'next/server';
import { createController } from '../../../src';
import { jwtProvider } from './auth';

// Create controller with JWT provider
export const controller = createController({
    auth: jwtProvider,
    onAuthError: () => {
        return NextResponse.json(
            { error: 'Authentication required', code: 'AUTH_REQUIRED' },
            { status: 401 }
        );
    },
    onValidationError: errors => {
        return NextResponse.json(
            {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors,
            },
            { status: 400 }
        );
    },
    onInternalError: error => {
        console.error('Internal server error:', error);
        return NextResponse.json(
            { error: 'Internal server error', code: 'INTERNAL_ERROR' },
            { status: 500 }
        );
    },
});
