'use client'

// INTERNAL OPS DASHBOARD — Blocked in production by middleware.ts (server-side 308 redirect).
// This client-side check is a secondary safety net only.
if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  window.location.replace('/')
}

import { useState, useCallback, memo } from 'react'
import Link from 'next/link'
import { IconClose, IconChevronDown } from '../components/Icons'
import { useAuth } from '../context/AuthContext'
import { useDashboardData, DEFAULT_TASKS, DEFAULT_ACTIVITY, DEFAULT_COMPANIES, DEFAULT_SETTINGS } from '../hooks/useDashboardData'
import type { Task, ActivityItem, Company, DashboardSettings, TaskStatus, Priority, AgentName, AgentStatus, Notification } from '../lib/dashboardApi'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const todayStr = new Date().toISOString().split('T')[0]

function formatTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const AGENT_COLORS: Record<string, string> = {
  Axle: 'var(--purple)',
  Bolt: 'var(--blue)',
  Zip: 'var(--green)',
}

const AGENT_MODELS: Record<string, string> = {
  Axle: 'Claude Opus 4.6',
  Bolt: 'Claude Sonnet 4.6',
  Zip: 'Claude Haiku 4.5',
}

const AGENT_ROLES: Record<string, string> = {
  Axle: 'Strategy, orchestration, research',
  Bolt: 'Development, features, fixes',
  Zip: 'Research, quick tasks, docs',
}

const PRIORITY_COLOR: Record<Priority, string> = {
  high: 'var(--red)',
  medium: 'var(--yellow)',
  low: 'var(--green)',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PROJECT_COLORS: Record<string, string> = {
  'Development': 'var(--blue)',
  'Business': 'var(--purple)',
  'Operations': 'var(--green)',
}

function getProjectColor(projectName: string) {
  for (const [cat, color] of Object.entries(PROJECT_COLORS)) {
    if (projectName.includes(cat)) return color
  }
  return 'var(--accent)'
}

// ─── Mini SVG Bar Chart ───────────────────────────────────────────────────────

const BarChart = memo(function BarChart({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, width: '100%' }}>
      {data.map((v, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: '100%', background: 'var(--accent)', borderRadius: '3px 3px 0 0',
            height: `${(v / max) * 60}px`, opacity: 0.7 + (v / max) * 0.3,
            transition: 'height 0.4s ease',
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-2)', writingMode: 'horizontal-tb' }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  )
})

const PieChart = memo(function PieChart({ slices }: { slices: { label: string; value: number; color: string }[] }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  let offset = 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width={80} height={80} viewBox="0 0 32 32" style={{ flexShrink: 0 }}>
        {slices.map((s, i) => {
          const pct = s.value / total
          const dash = pct * 100
          const gap = 100 - dash
          const rot = offset * 3.6
          offset += pct * 100
          return (
            <circle key={i} cx="16" cy="16" r="15.9" fill="none"
              stroke={s.color} strokeWidth="32"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={25 - rot / 3.6}
              transform="rotate(-90 16 16)" />
          )
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-1)' }}>{s.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-2)', marginLeft: 'auto' }}>
              {Math.round((s.value / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})

// ─── Add Task Modal ────────────────────────────────────────────────────────────

function AddTaskModal({
  companies, onAdd, onClose, defaultStatus
}: {
  companies: Company[]
  onAdd: (t: Task) => void
  onClose: () => void
  defaultStatus?: TaskStatus
}) {
  const [form, setForm] = useState({
    title: '', description: '', status: defaultStatus || 'todo' as TaskStatus,
    project: 'TradVue › Development', company: 'ApexLogics',
    agent: '' as AgentName | '', priority: 'medium' as Priority,
    dueDate: '', notes: '',
  })

  const allProjects = companies.flatMap(c => c.projects.map(p => ({ company: c.name, project: p.name })))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    onAdd({
      ...form, id: uid(),
      createdAt: new Date().toISOString(),
      completedAt: form.status === 'done' ? new Date().toISOString() : '',
    })
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: 480, maxWidth: '95vw',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Add Task</h3>
          <button onClick={onClose} style={{ color: 'var(--text-2)', padding: 4 }}><IconClose size={16} /></button>
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="ds-input" placeholder="Title *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus required />
          <textarea className="ds-input" placeholder="Description" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ resize: 'vertical', minHeight: 64 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <select className="ds-input" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
            </select>
            <select className="ds-input" value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select className="ds-input" value={form.project}
              onChange={e => {
                const match = allProjects.find(p => p.project === e.target.value)
                setForm(f => ({ ...f, project: e.target.value, company: match?.company || f.company }))
              }}>
              {allProjects.map(p => <option key={p.project} value={p.project}>{p.project}</option>)}
            </select>
            <select className="ds-input" value={form.agent}
              onChange={e => setForm(f => ({ ...f, agent: e.target.value as AgentName | '' }))}>
              <option value="">No agent</option>
              <option value="Axle">Axle</option>
              <option value="Bolt">Bolt</option>
              <option value="Zip">Zip</option>
            </select>
          </div>
          <input type="date" className="ds-input" value={form.dueDate}
            onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
            placeholder="Due date" />
          <textarea className="ds-input" placeholder="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            style={{ resize: 'vertical', minHeight: 48 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Task</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

const TaskCard = memo(function TaskCard({
  task, onClick, onDragStart
}: {
  task: Task
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        background: 'var(--bg-3)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '12px 14px', cursor: 'grab',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-b)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{task.title}</span>
        <span style={{ color: PRIORITY_COLOR[task.priority], flexShrink: 0, fontSize: 12 }}>
          {task.priority === 'high' ? '[H]' : task.priority === 'medium' ? '[M]' : '[L]'}
        </span>
      </div>
      {task.description && (
        <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.4,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {task.description}
        </p>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 4,
          background: getProjectColor(task.project) + '20',
          color: getProjectColor(task.project), border: `1px solid ${getProjectColor(task.project)}30`,
        }}>{task.project.split('›')[1]?.trim() || task.project}</span>
        {task.agent && (
          <span style={{
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            background: AGENT_COLORS[task.agent] + '20',
            color: AGENT_COLORS[task.agent], border: `1px solid ${AGENT_COLORS[task.agent]}30`,
          }}>{task.agent}</span>
        )}
        {task.dueDate && (
          <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  )
})

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task, onClose, onUpdate, onDelete }: {
  task: Task
  onClose: () => void
  onUpdate: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(task)

  function save() {
    onUpdate({ ...form, completedAt: form.status === 'done' && !form.completedAt ? new Date().toISOString() : form.completedAt })
    setEditing(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14,
        padding: 28, width: 540, maxWidth: '95vw', maxHeight: '85vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{task.title}</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 4,
                background: getProjectColor(task.project) + '20', color: getProjectColor(task.project),
              }}>{task.project}</span>
              {task.agent && <span style={{ fontSize: 10, color: AGENT_COLORS[task.agent] }}>{task.agent}</span>}
              <span style={{ fontSize: 10, color: PRIORITY_COLOR[task.priority] }}>{PRIORITY_LABEL[task.priority]}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-2)', padding: 4 }}><IconClose size={16} /></button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input className="ds-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <textarea className="ds-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ minHeight: 80, resize: 'vertical' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <select className="ds-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TaskStatus }))}>
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <select className="ds-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <textarea className="ds-input" placeholder="Notes" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} style={{ minHeight: 60, resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {task.description && <p style={{ fontSize: 13, color: 'var(--text-1)', lineHeight: 1.6 }}>{task.description}</p>}
            {task.notes && (
              <div style={{ background: 'var(--bg-3)', borderRadius: 8, padding: '12px 14px' }}>
                <span style={{ fontSize: 11, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>NOTES</span>
                <p style={{ fontSize: 13, color: 'var(--text-1)' }}>{task.notes}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>CREATED</span>
                <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{formatTime(task.createdAt)}</span>
              </div>
              {task.completedAt && (
                <div>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>COMPLETED</span>
                  <span style={{ fontSize: 12, color: 'var(--green)' }}>{formatTime(task.completedAt)}</span>
                </div>
              )}
              {task.dueDate && (
                <div>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block', marginBottom: 2 }}>DUE</span>
                  <span style={{ fontSize: 12, color: 'var(--text-1)' }}>{task.dueDate}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button className="btn" style={{ color: 'var(--red)', fontSize: 12 }}
                onClick={() => { onDelete(task.id); onClose() }}>Delete</button>
              <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  title, status, tasks, onTaskClick, onDrop, onDragStart, onAddTask, color,
}: {
  title: string; status: TaskStatus; tasks: Task[]
  onTaskClick: (t: Task) => void
  onDrop: (status: TaskStatus) => void
  onDragStart: (id: string) => void
  onAddTask: (s: TaskStatus) => void
  color: string
}) {
  const [over, setOver] = useState(false)

  return (
    <div
      style={{
        flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column',
        background: over ? 'var(--bg-3)' : 'var(--bg-2)',
        border: `1px solid ${over ? color : 'var(--border)'}`,
        borderRadius: 12, transition: '0.15s ease',
      }}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={() => { setOver(false); onDrop(status) }}
    >
      <div style={{
        padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)', letterSpacing: '0.02em' }}>{title}</span>
          <span style={{
            fontSize: 10, background: color + '20', color, borderRadius: 10,
            padding: '1px 7px', fontWeight: 600,
          }}>{tasks.length}</span>
        </div>
        <button onClick={() => onAddTask(status)} style={{
          color: 'var(--text-2)', padding: '2px 6px', borderRadius: 6, fontSize: 18, lineHeight: 1,
          transition: '0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = color)}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
        >+</button>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
        {tasks.map(t => (
          <TaskCard key={t.id} task={t} onClick={() => onTaskClick(t)}
            onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(t.id) }} />
        ))}
        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, padding: '24px 0' }}>
            No tasks
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token } = useAuth()
  const {
    tasks, activity, companies, settings,
    agents, notifications, unreadCount, stats,
    setTasks, setActivity, setCompanies, setSettings,
    addTask, updateTask, deleteTask, addActivityItem,
    addCompany, deleteCompany,
    markNotificationRead, markAllNotificationsRead, deleteNotification,
    refreshStats,
  } = useDashboardData(token)

  const [activeSection, setActiveSection] = useState<string>('overview')
  const [showAddTask, setShowAddTask] = useState(false)
  const [addTaskStatus, setAddTaskStatus] = useState<TaskStatus>('todo')
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [taskFilter, setTaskFilter] = useState({ agent: '', project: '', priority: '' })
  const [activityFilter, setActivityFilter] = useState('')
  const [expandedCompany, setExpandedCompany] = useState<string>('apex')
  const [addNote, setAddNote] = useState('')
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [tokenInputs, setTokenInputs] = useState<Record<string, number>>({ Axle: 50000, Bolt: 200000, Zip: 100000 })
  const [newCompanyName, setNewCompanyName] = useState('')
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Derived stats
  const todayTasks = tasks.filter(t => t.createdAt.startsWith(todayStr) || t.completedAt.startsWith(todayStr))
  const doneTodayTasks = tasks.filter(t => t.completedAt.startsWith(todayStr))
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
  const weekTasks = tasks.filter(t => t.completedAt && new Date(t.completedAt) >= weekStart)
  const openTasks = tasks.filter(t => t.status !== 'done')

  const filteredTasks = tasks.filter(t =>
    (!taskFilter.agent || t.agent === taskFilter.agent) &&
    (!taskFilter.project || t.project === taskFilter.project) &&
    (!taskFilter.priority || t.priority === taskFilter.priority)
  )

  const filteredActivity = activity.filter(a =>
    !activityFilter || a.agent === activityFilter || a.project.includes(activityFilter)
  )

  // Task board
  function handleDrop(status: TaskStatus) {
    if (!dragId) return
    const target = tasks.find(t => t.id === dragId)
    if (!target) return
    const updated = {
      ...target, status,
      completedAt: status === 'done' && !target.completedAt ? new Date().toISOString() : target.completedAt,
    }
    updateTask(updated)
    if (status !== target.status) {
      logActivity(`${target.agent || 'Someone'} moved: ${target.title} → ${status === 'done' ? 'Done' : status === 'inprogress' ? 'In Progress' : 'To Do'}`, target.agent, target.project)
    }
    setDragId(null)
  }

  function logActivity(message: string, agent: AgentName | '', project: string) {
    addActivityItem({ id: uid(), type: 'update', message, agent, project, timestamp: new Date().toISOString() })
  }

  function handleAddTask(task: Task) {
    addTask(task)
    logActivity(`Added task: ${task.title}`, task.agent, task.project)
  }

  function handleUpdateTask(task: Task) {
    updateTask(task)
  }

  function handleDeleteTask(id: string) {
    deleteTask(id)
  }

  function handleAddNote() {
    if (!addNote.trim()) return
    logActivity(`Note: ${addNote}`, '', '')
    setAddNote('')
    setShowNoteInput(false)
  }

  function handleExport() {
    const data = { tasks, activity, companies, settings, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `tradvue-dashboard-${todayStr}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleImport() {
    try {
      const data = JSON.parse(importJson)
      if (data.tasks) setTasks(data.tasks)
      if (data.activity) setActivity(data.activity)
      if (data.companies) setCompanies(data.companies)
      if (data.settings) setSettings(data.settings)
      setShowImport(false); setImportJson('')
    } catch { alert('Invalid JSON') }
  }

  // Metrics
  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 13 + i)
    return d.toISOString().split('T')[0]
  })

  const completedByDay = last14Days.map(day =>
    tasks.filter(t => t.completedAt.startsWith(day)).length
  )

  const dayLabels = last14Days.map(d => {
    const date = new Date(d)
    return date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)
  })

  const tasksByAgent = ['Axle', 'Bolt', 'Zip'].map(agent => ({
    label: agent,
    value: tasks.filter(t => t.agent === agent && t.status === 'done').length,
    color: AGENT_COLORS[agent],
  })).filter(x => x.value > 0)

  const allProjects = companies.flatMap(c => c.projects.map(p => p.name))
  const tasksByProject = allProjects.map(proj => ({
    label: proj.split('›')[1]?.trim() || proj,
    value: tasks.filter(t => t.project === proj && t.status === 'done').length,
    color: getProjectColor(proj),
  })).filter(x => x.value > 0)

  // Cost estimates
  const costEstimate = (Object.entries(tokenInputs) as [AgentName, number][]).reduce((total, [agent, tokens]) => {
    const rate = settings.agentCosts[agent] || 0
    return total + (tokens / 1_000_000) * rate
  }, 0)

  // Build agent statuses from real API data (falls back to static if empty)
  const agentStatuses: Record<string, { status: string; color: string; current: string }> = agents.length > 0
    ? Object.fromEntries(agents.map(a => [a.name, {
        status: a.status === 'busy' ? 'Working' : a.status === 'online' ? 'Active' : 'Idle',
        color: a.status === 'offline' ? 'var(--text-2)' : 'var(--blue)',
        current: a.currentTask || '',
      }]))
    : {
        Axle: { status: 'Active', color: 'var(--blue)', current: '' },
        Bolt: { status: 'Working', color: 'var(--blue)', current: '' },
        Zip: { status: 'Idle', color: 'var(--green)', current: '' },
      }

  const navItems = [
    { id: 'overview', label: 'Overview', emoji: 'home' },
    { id: 'tasks', label: 'Tasks', emoji: 'tasks' },
    { id: 'companies', label: 'Companies', emoji: 'co' },
    { id: 'agents', label: 'Agents', emoji: 'bot' },
    { id: 'notifications', label: 'Notifications', emoji: 'bell' },
    { id: 'metrics', label: 'Metrics', emoji: 'chart' },
    { id: 'settings', label: 'Settings', emoji: 'gear' },
  ]

  return (
    <div className="dashboard-layout" style={{
      background: 'var(--bg-0)', fontFamily: 'var(--font)',
    }}>
      {/* ── Mobile sidebar backdrop ── */}
      <div
        className={`dashboard-sidebar-backdrop ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />
      {/* ── Sidebar ── */}
      <aside className={`dashboard-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Brand */}
        <div style={{ padding: '20px 20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--purple) 0%, var(--blue) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, flexShrink: 0,
            }}>{'TV'}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.01em' }}>TradVue</div>
              <div style={{ fontSize: 10, color: 'var(--text-2)' }}>Ops Dashboard</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveSection(item.id); setSidebarOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 8, width: '100%', textAlign: 'left',
              background: activeSection === item.id ? 'var(--bg-3)' : 'transparent',
              color: activeSection === item.id ? 'var(--text-0)' : 'var(--text-2)',
              fontSize: 13, fontWeight: activeSection === item.id ? 500 : 400,
              border: activeSection === item.id ? '1px solid var(--border)' : '1px solid transparent',
              transition: 'all 0.12s',
            }}>
              <span style={{ fontSize: 14 }}>{item.emoji}</span>
              {item.label}
              {item.id === 'tasks' && openTasks.length > 0 && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--accent)', color: '#fff',
                  borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 600,
                }}>{openTasks.length}</span>
              )}
              {item.id === 'notifications' && unreadCount > 0 && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--red)', color: '#fff',
                  borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 600,
                }}>{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Back link */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <Link href="/" style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            ← TradVue
          </Link>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="dashboard-main">
        {/* Header */}
        <header style={{
          padding: '16px 28px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-1)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              className="dashboard-sidebar-toggle"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="Toggle sidebar"
            ><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg></button>
            <div>
            <h1 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
              {navItems.find(n => n.id === activeSection)?.emoji}{' '}
              {navItems.find(n => n.id === activeSection)?.label}
            </h1>
            <p style={{ fontSize: 11, color: 'var(--text-2)' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeSection === 'overview' && (
              <>
                <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={() => { setAddTaskStatus('todo'); setShowAddTask(true) }}>
                  + Add Task
                </button>
                <button className="btn" style={{ fontSize: 12, padding: '7px 14px' }}
                  onClick={() => setShowNoteInput(!showNoteInput)}>
                  + Add Note
                </button>
              </>
            )}
            {activeSection === 'tasks' && (
              <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 14px' }}
                onClick={() => { setAddTaskStatus('todo'); setShowAddTask(true) }}>
                + Add Task
              </button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>

          {/* ── OVERVIEW ── */}
          {activeSection === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Note input */}
              {showNoteInput && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input className="ds-input" placeholder="Add a note…" value={addNote}
                    onChange={e => setAddNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                    style={{ flex: 1 }} autoFocus />
                  <button className="btn btn-primary" onClick={handleAddNote}>Save</button>
                  <button className="btn" onClick={() => setShowNoteInput(false)}>Cancel</button>
                </div>
              )}

              {/* Status cards */}
              <div className="dashboard-grid-4">
                {/* Active Agents */}
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.06em', marginBottom: 10 }}>ACTIVE AGENTS</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-0)', marginBottom: 8 }}>
                    {stats.activeAgents || agents.filter(a => a.status !== 'offline').length || Object.values(agentStatuses).filter(a => a.status !== 'Idle').length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['Axle', 'Bolt', 'Zip'].map(agent => {
                      const agentData = agents.find(a => a.name === agent)
                      const st = agentStatuses[agent] || { status: 'Idle', current: '' }
                      const statusLabel = agentData
                        ? (agentData.status === 'busy' ? 'working' : agentData.status === 'online' ? 'online' : 'offline')
                        : (st.current ? 'working' : 'idle')
                      const dotColor = statusLabel === 'offline' ? 'var(--text-3)' : statusLabel === 'working' ? 'var(--blue)' : 'var(--green)'
                      return (
                        <div key={agent} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor }} />
                          <span style={{ fontSize: 11, color: 'var(--text-1)' }}>{agent}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 'auto' }}>{statusLabel}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Tasks Today */}
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.06em', marginBottom: 10 }}>TASKS TODAY</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--green)' }}>
                    {doneTodayTasks.length}
                    <span style={{ fontSize: 14, color: 'var(--text-2)', fontWeight: 400 }}>/{todayTasks.length}</span>
                  </div>
                  <div style={{ marginTop: 8, background: 'var(--bg-3)', borderRadius: 4, height: 4 }}>
                    <div style={{
                      height: '100%', borderRadius: 4, background: 'var(--green)',
                      width: `${todayTasks.length ? (doneTodayTasks.length / todayTasks.length) * 100 : 0}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 6 }}>
                    {doneTodayTasks.length} completed
                  </p>
                </div>

                {/* Tasks This Week */}
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.06em', marginBottom: 10 }}>THIS WEEK</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--blue)' }}>{weekTasks.length}</div>
                  <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8 }}>tasks completed</p>
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {['Axle', 'Bolt', 'Zip'].map(agent => (
                      <span key={agent} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: AGENT_COLORS[agent] + '20', color: AGENT_COLORS[agent],
                      }}>
                        {weekTasks.filter(t => t.agent === agent).length} {agent}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Open Items */}
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.06em', marginBottom: 10 }}>OPEN ITEMS</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: openTasks.filter(t => t.priority === 'high').length > 0 ? 'var(--red)' : 'var(--text-0)' }}>
                    {openTasks.length}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--red)' }}>High</span>
                      <span style={{ color: 'var(--text-1)' }}>{openTasks.filter(t => t.priority === 'high').length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--yellow)' }}>Medium</span>
                      <span style={{ color: 'var(--text-1)' }}>{openTasks.filter(t => t.priority === 'medium').length}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: 'var(--green)' }}>Low</span>
                      <span style={{ color: 'var(--text-1)' }}>{openTasks.filter(t => t.priority === 'low').length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Feed */}
              <div className="dashboard-grid-overview">
                <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 20px', borderBottom: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600 }}>Activity Feed</h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <select style={{
                        background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6,
                        color: 'var(--text-1)', fontSize: 11, padding: '4px 8px', cursor: 'pointer',
                      }} value={activityFilter} onChange={e => setActivityFilter(e.target.value)}>
                        <option value="">All agents</option>
                        <option value="Axle">Axle</option>
                        <option value="Bolt">Bolt</option>
                        <option value="Zip">Zip</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {filteredActivity.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>No activity yet</div>
                    ) : filteredActivity.map(item => (
                      <div key={item.id} style={{
                        padding: '12px 20px', borderBottom: '1px solid var(--border)',
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        transition: 'background 0.1s',
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: item.agent ? AGENT_COLORS[item.agent] + '20' : 'var(--bg-3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, color: item.agent ? AGENT_COLORS[item.agent] : 'var(--text-2)',
                        }}>
                          {item.type === 'task_complete' ? '✓' : item.type === 'deploy' ? '>' : item.type === 'task_start' ? '+' : '*'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, color: 'var(--text-0)', marginBottom: 2 }}>{item.message}</p>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {item.project && <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{item.project}</span>}
                            <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>{formatTime(item.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="ds-card" style={{ padding: '16px 20px' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Quick Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '9px' }}
                        onClick={() => { setAddTaskStatus('todo'); setShowAddTask(true) }}>
                        + Add Task
                      </button>
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '9px' }}
                        onClick={() => { setShowNoteInput(true); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
                        + Add Note
                      </button>
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '9px' }}
                        onClick={() => setActiveSection('tasks')}>
                        View Task Board →
                      </button>
                      <Link href="/" style={{
                        display: 'block', textAlign: 'center', fontSize: 12,
                        background: 'var(--bg-3)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '9px', color: 'var(--text-1)',
                        transition: '0.15s',
                      }}>
                        TradVue App ↗
                      </Link>
                    </div>
                  </div>

                  {/* Recent Notifications */}
                  {notifications.length > 0 && (
                    <div className="ds-card" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ fontSize: 13, fontWeight: 600 }}>Notifications</h2>
                        {unreadCount > 0 && (
                          <span style={{
                            background: 'var(--red)', color: '#fff', borderRadius: 10,
                            padding: '1px 7px', fontSize: 10, fontWeight: 600,
                          }}>{unreadCount}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {notifications.slice(0, 4).map(notif => {
                          const typeIcon: Record<string, string> = { info: '[i]', warning: '[!]', success: '[+]', error: '[x]' }
                          return (
                            <div key={notif.id} style={{
                              display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0',
                              borderBottom: '1px solid var(--border)',
                              opacity: notif.read ? 0.6 : 1,
                            }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>{typeIcon[notif.type] || 'ℹ️'}</span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 11, color: 'var(--text-0)', fontWeight: notif.read ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {notif.title}
                                </p>
                                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{formatTime(notif.createdAt)}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <button className="btn" style={{ width: '100%', justifyContent: 'center', fontSize: 11, padding: '7px', marginTop: 8 }}
                        onClick={() => setActiveSection('notifications')}>
                        View All →
                      </button>
                    </div>
                  )}

                  {/* In Progress */}
                  <div className="ds-card" style={{ padding: '16px 20px' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>In Progress</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {tasks.filter(t => t.status === 'inprogress').length === 0 ? (
                        <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No active tasks</p>
                      ) : tasks.filter(t => t.status === 'inprogress').map(t => (
                        <div key={t.id} style={{
                          padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 8,
                          border: '1px solid var(--border)', cursor: 'pointer',
                        }} onClick={() => { setSelectedTask(t); setActiveSection('tasks') }}>
                          <p style={{ fontSize: 12, color: 'var(--text-0)', marginBottom: 4 }}>{t.title}</p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {t.agent && <span style={{ fontSize: 10, color: AGENT_COLORS[t.agent] }}>{t.agent}</span>}
                            <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>{formatTime(t.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TASKS ── */}
          {activeSection === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
              {/* Filters */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)', marginRight: 4 }}>Filter:</span>
                <select className="ds-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
                  value={taskFilter.agent} onChange={e => setTaskFilter(f => ({ ...f, agent: e.target.value }))}>
                  <option value="">All agents</option>
                  <option value="Axle">Axle</option>
                  <option value="Bolt">Bolt</option>
                  <option value="Zip">Zip</option>
                </select>
                <select className="ds-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
                  value={taskFilter.priority} onChange={e => setTaskFilter(f => ({ ...f, priority: e.target.value }))}>
                  <option value="">All priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                <select className="ds-input" style={{ width: 'auto', fontSize: 12, padding: '6px 10px' }}
                  value={taskFilter.project} onChange={e => setTaskFilter(f => ({ ...f, project: e.target.value }))}>
                  <option value="">All projects</option>
                  {companies.flatMap(c => c.projects.map(p => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  )))}
                </select>
                {(taskFilter.agent || taskFilter.project || taskFilter.priority) && (
                  <button className="btn" style={{ fontSize: 11, padding: '5px 10px' }}
                    onClick={() => setTaskFilter({ agent: '', project: '', priority: '' })}>
                    Clear
                  </button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
                  {filteredTasks.length} tasks
                </span>
              </div>

              {/* Kanban */}
              <div className="dashboard-kanban">
                <KanbanColumn title="To Do" status="todo" color="var(--text-2)"
                  tasks={filteredTasks.filter(t => t.status === 'todo')}
                  onTaskClick={setSelectedTask}
                  onDrop={handleDrop}
                  onDragStart={setDragId}
                  onAddTask={(s) => { setAddTaskStatus(s); setShowAddTask(true) }} />
                <KanbanColumn title="In Progress" status="inprogress" color="var(--blue)"
                  tasks={filteredTasks.filter(t => t.status === 'inprogress')}
                  onTaskClick={setSelectedTask}
                  onDrop={handleDrop}
                  onDragStart={setDragId}
                  onAddTask={(s) => { setAddTaskStatus(s); setShowAddTask(true) }} />
                <KanbanColumn title="Done" status="done" color="var(--green)"
                  tasks={filteredTasks.filter(t => t.status === 'done')}
                  onTaskClick={setSelectedTask}
                  onDrop={handleDrop}
                  onDragStart={setDragId}
                  onAddTask={(s) => { setAddTaskStatus(s); setShowAddTask(true) }} />
              </div>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {activeSection === 'companies' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="dashboard-grid-companies">
                {/* Hierarchy */}
                <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: 13, fontWeight: 600 }}>Structure</h2>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '5px 10px' }}
                      onClick={() => setShowAddCompany(true)}>+ Add</button>
                  </div>
                  <div style={{ padding: 12 }}>
                    {companies.map(company => (
                      <div key={company.id} style={{ marginBottom: 8 }}>
                        <button onClick={() => setExpandedCompany(expandedCompany === company.id ? '' : company.id)} style={{
                          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px',
                          background: expandedCompany === company.id ? 'var(--bg-3)' : 'transparent',
                          borderRadius: 8, border: expandedCompany === company.id ? '1px solid var(--border)' : '1px solid transparent',
                          color: 'var(--text-0)', fontSize: 13, fontWeight: 500, transition: '0.12s',
                        }}>
                          <span style={{ fontSize: 16 }}>[co]</span>
                          {company.name}
                          <IconChevronDown size={14} style={{
                            marginLeft: 'auto', color: 'var(--text-2)',
                            transform: expandedCompany === company.id ? 'rotate(180deg)' : 'none',
                            transition: '0.2s',
                          }} />
                        </button>
                        {expandedCompany === company.id && (
                          <div style={{ marginLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {company.projects.map(proj => (
                              <button key={proj.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                                borderRadius: 8, width: '100%', textAlign: 'left', fontSize: 12,
                                color: 'var(--text-1)', background: 'transparent',
                                border: '1px solid transparent', transition: '0.12s',
                              }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-3)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                onClick={() => { setTaskFilter(f => ({ ...f, project: proj.name })); setActiveSection('tasks') }}>
                                <div style={{ width: 6, height: 6, borderRadius: 1, background: getProjectColor(proj.name), flexShrink: 0 }} />
                                {proj.name.split('›')[1]?.trim() || proj.name}
                                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>
                                  {tasks.filter(t => t.project === proj.name).length}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    {showAddCompany && (
                      <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: 8, marginTop: 8 }}>
                        <input className="ds-input" placeholder="Company name" value={newCompanyName}
                          onChange={e => setNewCompanyName(e.target.value)} style={{ marginBottom: 8 }} autoFocus />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button className="btn btn-primary" style={{ flex: 1, fontSize: 12 }} onClick={() => {
                            if (!newCompanyName.trim()) return
                            addCompany({ id: uid(), name: newCompanyName.trim(), projects: [] })
                            setNewCompanyName(''); setShowAddCompany(false)
                          }}>Add</button>
                          <button className="btn" style={{ fontSize: 12 }} onClick={() => setShowAddCompany(false)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Company tasks overview */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {companies.map(company => (
                    <div key={company.id} className="ds-card" style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{company.name}</h3>
                        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          {tasks.filter(t => t.company === company.name).length} tasks
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                        {company.projects.map(proj => {
                          const projTasks = tasks.filter(t => t.project === proj.name)
                          const done = projTasks.filter(t => t.status === 'done').length
                          return (
                            <div key={proj.id} style={{
                              background: 'var(--bg-3)', borderRadius: 10, padding: '12px 14px',
                              border: `1px solid ${getProjectColor(proj.name)}20`,
                              cursor: 'pointer', transition: '0.15s',
                            }}
                              onClick={() => { setTaskFilter(f => ({ ...f, project: proj.name })); setActiveSection('tasks') }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <div style={{ width: 8, height: 8, borderRadius: 2, background: getProjectColor(proj.name) }} />
                                <span style={{ fontSize: 12, fontWeight: 500 }}>{proj.category}</span>
                              </div>
                              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-0)', marginBottom: 4 }}>{projTasks.length}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{done} done · {projTasks.length - done} open</div>
                              <div style={{ marginTop: 8, background: 'var(--bg-0)', borderRadius: 3, height: 3 }}>
                                <div style={{
                                  height: '100%', borderRadius: 3, background: getProjectColor(proj.name),
                                  width: `${projTasks.length ? (done / projTasks.length) * 100 : 0}%`,
                                }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── AGENTS ── */}
          {activeSection === 'agents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="dashboard-grid-agents">
                {(['Axle', 'Bolt', 'Zip'] as AgentName[]).map(agent => {
                  const agentData = agents.find(a => a.name === agent)
                  const agentTasks = tasks.filter(t => t.agent === agent)
                  const doneTasks = agentTasks.filter(t => t.status === 'done')
                  const doneToday = agentData?.tasksCompletedToday ?? doneTasks.filter(t => t.completedAt.startsWith(todayStr)).length
                  const recentTasks = [...agentTasks].sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  ).slice(0, 5)
                  const agentStatus = agentData?.status || (agentStatuses[agent]?.current ? 'busy' : 'online')
                  const currentTask = agentData?.currentTask || agentStatuses[agent]?.current || ''
                  const statusLabel = agentStatus === 'busy' ? 'Working' : agentStatus === 'online' ? 'Online' : 'Offline'
                  const statusColor = agentStatus === 'offline' ? 'var(--text-2)' : agentStatus === 'busy' ? 'var(--blue)' : 'var(--green)'
                  const emoji = agent === 'Axle' ? 'gear' : agent === 'Bolt' ? 'B' : 'Z'
                  const tokensUsed = agentData?.tokensUsedToday || 0

                  return (
                    <div key={agent} className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                      {/* Card header */}
                      <div style={{
                        padding: '18px 20px', borderBottom: '1px solid var(--border)',
                        background: AGENT_COLORS[agent] + '08',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                              width: 40, height: 40, borderRadius: 10,
                              background: AGENT_COLORS[agent] + '20',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 20, border: `1px solid ${AGENT_COLORS[agent]}30`,
                            }}>{emoji}</div>
                            <div>
                              <h3 style={{ fontSize: 15, fontWeight: 700 }}>{agent}</h3>
                              <p style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 1 }}>
                                {agentData?.role || (agent === 'Axle' ? 'CEO / Orchestrator' : agent === 'Bolt' ? 'Developer' : 'Quick Tasks')}
                              </p>
                            </div>
                          </div>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                            color: statusColor,
                            background: statusColor + '15',
                            padding: '4px 10px', borderRadius: 20,
                          }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                            {statusLabel}
                          </div>
                        </div>
                      </div>

                      <div style={{ padding: '16px 20px' }}>
                        {/* Model */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>MODEL</div>
                          <code style={{ fontSize: 11, color: AGENT_COLORS[agent], background: AGENT_COLORS[agent] + '10', padding: '3px 8px', borderRadius: 4 }}>
                            {AGENT_MODELS[agent]}
                          </code>
                        </div>

                        {/* Role */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>ROLE</div>
                          <p style={{ fontSize: 12, color: 'var(--text-1)' }}>{AGENT_ROLES[agent]}</p>
                        </div>

                        {/* Current task */}
                        {currentTask && (
                          <div style={{ marginBottom: 16, background: 'var(--bg-3)', borderRadius: 8, padding: '10px 12px', border: `1px solid ${AGENT_COLORS[agent]}20` }}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>CURRENT TASK</div>
                            <p style={{ fontSize: 12, color: 'var(--text-0)' }}>{currentTask}</p>
                          </div>
                        )}

                        {/* Last active */}
                        {agentData?.lastActive && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>LAST ACTIVE</div>
                            <p style={{ fontSize: 12, color: 'var(--text-1)' }}>{formatTime(agentData.lastActive)}</p>
                          </div>
                        )}

                        {/* Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                          <div style={{ textAlign: 'center', background: 'var(--bg-3)', borderRadius: 8, padding: '10px 8px' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: AGENT_COLORS[agent] }}>{doneToday}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Today</div>
                          </div>
                          <div style={{ textAlign: 'center', background: 'var(--bg-3)', borderRadius: 8, padding: '10px 8px' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>{doneTasks.length}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Total</div>
                          </div>
                          <div style={{ textAlign: 'center', background: 'var(--bg-3)', borderRadius: 8, padding: '10px 8px' }}>
                            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-0)' }}>
                              {agentTasks.filter(t => t.status !== 'done').length}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Open</div>
                          </div>
                        </div>

                        {/* Tokens used today */}
                        {tokensUsed > 0 && (
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 4 }}>TOKENS TODAY</div>
                            <p style={{ fontSize: 12, color: 'var(--text-1)' }}>{tokensUsed.toLocaleString()}</p>
                          </div>
                        )}

                        {/* Recent tasks */}
                        <div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.05em', marginBottom: 8 }}>RECENT TASKS</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {recentTasks.length === 0 ? (
                              <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No tasks yet</p>
                            ) : recentTasks.map(t => (
                              <div key={t.id} style={{
                                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                                borderBottom: '1px solid var(--border)',
                              }}>
                                <span style={{
                                  fontSize: 10, color: t.status === 'done' ? 'var(--green)' : 'var(--text-3)',
                                }}>
                                  {t.status === 'done' ? '✓' : t.status === 'inprogress' ? '▶' : '○'}
                                </span>
                                <span style={{ fontSize: 11, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {t.title}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{formatTime(t.createdAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 720 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                    {unreadCount} unread
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button className="btn" style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={markAllNotificationsRead}>
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="ds-card" style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>( )</div>
                  <p style={{ fontSize: 14, color: 'var(--text-2)' }}>No notifications yet</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    Notifications will appear here when tasks are completed or important events occur.
                  </p>
                </div>
              ) : (
                <div className="ds-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {notifications.map((notif, idx) => {
                    const typeConfig: Record<string, { icon: string; color: string }> = {
                      info: { icon: 'ℹ️', color: 'var(--blue)' },
                      warning: { icon: '[!]', color: 'var(--yellow)' },
                      success: { icon: '[+]', color: 'var(--green)' },
                      error: { icon: '[x]', color: 'var(--red)' },
                    }
                    const cfg = typeConfig[notif.type] || typeConfig.info
                    return (
                      <div key={notif.id} style={{
                        padding: '14px 20px',
                        borderBottom: idx < notifications.length - 1 ? '1px solid var(--border)' : 'none',
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        background: notif.read ? 'transparent' : cfg.color + '06',
                        transition: 'background 0.15s',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: cfg.color + '15',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14,
                        }}>{cfg.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                            <span style={{
                              fontSize: 13, fontWeight: notif.read ? 400 : 600,
                              color: 'var(--text-0)',
                            }}>{notif.title}</span>
                            {!notif.read && (
                              <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: cfg.color, flexShrink: 0,
                              }} />
                            )}
                          </div>
                          {notif.message && (
                            <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4, marginBottom: 4 }}>
                              {notif.message}
                            </p>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{formatTime(notif.createdAt)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {!notif.read && (
                            <button style={{
                              padding: '4px 8px', fontSize: 10, color: 'var(--text-2)',
                              background: 'var(--bg-3)', border: '1px solid var(--border)',
                              borderRadius: 6, cursor: 'pointer', transition: '0.12s',
                            }}
                              onClick={() => markNotificationRead(notif.id)}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-0)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}>
                              Read
                            </button>
                          )}
                          <button style={{
                            padding: '4px 8px', fontSize: 10, color: 'var(--text-3)',
                            background: 'transparent', border: '1px solid transparent',
                            borderRadius: 6, cursor: 'pointer', transition: '0.12s',
                          }}
                            onClick={() => deleteNotification(notif.id)}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-3)')}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── METRICS ── */}
          {activeSection === 'metrics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Total Tasks</div>
                  <div style={{ fontSize: 32, fontWeight: 700 }}>{tasks.length}</div>
                </div>
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Completed</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--green)' }}>
                    {tasks.filter(t => t.status === 'done').length}
                  </div>
                </div>
                <div className="ds-card" style={{ padding: '16px 20px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 4 }}>Completion Rate</div>
                  <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--accent)' }}>
                    {tasks.length ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="dashboard-grid-metrics-2">
                {/* Tasks by Day */}
                <div className="ds-card">
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Tasks Completed — Last 14 Days</h3>
                  <BarChart data={completedByDay} labels={dayLabels} />
                </div>

                {/* Tasks by Agent */}
                <div className="ds-card">
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Tasks by Agent</h3>
                  {tasksByAgent.length > 0
                    ? <PieChart slices={tasksByAgent} />
                    : <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No completed tasks</p>}
                </div>

                {/* Tasks by Project */}
                <div className="ds-card">
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Tasks by Project</h3>
                  {tasksByProject.length > 0
                    ? <PieChart slices={tasksByProject} />
                    : <p style={{ fontSize: 12, color: 'var(--text-3)' }}>No completed tasks</p>}
                </div>

                {/* Open vs Closed */}
                <div className="ds-card">
                  <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Open vs Closed</h3>
                  <PieChart slices={[
                    { label: 'Closed', value: tasks.filter(t => t.status === 'done').length, color: 'var(--green)' },
                    { label: 'In Progress', value: tasks.filter(t => t.status === 'inprogress').length, color: 'var(--blue)' },
                    { label: 'To Do', value: tasks.filter(t => t.status === 'todo').length, color: 'var(--text-2)' },
                  ].filter(s => s.value > 0)} />
                </div>
              </div>

              {/* Cost Estimate */}
              <div className="ds-card">
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Cost Estimate</h3>
                <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 16 }}>
                  Enter approximate token counts per agent to estimate API costs.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
                  {(['Axle', 'Bolt', 'Zip'] as AgentName[]).map(agent => (
                    <div key={agent} style={{ background: 'var(--bg-3)', borderRadius: 10, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: 10 } as React.CSSProperties}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: AGENT_COLORS[agent] }}>{agent}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 8 }}>
                          ${settings.agentCosts[agent]}/M tokens
                        </span>
                      </div>
                      <input type="number" className="ds-input" style={{ fontSize: 12, padding: '6px 10px' }}
                        value={tokenInputs[agent]}
                        onChange={e => setTokenInputs(prev => ({ ...prev, [agent]: Number(e.target.value) }))}
                        placeholder="Token count" />
                      <div style={{ fontSize: 12, color: 'var(--text-1)', marginTop: 8 }}>
                        ≈ ${((tokenInputs[agent] || 0) / 1_000_000 * settings.agentCosts[agent]).toFixed(4)}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  background: 'var(--accent-dim)', border: '1px solid var(--accent)30',
                  borderRadius: 10, padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: 'var(--text-1)' }}>Estimated Total Cost</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
                    ${costEstimate.toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS ── */}
          {activeSection === 'settings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 640 }}>
              {/* Agent Config */}
              <div className="ds-card">
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Agent Configuration</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {(['Axle', 'Bolt', 'Zip'] as AgentName[]).map(agent => (
                    <div key={agent} style={{
                      display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
                      background: 'var(--bg-3)', borderRadius: 10, border: `1px solid ${AGENT_COLORS[agent]}20`,
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, background: AGENT_COLORS[agent] + '20',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                      }}>
                        {agent === 'Axle' ? 'gear' : agent === 'Bolt' ? 'B' : 'Z'}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)' }}>{agent}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{AGENT_MODELS[agent]} · {AGENT_ROLES[agent]}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Rate</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>$</span>
                          <input type="number" style={{
                            width: 60, background: 'var(--bg-2)', border: '1px solid var(--border)',
                            borderRadius: 6, padding: '4px 6px', color: 'var(--text-0)', fontSize: 11,
                            fontFamily: 'var(--mono)',
                          }}
                            value={settings.agentCosts[agent]}
                            onChange={e => setSettings({ ...settings, agentCosts: { ...settings.agentCosts, [agent]: Number(e.target.value) } })} />
                          <span style={{ fontSize: 10, color: 'var(--text-3)' }}>/M</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Companies */}
              <div className="ds-card">
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Company Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {companies.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', background: 'var(--bg-3)', borderRadius: 10,
                    }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{c.projects.length} projects</div>
                      </div>
                      <button className="btn" style={{ fontSize: 11, color: 'var(--red)', padding: '5px 10px' }}
                        onClick={() => deleteCompany(c.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '9px' }}
                    onClick={() => setShowAddCompany(true)}>
                    + Add Company
                  </button>
                  {showAddCompany && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="ds-input" placeholder="Company name" value={newCompanyName}
                        onChange={e => setNewCompanyName(e.target.value)} style={{ flex: 1 }} autoFocus />
                      <button className="btn btn-primary" onClick={() => {
                        if (!newCompanyName.trim()) return
                        addCompany({ id: uid(), name: newCompanyName.trim(), projects: [] })
                        setNewCompanyName(''); setShowAddCompany(false)
                      }}>Add</button>
                      <button className="btn" onClick={() => setShowAddCompany(false)}>Cancel</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Data */}
              <div className="ds-card">
                <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Data Management</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: '10px 16px' }} onClick={handleExport}>
                    Export All Data (JSON)
                  </button>
                  <button className="btn" style={{ fontSize: 12, padding: '10px 16px' }} onClick={() => setShowImport(!showImport)}>
                    Import Data (JSON)
                  </button>
                  {showImport && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea className="ds-input" placeholder="Paste JSON data here…" value={importJson}
                        onChange={e => setImportJson(e.target.value)}
                        style={{ minHeight: 120, resize: 'vertical', fontFamily: 'var(--mono)', fontSize: 11 }} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-primary" onClick={handleImport}>Import</button>
                        <button className="btn" onClick={() => setShowImport(false)}>Cancel</button>
                      </div>
                    </div>
                  )}
                  <button className="btn" style={{ fontSize: 12, padding: '10px 16px', color: 'var(--red)' }}
                    onClick={() => {
                      if (confirm('Reset all dashboard data to defaults?')) {
                        setTasks(DEFAULT_TASKS); setActivity(DEFAULT_ACTIVITY)
                        setCompanies(DEFAULT_COMPANIES); setSettings(DEFAULT_SETTINGS)
                      }
                    }}>
                    Reset to Defaults
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Modals ── */}
      {showAddTask && (
        <AddTaskModal
          companies={companies}
          onAdd={handleAddTask}
          onClose={() => setShowAddTask(false)}
          defaultStatus={addTaskStatus}
        />
      )}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={handleDeleteTask}
        />
      )}
    </div>
  )
}
