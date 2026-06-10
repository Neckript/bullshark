import { MentionRoleChip } from '@/components/mention-role-chip';
import { Node } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps
} from '@tiptap/react';
import { memo } from 'react';

const MentionRoleNodeView = memo(({ node }: NodeViewProps) => (
  <NodeViewWrapper as="span" className="mention-inline">
    <MentionRoleChip
      roleId={Number(node.attrs.roleId)}
      label={node.attrs.label}
    />
  </NodeViewWrapper>
));

export const MentionRoleNode = Node.create({
  name: 'mentionRole',
  group: 'inline',
  inline: true,
  atom: true,

  addNodeView() {
    return ReactNodeViewRenderer(MentionRoleNodeView, { as: 'span' });
  },

  addAttributes() {
    return {
      roleId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-role-id')?.trim() || null,
        renderHTML: (attrs) =>
          attrs.roleId != null ? { 'data-role-id': String(attrs.roleId) } : {}
      },
      label: {
        default: '',
        parseHTML: (el) =>
          (el as HTMLElement).textContent?.replace(/^@/, '') ?? '',
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="mention-role"]',
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const roleId = el.getAttribute('data-role-id')?.trim();
          const label = el.textContent?.replace(/^@/, '') ?? '';

          return roleId ? { roleId, label } : false;
        }
      }
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-type': 'mention-role',
        'data-role-id': String(node.attrs.roleId),
        class: 'mention'
      },
      `@${node.attrs.label ?? ''}`
    ];
  }
});
