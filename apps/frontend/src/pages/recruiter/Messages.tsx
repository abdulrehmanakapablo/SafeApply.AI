// FILE: src/pages/recruiter/Messages.tsx
// ROUTE: /recruiter/messages(/:id)
import Inbox from '../../components/messages/Inbox'

export default function RecruiterMessages() {
  return <Inbox base="/recruiter/messages" emptyBody="Message an applicant from their profile and the conversation appears here." />
}
