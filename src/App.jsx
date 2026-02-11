import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import './App.css'

const STORAGE_KEY = 'todos_v1'

function taskMatchesFilter(task, filter) {
  if (filter === 'active') return !task.completed
  if (filter === 'completed') return task.completed
  return true
}

function reorderTasksFromFilteredView(
  tasks,
  filter,
  draggedTaskId,
  targetTaskId,
  placeAfter,
) {
  const visibleIds = tasks
    .filter((task) => taskMatchesFilter(task, filter))
    .map((task) => task.id)

  const fromIndex = visibleIds.indexOf(draggedTaskId)
  const targetIndex = visibleIds.indexOf(targetTaskId)

  if (fromIndex === -1 || targetIndex === -1) {
    return tasks
  }

  let toIndex = targetIndex + (placeAfter ? 1 : 0)
  if (fromIndex < toIndex) {
    toIndex -= 1
  }

  if (fromIndex === toIndex) return tasks

  const reorderedVisibleIds = [...visibleIds]
  const [movedId] = reorderedVisibleIds.splice(fromIndex, 1)
  reorderedVisibleIds.splice(toIndex, 0, movedId)

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  let visiblePointer = 0

  return tasks.map((task) => {
    if (!taskMatchesFilter(task, filter)) return task
    const nextVisibleId = reorderedVisibleIds[visiblePointer]
    visiblePointer += 1
    return taskById.get(nextVisibleId) ?? task
  })
}

function readSavedTasks() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY)
    if (!savedValue) return []

    const parsedValue = JSON.parse(savedValue)
    if (!Array.isArray(parsedValue)) return []

    return parsedValue
      .filter(
        (task) =>
          typeof task === 'object' &&
          task !== null &&
          typeof task.id === 'number' &&
          typeof task.text === 'string' &&
          typeof task.completed === 'boolean',
      )
      .map((task) => ({
        id: task.id,
        text: task.text,
        completed: task.completed,
      }))
  } catch {
    return []
  }
}

function App() {
  const [taskText, setTaskText] = useState('')
  const [tasks, setTasks] = useState(readSavedTasks)
  const [filter, setFilter] = useState('all')
  const [editingTaskId, setEditingTaskId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const dragPreviewRef = useRef(null)
  const rowRefs = useRef(new Map())
  const previousPositionsRef = useRef(new Map())

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
    } catch {
      // Ignore storage errors so the app keeps working.
    }
  }, [tasks])

  function addTask(event) {
    event.preventDefault()
    const trimmedTask = taskText.trim()

    if (!trimmedTask) return

    setTasks((currentTasks) => [
      ...currentTasks,
      { id: Date.now(), text: trimmedTask, completed: false },
    ])
    setTaskText('')
  }

  function toggleTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  function deleteTask(taskId) {
    setTasks((currentTasks) =>
      currentTasks.filter((task) => task.id !== taskId),
    )

    if (editingTaskId === taskId) {
      setEditingTaskId(null)
      setEditingText('')
    }
  }

  function clearCompletedTasks() {
    const editingTask = tasks.find((task) => task.id === editingTaskId)
    if (editingTask?.completed) {
      cancelEditingTask()
    }

    setTasks((currentTasks) =>
      currentTasks.filter((task) => !task.completed),
    )
  }

  function startEditingTask(task) {
    setEditingTaskId(task.id)
    setEditingText(task.text)
  }

  function cancelEditingTask() {
    setEditingTaskId(null)
    setEditingText('')
  }

  function saveEditingTask(taskId) {
    const trimmedText = editingText.trim()

    if (!trimmedText) {
      cancelEditingTask()
      return
    }

    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === taskId ? { ...task, text: trimmedText } : task,
      ),
    )
    cancelEditingTask()
  }

  function handleEditKeyDown(event, taskId) {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveEditingTask(taskId)
    }

    if (event.key === 'Escape') {
      cancelEditingTask()
    }
  }

  function handleDragStart(event, taskId) {
    setDraggedTaskId(taskId)
    setDragOverTaskId(taskId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(taskId))
    const rowRect = event.currentTarget.getBoundingClientRect()
    const offsetX = event.clientX - rowRect.left
    const offsetY = event.clientY - rowRect.top

    const previewElement = event.currentTarget.cloneNode(true)
    previewElement.style.position = 'absolute'
    previewElement.style.top = '-9999px'
    previewElement.style.left = '-9999px'
    previewElement.style.width = `${event.currentTarget.offsetWidth}px`
    previewElement.style.pointerEvents = 'none'
    previewElement.style.transform = 'rotate(-1deg)'
    previewElement.style.boxShadow = '0 14px 36px rgba(0, 0, 0, 0.18)'
    previewElement.style.borderRadius = '14px'
    previewElement.style.background = '#ffffff'
    document.body.appendChild(previewElement)
    dragPreviewRef.current = previewElement
    event.dataTransfer.setDragImage(previewElement, offsetX, offsetY)
  }

  function handleDragOver(event, taskId) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (draggedTaskId === null || draggedTaskId === taskId) return

    const targetRect = event.currentTarget.getBoundingClientRect()
    const placeAfter = event.clientY > targetRect.top + targetRect.height / 2

    setDragOverTaskId(taskId)
    setTasks((currentTasks) =>
      reorderTasksFromFilteredView(
        currentTasks,
        filter,
        draggedTaskId,
        taskId,
        placeAfter,
      ),
    )
  }

  function handleDrop() {
    setDraggedTaskId(null)
    setDragOverTaskId(null)
  }

  function handleDragEnd() {
    setDraggedTaskId(null)
    setDragOverTaskId(null)

    if (dragPreviewRef.current) {
      dragPreviewRef.current.remove()
      dragPreviewRef.current = null
    }
  }

  const remainingCount = tasks.filter((task) => !task.completed).length
  const completedCount = tasks.length - remainingCount

  const visibleTasks = tasks.filter((task) => taskMatchesFilter(task, filter))

  useLayoutEffect(() => {
    const nextPositions = new Map()

    visibleTasks.forEach((task) => {
      const element = rowRefs.current.get(task.id)
      if (!element) return

      const currentRect = element.getBoundingClientRect()
      nextPositions.set(task.id, currentRect)

      const previousRect = previousPositionsRef.current.get(task.id)
      const shouldAnimate = previousRect && draggedTaskId !== task.id
      if (!shouldAnimate) return

      const deltaY = previousRect.top - currentRect.top
      if (!deltaY) return

      element.style.transition = 'none'
      element.style.transform = `translateY(${deltaY}px)`

      requestAnimationFrame(() => {
        element.style.transition = 'transform 160ms ease'
        element.style.transform = 'translateY(0)'
      })
    })

    previousPositionsRef.current = nextPositions
  }, [visibleTasks, draggedTaskId])

  return (
    <main className="app">
      <section className="todoCard">
        <h1>To-Do</h1>
        <p className="counter">
          {remainingCount} task{remainingCount === 1 ? '' : 's'} remaining
        </p>

        <form className="inputRow" onSubmit={addTask}>
          <input
            type="text"
            placeholder="Add a task"
            value={taskText}
            onChange={(event) => setTaskText(event.target.value)}
          />
          <button type="submit">Add</button>
        </form>

        <div className="controlsRow">
          <div className="filterGroup">
            <button
              type="button"
              className={`filterButton ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`filterButton ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`filterButton ${
                filter === 'completed' ? 'active' : ''
              }`}
              onClick={() => setFilter('completed')}
            >
              Completed
            </button>
          </div>

          <button
            type="button"
            className="clearButton"
            onClick={clearCompletedTasks}
            disabled={completedCount === 0}
          >
            Clear completed
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="emptyState">No tasks yet.</p>
        ) : visibleTasks.length === 0 ? (
          <p className="emptyState">No matching tasks.</p>
        ) : (
          <ul className="taskList">
            {visibleTasks.map((task) => (
              <li
                key={task.id}
                className={`taskRow ${draggedTaskId === task.id ? 'dragging' : ''} ${
                  dragOverTaskId === task.id ? 'dragOver' : ''
                }`}
                ref={(element) => {
                  if (element) {
                    rowRefs.current.set(task.id, element)
                  } else {
                    rowRefs.current.delete(task.id)
                  }
                }}
                draggable={editingTaskId !== task.id}
                onDragStart={(event) => handleDragStart(event, task.id)}
                onDragOver={(event) => handleDragOver(event, task.id)}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
              >
                {editingTaskId === task.id ? (
                  <input
                    type="text"
                    className="editInput"
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    onKeyDown={(event) => handleEditKeyDown(event, task.id)}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className={`taskText ${task.completed ? 'completed' : ''}`}
                    onClick={() => toggleTask(task.id)}
                  >
                    {task.text}
                  </button>
                )}
                <button
                  type="button"
                  className="editButton"
                  onClick={() =>
                    editingTaskId === task.id
                      ? saveEditingTask(task.id)
                      : startEditingTask(task)
                  }
                >
                  {editingTaskId === task.id ? 'Save' : 'Edit'}
                </button>
                <button
                  type="button"
                  className="deleteButton"
                  aria-label={`Delete ${task.text}`}
                  onClick={() => deleteTask(task.id)}
                >
                  X
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
