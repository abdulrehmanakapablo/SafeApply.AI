// FILE: src/pages/dashboard/Messages.tsx
// ROUTE: /dashboard/messages(/:id)
import Inbox from '../../components/messages/Inbox'

export default function Messages() {
  return <Inbox base="/dashboard/messages" emptyBody="Apply to a job on SafeApply and the company can message you here." />
}
