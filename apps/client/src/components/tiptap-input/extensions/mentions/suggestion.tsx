import { UserAvatar } from '@/components/user-avatar';
import { getFileUrl } from '@/helpers/get-file-url';
import { getRenderedUsername } from '@/helpers/get-rendered-username';
import { isNoColor } from '@/helpers/resolve-name-color';
import { computePosition } from '@floating-ui/dom';
import type { TJoinedPublicUser, TJoinedRole } from '@sharkord/shared';
import type { Editor } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState
} from 'react';

const MENTION_STORAGE_KEY = 'mentionUsers';

export type TMentionItem =
  | { type: 'user'; id: number; user: TJoinedPublicUser }
  | { type: 'role'; id: number; role: TJoinedRole };

type TMentionListProps = {
  items: TMentionItem[];
  onSelect: (item: TMentionItem) => void;
};

export type TMentionListRef = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

const MentionList = forwardRef<TMentionListRef, TMentionListProps>(
  ({ items, onSelect }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = useCallback(
      (index: number) => items[index] && onSelect(items[index]),
      [items, onSelect]
    );

    const onKeyDown = useCallback(
      (e: KeyboardEvent): boolean => {
        if (items.length === 0) return false;

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((i) => (i <= 0 ? items.length - 1 : i - 1));

          return true;
        }

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((i) => (i >= items.length - 1 ? 0 : i + 1));

          return true;
        }

        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          selectItem(selectedIndex);

          return true;
        }

        if (e.key === 'Escape') return false;

        return false;
      },
      [items, selectItem, selectedIndex]
    );

    useImperativeHandle(ref, () => ({ onKeyDown }));

    if (items.length === 0) return null;

    return (
      <div
        className="bg-popover text-popover-foreground border rounded-md shadow-md min-w-[16rem] max-w-88 max-h-60 overflow-y-auto p-1 z-50"
        role="listbox"
        aria-label="Mention"
      >
        {items.map((item, index) => (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            role="option"
            aria-selected={index === selectedIndex}
            className={`w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex items-center gap-2 cursor-default select-none outline-none transition-colors ${
              index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
            }`}
            onClick={() => onSelect(item)}
          >
            {item.type === 'user' ? (
              <>
                <UserAvatar userId={item.id} className="h-6 w-6 shrink-0" />
                <span className="font-medium truncate">
                  {getRenderedUsername(item.user)}
                </span>
              </>
            ) : (
              <>
                {item.role.icon ? (
                  <img
                    src={getFileUrl(item.role.icon)}
                    alt=""
                    className="h-6 w-6 shrink-0 rounded-sm object-cover"
                  />
                ) : (
                  <span
                    className="h-3 w-3 ml-1.5 mr-1.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: isNoColor(item.role.color)
                        ? 'currentColor'
                        : item.role.color
                    }}
                  />
                )}
                <span
                  className="font-medium truncate"
                  style={
                    isNoColor(item.role.color)
                      ? undefined
                      : { color: item.role.color }
                  }
                >
                  @{item.role.name}
                </span>
              </>
            )}
          </button>
        ))}
      </div>
    );
  }
);

const reposition = (component: ReactRenderer | null, clientRect: DOMRect) => {
  if (!component?.element) return;

  const virtual = { getBoundingClientRect: () => clientRect };

  computePosition(virtual, component.element, { placement: 'top-start' }).then(
    (pos) => {
      if (component?.element)
        Object.assign(component.element.style, {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          position: pos.strategy === 'fixed' ? 'fixed' : 'absolute'
        });
    }
  );
};

const cleanup = (component: ReactRenderer | null) => {
  if (component?.element && document.body.contains(component.element)) {
    document.body.removeChild(component.element);
  }

  component?.destroy();
};

type TSuggestionProps = {
  editor: Editor;
  query: string;
  clientRect?: (() => DOMRect | null) | null;
  command: (item: TMentionItem) => void;
};

const MentionSuggestion = {
  items: ({
    editor,
    query
  }: {
    editor: Editor;
    query: string;
  }): TMentionItem[] => {
    const storage = (
      editor.storage as unknown as Record<
        string,
        { users?: TJoinedPublicUser[]; roles?: TJoinedRole[] }
      >
    )[MENTION_STORAGE_KEY];

    const users = storage?.users ?? [];
    const roles = storage?.roles ?? [];

    const q = query.toLowerCase();

    const roleItems: TMentionItem[] = roles
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => b.position - a.position)
      .map((role) => ({ type: 'role', id: role.id, role }));

    const userItems: TMentionItem[] = users
      .filter((u) => !q || getRenderedUsername(u).toLowerCase().includes(q))
      .sort((a, b) => {
        const aName = getRenderedUsername(a).toLowerCase();
        const bName = getRenderedUsername(b).toLowerCase();

        const aS = aName.startsWith(q);
        const bS = bName.startsWith(q);

        if (aS && !bS) return -1;
        if (!aS && bS) return 1;

        return aS && bS ? aName.length - bName.length : 0;
      })
      .map((user) => ({ type: 'user', id: user.id, user }));

    // Roles first (fewer, intentional pings), then users; capped at 10.
    return [...roleItems, ...userItems].slice(0, 10);
  },
  allowSpaces: false,
  render: () => {
    let component: ReactRenderer | null = null;
    return {
      onStart(props: TSuggestionProps) {
        const items = MentionSuggestion.items({
          editor: props.editor,
          query: props.query
        });
        const onSelect = (item: TMentionItem) => {
          props.command(item);

          cleanup(component);

          component = null;
        };
        component = new ReactRenderer(MentionList, {
          props: { items, onSelect },
          editor: props.editor
        });

        document.body.appendChild(component.element);

        const rect = props.clientRect?.();

        if (rect) {
          reposition(component, rect);
        }
      },
      onUpdate(props: TSuggestionProps) {
        const items = MentionSuggestion.items({
          editor: props.editor,
          query: props.query
        });
        component?.updateProps({
          items,
          onSelect: (item: TMentionItem) => {
            props.command(item);

            cleanup(component);

            component = null;
          }
        });
        const rect = props.clientRect?.();

        if (rect) {
          reposition(component, rect);
        }
      },
      onKeyDown(props: { event: KeyboardEvent }) {
        const ref = component?.ref as TMentionListRef | undefined;

        return ref?.onKeyDown(props.event) ?? false;
      },
      onExit() {
        cleanup(component);
        component = null;
      }
    };
  }
};

export { MENTION_STORAGE_KEY, MentionSuggestion };
