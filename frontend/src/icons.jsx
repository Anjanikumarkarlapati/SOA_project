/**
 * Icon set for the dashboard.
 *
 * The design brief calls for a Phosphor-style stroke set at 1.5px on a 20px grid, so this uses
 * Phosphor itself rather than hand-drawn paths. Everything is re-exported under app-level names,
 * so screens name the concept ("sensor", "critical") and this file owns the glyph choice.
 *
 * Weight is standardised globally: "regular" for interface glyphs, "fill" only where the brief
 * asks for a solid shape (the healthy status dot).
 */
import {
  ArrowRight,
  ArrowsClockwise,
  BatteryLow,
  Broadcast,
  CaretRight,
  ChatCircleDots,
  Circle,
  Drop,
  Eye,
  EyeSlash,
  Gauge,
  Info,
  Leaf,
  List,
  Moon,
  PaperPlaneRight,
  PencilSimple,
  Plant,
  Plus,
  ShieldCheck,
  SignIn,
  SignOut,
  SquaresFour,
  Sun,
  Trash,
  UserPlus,
  Warning,
  WarningOctagon,
  WifiSlash,
  X,
} from '@phosphor-icons/react'

/** Interface glyphs sit on the 20px nav/action grid. */
const UI = { size: 20, weight: 'regular' }

/** Status glyphs sit slightly smaller so they read as a marker beside a label, not a button. */
const STATUS = { size: 16, weight: 'regular' }

const icon =
  (Glyph, defaults) =>
  (props) =>
    <Glyph {...defaults} {...props} />

// Navigation
export const IconDashboard = icon(SquaresFour, UI)
export const IconSensor = icon(Broadcast, UI)
export const IconCrop = icon(Plant, UI)
export const IconValve = icon(Drop, UI)
export const IconLogout = icon(SignOut, UI)

// Status shapes, per the brief: filled circle = good, triangle = warning, octagon = critical.
export const IconGood = icon(Circle, { ...STATUS, weight: 'fill' })
export const IconWarning = icon(Warning, STATUS)
export const IconCritical = icon(WarningOctagon, STATUS)
export const IconInfo = icon(Info, STATUS)
export const IconOffline = icon(WifiSlash, STATUS)
export const IconBattery = icon(BatteryLow, STATUS)

// Controls
export const IconSun = icon(Sun, UI)
export const IconMoon = icon(Moon, UI)
export const IconPlus = icon(Plus, STATUS)
export const IconTrash = icon(Trash, STATUS)
export const IconEdit = icon(PencilSimple, STATUS)
export const IconChevron = icon(CaretRight, STATUS)
export const IconRefresh = icon(ArrowsClockwise, STATUS)
export const IconArrowRight = icon(ArrowRight, STATUS)
export const IconEye = icon(Eye, STATUS)
export const IconEyeSlash = icon(EyeSlash, STATUS)
export const IconSignIn = icon(SignIn, UI)
export const IconUserPlus = icon(UserPlus, UI)
export const IconChat = icon(ChatCircleDots, UI)
export const IconClose = icon(X, STATUS)
export const IconSend = icon(PaperPlaneRight, STATUS)
export const IconMenu = icon(List, UI)

// Login page only - the one place the brief's "no illustration" rule is deliberately relaxed.
export const IconLeaf = icon(Leaf, UI)
export const IconGauge = icon(Gauge, UI)
export const IconShield = icon(ShieldCheck, UI)
