import { Account } from '../../types';
export declare class ImapSyncService {
    private connections;
    /**
     * Start syncing an IMAP account
     */
    startSync(account: Account): Promise<void>;
    /**
     * Sync emails from the last 30 days
     */
    private syncLast30Days;
    /**
     * Start IDLE mode for real-time updates
     */
    private startIdleMode;
    /**
     * Process individual email
     */
    private processEmail;
    /**
     * Reconnect to IMAP server
     */
    private reconnect;
    /**
     * Stop syncing an account
     */
    stopSync(accountId: string): Promise<void>;
    /**
     * Get sync status for all accounts
     */
    getSyncStatus(): {
        accountId: string;
        connected: boolean;
    }[];
}
declare const _default: ImapSyncService;
export default _default;
//# sourceMappingURL=ImapSyncService.d.ts.map