<script setup lang="ts">
import { t } from '@/i18n'
// Draws the pages of the server-rendered PDF with pdf.js, so the page shows
// the exact file that will be downloaded — same fonts, wrapping and page breaks.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const props = defineProps<{ data: ArrayBuffer | null }>()
const emit = defineEmits<{ pages: [count: number] }>()

const host = ref<HTMLDivElement | null>(null)
// One page at a time, with a pager, rather than a long scroll of pages.
const current = ref(0)
const total = ref(0)
let canvases: HTMLCanvasElement[] = []
const label = computed(() => t('pdfPreview.pageOf', { n: current.value + 1, total: total.value }))

function show() {
  if (!host.value || canvases.length === 0) return
  current.value = Math.min(current.value, canvases.length - 1)
  host.value.replaceChildren(canvases[current.value])
}

function go(delta: number) {
  const next = current.value + delta
  if (next < 0 || next >= total.value) return
  current.value = next
  show()
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
  else if (e.key === 'ArrowRight' || e.key === 'PageDown') go(1)
  else return
  e.preventDefault()
}

let doc: pdfjs.PDFDocumentProxy | null = null
let width = 0
let loadSeq = 0
let drawSeq = 0
let resizeTimer: number | undefined
let observer: ResizeObserver | undefined

async function draw() {
  const el = host.value
  if (!el || !doc || width <= 0) return
  const seq = ++drawSeq
  const dpr = window.devicePixelRatio || 1
  const rendered: HTMLCanvasElement[] = []
  // Render off-screen, then swap, so the old pages stay visible meanwhile.
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: (width / base.width) * dpr })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${width}px`
    canvas.style.height = `${(width * base.height) / base.width}px`
    canvas.className = 'block rounded-sm bg-white shadow-sm ring-1 ring-neutral-200'
    canvas.setAttribute('aria-label', t('pdfPreview.pageOf', { n, total: doc.numPages }))
    canvas.setAttribute('role', 'img')
    await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise
    if (seq !== drawSeq) return
    rendered.push(canvas)
  }
  canvases = rendered
  show()
}

watch(
  () => props.data,
  async (data) => {
    if (!data) return
    const seq = ++loadSeq
    // pdf.js takes ownership of the buffer it is given, so hand it a copy.
    const next = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise
    if (seq !== loadSeq) {
      void next.destroy()
      return
    }
    const old = doc
    doc = next
    total.value = next.numPages
    emit('pages', next.numPages)
    await draw()
    void old?.destroy()
  },
  { immediate: true },
)

onMounted(() => {
  if (!host.value) return
  observer = new ResizeObserver(([entry]) => {
    const w = Math.floor(entry.contentRect.width)
    if (w === width) return
    const first = width === 0
    width = w
    window.clearTimeout(resizeTimer)
    if (first) void draw()
    else resizeTimer = window.setTimeout(() => void draw(), 150)
  })
  observer.observe(host.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.clearTimeout(resizeTimer)
  loadSeq++
  drawSeq++
  void doc?.destroy()
})
</script>

<template>
  <div class="outline-none" tabindex="0" :aria-label="$t('pdfPreview.aria')" @keydown="onKey">
    <div ref="host" />
    <div v-if="total > 1" class="mt-4 flex items-center justify-center gap-3">
      <button
        type="button"
        :aria-label="$t('pdfPreview.prev')"
        :disabled="current === 0"
        class="rounded-full bg-white p-1.5 text-neutral-600 shadow-sm ring-1 ring-neutral-200 transition hover:text-neutral-900 disabled:opacity-40"
        @click="go(-1)"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="m12 15-5-5 5-5" /></svg>
      </button>
      <div class="flex items-center gap-1.5" role="tablist" :aria-label="$t('pdfPreview.pages')">
        <button
          v-for="n in total"
          :key="n"
          type="button"
          role="tab"
          :aria-selected="current === n - 1"
          :aria-label="$t('pdfPreview.page', { n })"
          class="h-2 rounded-full transition-all"
          :class="current === n - 1 ? 'w-5 bg-neutral-900' : 'w-2 bg-neutral-300 hover:bg-neutral-400'"
          @click="go(n - 1 - current)"
        />
      </div>
      <button
        type="button"
        :aria-label="$t('pdfPreview.next')"
        :disabled="current === total - 1"
        class="rounded-full bg-white p-1.5 text-neutral-600 shadow-sm ring-1 ring-neutral-200 transition hover:text-neutral-900 disabled:opacity-40"
        @click="go(1)"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="m8 5 5 5-5 5" /></svg>
      </button>
      <span class="min-w-[5.5rem] text-xs tabular-nums text-neutral-500">{{ label }}</span>
    </div>
  </div>
</template>
