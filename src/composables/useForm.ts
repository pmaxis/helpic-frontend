/**
 * One form's state, checked against a Zod schema: the values, the errors per
 * field (the schema's and the API's), an error for the whole form, and a busy
 * flag while it is sent.
 *
 * Nothing is checked until the first submit; after that each field is checked
 * again as it changes, so an error goes as soon as it is fixed. An error the
 * API gave for a field goes when that field changes. A field is required when
 * its schema refuses an empty value — field() passes that on to the label's
 * asterisk, so the asterisk and the check never disagree.
 *
 *   const form = useForm(schema, { email: '', password: '' })
 *   <form novalidate @submit.prevent="form.submit((data) => auth.login(data))">
 *     <BaseInput label="Email" v-bind="form.field('email')" />
 */
import { computed, nextTick, reactive, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'
import type { z } from 'zod'
import { ApiRequestError } from '@/services/api'
import { t } from '@/i18n'

type Errors = Record<string, string>

export interface FormOptions {
  /** API field names that belong to a form field under another name, e.g. { freelancer_id: 'person_id' }. */
  serverFields?: Record<string, string>
}

/** The empty value of a field like this one: what "required" is tested with. */
function emptyLike(value: unknown): unknown {
  if (Array.isArray(value)) return []
  if (typeof value === 'string') return ''
  return undefined
}

/** Focuses the first invalid field, in the open dialog if there is one. */
function focusFirstError() {
  void nextTick(() => {
    const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
    const scope: ParentNode = dialogs[dialogs.length - 1] ?? document
    scope.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  })
}

export function useForm<S extends z.ZodObject>(schema: MaybeRefOrGetter<S>, initial: z.input<S>, options: FormOptions = {}) {
  type Values = z.input<S>
  type Key = keyof Values & string

  const values = reactive({ ...initial }) as Values
  const clientErrors = ref<Errors>({})
  const serverErrors = ref<Errors>({})
  const formError = ref('')
  const submitting = ref(false)
  /** Set by the first submit: from then on fields are checked as they change. */
  const attempted = ref(false)

  const errors = computed<Errors>(() => ({ ...clientErrors.value, ...serverErrors.value }))

  /** Checks the values; returns the parsed data, or null and fills the errors. */
  function check(): z.output<S> | null {
    const result = toValue(schema).safeParse(values)
    const found: Errors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '')
        if (key && !found[key]) found[key] = issue.message
      }
    }
    clientErrors.value = found
    return result.success ? result.data : null
  }

  // Each field changed drops the API's complaint about it; after the first
  // submit, the form is checked again.
  watch(
    () => ({ ...(values as Record<string, unknown>) }),
    (now, before) => {
      const left = { ...serverErrors.value }
      let dropped = false
      for (const key of Object.keys(now)) {
        if (now[key] !== before[key] && left[key]) {
          delete left[key]
          dropped = true
        }
      }
      if (dropped) serverErrors.value = left
      if (attempted.value) check()
    },
    { deep: true },
  )
  // The rules can change with the form (an existing account needs no name).
  watch(
    () => toValue(schema),
    () => {
      if (attempted.value) check()
    },
  )

  function required(key: Key): boolean {
    const field = toValue(schema).shape[key] as z.ZodType | undefined
    return !!field && !field.safeParse(emptyLike((values as Record<string, unknown>)[key])).success
  }

  /** Props for a field component: the value, its error and whether it's required. Use with v-bind. */
  function field<K extends Key>(key: K) {
    return {
      modelValue: values[key],
      'onUpdate:modelValue': (value: Values[K]) => {
        values[key] = value
      },
      error: errors.value[key],
      required: required(key),
    }
  }

  /** Shows what the API said: per field where it can, for the whole form otherwise. */
  function fail(error: unknown) {
    if (!(error instanceof ApiRequestError)) {
      formError.value = t('errors.generic')
      return
    }
    if (!error.fields) {
      formError.value = error.message
      return
    }
    const onFields: Errors = {}
    const elsewhere: string[] = []
    for (const [apiKey, message] of Object.entries(error.fields)) {
      const key = options.serverFields?.[apiKey] ?? apiKey
      if (key in (values as object)) onFields[key] = message
      else elsewhere.push(message)
    }
    serverErrors.value = onFields
    formError.value = elsewhere.join(' ')
    focusFirstError()
  }

  /**
   * Checks the form and, when it's valid, runs action with the parsed data
   * (trimmed, as the schema says). Resolves whether it went through.
   */
  async function submit(action: (data: z.output<S>) => Promise<unknown>): Promise<boolean> {
    if (submitting.value) return false
    attempted.value = true
    formError.value = ''
    serverErrors.value = {}
    const data = check()
    if (!data) {
      focusFirstError()
      return false
    }
    submitting.value = true
    try {
      await action(data)
      return true
    } catch (error) {
      fail(error)
      return false
    } finally {
      submitting.value = false
    }
  }

  /** Starts over with these values (or the first ones), no errors shown. */
  function reset(next: Partial<Values> = initial) {
    Object.assign(values as object, { ...initial, ...next })
    attempted.value = false
    clientErrors.value = {}
    serverErrors.value = {}
    formError.value = ''
  }

  return reactive({ values, errors, formError, submitting, field, required, submit, reset, fail })
}
