import { createFileRoute } from '@tanstack/react-router'
import { LobbyPage } from '../features/lobby/lobby-page.tsx'

export const Route = createFileRoute('/room/')({ component: LobbyPage })
