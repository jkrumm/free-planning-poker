import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AppHeader } from '../features/language/app-header.tsx'

export const Route = createRootRoute({
  component: () => (
    <>
      <AppHeader />
      <Outlet />
    </>
  ),
})
