/** The kanban board and its columns. */
const en = {
  board: {
    moreLabels: 'More labels: {names}',
    edit: 'Edit',
    moveLeft: 'Move left',
    moveRight: 'Move right',
    delete: 'Delete',
    addTask: 'Add task',
    addColumn: 'Add column',
    editTask: 'Edit task',
    editTaskNamed: 'Edit {title}',
    dragToMove: 'Drag to move {name}',
    rename: 'Rename {name}',
    clickToRename: 'Click to rename',
    confirmDelete: 'Delete this column?',
    emptyColumn: 'The column is empty, so nothing else changes.',
    tasksMove:
      "Its {n} task moves to another {status} column on this board — tasks themselves aren't deleted. If there's no such column, move the tasks first. | Its {n} tasks move to another {status} column on this board — tasks themselves aren't deleted. If there's no such column, move the tasks first.",
    moveColumnFailed: 'Could not move the column',
    moveTaskFailed: 'Could not move the task',
    renameFailed: 'Could not rename the column',
    deleteFailed: 'Could not delete the column',
  },
  columnForm: {
    edit: 'Edit column',
    new: 'New column',
    name: 'Name',
    namePlaceholder: 'Review',
    category: 'Category',
    thisColumn: 'this column',
    explain:
      'Tasks in this column get the status “{name}” and count as {category} — that decides who may move them here and whether they count as open.',
    add: 'Add column',
  },
}

const uk: typeof en = {
  board: {
    moreLabels: 'Ще мітки: {names}',
    edit: 'Змінити',
    moveLeft: 'Посунути ліворуч',
    moveRight: 'Посунути праворуч',
    delete: 'Видалити',
    addTask: 'Додати задачу',
    addColumn: 'Додати колонку',
    editTask: 'Змінити задачу',
    editTaskNamed: 'Змінити {title}',
    dragToMove: 'Перетягніть, щоб посунути {name}',
    rename: 'Перейменувати {name}',
    clickToRename: 'Натисніть, щоб перейменувати',
    confirmDelete: 'Видалити колонку?',
    emptyColumn: 'Колонка порожня, тож більше нічого не зміниться.',
    tasksMove:
      'Її {n} задача переїде в іншу колонку категорії «{status}» на цій дошці — самі задачі не видаляються. Якщо такої колонки немає, спершу перенесіть задачі. | Її {n} задачі переїдуть в іншу колонку категорії «{status}» на цій дошці — самі задачі не видаляються. Якщо такої колонки немає, спершу перенесіть задачі. | Її {n} задач переїдуть в іншу колонку категорії «{status}» на цій дошці — самі задачі не видаляються. Якщо такої колонки немає, спершу перенесіть задачі.',
    moveColumnFailed: 'Не вдалося посунути колонку',
    moveTaskFailed: 'Не вдалося перемістити задачу',
    renameFailed: 'Не вдалося перейменувати колонку',
    deleteFailed: 'Не вдалося видалити колонку',
  },
  columnForm: {
    edit: 'Змінити колонку',
    new: 'Нова колонка',
    name: 'Назва',
    namePlaceholder: 'На перевірці',
    category: 'Категорія',
    thisColumn: 'ця колонка',
    explain:
      'Задачі в цій колонці отримують статус «{name}» і рахуються як «{category}» — від цього залежить, хто може їх сюди переносити і чи вважаються вони відкритими.',
    add: 'Додати колонку',
  },
}

export default { en, uk }
