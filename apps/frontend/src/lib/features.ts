// FILE: src/lib/features.ts
// PURPOSE: Build-time feature switches, set in the hosting dashboard's
//          environment variables. Changing one needs a rebuild/redeploy.

/** Email (password reset links). Off until an email service is set up. */
export const EMAIL_ENABLED = import.meta.env.VITE_EMAIL_ENABLED === 'true'
