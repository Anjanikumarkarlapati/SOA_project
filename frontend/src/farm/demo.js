/**
 * The India demo runs without the Spring services: a local session that never reaches the
 * gateway. It opens the farm onboarding and assistant, which are computed in the browser.
 */
export const DEMO_TOKEN = 'demo-offline'

export function demoSession() {
  return {
    token: DEMO_TOKEN,
    refreshToken: '',
    expiresIn: 0,
    email: 'demo.farmer@agritech.in',
    role: 'FARMER',
    farmId: 'FARM-DEMO-IN',
    displayName: 'Ramesh Kumar',
  }
}

export function isDemoSession(session) {
  return session?.token === DEMO_TOKEN
}
