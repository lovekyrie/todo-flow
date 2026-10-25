import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api'
import './TodoPage.scss'

interface Todo {
  id: number
  title: string
  completed: boolean
}

function TodoPage() {
  const navigate = useNavigate()
  const [todos, setTodos] = useState<Todo[]>([])
  const [title, setTitle] = useState('')
  const [username, setUsername] = useState('')

  useEffect(() => {
    api('/api/me').then(async (response) => {
      if (response.status === 401) {
        clearToken()
        navigate('/login')
        return
      }
      const user = await response.json()
      setUsername(user.username)
    })

    api('/api/todos').then(async (response) => {
      if (!response.ok)
        return
      setTodos(await response.json())
    })
  }, [navigate])

  function logout() {
    clearToken()
    navigate('/login')
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTitle = title.trim()
    if (!nextTitle) {
      return
    }

    const response = await api('/api/todos', {
      method: 'POST',
      body: JSON.stringify({ title: nextTitle }),
    })
    if (!response.ok) {
      return
    }

    const created: Todo = await response.json()
    setTodos(current => [...current, created])
    setTitle('')
  }

  async function handleComplete(id: number) {
    const response = await api(`/api/todos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed: true }),
    })
    if (!response.ok) {
      return
    }
    const updated: Todo = await response.json()
    setTodos(current => current.map(todo => todo.id === id
      ? updated
      : todo))
  }

  async function handleDelete(id: number) {
    const response = await api(`/api/todos/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      return
    }
    setTodos(current => current.filter(todo => todo.id !== id))
  }

  return (
    <div className="todo-page">
      <div className="toolbar">
        <span>{username}</span>
        <button type="button" onClick={logout}>退出</button>
      </div>
      <h1>Todo List</h1>
      <form onSubmit={handleAdd}>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="待办标题"
          aria-label="待办标题"
        />
        <button type="submit">添加</button>
      </form>
      <ul>
        {todos.map(todo => (
          <li key={todo.id}>
            <input type="checkbox" checked={todo.completed} onChange={() => handleComplete(todo.id)} />
            <span>{todo.title}</span>
            <button onClick={() => handleDelete(todo.id)}>删除</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default TodoPage
