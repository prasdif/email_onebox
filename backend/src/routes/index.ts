// backend/src/routes/index.ts

import { Router } from 'express';
import emailRoutes from './emailRoutes';
import accountRoutes from './accountRoutes';

const router = Router();

// Mount routes
router.use('/emails', emailRoutes);
router.use('/accounts', accountRoutes);

export default router;