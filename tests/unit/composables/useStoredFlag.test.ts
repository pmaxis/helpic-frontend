import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { useStoredFlag } from '@/composables/useStoredFlag'

describe('useStoredFlag', () => {
  it('starts off, and remembers a change in this browser', async () => {
    const flag = useStoredFlag('helpic:test-flag')
    expect(flag.value).toBe(false)
    flag.value = true
    await nextTick()
    expect(localStorage.getItem('helpic:test-flag')).toBe('1')
    expect(useStoredFlag('helpic:test-flag').value).toBe(true)
  })

  it('still works, for this visit, when storage refuses', async () => {
    const getItem = Storage.prototype.getItem
    const setItem = Storage.prototype.setItem
    Storage.prototype.getItem = () => {
      throw new Error('private mode')
    }
    Storage.prototype.setItem = Storage.prototype.getItem
    try {
      const flag = useStoredFlag('helpic:test-flag')
      expect(flag.value).toBe(false)
      flag.value = true
      await nextTick()
      expect(flag.value).toBe(true)
    } finally {
      Storage.prototype.getItem = getItem
      Storage.prototype.setItem = setItem
    }
  })
})
