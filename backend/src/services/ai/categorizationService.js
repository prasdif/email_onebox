"use strict";
// backend/src/services/ai/categorizationService.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategorizationService = void 0;
class CategorizationService {
    categories = [
        'Interested',
        'Meeting Booked',
        'Not Interested',
        'Spam',
        'Out of Office'
    ];
    async categorizeEmail(email) {
        const text = `${email.subject} ${email.body}`.toLowerCase();
        const from = email.from.toLowerCase();
        // Out of Office Detection
        if (this.isOutOfOffice(text, email.subject)) {
            return 'Out of Office';
        }
        // Spam Detection
        if (this.isSpam(text, from)) {
            return 'Spam';
        }
        // Meeting Booked Detection
        if (this.isMeetingBooked(text)) {
            return 'Meeting Booked';
        }
        // Interested Detection (Job/Business opportunities)
        if (this.isInterested(text)) {
            return 'Interested';
        }
        // Default
        return 'Not Interested';
    }
    isOutOfOffice(text, subject) {
        const oooKeywords = [
            'out of office',
            'ooo',
            'away from office',
            'on vacation',
            'on leave',
            'automatic reply',
            'auto-reply',
            'currently unavailable',
            'will be out',
            'away until'
        ];
        return oooKeywords.some(keyword => text.includes(keyword) || subject.toLowerCase().includes(keyword));
    }
    isSpam(text, from) {
        const spamKeywords = [
            'unsubscribe',
            'click here now',
            'limited time offer',
            'act now',
            'congratulations you won',
            'claim your prize',
            'nigerian prince',
            'increase your income',
            'work from home',
            'make money fast',
            'buy now',
            'free money',
            'risk free',
            'no credit card',
            'viagra',
            'casino'
        ];
        const spamDomains = [
            'noreply',
            'no-reply',
            'donotreply',
            'newsletter',
            'marketing'
        ];
        const hasSpamKeywords = spamKeywords.some(keyword => text.includes(keyword));
        const hasSpamDomain = spamDomains.some(domain => from.includes(domain));
        return hasSpamKeywords || hasSpamDomain;
    }
    isMeetingBooked(text) {
        const meetingKeywords = [
            'meeting scheduled',
            'meeting confirmed',
            'calendar invite',
            'has invited you',
            'meeting request',
            'appointment confirmed',
            'scheduled a meeting',
            'zoom meeting',
            'google meet',
            'teams meeting',
            'meeting link',
            'join the meeting',
            'meeting at',
            'meeting on',
            'calendar event'
        ];
        return meetingKeywords.some(keyword => text.includes(keyword));
    }
    isInterested(text) {
        const interestedKeywords = [
            'job opportunity',
            'job opening',
            'position available',
            'interview',
            'hiring',
            'recruitment',
            'shortlisted',
            'selected for',
            'next round',
            'technical interview',
            'phone screen',
            'interested in your profile',
            'resume',
            'cv',
            'application',
            'business opportunity',
            'partnership',
            'collaboration',
            'proposal',
            'investment opportunity',
            'would like to discuss',
            'schedule a call',
            'lets connect',
            'coffee chat'
        ];
        return interestedKeywords.some(keyword => text.includes(keyword));
    }
    // Batch categorization
    async categorizeEmails(emails) {
        const results = new Map();
        for (const email of emails) {
            const category = await this.categorizeEmail(email);
            results.set(email, category);
        }
        return results;
    }
    // Get category statistics
    getCategoryStats(categories) {
        return categories.reduce((acc, category) => {
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {});
    }
    // Confidence score (for future ML model)
    async getCategoryWithConfidence(email) {
        const category = await this.categorizeEmail(email);
        // Simple confidence based on keyword matches
        const text = `${email.subject} ${email.body}`.toLowerCase();
        let matchCount = 0;
        let totalKeywords = 0;
        // Count keyword matches for the determined category
        if (category === 'Interested') {
            totalKeywords = 10;
            matchCount = this.countMatches(text, [
                'job', 'interview', 'opportunity', 'hiring', 'position',
                'selected', 'shortlisted', 'resume', 'application', 'recruitment'
            ]);
        }
        const confidence = totalKeywords > 0 ? matchCount / totalKeywords : 0.5;
        return {
            category,
            confidence: Math.min(confidence * 100, 95) // Cap at 95%
        };
    }
    countMatches(text, keywords) {
        return keywords.filter(keyword => text.includes(keyword)).length;
    }
}
exports.CategorizationService = CategorizationService;
exports.default = new CategorizationService();
//# sourceMappingURL=categorizationService.js.map