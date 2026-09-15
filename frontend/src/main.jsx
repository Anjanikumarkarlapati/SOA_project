import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Self-hosted so the dashboard renders without a round trip to a font CDN. Field tablets on a
// patchy connection get the interface immediately instead of a flash of fallback type.
// The three faces the Figma reference is built on: DM Sans for the interface, Crimson Text for
// headlines and headline figures, DM Mono for data labels. Only the weights the UI uses ship.
import '@fontsource-variable/dm-sans'
import '@fontsource/crimson-text/400.css'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'

import App from './App'
import { SessionProvider } from './session'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
