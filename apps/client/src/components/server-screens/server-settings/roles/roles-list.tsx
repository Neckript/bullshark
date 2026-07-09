import { getTRPCClient } from '@/lib/trpc';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  OWNER_ROLE_ID,
  getTrpcError,
  type TJoinedRole
} from '@sharkord/shared';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@sharkord/ui';
import { Plus } from 'lucide-react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TRolesListProps = {
  roles: TJoinedRole[];
  selectedRoleId: number | undefined;
  setSelectedRoleId: (roleId: number) => void;
  refetch: () => void;
};

type TRoleRowProps = {
  role: TJoinedRole;
  selected: boolean;
  onSelect: () => void;
};

const rowClassName = (selected: boolean) =>
  `flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
    selected ? 'bg-accent' : ''
  }`;

const RoleDot = ({ color }: { color: string | null }) => (
  <div
    className="h-3 w-3 rounded-full"
    style={{ backgroundColor: color ?? '#6b7280' }}
  />
);

const StaticRoleRow = memo(({ role, selected, onSelect }: TRoleRowProps) => (
  <button onClick={onSelect} className={rowClassName(selected)}>
    <div className="flex items-center gap-2">
      <RoleDot color={role.color} />
      <span>{role.name}</span>
    </div>
  </button>
));

const SortableRoleRow = memo(({ role, selected, onSelect }: TRoleRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: role.id });

  return (
    <button
      ref={setNodeRef}
      onClick={onSelect}
      style={{
        transform: CSS.Transform.toString(transform && { ...transform, x: 0 }),
        transition,
        opacity: isDragging ? 0.5 : 1
      }}
      className={`${rowClassName(selected)} cursor-grab active:cursor-grabbing`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center gap-2">
        <RoleDot color={role.color} />
        <span>{role.name}</span>
      </div>
    </button>
  );
});

const RolesList = memo(
  ({ roles, selectedRoleId, setSelectedRoleId, refetch }: TRolesListProps) => {
    const { t } = useTranslation('settings');

    // roles arrive ordered by position desc: owner first, then movable, default last.
    const ownerRole = roles.find((r) => r.id === OWNER_ROLE_ID);
    const defaultRole = roles.find((r) => r.isDefault);
    const movableRoles = useMemo(
      () => roles.filter((r) => r.id !== OWNER_ROLE_ID && !r.isDefault),
      [roles]
    );
    const movableIds = useMemo(
      () => movableRoles.map((r) => r.id),
      [movableRoles]
    );

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    const onAddRole = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        const newRoleId = await trpc.roles.add.mutate();

        await refetch();

        setSelectedRoleId(newRoleId);
        toast.success(t('roleCreated'));
      } catch {
        toast.error(t('roleCreateFailed'));
      }
    }, [refetch, setSelectedRoleId, t]);

    const handleDragEnd = useCallback(
      async (event: DragEndEvent) => {
        const { active, over } = event;

        if (!over || active.id === over.id) return;

        const oldIndex = movableIds.indexOf(active.id as number);
        const newIndex = movableIds.indexOf(over.id as number);

        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = [...movableIds];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved!);

        const trpc = getTRPCClient();

        try {
          // reordered is top-first, matching the server's expectation
          await trpc.roles.reorder.mutate({ orderedRoleIds: reordered });
          await refetch();
        } catch (error) {
          toast.error(getTrpcError(error, t('roleReorderFailed')));
          await refetch();
        }
      },
      [movableIds, refetch, t]
    );

    return (
      <Card className="w-full md:w-64 md:flex-shrink-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('rolesTitle')}</CardTitle>
            <Button size="icon" variant="ghost" onClick={onAddRole}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 p-2">
          {ownerRole && (
            <StaticRoleRow
              role={ownerRole}
              selected={selectedRoleId === ownerRole.id}
              onSelect={() => setSelectedRoleId(ownerRole.id)}
            />
          )}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={movableIds}
              strategy={verticalListSortingStrategy}
            >
              {movableRoles.map((role) => (
                <SortableRoleRow
                  key={role.id}
                  role={role}
                  selected={selectedRoleId === role.id}
                  onSelect={() => setSelectedRoleId(role.id)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {defaultRole && (
            <StaticRoleRow
              role={defaultRole}
              selected={selectedRoleId === defaultRole.id}
              onSelect={() => setSelectedRoleId(defaultRole.id)}
            />
          )}
        </CardContent>
      </Card>
    );
  }
);

export { RolesList };
