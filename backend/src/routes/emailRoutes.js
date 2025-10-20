"use strict";
// backend/src/routes/emailRoutes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const elasticsearch_1 = require("../config/elasticsearch");
const database_1 = require("../config/database");
const WebhookService_1 = __importDefault(require("../services/integrations/WebhookService"));
const router = (0, express_1.Router)();
/**
 * GET /api/emails
 * Search and list emails
 */
router.get('/', async (req, res) => {
    try {
        const { q, accountId, folder, category, page = 1, limit = 50 } = req.query;
        const from = (Number(page) - 1) * Number(limit);
        const results = await (0, elasticsearch_1.searchEmails)(q, {
            accountId: accountId,
            folder: folder,
            category: category,
            size: Number(limit),
            from
        });
        res.json({
            success: true,
            data: results.emails,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: results.total
            }
        });
    }
    catch (error) {
        console.error('Error fetching emails:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * GET /api/emails/:messageId
 * Get single email by message ID
 */
router.get('/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;
        const result = await (0, database_1.query)('SELECT * FROM emails WHERE message_id = $1', [messageId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Email not found'
            });
        }
        res.json({
            success: true,
            data: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error fetching email:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * PATCH /api/emails/:messageId/category
 * Update email category
 */
router.patch('/:messageId/category', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { category } = req.body;
        // Validate category
        const validCategories = [
            'Interested',
            'Meeting Booked',
            'Not Interested',
            'Spam',
            'Out of Office'
        ];
        if (!validCategories.includes(category)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid category'
            });
        }
        // Update in database
        await (0, database_1.query)('UPDATE emails SET category = $1, updated_at = CURRENT_TIMESTAMP WHERE message_id = $2', [category, messageId]);
        // Update in Elasticsearch
        await (0, elasticsearch_1.updateEmailCategory)(messageId, category);
        // Trigger webhook if marked as "Interested"
        if (category === 'Interested') {
            const emailResult = await (0, database_1.query)('SELECT * FROM emails WHERE message_id = $1', [messageId]);
            if (emailResult.rows.length > 0) {
                const email = emailResult.rows[0];
                await WebhookService_1.default.trigger({
                    messageId: email.message_id,
                    from: email.from_address,
                    to: email.to_address,
                    subject: email.subject,
                    body: email.body,
                    date: email.received_at,
                    folder: email.folder,
                    accountId: email.account_id
                }, category);
            }
        }
        res.json({
            success: true,
            message: 'Category updated successfully'
        });
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * PATCH /api/emails/:messageId/read
 * Mark email as read/unread
 */
router.patch('/:messageId/read', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { isRead } = req.body;
        await (0, database_1.query)('UPDATE emails SET is_read = $1, updated_at = CURRENT_TIMESTAMP WHERE message_id = $2', [isRead, messageId]);
        res.json({
            success: true,
            message: 'Read status updated'
        });
    }
    catch (error) {
        console.error('Error updating read status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
/**
 * GET /api/emails/stats/categories
 * Get email count by category
 */
router.get('/stats/categories', async (req, res) => {
    try {
        const result = await (0, database_1.query)(`
      SELECT 
        category,
        COUNT(*) as count
      FROM emails
      GROUP BY category
    `);
        res.json({
            success: true,
            data: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
exports.default = router;
//# sourceMappingURL=emailRoutes.js.map