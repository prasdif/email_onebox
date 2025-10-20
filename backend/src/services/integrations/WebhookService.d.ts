interface EmailData {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
    date: Date;
    folder: string;
    accountId: string;
}
declare class WebhookService {
    private slackWebhookUrl;
    private externalWebhookUrl;
    constructor();
    trigger(email: EmailData, category: string): Promise<void>;
    private sendSlackNotification;
    private sendExternalWebhook;
    private truncate;
    testSlack(): Promise<boolean>;
    testWebhook(): Promise<boolean>;
}
declare const _default: WebhookService;
export default _default;
//# sourceMappingURL=WebhookService.d.ts.map