import { Router } from 'express';
import { getProfile, updateProfile } from '../controllers/profile.controller';

// Mounted at /api/profile. Paths only; the handlers live in the controller.
const router = Router();

router.get('/', getProfile);
router.patch('/', updateProfile);

export default router;
