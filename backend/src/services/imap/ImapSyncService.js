"use strict";
// backend/src/services/imap/ImapSyncService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImapSyncService = void 0;
const imap_simple_1 = __importDefault(require("imap-simple"));
const mailparser_1 = require("mailparser");
const database_1 = require("../../config/database");
const ElasticsearchService_1 = __importDefault(require("../search/ElasticsearchService"));
const EmailCategorizationService_1 = __importDefault(require("../ai/EmailCategorizationService"));
const SlackService_1 = __importDefault(require("../integrations/SlackService"));
const WebhookService_1 = __importDefault(require("../integrations/WebhookService"));
const types_1 = require("../../types");
class ImapSyncService {
    connections = new Map();
    /**
     * Start syncing an IMAP account
     */
    async startSync(account) {
        try {
            console.log(`🔄 Starting sync for: ${account.email}`);
            const config = {
                imap: {
                    user: account.email,
                    password: account.password,
                    host: account.imapHost,
                    port: account.imapPort,
                    tls: true,
                    authTimeout: 10000,
                    tlsOptions: { rejectUnauthorized: false }
                }
            };
            const connection = await imap_simple_1.default.connect(config);
            this.connections.set(account.id, connection);
            // Step 1: Initial sync - last 30 days
            await this.syncLast30Days(connection, account);
            // Step 2: Start real-time IDLE mode
            await this.startIdleMode(connection, account);
            // Update last synced timestamp
            await (0, database_1.query)('UPDATE accounts SET last_synced_at = CURRENT_TIMESTAMP WHERE id = $1', [account.id]);
            console.log(`✅ Sync started for ${account.email}`);
        }
        catch (error) {
            console.error(`❌ Error syncing ${account.email}:`, error.message);
            throw error;
        }
    }
    /**
     * Sync emails from the last 30 days
     */
    async syncLast30Days(connection, account) {
        try {
            await connection.openBox('INBOX');
            // Calculate date 30 days ago
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            const dateString = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '-');
            // Search for emails from last 30 days
            const searchCriteria = [['SINCE', dateString]];
            const fetchOptions = {
                bodies: ['HEADER', 'TEXT', ''],
                markSeen: false,
                struct: true
            };
            console.log(`📥 Fetching emails since ${dateString} for ${account.email}...`);
            const messages = await connection.search(searchCriteria, fetchOptions);
            console.log(`📧 Found ${messages.length} emails to sync`);
            // Process emails in batches to avoid overwhelming the system
            const batchSize = 10;
            for (let i = 0; i < messages.length; i += batchSize) {
                const batch = messages.slice(i, i + batchSize);
                await Promise.all(batch.map(message => this.processEmail(message, account, 'INBOX')));
                if (i + batchSize < messages.length) {
                    // Small delay between batches
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            console.log(`✅ Initial sync complete for ${account.email}`);
        }
        catch (error) {
            console.error(`Error in initial sync for ${account.email}:`, error.message);
            throw error;
        }
    }
    /**
     * Start IDLE mode for real-time updates
     */
    async startIdleMode(connection, account) {
        try {
            await connection.openBox('INBOX');
            console.log(`👂 IDLE mode active for ${account.email}`);
            // Listen for new mail
            connection.on('mail', async (numNewMsgs) => {
                console.log(`📬 ${numNewMsgs} new email(s) for ${account.email}`);
                try {
                    // Fetch only unseen emails
                    const searchCriteria = ['UNSEEN'];
                    const fetchOptions = {
                        bodies: ['HEADER', 'TEXT', ''],
                        markSeen: false,
                        struct: true
                    };
                    const messages = await connection.search(searchCriteria, fetchOptions);
                    // Process new emails
                    for (const message of messages) {
                        await this.processEmail(message, account, 'INBOX');
                    }
                }
                catch (error) {
                    console.error(`Error processing new emails for ${account.email}:`, error.message);
                }
            });
            // Handle connection errors
            connection.on('error', async (err) => {
                console.error(`❌ IMAP error for ${account.email}:`, err.message);
                await this.reconnect(account);
            });
            connection.on('end', async () => {
                console.log(`🔌 Connection ended for ${account.email}`);
                await this.reconnect(account);
            });
        }
        catch (error) {
            console.error(`Error starting IDLE mode for ${account.email}:`, error.message);
            throw error;
        }
    }
    /**
     * Process individual email
     */
    async processEmail(message, account, folder) {
        try {
            // Find the text body
            const all = message.parts.find((part) => part.which === 'TEXT') ||
                message.parts.find((part) => part.which === '');
            const idHeader = message.parts.find((part) => part.which === 'HEADER');
            if (!idHeader) {
                console.warn('No header found for message');
                return;
            }
            // Parse email
            const parsed = await (0, mailparser_1.simpleParser)(idHeader.body);
            const uid = message.attributes.uid;
            let bodyText = '';
            if (all && all.body) {
                bodyText = typeof all.body === 'string' ? all.body : all.body.toString();
            }
            else if (parsed.text) {
                bodyText = parsed.text;
            }
            // Create parsed email object
            const email = {
                messageId: parsed.messageId || `${account.id}-${uid}`,
                from: parsed.from?.text || 'unknown',
                to: parsed.to?.text || '',
                subject: parsed.subject || '(no subject)',
                body: bodyText.substring(0, 5000), // Limit body size
                date: parsed.date || new Date(),
                folder: folder,
                accountId: account.id
            };
            // Check if email already exists
            const existingEmail = await (0, database_1.query)('SELECT id FROM emails WHERE message_id = $1', [email.messageId]);
            if (existingEmail.rows.length > 0) {
                // Email already processed
                return;
            }
            // Categorize with AI
            const category = await EmailCategorizationService_1.default.categorize(email);
            // Save to database
            await (0, database_1.query)(`INSERT INTO emails 
         (message_id, account_id, from_address, to_address, subject, body, folder, category, received_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                email.messageId,
                email.accountId,
                email.from,
                email.to,
                email.subject,
                email.body,
                email.folder,
                category,
                email.date
            ]);
            // Index in Elasticsearch
            await ElasticsearchService_1.default.indexEmail(email);
            // Send Slack notification if "Interested"
            if (category === 'Interested') {
                await SlackService_1.default.sendNotification(email);
                await WebhookService_1.default.trigger(email, category);
            }
            console.log(`✅ Processed: ${email.subject.substring(0, 50)} [${category || 'uncategorized'}]`);
        }
        catch (error) {
            console.error('Error processing email:', error.message);
        }
    }
    /**
     * Reconnect to IMAP server
     */
    async reconnect(account) {
        console.log(`🔄 Reconnecting ${account.email}...`);
        // Wait 5 seconds before reconnecting
        await new Promise(resolve => setTimeout(resolve, 5000));
        // Close existing connection
        const existingConnection = this.connections.get(account.id);
        if (existingConnection) {
            try {
                await existingConnection.end();
            }
            catch (err) {
                // Ignore errors when closing
            }
            this.connections.delete(account.id);
        }
        // Start new sync
        try {
            await this.startSync(account);
        }
        catch (error) {
            console.error(`Failed to reconnect ${account.email}:`, error.message);
            // Try again in 30 seconds
            setTimeout(() => this.reconnect(account), 30000);
        }
    }
    /**
     * Stop syncing an account
     */
    async stopSync(accountId) {
        const connection = this.connections.get(accountId);
        if (connection) {
            try {
                await connection.end();
            }
            catch (err) {
                // Ignore errors
            }
            this.connections.delete(accountId);
            console.log(`🛑 Stopped sync for account ${accountId}`);
        }
    }
    /**
     * Get sync status for all accounts
     */
    getSyncStatus() {
        return Array.from(this.connections.entries()).map(([accountId, connection]) => ({
            accountId,
            connected: connection && connection.state === 'authenticated'
        }));
    }
}
exports.ImapSyncService = ImapSyncService;
exports.default = new ImapSyncService();
//# sourceMappingURL=ImapSyncService.js.map