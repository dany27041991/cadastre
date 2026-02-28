/**
 * Route definitions (for future use with react-router).
 */
export const ROUTES = {
  home: '/',
  territory: '/territory',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]
