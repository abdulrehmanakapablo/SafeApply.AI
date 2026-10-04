import { Router, type Router as RouterType } from 'express'
import { getCompanyRecord } from '../controllers/records.controller'

const router: RouterType = Router()
router.get('/companies/:slug', getCompanyRecord)
export default router
