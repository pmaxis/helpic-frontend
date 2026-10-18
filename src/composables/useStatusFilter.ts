import { computed, reactive, ref, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchColumns } from '@/stores/board'
import { columnName } from '@/constants/tasks'
import type { BoardColumn } from '@/types/board'
import type { Task, TaskStatus } from '@/types/tasks'

/**
 * The list's status filter. Nothing picked shows every task. A pick keeps
 * tasks in those columns. Columns are the project's own statuses.
 */
export function useStatusFilter(projectId: Ref<string>) {
  const { locale } = useI18n()
  const selected = ref<string[]>([])
  const columns = ref<BoardColumn[]>([])

  const options = computed(() => {
    void locale.value
    return columns.value.map((c) => ({ value: c.id, label: columnName(c.name) }))
  })

  async function load() {
    if (!projectId.value) {
      columns.value = []
      selected.value = []
      return
    }
    const data = await fetchColumns({ project: projectId.value })
    columns.value = data.columns ?? []
    const ids = new Set(columns.value.map((c) => c.id))
    selected.value = selected.value.filter((id) => ids.has(id))
  }

  /** Selects every column of one bucket, e.g. the dashboard's "done" link. */
  function selectBucket(bucket: TaskStatus) {
    selected.value = columns.value.filter((c) => c.category === bucket).map((c) => c.id)
  }

  function visible(list: Task[]): Task[] {
    if (!selected.value.length) return list
    const ids = new Set(selected.value)
    return list.filter((task) => ids.has(task.status_id))
  }

  return reactive({ selected, options, load, selectBucket, visible })
}
