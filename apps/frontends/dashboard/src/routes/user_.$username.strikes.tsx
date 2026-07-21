import { Navigate, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/user_/$username/strikes")({
  component: StrikesRedirect,
})

function StrikesRedirect() {
  const { username } = Route.useParams()
  return <Navigate to="/user/$username" params={{ username }} search={{ tab: "strikes" }} replace />
}
