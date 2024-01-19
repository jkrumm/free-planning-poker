import { eq, sql } from 'drizzle-orm';
import { type MySqlTable } from 'drizzle-orm/mysql-core/table';

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
    throw new NotFoundError('visitor not found');
  }

  return user;
}

export async function countTable(table: MySqlTable) {
  return Number(
    (await db.select({ count: sql<number>`count(*)` }).from(table))[0]?.count ??
      0,
  );
}
