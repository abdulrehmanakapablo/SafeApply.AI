// Recruiter plan routes: team, notes, talent, analytics (+ seeker talent profile, public badge).
import { Router, type Router as RouterType } from 'express'
import { authMiddleware } from '../middleware/auth'
import { requireRole } from '../middleware/roles'
import { validate } from '../middleware/validate'
import { writeLimiter } from '../middleware/rateLimiter'
import { folderItemSchema, folderSchema, noteSchema, talentInviteSchema, talentProfileSchema, teamInviteSchema, teamJoinSchema } from '../validators/teams.validator'
import * as t from '../controllers/teams.controller'

/** Used inside routes/recruiter.ts, which already applies auth + recruiter role. */
export const recruiterTeamRoutes: RouterType = Router()
const r = recruiterTeamRoutes
r.get('/team', t.getTeam)
r.post('/team/invites', writeLimiter, validate(teamInviteSchema), t.inviteMember)
r.delete('/team/invites/:id', writeLimiter, t.revokeInvite)
r.delete('/team/members/:id', writeLimiter, t.removeMember)
r.post('/team/leave', writeLimiter, t.leaveTeam)
r.get('/applicants/:id/notes', t.listNotes)
r.post('/applicants/:id/notes', writeLimiter, validate(noteSchema), t.addNote)
r.delete('/applicants/:id/notes/:noteId', writeLimiter, t.deleteNote)
r.get('/talent', t.searchTalent)
r.get('/talent/folders', t.listFolders)
r.post('/talent/folders', writeLimiter, validate(folderSchema), t.createFolder)
r.get('/talent/folders/:folderId', t.getFolder)
r.delete('/talent/folders/:folderId', writeLimiter, t.deleteFolder)
r.post('/talent/folders/:folderId/items', writeLimiter, validate(folderItemSchema), t.addFolderItem)
r.delete('/talent/folders/:folderId/items/:talentId', writeLimiter, t.removeFolderItem)
r.get('/talent/:id', t.getTalent)
r.post('/talent/:id/invite', writeLimiter, validate(talentInviteSchema), t.inviteTalent)
r.get('/analytics', t.getAnalytics)

/** Mounted at /api/team: invite links (any signed-in account can preview). */
export const teamJoinRoutes: RouterType = Router()
teamJoinRoutes.get('/invites/:token', authMiddleware, t.previewInvite)
teamJoinRoutes.post('/join', authMiddleware, writeLimiter, validate(teamJoinSchema), t.joinTeam)

/** Mounted at /api/talent: the seeker's own visibility settings. */
export const talentRoutes: RouterType = Router()
talentRoutes.get('/me', authMiddleware, requireRole('user'), t.getMyTalent)
talentRoutes.put('/me', authMiddleware, requireRole('user'), writeLimiter, validate(talentProfileSchema), t.saveMyTalent)

/** Mounted at /api/badge: public SVG, no auth. */
export const badgeRoutes: RouterType = Router()
badgeRoutes.get('/:file', t.companyBadge)
