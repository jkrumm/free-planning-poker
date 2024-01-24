import { eq } from 'drizzle-orm';

import { BadRequestError, NotFoundError } from 'fpp/constants/error.constant';

import { validateNanoId } from 'fpp/utils/validate-nano-id.util';

import db from 'fpp/server/db/db';
import { type IUser, users } from 'fpp/server/db/schema';

export async function findUserById(userId: string | null): Promise<IUser> {
  if (!validateNanoId(userId)) {
    throw new BadRequestError('invalid userId');
  }

  const user: IUser | null =
    (await db.select().from(users).where(eq(users.id, userId!)))[0] ?? null;

  if (!user) {
    throw new NotFoundError('user not found');
  }

  return user;
}
