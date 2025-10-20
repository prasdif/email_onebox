// backend/src/services/vector/ragService.ts
import Redis from 'ioredis';

interface EmailContext {
  subject: string;
  body: string;
  from: string;
}

interface ProductInfo {
  name: string;
  description: string;
  features: string[];
  pricing: string;
  useCases: string[];
}

interface ReplyTemplate {
  scenario: string;
  keywords: string[];
  template: string;
  variables: string[];
}

export class RAGService {
  private redis: Redis;
  private productData: ProductInfo[];
  private replyTemplates: ReplyTemplate[];
  private calendarLink: string;

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_URL || 'localhost',
      port: 6379
    });

    this.calendarLink = process.env.CALENDAR_LINK || 'https://cal.com/example';
    this.initializeKnowledgeBase();
  }

  private initializeKnowledgeBase() {
    // Product information for context
    this.productData = [
      {
        name: 'Email Onebox Pro',
        description: 'AI-powered email management system with intelligent categorization and automated responses',
        features: [
          'Real-time IMAP synchronization',
          'AI-based email categorization',
          'Searchable email storage with Elasticsearch',
          'Slack notifications for important emails',
          'RAG-powered suggested replies',
          'Multi-account support'
        ],
        pricing: 'Starting at $29/month for individuals, $99/month for teams',
        useCases: [
          'Job seekers managing recruitment emails',
          'Sales teams tracking leads',
          'Customer support automation',
          'Executive email management'
        ]
      }
    ];

    // Reply templates for different scenarios
    this.replyTemplates = [
      {
        scenario: 'job_application_shortlisted',
        keywords: ['shortlist', 'selected', 'next round', 'interview', 'resume'],
        template: `Thank you for shortlisting my profile! I'm available for a technical interview. You can book a slot here: {CALENDAR_LINK}`,
        variables: ['CALENDAR_LINK']
      },
      {
        scenario: 'interview_scheduling',
        keywords: ['when will be', 'good time', 'available', 'schedule', 'meet'],
        template: `Hi, Your resume has been shortlisted. When will be a good time for you to attend the technical interview? You can also book directly: {CALENDAR_LINK}`,
        variables: ['CALENDAR_LINK']
      },
      {
        scenario: 'job_opportunity',
        keywords: ['opportunity', 'position', 'role', 'opening', 'hiring'],
        template: `Thank you for reaching out about this opportunity. I'm interested in learning more. Could we schedule a brief call? Here's my calendar: {CALENDAR_LINK}`,
        variables: ['CALENDAR_LINK']
      },
      {
        scenario: 'meeting_request',
        keywords: ['meeting', 'discuss', 'call', 'connect', 'chat'],
        template: `I'd be happy to discuss this further. Please feel free to book a time that works for you: {CALENDAR_LINK}`,
        variables: ['CALENDAR_LINK']
      },
      {
        scenario: 'business_inquiry',
        keywords: ['proposal', 'partnership', 'collaboration', 'project'],
        template: `Thank you for your inquiry. I'm interested in exploring this further. Let's schedule a call to discuss: {CALENDAR_LINK}`,
        variables: ['CALENDAR_LINK']
      }
    ];
  }

  async generateReplies(emailContext: EmailContext): Promise<{
    suggestions: string[];
    reasoning: string[];
    matchedScenario: string;
  }> {
    const text = `${emailContext.subject} ${emailContext.body}`.toLowerCase();
    
    // Find matching scenario
    let bestMatch: ReplyTemplate | null = null;
    let maxMatches = 0;

    for (const template of this.replyTemplates) {
      const matches = template.keywords.filter(keyword => 
        text.includes(keyword.toLowerCase())
      ).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestMatch = template;
      }
    }

    // Generate replies
    const suggestions: string[] = [];
    const reasoning: string[] = [];

    if (bestMatch) {
      // Primary suggestion from matched template
      const primaryReply = this.fillTemplate(bestMatch.template, {
        CALENDAR_LINK: this.calendarLink
      });
      suggestions.push(primaryReply);
      reasoning.push(`Matched scenario: ${bestMatch.scenario} (${maxMatches} keywords matched)`);

      // Add variations
      if (bestMatch.scenario.includes('job')) {
        suggestions.push(
          `Thank you for considering my application. I'm enthusiastic about this opportunity and available for next steps. Calendar: ${this.calendarLink}`
        );
        suggestions.push(
          `I appreciate you reaching out. I'd love to learn more about this role. When would be convenient for a discussion?`
        );
      } else if (bestMatch.scenario.includes('meeting')) {
        suggestions.push(
          `That sounds great! I'm available this week. Please pick a time: ${this.calendarLink}`
        );
      }
    } else {
      // Generic professional replies
      suggestions.push(
        `Thank you for your email. I'd be happy to discuss this further. Please feel free to schedule a time: ${this.calendarLink}`
      );
      suggestions.push(
        `I appreciate you reaching out. Could you provide more details about this opportunity?`
      );
      suggestions.push(
        `Thank you for contacting me. I'll review your message and respond within 24 hours.`
      );
      
      reasoning.push('No specific scenario matched - providing generic professional responses');
    }

    return {
      suggestions: suggestions.slice(0, 3), // Return top 3
      reasoning,
      matchedScenario: bestMatch?.scenario || 'generic'
    };
  }

  async getContextualInfo(query: string): Promise<string[]> {
    const queryLower = query.toLowerCase();
    const contexts: string[] = [];

    // Search product data
    for (const product of this.productData) {
      if (queryLower.includes('product') || 
          queryLower.includes('feature') || 
          queryLower.includes('service')) {
        contexts.push(`Our product: ${product.name} - ${product.description}`);
        contexts.push(`Key features: ${product.features.join(', ')}`);
      }

      if (queryLower.includes('price') || queryLower.includes('cost')) {
        contexts.push(`Pricing: ${product.pricing}`);
      }
    }

    return contexts;
  }

  private fillTemplate(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(`{${key}}`, value);
    }
    
    return result;
  }

  async storeEmailEmbedding(emailId: string, emailData: EmailContext): Promise<void> {
    // Store email metadata in Redis for quick retrieval
    const key = `email:${emailId}`;
    await this.redis.hset(key, {
      subject: emailData.subject,
      from: emailData.from,
      body: emailData.body.substring(0, 500), // Store first 500 chars
      timestamp: Date.now()
    });

    await this.redis.expire(key, 86400 * 30); // 30 days
  }

  async getStoredContext(emailId: string): Promise<EmailContext | null> {
    const key = `email:${emailId}`;
    const data = await this.redis.hgetall(key);
    
    if (!data || Object.keys(data).length === 0) {
      return null;
    }

    return {
      subject: data.subject,
      body: data.body,
      from: data.from
    };
  }

  async analyzeEmailSentiment(text: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    confidence: number;
  }> {
    const lowerText = text.toLowerCase();

    const positiveWords = ['thanks', 'great', 'excellent', 'perfect', 'interested', 
                          'opportunity', 'excited', 'looking forward', 'appreciate'];
    const negativeWords = ['unfortunately', 'reject', 'decline', 'not interested', 
                          'spam', 'unsubscribe', 'stop'];

    let positiveScore = 0;
    let negativeScore = 0;

    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveScore++;
    });

    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeScore++;
    });

    const totalScore = positiveScore + negativeScore;
    const confidence = totalScore > 0 ? (Math.max(positiveScore, negativeScore) / totalScore) * 100 : 50;

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    if (positiveScore > negativeScore) sentiment = 'positive';
    else if (negativeScore > positiveScore) sentiment = 'negative';

    return { sentiment, confidence };
  }
}

export default new RAGService();