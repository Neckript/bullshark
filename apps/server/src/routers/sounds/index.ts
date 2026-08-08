import { t } from '../../utils/trpc';
import { addSoundRoute } from './add-sound';
import { deleteSoundRoute } from './delete-sound';
import {
  onSoundCreateRoute,
  onSoundDeleteRoute,
  onSoundUpdateRoute
} from './events';
import { getSoundsRoute } from './get-sounds';
import { updateSoundRoute } from './update-sound';

export const soundsRouter = t.router({
  add: addSoundRoute,
  update: updateSoundRoute,
  delete: deleteSoundRoute,
  getAll: getSoundsRoute,
  onCreate: onSoundCreateRoute,
  onDelete: onSoundDeleteRoute,
  onUpdate: onSoundUpdateRoute
});
