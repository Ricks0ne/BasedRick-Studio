import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let rawCode = (body?.code || '').trim();

    if (!rawCode) {
      return NextResponse.json(
        { success: false, message: 'Please enter an access code.' },
        { status: 400 }
      );
    }

    // Master bypass check
    if (rawCode === 'BASE-BATCHES-004') {
      return NextResponse.json({ success: true });
    }

    // Strip accidental "invite:" prefix if the user typed or pasted it
    if (rawCode.toLowerCase().startsWith('invite:')) {
      rawCode = rawCode.slice(7).trim();
    }

    // Check exact key and uppercase variation
    const exactKey = `invite:${rawCode}`;
    const upperKey = `invite:${rawCode.toUpperCase()}`;

    // Attempt deletion
    const deletedExact = await redis.del(exactKey);
    const deletedUpper = exactKey !== upperKey ? await redis.del(upperKey) : 0;

    console.log(`[VerifyBeta] Checking code: "${rawCode}" -> deletedExact: ${deletedExact}, deletedUpper: ${deletedUpper}`);

    if (deletedExact === 1 || deletedUpper === 1) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid or already used access code.' },
      { status: 401 }
    );
  } catch (error: any) {
    console.error('[VerifyBeta Server Error]:', error);
    return NextResponse.json(
      { success: false, message: `Server error: ${error?.message || 'Check database connection'}` },
      { status: 500 }
    );
  }
}