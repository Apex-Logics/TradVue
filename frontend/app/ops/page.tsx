'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'

// ── Auth ──────────────────────────────────────────────────────────────────────
// Admin check is done server-side via is_admin flag from /api/auth/me

// ── Types ─────────────────────────────────────────────────────────────────────

type Column = 'backlog' | 'inprogress' | 'done' | 'blocked'
type Priority = 'high' | 'medium' | 'low'
type AgentName = 'Axle' | 'Bolt' | 'Zip' | 'Nova' | 'Erick'

interface OpsTask {
  id: string
  title: string
  agent: AgentName
  priority: Priority
  column: Column
  createdAt: string
  notes: string
}

type AgentStatus = 'idle' | 'working' | 'error'

interface AgentInfo {
  name: AgentName | string
  emoji: string
  model: string
  status: AgentStatus
  lastActive: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'ops_tasks'
const DEPLOY_TIME_KEY = 'ops_last_deploy'

const PRIORITY_EMOJI: Record<Priority, string> = {
  high: '●',
  medium: '●',
  low: '●',
}

const COLUMN_LABELS: Record<Column, string> = {
  backlog: 'Backlog',
  inprogress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
}

const COLUMN_ACCENT: Record<Column, string> = {
  backlog: 'var(--text-2)',
  inprogress: 'var(--blue)',
  done: 'var(--green)',
  blocked: 'var(--red)',
}

const AGENTS: AgentInfo[] = [
  { name: 'Axle', emoji: '*', model: 'claude-sonnet-4-6', status: 'idle', lastActive: 'Today' },
  { name: 'Bolt', emoji: '', model: 'claude-sonnet-4-6', status: 'working', lastActive: 'Now' },
  { name: 'Zip',  emoji: '→', model: 'claude-sonnet-4-6', status: 'idle',    lastActive: 'Today' },
  { name: 'Nova', emoji: '★', model: 'claude-sonnet-4-6', status: 'idle',    lastActive: 'Yesterday' },
]

const INITIAL_TASKS: OpsTask[] = [
  // Backlog
  { id: 'b1',  title: 'Wire Marketaux sentiment into Analysis panel', agent: 'Bolt',  priority: 'medium', column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b2',  title: 'chartgenius.io → tradvue.com redirect',         agent: 'Axle',  priority: 'high',   column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b3',  title: 'Click-test remaining 27/30 calculators',         agent: 'Zip',   priority: 'medium', column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b4',  title: 'Fix 4 failing backend test suites',              agent: 'Bolt',  priority: 'medium', column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b5',  title: 'Stripe payment integration',                     agent: 'Bolt',  priority: 'high',   column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b6',  title: 'SnapTrade broker sync integration',              agent: 'Bolt',  priority: 'high',   column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b7',  title: 'Reddit first post (r/daytrading)',               agent: 'Axle',  priority: 'low',    column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b8',  title: 'Trademark filing research',                      agent: 'Zip',   priority: 'low',    column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b9',  title: 'E&O insurance quotes',                           agent: 'Axle',  priority: 'medium', column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  { id: 'b10', title: 'Nova full code review delivery',                 agent: 'Nova',  priority: 'medium', column: 'backlog',    createdAt: '2026-03-14', notes: '' },
  // In Progress
  { id: 'ip1', title: 'Reddit account warm-up',                         agent: 'Erick', priority: 'medium', column: 'inprogress', createdAt: '2026-03-14', notes: '' },
  // Done
  { id: 'd1',  title: 'Free Tier + Paywall system',                     agent: 'Bolt',  priority: 'high',   column: 'done',       createdAt: '2026-03-10', notes: 'Shipped' },
  { id: 'd2',  title: 'AI Support Chatbot',                             agent: 'Bolt',  priority: 'medium', column: 'done',       createdAt: '2026-03-11', notes: 'Shipped' },
  { id: 'd3',  title: 'Multi-broker CSV import (8 brokers)',            agent: 'Bolt',  priority: 'medium', column: 'done',       createdAt: '2026-03-12', notes: 'Shipped' },
  { id: 'd4',  title: 'Calendar UX v2 + static fallback',              agent: 'Bolt',  priority: 'medium', column: 'done',       createdAt: '2026-03-13', notes: 'Shipped' },
  { id: 'd5',  title: 'DBA filing',                                     agent: 'Erick', priority: 'high',   column: 'done',       createdAt: '2026-03-08', notes: 'Done' },
  { id: 'd6',  title: 'Copyright deposit prep',                         agent: 'Axle',  priority: 'medium', column: 'done',       createdAt: '2026-03-09', notes: 'Done' },
]

const QUICK_LINKS = [
  { label: 'Render',    url: 'https://dashboard.render.com' },
  { label: 'GitHub',    url: 'https://github.com/Apex-Logics/TradVue' },
  { label: '▲ Vercel',     url: 'https://vercel.com/dashboard' },
  { label: 'Supabase',  url: 'https://supabase.com/dashboard' },
  { label: 'Prod Site', url: 'https://www.tradvue.com' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function loadTasks(): OpsTask[] {
  if (typeof window === 'undefined') return INITIAL_TASKS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return INITIAL_TASKS
    return JSON.parse(raw) as OpsTask[]
  } catch {
    return INITIAL_TASKS
  }
}

function saveTasks(tasks: OpsTask[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)) } catch {}
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
  </svg>
)

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

const IconExternal = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
    <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
  </svg>
)

// ── Task Card ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: OpsTask
  onDelete: (id: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
}

function TaskCard({ task, onDelete, onDragStart }: TaskCardProps) {
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task.id)}
      style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        cursor: 'grab',
        transition: 'border-color 0.15s, transform 0.1s',
        userSelect: 'none',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-b)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)' }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-0)', lineHeight: 1.4, flex: 1 }}>{task.title}</span>
        <button
          onClick={() => onDelete(task.id)}
          title="Delete task"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px', borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)' }}
        >
          <IconTrash />
        </button>
      </div>

      {/* Notes */}
      {task.notes && (
        <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8, lineHeight: 1.4 }}>{task.notes}</p>
      )}

      {/* Footer: agent + priority + date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
          background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border)',
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>
          {task.agent}
        </span>
        <span style={{ fontSize: 12 }} title={task.priority}>{PRIORITY_EMOJI[task.priority]}</span>
        <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>{task.createdAt}</span>
      </div>
    </div>
  )
}

// ── Kanban Column ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  column: Column
  tasks: OpsTask[]
  onDelete: (id: string) => void
  onDragStart: (e: React.DragEvent, taskId: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, column: Column) => void
  isDragTarget: boolean
}

function KanbanColumn({ column, tasks, onDelete, onDragStart, onDragOver, onDrop, isDragTarget }: KanbanColumnProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, column)}
      style={{
        flex: '1 1 220px',
        minWidth: 200,
        background: isDragTarget ? 'rgba(74,158,255,0.04)' : 'var(--bg-1)',
        border: `1px solid ${isDragTarget ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: 300,
      }}
    >
      {/* Column header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: COLUMN_ACCENT[column] }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {COLUMN_LABELS[column]}
          </span>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, color: 'var(--text-2)',
          background: 'var(--bg-3)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '1px 7px',
        }}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      {tasks.map(task => (
        <TaskCard key={task.id} task={task} onDelete={onDelete} onDragStart={onDragStart} />
      ))}

      {tasks.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 12, fontStyle: 'italic' }}>
          Drop here
        </div>
      )}
    </div>
  )
}

// ── Add Task Form ─────────────────────────────────────────────────────────────

interface AddTaskFormProps {
  onAdd: (task: Omit<OpsTask, 'id'>) => void
  onClose: () => void
}

function AddTaskForm({ onAdd, onClose }: AddTaskFormProps) {
  const [title, setTitle] = useState('')
  const [agent, setAgent] = useState<AgentName>('Bolt')
  const [priority, setPriority] = useState<Priority>('medium')
  const [column, setColumn] = useState<Column>('backlog')
  const [notes, setNotes] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd({
      title: title.trim(),
      agent,
      priority,
      column,
      createdAt: new Date().toISOString().slice(0, 10),
      notes: notes.trim(),
    })
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-3)',
    border: '1px solid var(--border)',
    borderRadius: 7,
    padding: '8px 12px',
    color: 'var(--text-0)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--text-2)',
    display: 'block',
    marginBottom: 5,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 28, width: '100%', maxWidth: 480,
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--text-0)' }}>
          + Add Task
        </h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Title *</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              style={inputStyle}
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Agent</label>
              <select value={agent} onChange={e => setAgent(e.target.value as AgentName)} style={inputStyle}>
                <option value="Axle">Axle</option>
                <option value="Bolt">Bolt</option>
                <option value="Zip">Zip</option>
                <option value="Nova">Nova</option>
                <option value="Erick">Erick</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value as Priority)} style={inputStyle}>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <div>
            <label style={labelStyle}>Column</label>
            <select value={column} onChange={e => setColumn(e.target.value as Column)} style={inputStyle}>
              <option value="backlog">Backlog</option>
              <option value="inprogress">In Progress</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes…"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 7, padding: '8px 18px', color: 'var(--text-1)', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
            <button type="submit" disabled={!title.trim()}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '8px 22px', color: '#fff', cursor: title.trim() ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600, opacity: title.trim() ? 1 : 0.5 }}>
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Agent Status Panel ────────────────────────────────────────────────────────

function AgentStatusPanel() {
  const STATUS_COLOR: Record<AgentStatus, string> = {
    idle: 'var(--text-2)',
    working: 'var(--green)',
    error: 'var(--red)',
  }
  const STATUS_BG: Record<AgentStatus, string> = {
    idle: 'var(--bg-3)',
    working: 'var(--green-dim)',
    error: 'var(--red-dim)',
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {AGENTS.map(agent => (
        <div key={agent.name} style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {/* Name + emoji */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>{agent.emoji}</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-0)' }}>{agent.name}</span>
          </div>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[agent.status], flexShrink: 0 }} />
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
              background: STATUS_BG[agent.status], color: STATUS_COLOR[agent.status],
              border: `1px solid ${STATUS_COLOR[agent.status]}30`,
              textTransform: 'capitalize',
            }}>
              {agent.status}
            </span>
          </div>

          {/* Model */}
          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
            <span style={{ color: 'var(--text-3)' }}>model: </span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>{agent.model}</span>
          </div>

          {/* Last active */}
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            last active: {agent.lastActive}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Quick Stats & Links ───────────────────────────────────────────────────────

function QuickStatsPanel({ tasks }: { tasks: OpsTask[] }) {
  const [deployTime, setDeployTime] = useState('')
  const [editingDeploy, setEditingDeploy] = useState(false)
  const [deployInput, setDeployInput] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DEPLOY_TIME_KEY) || ''
      setDeployTime(saved)
    } catch {}
  }, [])

  const saveDeploy = () => {
    setDeployTime(deployInput)
    try { localStorage.setItem(DEPLOY_TIME_KEY, deployInput) } catch {}
    setEditingDeploy(false)
  }

  const counts = {
    backlog: tasks.filter(t => t.column === 'backlog').length,
    inprogress: tasks.filter(t => t.column === 'inprogress').length,
    done: tasks.filter(t => t.column === 'done').length,
    blocked: tasks.filter(t => t.column === 'blocked').length,
    high: tasks.filter(t => t.priority === 'high' && t.column !== 'done').length,
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {/* Stats */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Task Stats
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { label: 'Backlog',     value: counts.backlog,     color: 'var(--text-2)' },
            { label: 'In Progress', value: counts.inprogress,  color: 'var(--blue)' },
            { label: 'Done',        value: counts.done,        color: 'var(--green)' },
            { label: 'Blocked',     value: counts.blocked,     color: 'var(--red)' },
            { label: 'High Pri', value: counts.high,        color: 'var(--red)' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <span style={{ color: 'var(--text-2)' }}>{s.label}</span>
              <span style={{ fontWeight: 700, color: s.color, fontSize: 18, lineHeight: 1 }}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Deploy time */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Last Deploy</span>
            <button onClick={() => { setEditingDeploy(true); setDeployInput(deployTime) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, padding: 2 }}>
Edit
            </button>
          </div>
          {editingDeploy ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={deployInput} onChange={e => setDeployInput(e.target.value)}
                placeholder="e.g. Mar 14 2026 2:30pm"
                style={{ flex: 1, background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 9px', color: 'var(--text-0)', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={saveDeploy}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                Save
              </button>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: deployTime ? 'var(--text-0)' : 'var(--text-3)', fontStyle: deployTime ? 'normal' : 'italic' }}>
              {deployTime || 'Not recorded'}
            </span>
          )}
        </div>
      </div>

      {/* Links */}
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 20px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Quick Links
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {QUICK_LINKS.map(link => (
            <a
              key={link.label}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-3)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '8px 12px',
                color: 'var(--text-1)', textDecoration: 'none', fontSize: 13,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.color = 'var(--text-0)'; el.style.borderColor = 'var(--accent)' }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.color = 'var(--text-1)'; el.style.borderColor = 'var(--border)' }}
            >
              <span>{link.label}</span>
              <IconExternal />
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OpsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [tasks, setTasks] = useState<OpsTask[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [dragTaskId, setDragTaskId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Column | null>(null)
  const initialized = useRef(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      setTasks(loadTasks())
    }
  }, [])

  // Auth guard
  useEffect(() => {
    if (authLoading) return
    if (!user || !user.is_admin) router.replace('/')
  }, [user, authLoading, router])

  // Persist on change
  useEffect(() => {
    if (initialized.current && tasks.length > 0) saveTasks(tasks)
  }, [tasks])

  // ── Kanban drag & drop ─────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDragTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, column: Column) => {
    e.preventDefault()
    if (!dragTaskId) return
    setTasks(prev => prev.map(t => t.id === dragTaskId ? { ...t, column } : t))
    setDragTaskId(null)
    setDragOverColumn(null)
  }, [dragTaskId])

  const handleDragEnter = useCallback((column: Column) => {
    setDragOverColumn(column)
  }, [])

  const handleAddTask = useCallback((taskData: Omit<OpsTask, 'id'>) => {
    const newTask: OpsTask = { ...taskData, id: uid() }
    setTasks(prev => [...prev, newTask])
  }, [])

  const handleDeleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-0)' }}>
      <div style={{ color: 'var(--text-1)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (!user || !user.is_admin) return null

  // ── Render ─────────────────────────────────────────────────────────────────

  const columns: Column[] = ['backlog', 'inprogress', 'done', 'blocked']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--text-0)', fontFamily: 'var(--font)' }}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-1)', padding: '0 24px', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 58 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.3px' }}>
              ApexLogics <span style={{ color: 'var(--accent)' }}>Ops</span>
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-2)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', marginLeft: 4, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Internal
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{user.email}</span>
            <button
              onClick={() => setShowAddForm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', border: 'none', borderRadius: 7, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              <IconPlus /> Add Task
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Section A: Kanban Board ──────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 16 }}>
            Task Board
          </h2>
          <div
            style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}
            onDragEnd={() => { setDragTaskId(null); setDragOverColumn(null) }}
          >
            {columns.map(col => (
              <div
                key={col}
                onDragEnter={() => handleDragEnter(col)}
                style={{ flex: '1 1 220px', minWidth: 220 }}
              >
                <KanbanColumn
                  column={col}
                  tasks={tasks.filter(t => t.column === col)}
                  onDelete={handleDeleteTask}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragTarget={dragOverColumn === col && dragTaskId !== null}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ── Section B: Agent Status ──────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 16 }}>
            Agent Status
          </h2>
          <AgentStatusPanel />
        </section>

        {/* ── Section C: Stats & Links ─────────────────────────────────────── */}
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 16 }}>
            Stats & Links
          </h2>
          <QuickStatsPanel tasks={tasks} />
        </section>

      </div>

      {/* Add Task Modal */}
      {showAddForm && (
        <AddTaskForm onAdd={handleAddTask} onClose={() => setShowAddForm(false)} />
      )}
    </div>
  )
}
