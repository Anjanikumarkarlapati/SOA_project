import { useRef, useState } from 'react'
import { useSession } from './session'
import { IconChat, IconClose, IconSend } from './icons'
import { useI18n } from './i18n/react'

/**
 * Answers are canned, not generated - this only ever repeats what this KB says, so it can't
 * hallucinate a feature the app doesn't have. Each topic scores on keyword overlap with the
 * question; highest score above the threshold wins.
 */
// Answers are translation keys, so the bot replies in whatever language the site is in.
const TOPICS = [
  { keywords: ['dashboard', 'home', 'overview', 'summary'], answer: 'chat.dashboard' },
  {
    keywords: ['sensor', 'device', 'register', 'deregister', 'iot', 'battery', 'offline', 'telemetry'],
    answer: 'chat.sensors',
  },
  { keywords: ['crop', 'field', 'moisture', 'analyze', 'analysis', 'health', 'optimal', 'alert'], answer: 'chat.crops' },
  { keywords: ['irrigation', 'schedule', 'recurring', 'daily', 'weekly'], answer: 'chat.schedules' },
  { keywords: ['valve', 'manual', 'open', 'close', 'emergency', 'stop'], answer: 'chat.valves' },
  {
    keywords: ['login', 'sign in', 'signin', 'password', 'google', 'account', 'register account', 'sign up'],
    answer: 'chat.login',
  },
  { keywords: ['logout', 'sign out', 'signout'], answer: 'chat.logout' },
  { keywords: ['theme', 'dark', 'light', 'mode'], answer: 'chat.theme' },
  { keywords: ['admin', 'role', 'permission', 'viewer', 'access', 'farmer'], answer: 'chat.roles' },
  { keywords: ['assistant', 'water', 'automation', 'automate', 'temperature', 'rain', 'india'], answer: 'chat.assistant' },
  { keywords: ['language', 'hindi', 'translate', 'bhasha'], answer: 'chat.language' },
]

const GREETING = { from: 'bot', key: 'chat.greeting' }

function findAnswer(question) {
  const words = question.toLowerCase().match(/[a-z]+/g) || []
  if (words.length === 0) return null

  let best = null
  let bestScore = 0
  for (const topic of TOPICS) {
    const score = topic.keywords.reduce(
      (sum, kw) => sum + (question.toLowerCase().includes(kw) ? kw.split(' ').length : 0),
      0,
    )
    if (score > bestScore) {
      bestScore = score
      best = topic
    }
  }
  return bestScore > 0 ? best.answer : null
}

const FALLBACK = 'chat.fallback'

export default function ChatBot() {
  const { isAdmin } = useSession()
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const listRef = useRef(null)

  const send = (event) => {
    event.preventDefault()
    const question = input.trim()
    if (!question) return

    const answer = findAnswer(question) || FALLBACK
    setMessages((m) => [...m, { from: 'user', text: question }, { from: 'bot', key: answer }])
    setInput('')
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

  return (
    <div className="chatbot">
      {open ? (
        <div className="chatbot-panel" role="dialog" aria-label={t('chat.title')}>
          <div className="chatbot-head">
            <span>{t('chat.title')}</span>
            <button type="button" className="btn btn-quiet btn-icon" aria-label={t('chat.close')} onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </div>
          <div className="chatbot-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-bubble chatbot-bubble-${m.from}`}>
                {m.key ? t(m.key) : m.text}
              </div>
            ))}
          </div>
          <form className="chatbot-input-row" onSubmit={send}>
            <input
              className="input"
              placeholder={isAdmin ? t('chat.placeholderAdmin') : t('chat.placeholder')}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t('chat.ask')}
            />
            <button type="submit" className="btn btn-primary btn-icon" aria-label={t('chat.send')}>
              <IconSend />
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className="chatbot-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('chat.closeAssistant') : t('chat.open')}
      >
        {open ? <IconClose /> : <IconChat />}
      </button>
    </div>
  )
}
