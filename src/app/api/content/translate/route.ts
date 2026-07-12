import { db } from '@/app/libs/prismadb';
import { t } from '@/modules/content';
import { Locale } from '@/modules/content';

export async function POST(request: Request) {
  try {
    const { key, locale } = await request.json();

    if (!key || typeof key !== 'string') {
      return Response.json(
        { error: 'Missing or invalid key' },
        { status: 400 }
      );
    }

    const value = await t(db, key, {}, (locale as Locale) || 'ru');

    return Response.json({ key, value, locale });
  } catch (error) {
    console.error('Translation error:', error);
    return Response.json(
      { error: 'Failed to fetch translation' },
      { status: 500 }
    );
  }
}
