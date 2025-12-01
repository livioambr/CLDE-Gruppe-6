import express from 'express';
const router = express.Router();

/**
 * POST /api/session/clear
 * Clear common session cookie names so clients can remove HttpOnly cookies server-side.
 */
router.post('/clear', (req, res) => {
  try {
    const cookieNames = ['connect.sid', 'session', 'sid'];
    cookieNames.forEach((name) => {
      // clear cookie on root path; adjust options if your session cookie uses sameSite/secure/domain
      res.clearCookie(name, { path: '/' });
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('Error clearing session cookies:', err);
    return res.status(500).json({ success: false, error: 'Could not clear session cookies' });
  }
});

export default router;