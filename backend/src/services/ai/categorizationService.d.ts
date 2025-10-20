interface Email {
    subject: string;
    body: string;
    from: string;
    to?: string[];
}
export declare class CategorizationService {
    private categories;
    categorizeEmail(email: Email): Promise<string>;
    private isOutOfOffice;
    private isSpam;
    private isMeetingBooked;
    private isInterested;
    categorizeEmails(emails: Email[]): Promise<Map<Email, string>>;
    getCategoryStats(categories: string[]): Record<string, number>;
    getCategoryWithConfidence(email: Email): Promise<{
        category: string;
        confidence: number;
    }>;
    private countMatches;
}
declare const _default: CategorizationService;
export default _default;
//# sourceMappingURL=categorizationService.d.ts.map