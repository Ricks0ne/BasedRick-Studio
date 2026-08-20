import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize the edge-compatible Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function POST(request: Request) {
  try {
    const { code } = await request.json();

    // We prefix codes with "invite:" to keep the database organized
    // redis.del returns 1 if the code existed and was deleted, or 0 if it failed
    const wasDeleted = await redis.del(`invite:${code}`);

    // Let the Base Batches reviewers bypass the single-use check!
    const isMasterCode = code === 'BASE-BATCHES-004';

    if (wasDeleted === 1 || isMasterCode) {
      // Issue the secure cookie
      cookies().set('basedrick-beta-access', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, 
        path: '/',
      });
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid or already used access code.' }, 
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Server error' }, 
      { status: 500 }
    );
  }
}