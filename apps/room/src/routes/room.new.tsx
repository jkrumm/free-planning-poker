import { createFileRoute } from '@tanstack/react-router'
import { NewRoomPage } from '../features/lobby/new-room-page.tsx'

export const Route = createFileRoute('/room/new')({ component: NewRoomPage })
