import { createFileRoute } from '@tanstack/react-router'
import { RoomPage } from '../features/room/room-page.tsx'

export const Route = createFileRoute('/room/$slug')({ component: RoomRoute })

function RoomRoute() {
  const { slug } = Route.useParams()
  return <RoomPage slug={slug} />
}
