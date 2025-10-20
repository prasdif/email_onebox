"use strict";
// backend/src/services/integrations/WebhookService.ts
Object.defineProperty(exports, "__esModule", { value: true });
class WebhookService {
    slackWebhookUrl;
    externalWebhookUrl;
    constructor() {
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL || '';
        this.externalWebhookUrl = process.env.WEBHOOK_URL || '';
    }
    async trigger(email, category) {
        if (category === 'Interested') {
            await Promise.all([
                this.sendSlackNotification(email),
                this.sendExternalWebhook(email, category)
            ]);
        }
    }
    async sendSlackNotification(email) {
        if (!this.slackWebhookUrl) {
            console.log('⚠️ Slack webhook URL not configured');
            return;
        }
        try {
            const response = await fetch(this.slackWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: `🎯 New Interested Email`,
                    blocks: [
                        {
                            type: 'header',
                            text: {
                                type: 'plain_text',
                                text: '📧 New Interested Email',
                                emoji: true
                            }
                        },
                        {
                            type: 'section',
                            fields: [
                                {
                                    type: 'mrkdwn',
                                    text: `*From:*\n${email.from}`
                                },
                                {
                                    type: 'mrkdwn',
                                    text: `*Date:*\n${new Date(email.date).toLocaleString()}`
                                }
                            ]
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `*Subject:*\n${email.subject}`
                            }
                        },
                        {
                            type: 'section',
                            text: {
                                type: 'mrkdwn',
                                text: `*Preview:*\n${this.truncate(email.body, 200)}`
                            }
                        }
                    ]
                })
            });
            if (response.ok) {
                console.log('✅ Slack notification sent');
            }
            else {
                console.error('❌ Slack notification failed:', response.statusText);
            }
        }
        catch (error) {
            console.error('❌ Slack notification error:', error);
        }
    }
    async sendExternalWebhook(email, category) {
        if (!this.externalWebhookUrl) {
            console.log('⚠️ External webhook URL not configured');
            return;
        }
        try {
            const payload = {
                event: 'email_categorized',
                category,
                timestamp: new Date().toISOString(),
                data: {
                    messageId: email.messageId,
                    from: email.from,
                    to: email.to,
                    subject: email.subject,
                    date: email.date,
                    folder: email.folder,
                    accountId: email.accountId,
                    snippet: this.truncate(email.body, 100)
                }
            };
            const response = await fetch(this.externalWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Webhook-Source': 'email-onebox'
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                console.log('✅ External webhook triggered');
            }
            else {
                console.error('❌ External webhook failed:', response.statusText);
            }
        }
        catch (error) {
            console.error('❌ External webhook error:', error);
        }
    }
    truncate(text, maxLength) {
        if (text.length <= maxLength)
            return text;
        return text.substring(0, maxLength) + '...';
    }
    async testSlack() {
        const testEmail = {
            messageId: 'test-123',
            from: 'test@example.com',
            to: 'you@example.com',
            subject: 'Test Slack Integration',
            body: 'This is a test email to verify Slack integration.',
            date: new Date(),
            folder: 'INBOX',
            accountId: 'test-account'
        };
        await this.sendSlackNotification(testEmail);
        return true;
    }
    async testWebhook() {
        const testEmail = {
            messageId: 'test-456',
            from: 'test@example.com',
            to: 'you@example.com',
            subject: 'Test Webhook Integration',
            body: 'This is a test email to verify webhook integration.',
            date: new Date(),
            folder: 'INBOX',
            accountId: 'test-account'
        };
        await this.sendExternalWebhook(testEmail, 'Interested');
        return true;
    }
}
exports.default = new WebhookService();
//# sourceMappingURL=WebhookService.js.map