import type { SubmitEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken, errorMessage } from '../api'
import Icon from '../components/Icon'
import './TodoPage.scss'

interface Todo {
  id: number
  title: string
  completed: boolean
  createdAt: string
}

type Filter = 'all' | 'active' | 'completed'
type LoadState = 'loading' | 'ready' | 'error'

const filters: { value: Filter, label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
]

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function createdAtLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : dateFormatter.format(date)
}

function TodoPage() {
  const navigate = useNavigate()
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const [pendingIds, setPendingIds] = useState<Set<number>>(() => new Set())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draftTitle, setDraftTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [userResponse, todosResponse] = await Promise.all([
          api('/api/me', { signal: controller.signal }),
          api('/api/todos', { signal: controller.signal }),
        ])
        if (controller.signal.aborted)
          return
        if (userResponse.status === 401 || todosResponse.status === 401) {
          clearToken()
          navigate('/login', { replace: true })
          return
        }
        if (!userResponse.ok || !todosResponse.ok)
          throw new Error('加载失败')

        const [user, items] = await Promise.all([
          userResponse.json(),
          todosResponse.json(),
        ])
        if (controller.signal.aborted)
          return
        setUsername(user.username)
        setTodos(items)
        setLoadState('ready')
      }
      catch {
        if (!controller.signal.aborted) {
          setError('待办加载失败，请检查连接后重试')
          setLoadState('error')
        }
      }
    }

    void load()
    return () => controller.abort()
  }, [navigate, loadAttempt])

  useEffect(() => {
    if (editingId !== null)
      editInputRef.current?.focus()
  }, [editingId])

  const completedCount = todos.filter(todo => todo.completed).length
  const activeCount = todos.length - completedCount
  const counts = { all: todos.length, active: activeCount, completed: completedCount }
  const visibleTodos = todos.filter(todo => filter === 'all' || (filter === 'completed'
    ? todo.completed
    : !todo.completed))

  function logout() {
    clearToken()
    navigate('/login', { replace: true })
  }

  function retry() {
    setError('')
    setLoadState('loading')
    setLoadAttempt(current => current + 1)
  }

  function markPending(id: number, pending: boolean) {
    setPendingIds((current) => {
      const next = new Set(current)
      if (pending)
        next.add(id)
      else
        next.delete(id)
      return next
    })
  }

  async function todoRequest(path: string, init: RequestInit, fallback: string) {
    let response: Response
    try {
      response = await api(path, init)
    }
    catch {
      throw new Error('网络连接失败，请稍后重试')
    }
    if (response.status === 401) {
      logout()
      throw new Error('登录已过期，请重新登录')
    }
    if (!response.ok)
      throw new Error(await errorMessage(response, fallback))
    return response
  }

  async function handleAdd(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle || adding || loadState !== 'ready')
      return

    setAdding(true)
    setError('')
    try {
      const response = await todoRequest('/api/todos', {
        method: 'POST',
        body: JSON.stringify({ title: nextTitle }),
      }, '添加失败，请稍后重试')
      const created: Todo = await response.json()
      setTodos(current => [...current, created])
      setTitle('')
      setFilter('all')
    }
    catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : '添加失败，请稍后重试')
    }
    finally {
      setAdding(false)
    }
  }

  async function updateTodo(todo: Todo, patch: Partial<Pick<Todo, 'title' | 'completed'>>) {
    if (pendingIds.has(todo.id))
      return

    markPending(todo.id, true)
    setError('')
    try {
      const response = await todoRequest(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      }, '保存失败，请稍后重试')
      const updated: Todo = await response.json()
      setTodos(current => current.map(item => item.id === todo.id
        ? updated
        : item))
      setEditingId(current => current === todo.id
        ? null
        : current)
    }
    catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : '保存失败，请稍后重试')
    }
    finally {
      markPending(todo.id, false)
    }
  }

  async function handleDelete(id: number) {
    if (pendingIds.has(id))
      return

    markPending(id, true)
    setError('')
    try {
      await todoRequest(`/api/todos/${id}`, { method: 'DELETE' }, '删除失败，请稍后重试')
      setTodos(current => current.filter(todo => todo.id !== id))
      setEditingId(current => current === id
        ? null
        : current)
    }
    catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : '删除失败，请稍后重试')
    }
    finally {
      markPending(id, false)
    }
  }

  function startEditing(todo: Todo) {
    setDraftTitle(todo.title)
    setEditingId(todo.id)
  }

  function handleEdit(event: SubmitEvent<HTMLFormElement>, todo: Todo) {
    event.preventDefault()
    const nextTitle = draftTitle.trim()
    if (nextTitle)
      void updateTodo(todo, { title: nextTitle })
  }

  return (
    <main className="todo-page">
      <header className="todo-header">
        <div className="todo-brand">
          <Icon name="logo" size={48} />
          <h1>Todo List</h1>
        </div>
        <button className="secondary-button logout-button" type="button" onClick={logout}>
          <Icon name="logout" size={20} />
          退出
        </button>
        <div className="user-greeting">
          <Icon name="avatar" size={28} />
          <p>
            {username
              ? `你好，${username}`
              : '每一天，都有新的开始'}
          </p>
        </div>
      </header>

      <div className="todo-content">
        <section className="stats-grid" aria-label="任务统计">
          <div className="stat-card">
            <Icon name="stat-all" size={44} />
            <span>全部任务</span>
            <strong>{todos.length}</strong>
          </div>
          <div className="stat-card">
            <Icon name="stat-completed" size={44} />
            <span>已完成</span>
            <strong>{completedCount}</strong>
          </div>
          <div className="stat-card">
            <Icon name="stat-active" size={44} />
            <span>进行中</span>
            <strong>{activeCount}</strong>
          </div>
        </section>

        <form className="add-todo-form" onSubmit={handleAdd} aria-label="添加待办" aria-busy={adding}>
          <label className="sr-only" htmlFor="new-todo">待办标题</label>
          <Icon name="plus" size={26} />
          <input
            id="new-todo"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="输入待办标题…"
            autoComplete="off"
            required
            disabled={adding || loadState !== 'ready'}
          />
          <button className="primary-button" type="submit" disabled={!title.trim() || adding || loadState !== 'ready'}>{adding ? '添加中…' : '添加'}</button>
        </form>

        {error && (
          <div className="todo-error">
            <p className="feedback" role="alert">{error}</p>
            {loadState === 'error' && <button className="secondary-button" type="button" onClick={retry}>重新加载</button>}
          </div>
        )}

        <nav className="todo-filters" aria-label="任务筛选">
          {filters.map(item => (
            <button
              key={item.value}
              type="button"
              aria-pressed={filter === item.value}
              disabled={loadState !== 'ready'}
              onClick={() => {
                setFilter(item.value)
                setEditingId(null)
              }}
            >
              {item.label}
              <span>{counts[item.value]}</span>
            </button>
          ))}
        </nav>

        <section className="task-section" aria-label="待办列表" aria-busy={loadState === 'loading'}>
          {loadState === 'loading' && (
            <div className="empty-state" role="status">
              <span className="loading-spinner" />
              正在加载你的待办…
            </div>
          )}
          {loadState === 'ready' && visibleTodos.length === 0 && (
            <div className="empty-state" role="status">
              <Icon
                name={filter === 'completed'
                  ? 'stat-completed'
                  : 'logo'}
                size={72}
              />
              <h2>
                {todos.length === 0
                  ? '还没有待办事项'
                  : filter === 'completed'
                    ? '还没有已完成的任务'
                    : '当前没有进行中的任务'}
              </h2>
              <p>
                {todos.length === 0
                  ? '写下第一件小事，开启有条理的一天。'
                  : filter === 'completed'
                    ? '完成一件小事，就离目标更近一步。'
                    : '做得不错，给自己一点休息时间吧。'}
              </p>
            </div>
          )}
          <ul className="todo-list">
            {visibleTodos.map((todo) => {
              const pending = pendingIds.has(todo.id)
              const date = createdAtLabel(todo.createdAt)
              return (
                <li className={`todo-card${todo.completed ? ' is-completed' : ''}`} key={todo.id} aria-busy={pending}>
                  <div className="todo-row">
                    <label className="todo-check">
                      <input
                        type="checkbox"
                        checked={todo.completed}
                        disabled={pending}
                        aria-label={(todo.completed ? '标记为未完成：' : '标记为完成：') + todo.title}
                        onChange={() => void updateTodo(todo, { completed: !todo.completed })}
                      />
                    </label>
                    <div className="todo-copy">
                      <span className="todo-title">{todo.title}</span>
                      {date && (
                        <div className="todo-date">
                          <Icon name="clock" size={16} />
                          <time dateTime={todo.createdAt}>{`创建于 ${date}`}</time>
                        </div>
                      )}
                    </div>
                    <div className="todo-actions">
                      <button className="icon-button" type="button" aria-label={`编辑待办：${todo.title}`} aria-expanded={editingId === todo.id} disabled={pending} onClick={() => startEditing(todo)}><Icon name="edit" /></button>
                      <button className="icon-button delete-button" type="button" aria-label={`删除待办：${todo.title}`} disabled={pending} onClick={() => void handleDelete(todo.id)}><Icon name="delete" /></button>
                    </div>
                  </div>
                  {editingId === todo.id && (
                    <form className="edit-todo-form" aria-label="编辑待办" onSubmit={event => handleEdit(event, todo)}>
                      <label className="sr-only" htmlFor={`edit-todo-${todo.id}`}>编辑待办标题</label>
                      <input
                        ref={editInputRef}
                        id={`edit-todo-${todo.id}`}
                        value={draftTitle}
                        onChange={event => setDraftTitle(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape' && !pending)
                            setEditingId(null)
                        }}
                        disabled={pending}
                        required
                      />
                      <div className="edit-actions">
                        <button className="secondary-button" type="button" disabled={pending} onClick={() => setEditingId(null)}>取消</button>
                        <button className="primary-button" type="submit" disabled={pending || !draftTitle.trim()}>{pending ? '保存中…' : '保存'}</button>
                      </div>
                    </form>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
        {loadState === 'ready' && todos.length > 0 && (
          <p className="list-footer">
            {activeCount > 0
              ? `还有 ${activeCount} 件小事，按自己的节奏来。`
              : '今天的努力，都值得一个勾。'}
          </p>
        )}
      </div>
    </main>
  )
}

export default TodoPage
