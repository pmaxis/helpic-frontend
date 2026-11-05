/**
 * Speech to text, done by the browser: nothing passes through Helpic. Chrome
 * and Safari have it, Firefox doesn't: dictationSupported() says if this one does.
 *
 *   const dictation = useDictation((phrase) => append(phrase))
 *   <button v-if="dictationSupported()" @click="dictation.toggle()">
 *
 * A phrase is what was said up to a pause. `heard` is the one still being
 * said, which the browser may yet correct. Recognition stops with the
 * component, and by itself after a long silence.
 */
import { onScopeDispose, ref } from 'vue'
import { intlLocale } from '@/i18n'

interface SpeechResult {
  isFinal: boolean
  0: { transcript: string }
}

interface SpeechEvent {
  resultIndex: number
  results: ArrayLike<SpeechResult>
}

interface SpeechRecognizer {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type Recognizer = new () => SpeechRecognizer

/** Why dictation stopped: the microphone was refused, or something else went wrong. */
export type DictationError = 'denied' | 'failed'

function recognizer(): Recognizer | undefined {
  const w = window as unknown as { SpeechRecognition?: Recognizer; webkitSpeechRecognition?: Recognizer }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function dictationSupported(): boolean {
  return !!recognizer()
}

export function useDictation(onPhrase: (phrase: string) => void) {
  const Speech = recognizer()
  const listening = ref(false)
  const heard = ref('')
  const error = ref<DictationError | null>(null)
  let session: SpeechRecognizer | null = null

  function start() {
    if (!Speech || session) return
    error.value = null
    const s = new Speech()
    s.lang = intlLocale()
    s.continuous = true
    s.interimResults = true
    s.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript.trim()
        if (!result.isFinal) interim += ` ${text}`
        else if (text) onPhrase(text)
      }
      heard.value = interim.trim()
    }
    s.onerror = (event) => {
      // Silence and our own abort aren't failures.
      if (event.error === 'no-speech' || event.error === 'aborted') return
      error.value = event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'failed'
    }
    s.onend = () => {
      session = null
      listening.value = false
      heard.value = ''
    }
    session = s
    listening.value = true
    try {
      s.start()
    } catch {
      session = null
      listening.value = false
      error.value = 'failed'
    }
  }

  /** Finishes: what was said so far still arrives as a phrase. */
  function stop() {
    session?.stop()
  }

  function toggle() {
    if (listening.value) stop()
    else start()
  }

  onScopeDispose(() => {
    if (!session) return
    session.onresult = session.onerror = session.onend = null
    session.abort()
    session = null
  })

  return { listening, heard, error, start, stop, toggle }
}
