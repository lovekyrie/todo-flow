import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

async function main() {
  // Reuse a locally available Playwright runtime; no app dependency is required.
  const { chromium } = await import(process.argv[2] || process.env.PLAYWRIGHT_CORE_PATH || 'playwright-core')
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222')
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const output = fileURLToPath(new URL('./screenshots/', import.meta.url))
  await mkdir(output, { recursive: true })
  const results = []
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const fixture = [
    {
      id: 1,
      title: '剪指甲',
      completed: false,
      createdAt: '2026-11-01T02:30:00Z',
    },
    {
      id: 2,
      title: '学习前端技术',
      completed: false,
      createdAt: '2026-11-01T06:00:00Z',
    },
    {
      id: 3,
      title: '完成项目文档',
      completed: true,
      createdAt: '2026-10-31T12:15:00Z',
    },
    {
      id: 4,
      title: '去健身房',
      completed: false,
      createdAt: '2026-11-02T11:00:00Z',
    },
    {
      id: 5,
      title: '买生日礼物',
      completed: true,
      createdAt: '2024-01-15T02:00:00Z',
    },
  ]
  let todos = structuredClone(fixture)
  let nextId = 6
  let failNext = null
  let unauthorized = false
  let loadDelay = 0
  let lastBody

  await context.route('**/api/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const method = request.method()
    if (method !== 'GET')
      await new Promise(resolve => setTimeout(resolve, 180))
    else if (loadDelay)
      await new Promise(resolve => setTimeout(resolve, loadDelay))
    const reply = (status, data) => route.fulfill({
      status,
      contentType: 'application/json',
      body: status === 204
        ? ''
        : JSON.stringify(data),
    }).catch(() => {})
    if (unauthorized)
      return reply(401, { error: 'unauthorized' })
    if (failNext && path === failNext.path && method === failNext.method) {
      const failure = failNext
      failNext = null
      if (failure.network)
        return route.abort('failed').catch(() => {})
      return reply(failure.status || 500, { error: failure.error || 'internal error' })
    }
    if (path.startsWith('/api/auth/')) {
      lastBody = request.postDataJSON()
      return reply(path.endsWith('register')
        ? 201
        : 200, {
        token: 'ui-qa-placeholder',
        user: { id: 1, username: 'lovekyrie' },
      })
    }
    if (path === '/api/me')
      return reply(200, { id: 1, username: 'lovekyrie' })
    if (path === '/api/todos' && method === 'GET')
      return reply(200, todos)
    if (path === '/api/todos' && method === 'POST') {
      lastBody = request.postDataJSON()
      const todo = {
        id: nextId++,
        title: lastBody.title,
        completed: false,
        createdAt: '2026-11-01T08:00:00Z',
      }
      todos.push(todo)
      return reply(201, todo)
    }
    const id = Number(path.split('/').at(-1))
    const todo = todos.find(item => item.id === id)
    if (!todo)
      return reply(404, { error: 'not found' })
    if (method === 'PATCH') {
      lastBody = request.postDataJSON()
      Object.assign(todo, lastBody)
      return reply(200, todo)
    }
    if (method === 'DELETE') {
      todos = todos.filter(item => item.id !== id)
      return reply(204)
    }
    return reply(404, {})
  })

  const wait = fn => page.waitForFunction(fn, undefined, { timeout: 8000 })
  async function waitCount(number) {
    await page.waitForFunction(expected => document.querySelectorAll('.todo-card').length === expected, number)
  }
  async function stats(expected) {
    assert.deepEqual(await page.locator('.stat-card strong').allTextContents(), expected.map(String))
  }
  async function ready() {
    await page.locator('.task-section[aria-busy="false"]').waitFor()
  }
  async function layout(name, width, screenshot = true) {
    await page.setViewportSize({
      width,
      height: width > 480
        ? 900
        : 812,
    })
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      root: document.querySelector('#root').getBoundingClientRect().width,
      overlap: [
        ...document.querySelectorAll('.todo-row'),
      ].some(row => row.querySelector('.todo-copy').getBoundingClientRect().right > row.querySelector('.todo-actions').getBoundingClientRect().left),
      invalidImages: [...document.images].filter(image => !image.complete || !image.naturalWidth).length,
    }))
    assert.ok(dimensions.scrollWidth <= dimensions.viewport + 1, JSON.stringify(dimensions))
    assert.ok(dimensions.root <= 480, JSON.stringify(dimensions))
    assert.equal(dimensions.overlap, false)
    assert.equal(dimensions.invalidImages, 0)
    if (screenshot)
      await page.screenshot({ path: `${output + name}-${width}.png`, fullPage: true })
    results.push({ page: name, ...dimensions })
  }

  try {
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor()
    for (const width of [320, 375, 390, 430, 1280])
      await layout('login', width)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('button', { name: '显示密码', exact: true }).click()
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'text')
    await page.getByRole('button', { name: '隐藏密码', exact: true }).click()
    assert.equal(await page.locator('#login-password').getAttribute('type'), 'password')
    await page.getByRole('link', { name: '去注册' }).click()
    await page.getByRole('heading', { name: '创建账号' }).waitFor()
    for (const width of [320, 375, 390, 430, 1280])
      await layout('register', width)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByLabel('用户名', { exact: true }).fill(' ui-qa-user ')
    await page.getByLabel('密码', { exact: true }).fill('qa-example-password')
    await page.getByLabel('确认密码', { exact: true }).fill('mismatch')
    await page.getByText('两次输入的密码不一致').waitFor()
    assert.equal(await page.getByRole('button', { name: '注册', exact: true }).isDisabled(), true)
    await page.getByLabel('确认密码', { exact: true }).fill('qa-example-password')
    failNext = {
      path: '/api/auth/register',
      method: 'POST',
      status: 409,
      error: 'username taken',
    }
    await page.getByRole('button', { name: '注册', exact: true }).click()
    await page.getByText('用户名已存在').waitFor()
    await page.getByRole('button', { name: '注册', exact: true }).click()
    await ready()
    assert.equal(lastBody.username, 'ui-qa-user')
    await waitCount(5)
    await stats([5, 2, 3])
    for (const width of [320, 375, 390, 430, 1280])
      await layout('todos', width)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('checkbox', { name: '标记为完成：剪指甲', exact: true }).click()
    await wait(() => document.querySelectorAll('.is-completed').length === 3)
    await stats([5, 3, 2])
    await page.getByRole('button', { name: /^已完成/ }).click()
    await waitCount(3)
    await page.getByRole('checkbox', { name: '标记为未完成：剪指甲', exact: true }).click()
    await waitCount(2)
    await stats([5, 2, 3])
    await page.getByRole('button', { name: /^进行中/ }).click()
    await waitCount(3)
    await page.getByLabel('待办标题', { exact: true }).fill('  读书二十分钟  ')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '添加中…' }).isDisabled(), true)
    await waitCount(6)
    assert.equal(lastBody.title, '读书二十分钟')
    assert.equal(await page.getByLabel('待办标题', { exact: true }).inputValue(), '')
    await stats([6, 2, 4])
    await page.getByRole('button', { name: '编辑待办：读书二十分钟', exact: true }).click()
    assert.equal(await page.getByLabel('编辑待办标题').evaluate(input => input === document.activeElement), true)
    const longTitle = '这是一个很长的待办标题，用来检查手机端自动换行以及操作按钮是否仍然可以正常点击。LongUnbrokenTaskTitle0123456789'
    await page.getByLabel('编辑待办标题').fill(longTitle)
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.locator('.edit-todo-form').waitFor({ state: 'detached' })
    await layout('long-title', 320)
    await page.getByRole('button', { name: `编辑待办：${longTitle}`, exact: true }).click()
    await page.getByLabel('编辑待办标题').fill('取消这次编辑')
    await page.getByLabel('编辑待办标题').press('Escape')
    assert.equal(await page.locator('.todo-title').filter({ hasText: longTitle }).count(), 1)
    await page.getByRole('button', { name: `编辑待办：${longTitle}`, exact: true }).click()
    await page.getByLabel('编辑待办标题').fill('请求失败时保留草稿')
    failNext = { path: '/api/todos/6', method: 'PATCH' }
    await page.getByRole('button', { name: '保存', exact: true }).click()
    await page.getByText('保存失败，请稍后重试').waitFor()
    assert.equal(await page.getByLabel('编辑待办标题').inputValue(), '请求失败时保留草稿')
    await page.getByRole('button', { name: '取消', exact: true }).click()
    failNext = { path: '/api/todos/6', method: 'DELETE' }
    await page.getByRole('button', { name: `删除待办：${longTitle}`, exact: true }).click()
    await page.getByText('删除失败，请稍后重试').waitFor()
    await waitCount(6)
    await page.getByRole('button', { name: `删除待办：${longTitle}`, exact: true }).click()
    await waitCount(5)
    await stats([5, 2, 3])
    await page.getByLabel('待办标题', { exact: true }).fill('网络失败时保留输入')
    failNext = { path: '/api/todos', method: 'POST', network: true }
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.getByText('网络连接失败，请稍后重试').waitFor()
    assert.equal(await page.getByLabel('待办标题', { exact: true }).inputValue(), '网络失败时保留输入')
    await waitCount(5)
    todos = []
    await page.reload()
    await ready()
    await page.getByRole('heading', { name: '还没有待办事项' }).waitFor()
    await stats([0, 0, 0])
    await layout('empty', 375)
    todos = [
      structuredClone(fixture[0]),
    ]
    await page.reload()
    await ready()
    await page.getByRole('button', { name: /^已完成/ }).click()
    await page.getByRole('heading', { name: '还没有已完成的任务' }).waitFor()
    await layout('filter-empty', 375)
    loadDelay = 600
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByText('正在加载你的待办…').waitFor()
    await layout('loading', 375)
    await ready()
    loadDelay = 0
    failNext = { path: '/api/todos', method: 'GET' }
    await page.reload()
    await page.getByText('待办加载失败，请检查连接后重试').waitFor()
    await layout('load-error', 375)
    await page.getByRole('button', { name: '重新加载' }).click()
    await ready()
    await waitCount(1)
    unauthorized = true
    await page.getByLabel('待办标题', { exact: true }).fill('过期测试')
    await page.getByRole('button', { name: '添加', exact: true }).click()
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor()
    unauthorized = false
    await page.getByLabel('用户名', { exact: true }).fill('ui-qa-user')
    await page.getByLabel('密码', { exact: true }).fill('qa-example-password')
    failNext = {
      path: '/api/auth/login',
      method: 'POST',
      status: 401,
      error: 'invalid username or password',
    }
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByText('用户名或密码错误').waitFor()
    failNext = { path: '/api/auth/login', method: 'POST', network: true }
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await page.getByText('网络连接失败，请稍后重试').waitFor()
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await ready()
    await page.getByRole('button', { name: '退出', exact: true }).click()
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor()
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('heading', { name: '欢迎回来' }).waitFor()
    assert.deepEqual(errors, [])
    await writeFile(`${output}../browser-results.json`, `${JSON.stringify({
      status: 'passed',
      coverage: 'auth, password visibility, registration mismatch/conflict, CRUD, toggle/undo, filters, counts, long titles, empty/loading/error/retry, network failures, 401, logout',
      results,
      pageErrors: errors,
    }, null, 2)}\n`)
    console.log(`Passed: mobile layouts and all mocked API interaction scenarios (${results.length} screenshots).`)
  }
  finally {
    await context.close()
    await browser.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
