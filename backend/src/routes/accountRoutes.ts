// backend/src/routes/accountRoutes.ts

import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import imapSyncService from '../services/imap/ImapSyncService';

const router = Router();

/**
 * POST /api/accounts
 * Add a new email account
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, password, imapHost, imapPort = 993 } = req.body;

    // Validate required fields
    if (!email || !password || !imapHost) {
      return res.status(400).json({
        success: false,
        error: 'Email, password, and IMAP host are required'
      });
    }

    // Check if account already exists
    const existingAccount = await query(
      'SELECT id FROM accounts WHERE email = $1',
      [email]
    );

    if (existingAccount.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Account already exists'
      });
    }

    // Insert account
    const result = await query(
      `INSERT INTO accounts (email, password, imap_host, imap_port) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, email, imap_host, imap_port, is_active, created_at`,
      [email, password, imapHost, imapPort]
    );

    const account = result.rows[0];

    // Start syncing in background
    imapSyncService.startSync({
      id: account.id,
      email: account.email,
      password: password,
      imapHost: account.imap_host,
      imapPort: account.imap_port
    }).catch(err => {
      console.error('Error starting sync:', err);
    });

    res.status(201).json({
      success: true,
      message: 'Account added successfully',
      data: {
        id: account.id,
        email: account.email,
        imapHost: account.imap_host,
        imapPort: account.imap_port,
        isActive: account.is_active
      }
    });
  } catch (error: any) {
    console.error('Error adding account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/accounts
 * List all accounts
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, imap_host, imap_port, is_active, last_synced_at, created_at 
       FROM accounts 
       ORDER BY created_at DESC`
    );

    // Get sync status for each account
    const syncStatuses = imapSyncService.getSyncStatus();
    const statusMap = new Map(syncStatuses.map(s => [s.accountId, s.connected]));

    const accounts = result.rows.map(account => ({
      ...account,
      syncStatus: statusMap.get(account.id) ? 'connected' : 'disconnected'
    }));

    res.json({
      success: true,
      data: accounts
    });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/accounts/:id
 * Get single account
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT id, email, imap_host, imap_port, is_active, last_synced_at, created_at 
       FROM accounts 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error fetching account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/accounts/:id
 * Delete an account
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Stop syncing
    await imapSyncService.stopSync(id);

    // Delete from database (cascade will delete emails)
    await query('DELETE FROM accounts WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting account:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/accounts/:id/sync
 * Manually trigger sync for an account
 */
router.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM accounts WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    const account = result.rows[0];

    // Restart sync
    await imapSyncService.stopSync(id);
    await imapSyncService.startSync({
      id: account.id,
      email: account.email,
      password: account.password,
      imapHost: account.imap_host,
      imapPort: account.imap_port
    });

    res.json({
      success: true,
      message: 'Sync triggered successfully'
    });
  } catch (error: any) {
    console.error('Error triggering sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/accounts/:id/status
 * Get sync status for an account
 */
router.get('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const syncStatuses = imapSyncService.getSyncStatus();
    const status = syncStatuses.find(s => s.accountId === id);

    res.json({
      success: true,
      data: {
        accountId: id,
        connected: status?.connected || false,
        status: status?.connected ? 'active' : 'inactive'
      }
    });
  } catch (error: any) {
    console.error('Error fetching sync status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;