import { useCategoryById } from '@/features/server/categories/hooks';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TServerScreenBaseProps } from '../screens';
import { SectionedSettings } from '../sectioned-settings';
import { General } from './general';
import { CategoryPermissions } from './permissions';

type TCategorySettingsProps = TServerScreenBaseProps & {
  categoryId: number;
};

const CategorySettings = memo(
  ({ close, categoryId }: TCategorySettingsProps) => {
    const { t } = useTranslation('settings');
    const category = useCategoryById(categoryId);

    return (
      <SectionedSettings
        close={close}
        title={t('categorySettingsTitle')}
        groupLabel={category?.name ?? ''}
        sections={[
          {
            id: 'general',
            label: t('generalTab'),
            content: <General categoryId={categoryId} />
          },
          {
            id: 'permissions',
            label: t('permissionsTab'),
            content: <CategoryPermissions categoryId={categoryId} />
          }
        ]}
      />
    );
  }
);

export { CategorySettings };
