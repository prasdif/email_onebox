interface EmailContext {
    subject: string;
    body: string;
    from: string;
}
export declare class RAGService {
    private redis;
    private productData;
    private replyTemplates;
    private calendarLink;
    constructor();
    private initializeKnowledgeBase;
    generateReplies(emailContext: EmailContext): Promise<{
        suggestions: string[];
        reasoning: string[];
        matchedScenario: string;
    }>;
    getContextualInfo(query: string): Promise<string[]>;
    private fillTemplate;
    storeEmailEmbedding(emailId: string, emailData: EmailContext): Promise<void>;
    getStoredContext(emailId: string): Promise<EmailContext | null>;
    analyzeEmailSentiment(text: string): Promise<{
        sentiment: 'positive' | 'neutral' | 'negative';
        confidence: number;
    }>;
}
declare const _default: RAGService;
export default _default;
//# sourceMappingURL=ragService.d.ts.map