<script setup lang="ts">
/**
 * A WYSIWYG box for Markdown: a toolbar over the text (bold, italic, strike,
 * code, headings, lists, a quote, a code block, a link, undo and redo), and
 * Markdown shortcuts as typed ("## ", "- ", "1. ", "**bold**"…). v-model is
 * the Markdown. ⌘/Ctrl + Enter emits "submit", Esc "cancel", leaving the
 * box "blur" — unless the focus only went to the toolbar. A link is named
 * after the page it leads to when no one gave it a name.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import type { Mark } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { useI18n } from 'vue-i18n'
import { normalizeHref, webAddress } from '@/utils/richText'
import { fetchPageTitle } from '@/services/linkPreview'

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
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        void openLink()
        return true
      }
      // Esc goes on up as well: in a dialog it closes the dialog.
      if (e.key === 'Escape') emit('cancel')
      return false
    },
    // A bare address pasted at the caret goes in as a link, then takes the page's title.
    // Over a selection, the selected text becomes the link (the Link extension does it).
    handlePaste: (view, e) => {
      const url = webAddress(e.clipboardData?.getData('text/plain') ?? '')
      const ed = editor.value
      if (!url || !ed || !view.state.selection.empty || ed.isActive('code') || ed.isActive('codeBlock')) return false
      const shown = (e.clipboardData?.getData('text/plain') ?? '').trim()
      e.preventDefault()
      insertLink(view.state.selection.from, view.state.selection.to, shown, url)
      void nameLinks(url, shown)
      return true
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
      { key: 'link', label: t('editor.linkShortcut'), icon: 'link', active: on('link'), run: () => void openLink() },
    ],
    [
      { key: 'undo', label: t('editor.undo'), icon: 'undo', run: () => chain().undo().run(), disabled: () => !e?.can().undo() },
      { key: 'redo', label: t('editor.redo'), icon: 'redo', run: () => chain().redo().run(), disabled: () => !e?.can().redo() },
    ],
  ]
})

// --- a link ------------------------------------------------------------------
//
// The link's form asks for its text, what the description shows, and its
// address. It opens on the selection, or on the whole link the caret is in;
// with nothing selected the link goes in at the caret. A text left as it
// was keeps its other marks (bold…); a new one replaces it. An empty text
// shows the address itself, and an empty address takes the link off.

const linking = ref(false)
const linkText = ref('')
const href = ref('')
/** Where the link goes, and the text it had there when the form opened. */
let target = { from: 0, to: 0, text: '' }
/** Whether the form edits a link that was there. */
const editingLink = ref(false)
const textInput = ref<HTMLInputElement | null>(null)
const hrefInput = ref<HTMLInputElement | null>(null)
/** Whether the text is the writer's own: then the page's title doesn't replace it. */
let ownText = false
/** The address whose title the form waits for; '' when it waits for none. */
const titleFor = ref('')
let titleTimer: ReturnType<typeof setTimeout> | undefined

// As an address is typed or pasted, the page's title comes as the link's text.
watch(href, (value) => {
  clearTimeout(titleTimer)
  titleFor.value = ''
  if (!linking.value || ownText) return
  const url = webAddress(value) ?? (/^[^\s/]+\.[a-z]{2,}(\/\S*)?$/i.test(value.trim()) ? normalizeHref(value) : null)
  if (!url) return
  titleTimer = setTimeout(async () => {
    titleFor.value = url
    const title = await fetchPageTitle(url)
    if (titleFor.value !== url || !linking.value || ownText) return
    titleFor.value = ''
    if (title) linkText.value = title
  }, 350)
})
onBeforeUnmount(() => clearTimeout(titleTimer))

/** The writer typed a text of their own; one emptied out leaves it to the title again. */
function onTextInput() {
  ownText = linkText.value.trim() !== ''
}

async function openLink() {
  const e = editor.value
  if (!e || props.disabled) return
  editingLink.value = e.isActive('link')
  if (editingLink.value) e.chain().extendMarkRange('link').run()
  const { from, to } = e.state.selection
  // A selection over several paragraphs can't be one link's text: the link goes at its start.
  const text = e.state.doc.textBetween(from, to, '\n')
  target = text.includes('\n') ? { from, to: from, text: '' } : { from, to, text }
  titleFor.value = ''
  if (editingLink.value) {
    // An existing link keeps its text, whatever its address becomes.
    linkText.value = target.text
    href.value = (e.getAttributes('link').href as string | undefined) ?? ''
    ownText = true
  } else if (webAddress(target.text)) {
    // A selected address is the link's address, and the page names it.
    linkText.value = ''
    href.value = target.text.trim()
    ownText = false
  } else {
    // A selected word is the writer's own text.
    linkText.value = target.text
    href.value = ''
    ownText = target.text !== ''
  }
  linking.value = true
  await nextTick()
  // With its text there, it's the address that's wanted.
  const field = linkText.value ? hrefInput.value : textInput.value
  field?.focus()
  field?.select()
}

function closeLink() {
  linking.value = false
  editor.value?.chain().focus().setTextSelection({ from: target.from, to: target.to }).run()
}

function applyLink() {
  const e = editor.value
  if (!e) return
  const url = normalizeHref(href.value)
  const { from, to } = target
  const c = e.chain().focus().setTextSelection({ from, to })
  if (!url) {
    if (from !== to) c.unsetLink()
    c.run()
    linking.value = false
    return
  }
  // No text: the address shows, until the page's title comes.
  const text = linkText.value.trim() || href.value.trim()
  if (!linkText.value.trim()) void nameLinks(url, text)
  // The link is inclusive (it grows as an address is typed): the caret goes after it, the mark left behind.
  if (from !== to && text === target.text) {
    c.setLink({ href: url }).setTextSelection(to).unsetMark('link').run()
  } else {
    c.run()
    insertLink(from, to, text, url)
  }
  linking.value = false
}

/**
 * Puts text in place of from…to as a link to url, keeping the marks at the
 * caret (bold…) when nothing was selected; the caret goes after it.
 */
function insertLink(from: number, to: number, text: string, url: string) {
  const e = editor.value
  if (!e) return
  const marks = from !== to ? [] : (e.state.storedMarks ?? e.state.selection.$from.marks())
  e.chain()
    .focus()
    .insertContentAt(
      { from, to },
      { type: 'text', text, marks: [...marks.filter((m) => m.type.name !== 'link').map((m) => m.toJSON()), { type: 'link', attrs: { href: url } }] },
    )
    .unsetMark('link')
    .run()
}

/**
 * Names the links to url still showing shown (the address as it was put
 * in) after the page's title, once the server has read it. A link renamed
 * or moved meanwhile is found by what it shows, not where it was; one whose
 * text was changed is left as it is.
 */
async function nameLinks(url: string, shown: string) {
  const title = await fetchPageTitle(url)
  const e = editor.value
  if (!title || !e || e.isDestroyed || title === shown) return
  const found: { pos: number; size: number; marks: readonly Mark[] }[] = []
  e.state.doc.descendants((node, pos) => {
    if (node.isText && node.text === shown && node.marks.some((m) => m.type.name === 'link' && m.attrs.href === url)) {
      found.push({ pos, size: node.nodeSize, marks: node.marks })
    }
  })
  if (!found.length) return
  const tr = e.state.tr
  // From the end, so the earlier positions still hold.
  for (const f of found.reverse()) tr.replaceWith(f.pos, f.pos + f.size, e.schema.text(title, f.marks))
  e.view.dispatch(tr)
}

function removeLink() {
  const { from, to } = target
  editor.value?.chain().focus().setTextSelection({ from, to }).unsetLink().setTextSelection(to).run()
  linking.value = false
}

/** The focus left the form and the editor both: the editing is over. */
function onLinkBlur(e: FocusEvent) {
  if (root.value?.contains(e.relatedTarget as Node | null)) return
  linking.value = false
  emit('blur')
}

const minHeight = computed(() => `${props.rows * 1.5 + 1}rem`)
</script>

<template>
  <div
    ref="root"
    class="rich-text-box overflow-clip rounded-lg border bg-white transition-colors focus-within:border-neutral-900 focus-within:ring-2 focus-within:ring-neutral-900/10"
    :class="[invalid ? 'border-neutral-900' : 'border-neutral-300', disabled ? 'opacity-60' : '']"
  >
    <form
      v-if="linking"
      :style="{ top: stickyTop }"
      class="sticky z-10 flex flex-wrap items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5"
      :aria-label="$t('editor.link')"
      @submit.prevent="applyLink"
      @keydown.esc.prevent.stop="closeLink"
    >
      <label :for="`${id ?? 'editor'}-link-text`" class="sr-only">{{ $t('editor.linkText') }}</label>
      <input
        :id="`${id ?? 'editor'}-link-text`"
        ref="textInput"
        v-model="linkText"
        type="text"
        maxlength="500"
        :placeholder="titleFor ? $t('editor.linkTitleLoading') : $t('editor.linkTextPlaceholder')"
        :aria-busy="titleFor ? 'true' : undefined"
        @input="onTextInput"
        class="h-7 min-w-32 flex-1 basis-40 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
        @blur="onLinkBlur"
      />
      <label :for="`${id ?? 'editor'}-link`" class="sr-only">{{ $t('editor.linkAddress') }}</label>
      <input
        :id="`${id ?? 'editor'}-link`"
        ref="hrefInput"
        v-model="href"
        type="text"
        inputmode="url"
        autocomplete="url"
        spellcheck="false"
        maxlength="2000"
        :placeholder="$t('editor.linkPlaceholder')"
        class="h-7 min-w-32 flex-[2] basis-56 rounded-md border border-neutral-300 bg-white px-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none"
        @blur="onLinkBlur"
      />
      <div class="ml-auto flex items-center gap-1">
        <a
          v-if="editingLink && normalizeHref(href)"
          :href="normalizeHref(href)"
          target="_blank"
          rel="noopener noreferrer nofollow"
          :title="$t('editor.openLink')"
          :aria-label="$t('editor.openLink')"
          class="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
          @blur="onLinkBlur"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4" aria-hidden="true">
            <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </a>
        <button type="submit" class="h-7 rounded-md bg-neutral-900 px-2.5 text-xs font-medium text-white hover:bg-neutral-700" @blur="onLinkBlur">
          {{ $t('editor.apply') }}
        </button>
        <button
          v-if="editingLink"
          type="button"
          class="h-7 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
          @blur="onLinkBlur"
          @click="removeLink"
        >
          {{ $t('editor.unlink') }}
        </button>
        <button
          type="button"
          class="h-7 rounded-md px-2 text-xs font-medium text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
          @blur="onLinkBlur"
          @click="closeLink"
        >
          {{ $t('common.cancel') }}
        </button>
      </div>
    </form>
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
    <EditorContent :editor="editor" class="cursor-text px-3 py-2 text-sm leading-6 text-neutral-900" :style="{ minHeight }" @click.self="focus" />
  </div>
</template>
