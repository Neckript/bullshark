import { MAX_SOUND_NAME_LENGTH, type TJoinedSound } from '@sharkord/shared';
import { count, eq } from 'drizzle-orm';
import { db } from '..';
import { attachFileToken } from '../../helpers/files-crypto';
import { files, sounds, users } from '../schema';
import { getSettings } from './server';

const soundSelectFields = {
  sound: sounds,
  file: files,
  user: {
    id: users.id,
    name: users.name,
    bannerColor: users.bannerColor,
    nicknameColor: users.nicknameColor,
    nicknameFont: users.nicknameFont,
    showRoleBadge: users.showRoleBadge,
    bio: users.bio,
    createdAt: users.createdAt,
    banned: users.banned,
    avatarId: users.avatarId,
    bannerId: users.bannerId
  }
};

type TSoundRow = Awaited<ReturnType<typeof getSoundRows>>[number];

const getSoundRows = () =>
  db
    .select(soundSelectFields)
    .from(sounds)
    .innerJoin(files, eq(sounds.fileId, files.id))
    .innerJoin(users, eq(sounds.userId, users.id));

const parseSound = (
  row: TSoundRow,
  signedUrlsEnabled: boolean,
  signedUrlsTtlSeconds: number
): TJoinedSound => ({
  ...row.sound,
  file: attachFileToken(row.file, signedUrlsEnabled, signedUrlsTtlSeconds),
  user: { ...row.user, avatar: null, banner: null }
});

const getSoundById = async (id: number): Promise<TJoinedSound | undefined> => {
  const row = await getSoundRows().where(eq(sounds.id, id)).limit(1).get();

  if (!row) return undefined;

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  return parseSound(row, storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds);
};

const getSounds = async (): Promise<TJoinedSound[]> => {
  const rows = await getSoundRows();

  const { storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds } =
    await getSettings();

  return rows.map((row) =>
    parseSound(row, storageSignedUrlsEnabled, storageSignedUrlsTtlSeconds)
  );
};

const soundExists = async (name: string): Promise<boolean> => {
  const sound = await db
    .select()
    .from(sounds)
    .where(eq(sounds.name, name))
    .limit(1)
    .get();

  return !!sound;
};

const countSounds = async (): Promise<number> => {
  const result = await db.select({ value: count() }).from(sounds).get();

  return result?.value ?? 0;
};

const getUniqueSoundName = async (baseName: string): Promise<string> => {
  let normalizedBase = baseName.toLowerCase().replace(/\s+/g, '_');

  if (normalizedBase.length > MAX_SOUND_NAME_LENGTH - 3) {
    normalizedBase = normalizedBase.substring(0, MAX_SOUND_NAME_LENGTH - 3);
  }

  let soundName = normalizedBase.substring(0, MAX_SOUND_NAME_LENGTH);
  let counter = 1;

  while (await soundExists(soundName)) {
    const suffix = `_${counter}`;
    const maxBaseLength = MAX_SOUND_NAME_LENGTH - suffix.length;
    soundName = `${normalizedBase.substring(0, maxBaseLength)}${suffix}`;
    counter++;
  }

  return soundName;
};

export {
  countSounds,
  getSoundById,
  getSounds,
  getUniqueSoundName,
  soundExists
};
