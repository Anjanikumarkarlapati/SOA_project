import { useRef, useState } from 'react'
import { useSession } from './session'
import { IconChat, IconClose, IconSend } from './icons'

/**
 * Answers are canned, not generated - this only ever repeats what this KB says, so it can't
 * hallucinate a feature the app doesn't have. Each topic scores on keyword overlap with the
 * question; highest score above the threshold wins.
 */
const TOPICS = [
  {
    keywords: ['dashboard', 'home', 'overview', 'summary'],
    answer:
      "The Dashboard is your farm's overview: field health, sensor network status, the alert feed, a 24h soil moisture trend, and irrigation zone state. It refreshes automatically every 15 seconds.",
  },
  {
    keywords: ['sensor', 'device', 'register', 'deregister', 'iot', 'battery', 'offline', 'telemetry'],
    answer:
      "On the Sensors page you can search by device ID, filter by status (online/offline/low battery) or field, and view a device's detail page for its telemetry history. Admins can register a new device (Register device) or deregister one - deregistering removes its history too.",
  },
  {
    keywords: ['crop', 'field', 'moisture', 'analyze', 'analysis', 'health', 'optimal', 'alert'],
    answer:
      "Crop Monitoring shows each field's environmental health against its optimal range. Open a field for its metrics and to run Analyze for a fresh read. Threshold breaches show up as alerts on the Dashboard alert feed.",
  },
  {
    keywords: ['irrigation', 'schedule', 'recurring', 'daily', 'weekly'],
    answer:
      "Irrigation → Schedules lets admins create a recurring watering schedule per zone: daily or weekly, a start time, duration, and an optional 'skip if already moist' rule. Toggle a schedule active/inactive or edit/delete it from the list.",
  },
  {
    keywords: ['valve', 'manual', 'open', 'close', 'emergency', 'stop'],
    answer:
      "Irrigation → Manual Control lets admins open or close each zone's valve directly and see live flow rate and time remaining. 'Close all valves' is a farm-wide emergency stop, and it asks for confirmation before it runs.",
  },
  {
    keywords: ['login', 'sign in', 'signin', 'password', 'google', 'account', 'register account', 'sign up'],
    answer:
      'Sign in with your email and password, or use "Continue with Google" (via Supabase) on the Login page. New here? Use the sign-up option to create an account.',
  },
  {
    keywords: ['logout', 'sign out', 'signout'],
    answer: 'Click "Sign out" at the bottom of the sidebar to end your session.',
  },
  {
    keywords: ['theme', 'dark', 'light', 'mode'],
    answer: 'Use the sun/moon icon at the top right of any page to switch between light and dark mode.',
  },
  {
    keywords: ['admin', 'role', 'permission', 'viewer', 'access'],
    answer:
      'There are two roles: admin, who can register/edit sensors, manage irrigation schedules, and operate valves; and viewer, who can see everything but not make changes.',
  },
]

const GREETING = {
  from: 'bot',
  text: "Hi! I'm the AgriTech assistant. Ask me about sensors, crops, irrigation, or your account, and I'll point you to the right place.",
}

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

const FALLBACK =
  "I don't have an answer for that yet. Try asking about sensors, crops, irrigation, schedules, valves, login, or account roles."

export default function ChatBot() {
  const { isAdmin } = useSession()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([GREETING])
  const [input, setInput] = useState('')
  const listRef = useRef(null)

  const send = (event) => {
    event.preventDefault()
    const question = input.trim()
    if (!question) return

    const answer = findAnswer(question) || FALLBACK
    setMessages((m) => [...m, { from: 'user', text: question }, { from: 'bot', text: answer }])
    setInput('')
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
    })
  }

  return (
    <div className="chatbot">
      {open ? (
        <div className="chatbot-panel" role="dialog" aria-label="AgriTech assistant">
          <div className="chatbot-head">
            <span>AgriTech Assistant</span>
            <button type="button" className="btn btn-quiet btn-icon" aria-label="Close chat" onClick={() => setOpen(false)}>
              <IconClose />
            </button>
          </div>
          <div className="chatbot-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-bubble chatbot-bubble-${m.from}`}>
                {m.text}
              </div>
            ))}
          </div>
          <form className="chatbot-input-row" onSubmit={send}>
            <input
              className="input"
              placeholder={isAdmin ? 'Ask about sensors, crops, irrigation...' : 'Ask about the dashboard...'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Ask the AgriTech assistant"
            />
            <button type="submit" className="btn btn-primary btn-icon" aria-label="Send">
              <IconSend />
            </button>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        className="chatbot-fab"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <IconClose /> : <IconChat />}
      </button>
    </div>
  )
}
