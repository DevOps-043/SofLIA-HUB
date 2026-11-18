import { z } from 'zod';

const roomId = z.string().uuid();
const roomNamePrefix = 'soflia-room-';

export function roomVideoContext(current: { subsessionName: string; userStatus: string } | undefined): string | null | undefined {
  if (!current || ['initial', 'invited', 'main session'].includes(current.userStatus)) return null;
  if (current.userStatus !== 'in room' || !current.subsessionName.startsWith(roomNamePrefix)) return undefined;
  const id = roomId.safeParse(current.subsessionName.slice(roomNamePrefix.length));
  return id.success ? id.data : undefined;
}

export function roomVideoPage<T>(people: T[], requestedPage: number) {
  const pageSize = 9;
  const pages = Math.max(1, Math.ceil(people.length / pageSize));
  const page = Math.max(0, Math.min(requestedPage, pages - 1));
  return { people: people.slice(page * pageSize, (page + 1) * pageSize), page, pages };
}

export function peopleInVideoRoom<T extends { userId: number; subsessionId?: string; userGuid?: string }>(
  people: T[], subsessionId: string, self: number | undefined, joinedGuids: ReadonlySet<string>,
) {
  return people.filter(person => person.userId === self || (person.subsessionId
    ? person.subsessionId === subsessionId
    : !!person.userGuid && joinedGuids.has(person.userGuid)));
}
