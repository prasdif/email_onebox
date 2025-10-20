import { Client } from '@elastic/elasticsearch';
declare const esClient: Client;
interface SearchOptions {
    accountId?: string;
    folder?: string;
    category?: string;
    size?: number;
    from?: number;
}
export declare function searchEmails(query: string, options?: SearchOptions): Promise<{
    emails: unknown[];
    total: number;
}>;
export declare function indexEmail(email: any): Promise<void>;
export declare function updateEmailCategory(messageId: string, category: string): Promise<void>;
export declare function initializeIndex(): Promise<void>;
export default esClient;
//# sourceMappingURL=elasticsearch.d.ts.map