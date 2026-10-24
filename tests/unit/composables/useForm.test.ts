import { describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { z } from 'zod'
import { useForm } from '@/composables/useForm'
import { ApiRequestError } from '@/services/api'
import { email, LIMITS, optionalText, requiredText } from '@/utils/validation'
import { t } from '@/i18n'

const schema = z.object({ name: requiredText('name', LIMITS.name), email: email(), note: optionalText('description', 10) })

function makeForm() {
  return useForm(schema, { name: '', email: '', note: '' }, { serverFields: { contact_email: 'email' } })
}

function refused(fields?: Record<string, string>, message = 'Refused') {
  return new ApiRequestError(422, { code: 'validation', message, fields })
}

describe('useForm', () => {
  it('shows no errors before the first submit', async () => {
    const form = makeForm()
    form.values.email = 'not an email'
    await nextTick()
    expect(form.errors).toEqual({})
  })

  it('refuses an invalid form without running the action', async () => {
    const form = makeForm()
    const action = vi.fn()
    expect(await form.submit(action)).toBe(false)
    expect(action).not.toHaveBeenCalled()
    expect(Object.keys(form.errors).sort()).toEqual(['email', 'name'])
  })

  it('checks each change after the first submit, so a fixed field loses its error', async () => {
    const form = makeForm()
    await form.submit(vi.fn())
    form.values.name = 'Olena'
    await nextTick()
    expect(form.errors.name).toBeUndefined()
    expect(form.errors.email).toBeDefined()
  })

  it('runs the action with the parsed, trimmed data', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: '  Olena ', email: ' olena@example.test ' })
    const action = vi.fn().mockResolvedValue(undefined)
    expect(await form.submit(action)).toBe(true)
    expect(action).toHaveBeenCalledWith({ name: 'Olena', email: 'olena@example.test', note: '' })
  })

  it('puts the API’s errors on their fields, mapped names too, and the rest on the form', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: 'Olena', email: 'olena@example.test' })
    await form.submit(() => Promise.reject(refused({ name: 'Taken', contact_email: 'Unknown address', plan: 'No such plan' })))
    expect(form.errors).toEqual({ name: 'Taken', email: 'Unknown address' })
    expect(form.formError).toBe('No such plan')
  })

  it('drops the API’s error on a field once that field changes', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: 'Olena', email: 'olena@example.test' })
    await form.submit(() => Promise.reject(refused({ name: 'Taken' })))
    form.values.name = 'Olena K'
    await nextTick()
    expect(form.errors.name).toBeUndefined()
  })

  it('shows an error without fields for the whole form', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: 'Olena', email: 'olena@example.test' })
    await form.submit(() => Promise.reject(refused(undefined, 'Try again later')))
    expect(form.formError).toBe('Try again later')
  })

  it('shows a generic error for something that isn’t the API’s', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: 'Olena', email: 'olena@example.test' })
    await form.submit(() => Promise.reject(new Error('boom')))
    expect(form.formError).toBe(t('errors.generic'))
  })

  it('sends once at a time', async () => {
    const form = makeForm()
    Object.assign(form.values, { name: 'Olena', email: 'olena@example.test' })
    let finish!: () => void
    const action = vi.fn(() => new Promise<void>((r) => (finish = r)))
    const first = form.submit(action)
    expect(await form.submit(action)).toBe(false)
    finish()
    expect(await first).toBe(true)
    expect(action).toHaveBeenCalledOnce()
  })

  it('updates a value through the field’s props', () => {
    const form = makeForm()
    form.field('name')['onUpdate:modelValue']('Acme')
    expect(form.values.name).toBe('Acme')
  })

  it('focuses the first invalid field, in the open dialog when there is one', async () => {
    document.body.innerHTML = '<input aria-invalid="true" id="page"><div role="dialog"><input aria-invalid="true" id="dialog"></div>'
    const form = makeForm()
    await form.submit(vi.fn())
    await nextTick()
    expect(document.activeElement?.id).toBe('dialog')
    document.body.innerHTML = ''
  })

  it('checks again when the rules change after a submit', async () => {
    const strict = ref(false)
    const rules = computed(() => z.object({ name: strict.value ? requiredText('name', 3) : z.string() }))
    const form = useForm(rules, { name: 'Olena' })
    await form.submit(vi.fn().mockResolvedValue(undefined))
    strict.value = true
    await nextTick()
    expect(form.errors.name).toBeDefined()
  })

  it('says a field is required when its schema refuses it empty', () => {
    const form = makeForm()
    expect(form.field('name').required).toBe(true)
    expect(form.field('note').required).toBe(false)
  })

  it('starts over with new values and no errors', async () => {
    const form = makeForm()
    await form.submit(vi.fn())
    form.reset({ name: 'Acme' })
    await nextTick()
    expect(form.values).toEqual({ name: 'Acme', email: '', note: '' })
    expect(form.errors).toEqual({})
  })
})
