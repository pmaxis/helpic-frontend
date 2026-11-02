<script setup lang="ts">
/**
 * A WYSIWYG box for Markdown: a toolbar over the text (bold, italic, strike,
 * code, headings, lists, a quote, a code block, a link, undo and redo), and
 * Markdown shortcuts as typed ("## ", "- ", "1. ", "**bold**"…). v-model is
 * the Markdown. ⌘/Ctrl + Enter emits "submit", Esc "cancel", leaving the
 * box "blur" — unless the focus only went to the toolbar.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    id?: string
    placeholder?: string
    disabled?: boolean
    /** The box's least height, in lines of text. */
    rows?: number
    invalid?: boolean
    describedby?: string
    /** Its accessible name… */
    label?: string
    /** …or the id of what names it. */
    labelledby?: string
    /** Puts the caret at the end of the text as soon as it's there. */
    autofocus?: boolean
    /**
     * Where the toolbar stays while a long text scrolls: a sticky top counts
     * from inside the scrolling box's padding, so a box padded around the
     * editor passes its padding, negated, to keep the toolbar at its very top.
     */
    stickyTop?: string
  }>(),
  { rows: 6, stickyTop: '0px' },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  submit: []
  cancel: []
  blur: []
}>()

const { t } = useI18n()
const root = ref<HTMLElement | null>(null)
/** The Markdown last sent out, so it isn't read back in as a change. */
let last = props.modelValue

const editor = useEditor({
  content: props.modelValue,
  contentType: 'markdown',
  editable: !props.disabled,
  autofocus: props.autofocus ? 'end' : false,
  extensions: [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Markdown has no underline.
      underline: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: 'https',
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer nofollow' },
      },
    }),
    Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
    Placeholder.configure({ placeholder: () => props.placeholder ?? '' }),
  ],
  editorProps: {
    attributes: () => ({
      class: 'rich-text rich-text-editor focus:outline-none',
      role: 'textbox',
      'aria-multiline': 'true',
      ...(props.id ? { id: props.id } : {}),
      ...(props.label ? { 'aria-label': props.label } : {}),
      ...(props.labelledby ? { 'aria-labelledby': props.labelledby } : {}),
      ...(props.invalid ? { 'aria-invalid': 'true' } : {}),
      ...(props.describedby ? { 'aria-describedby': props.describedby } : {}),
    }),
    handleKeyDown: (_view, e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        emit('submit')
        return true
      }
      // Esc goes on up as well: in a dialog it closes the dialog.
      if (e.key === 'Escape') emit('cancel')
      return false
    },
  },
  onUpdate: ({ editor }) => {
    last = editor.isEmpty ? '' : editor.getMarkdown()
    emit('update:modelValue', last)
  },
  onBlur: ({ event }) => {
    // The focus went to the toolbar or the link field: still editing.
    if (root.value?.contains(event.relatedTarget as Node | null)) return
    emit('blur')
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value || value === last) return
    last = value
    editor.value.commands.setContent(value, { contentType: 'markdown', emitUpdate: false })
  },
)
watch(
  () => props.disabled,
  (d) => editor.value?.setEditable(!d, false),
)
// The box's attributes are read on each update of the editor: one for them.
watch(
  () => [props.invalid, props.describedby, props.label],
  () => editor.value?.view.updateState(editor.value.state),
)
onBeforeUnmount(() => editor.value?.destroy())

/** Puts the caret in the box, at the end of the text. */
function focus() {
  editor.value?.commands.focus('end')
}
defineExpose({ focus })

type Action = { key: string; label: string; icon: string; active?: () => boolean; run: () => void; disabled?: () => boolean }

const chain = () => editor.value!.chain().focus()
const groups = computed<Action[][]>(() => {
  const e = editor.value
  const on = (name: string, attrs?: Record<string, unknown>) => () => !!e?.isActive(name, attrs)
  return [
    [
      { key: 'bold', label: t('editor.bold'), icon: 'bold', active: on('bold'), run: () => chain().toggleBold().run() },
      { key: 'italic', label: t('editor.italic'), icon: 'italic', active: on('italic'), run: () => chain().toggleItalic().run() },
      { key: 'strike', label: t('editor.strike'), icon: 'strike', active: on('strike'), run: () => chain().toggleStrike().run() },
      { key: 'code', label: t('editor.code'), icon: 'code', active: on('code'), run: () => chain().toggleCode().run() },
    ],
    [
      { key: 'h2', label: t('editor.heading'), icon: 'h2', active: on('heading', { level: 2 }), run: () => chain().toggleHeading({ level: 2 }).run() },
      { key: 'h3', label: t('editor.subheading'), icon: 'h3', active: on('heading', { level: 3 }), run: () => chain().toggleHeading({ level: 3 }).run() },
    ],
    [
      { key: 'ul', label: t('editor.bulletList'), icon: 'ul', active: on('bulletList'), run: () => chain().toggleBulletList().run() },
      { key: 'ol', label: t('editor.orderedList'), icon: 'ol', active: on('orderedList'), run: () => chain().toggleOrderedList().run() },
      { key: 'quote', label: t('editor.quote'), icon: 'quote', active: on('blockquote'), run: () => chain().toggleBlockquote().run() },
      { key: 'codeBlock', label: t('editor.codeBlock'), icon: 'codeBlock', active: on('codeBlock'), run: () => chain().toggleCodeBlock().run() },
      { key: 'link', label: t('editor.link'), icon: 'link', active: on('link'), run: () => void openLink() },
    ],
    [
      { key: 'undo', label: t('editor.undo'), icon: 'undo', run: () => chain().undo().run(), disabled: () => !e?.can().undo() },
      { key: 'redo', label: t('editor.redo'), icon: 'redo', run: () => chain().redo().run(), disabled: () => !e?.can().redo() },
    ],
  ]
})

// --- a link ------------------------------------------------------------------

const linking = ref(false)
const href = ref('')
const linkInput = ref<HTMLInputElement | null>(null)

async function openLink() {
  const e = editor.value
  if (!e) return
  href.value = (e.getAttributes('link').href as string | undefined) ?? ''
  linking.value = true
  await nextTick()
  linkInput.value?.focus()
  linkInput.value?.select()
}

function closeLink() {
  linking.value = false
  editor.value?.commands.focus()
}

function applyLink() {
  const e = editor.value
  if (!e) return
  let url = href.value.trim()
  if (url && !/^(https?:\/\/|mailto:)/i.test(url)) url = (url.includes('@') && !url.includes('/') ? 'mailto:' : 'https://') + url
  const c = e.chain().focus().extendMarkRange('link')
  if (!url) c.unsetLink().run()
  else if (e.state.selection.empty && !e.isActive('link')) c.insertContent({ type: 'text', text: href.value.trim(), marks: [{ type: 'link', attrs: { href: url } }] }).run()
  else c.setLink({ href: url }).run()
  linking.value = false
}

function removeLink() {
  editor.value?.chain().focus().extendMarkRange('link').unsetLink().run()
  linking.value = false
}

const minHeight = computed(() => `${props.rows * 1.75 + 1}rem`)
</script>

<template>
  <div
    ref="root"
    class="rich-text-box overflow-clip rounded-lg border bg-white transition-colors focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10"
    :class="[invalid ? 'border-neutral-900' : 'border-neutral-300', disabled ? 'opacity-60' : '']"
  >
    <div v-if="linking" :style="{ top: stickyTop }" class="sticky z-10 flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <label :for="`${id ?? 'editor'}-link`" class="sr-only">{{ $t('editor.linkAddress') }}</label>
      <input
        :id="`${id ?? 'editor'}-link`"
        ref="linkInput"
        v-model="href"
        type="url"
        inputmode="url"
        :placeholder="$t('editor.linkPlaceholder')"
        class="h-7 min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
        @keydown.enter.prevent="applyLink"
        @keydown.esc.prevent.stop="closeLink"
        @blur="(e) => { if (!root?.contains(e.relatedTarget as Node | null)) { linking = false; emit('blur') } }"
      />
      <button type="button" class="h-7 rounded-md bg-neutral-900 px-2.5 text-xs font-medium text-white hover:bg-neutral-700" @click="applyLink">
        {{ $t('editor.apply') }}
      </button>
      <button
        v-if="editor?.isActive('link')"
        type="button"
        class="h-7 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
        @click="removeLink"
      >
        {{ $t('editor.unlink') }}
      </button>
      <button type="button" class="h-7 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900" @click="closeLink">
        {{ $t('common.cancel') }}
      </button>
    </div>
    <div
      v-else
      role="toolbar"
      :style="{ top: stickyTop }"
      :aria-label="$t('editor.toolbar')"
      :aria-controls="id"
      class="sticky z-10 flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-1.5 py-1"
    >
      <template v-for="(group, gi) in groups" :key="gi">
        <span v-if="gi" class="mx-1 h-4 w-px bg-neutral-200" aria-hidden="true" />
        <button
          v-for="a in group"
          :key="a.key"
          type="button"
          :title="a.label"
          :aria-label="a.label"
          :aria-pressed="a.active ? a.active() : undefined"
          :disabled="disabled || a.disabled?.()"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition-colors hover:bg-neutral-200 hover:text-neutral-900 disabled:pointer-events-none disabled:opacity-40"
          :class="a.active?.() ? 'bg-neutral-200 text-neutral-900' : ''"
          @mousedown.prevent
          @click="a.run"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path v-if="a.icon === 'bold'" d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" />
            <path v-else-if="a.icon === 'italic'" d="M19 4h-9M14 20H5M15 4 9 20" />
            <path v-else-if="a.icon === 'strike'" d="M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16" />
            <path v-else-if="a.icon === 'code'" d="m16 18 6-6-6-6M8 6l-6 6 6 6" />
            <path v-else-if="a.icon === 'h2'" d="M4 12h8M4 18V6M12 18V6M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1" />
            <path v-else-if="a.icon === 'h3'" d="M4 12h8M4 18V6M12 18V6M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2" />
            <path v-else-if="a.icon === 'ul'" d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
            <path v-else-if="a.icon === 'ol'" d="M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
            <path v-else-if="a.icon === 'quote'" d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            <path v-else-if="a.icon === 'codeBlock'" d="M10 9.5 8 12l2 2.5M14 9.5l2 2.5-2 2.5M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            <path v-else-if="a.icon === 'link'" d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            <path v-else-if="a.icon === 'undo'" d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13" />
            <path v-else-if="a.icon === 'redo'" d="M21 7v6h-6M3 17a9 9 0 0 1 15-6.7l3 2.7" />
          </svg>
        </button>
      </template>
    </div>
    <EditorContent :editor="editor" class="cursor-text px-3 py-2 text-[15px] leading-7 text-neutral-900" :style="{ minHeight }" @click.self="focus" />
  </div>
</template>
