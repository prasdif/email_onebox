// backend/src/services/search/elasticsearchService.ts
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({ 
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200' 
});

interface Email {
  id: string;
  accountId: string;
  folder: string;
  from: string;
  to: string[];
  subject: string;
  body: string;
  date: Date;
  aiCategory?: string;
  uid: number;
  headers?: any;
}

export class ElasticsearchService {
  private indexName = 'emails';

  async initIndex() {
    const exists = await esClient.indices.exists({ index: this.indexName });
    
    if (!exists) {
      await esClient.indices.create({
        index: this.indexName,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              accountId: { type: 'keyword' },
              folder: { type: 'keyword' },
              from: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              to: { type: 'text' },
              subject: { type: 'text' },
              body: { type: 'text' },
              date: { type: 'date' },
              aiCategory: { type: 'keyword' },
              uid: { type: 'integer' },
              timestamp: { type: 'date' }
            }
          }
        }
      });
      console.log('✅ Elasticsearch index created');
    }
  }

  async indexEmail(email: Email) {
    try {
      await esClient.index({
        index: this.indexName,
        id: email.id,
        document: {
          ...email,
          timestamp: new Date()
        }
      });
      console.log(`📧 Indexed email: ${email.subject}`);
    } catch (error) {
      console.error('Failed to index email:', error);
    }
  }

  async bulkIndexEmails(emails: Email[]) {
    const operations = emails.flatMap(email => [
      { index: { _index: this.indexName, _id: email.id } },
      { ...email, timestamp: new Date() }
    ]);

    if (operations.length === 0) return;

    try {
      const result = await esClient.bulk({ body: operations });
      console.log(`✅ Bulk indexed ${emails.length} emails`);
      return result;
    } catch (error) {
      console.error('Bulk index error:', error);
    }
  }

  async searchEmails(query: string, filters?: {
    folder?: string;
    accountId?: string;
    category?: string;
  }) {
    const must: any[] = [];

    if (query) {
      must.push({
        multi_match: {
          query,
          fields: ['subject^3', 'body^2', 'from', 'to'],
          type: 'best_fields',
          fuzziness: 'AUTO'
        }
      });
    }

    if (filters?.folder) {
      must.push({ term: { folder: filters.folder } });
    }

    if (filters?.accountId) {
      must.push({ term: { accountId: filters.accountId } });
    }

    if (filters?.category) {
      must.push({ term: { aiCategory: filters.category } });
    }

    const queryBody = must.length > 0 
      ? { bool: { must } }
      : { match_all: {} };

    try {
      const result = await esClient.search({
        index: this.indexName,
        body: {
          query: queryBody,
          sort: [{ date: 'desc' }],
          size: 100
        }
      });

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  async getAllEmails(accountId?: string, folder?: string) {
    const must: any[] = [];
    
    if (accountId) must.push({ term: { accountId } });
    if (folder) must.push({ term: { folder } });

    const query = must.length > 0 ? { bool: { must } } : { match_all: {} };

    try {
      const result = await esClient.search({
        index: this.indexName,
        body: {
          query,
          sort: [{ date: 'desc' }],
          size: 1000
        }
      });

      return result.hits.hits.map(hit => hit._source);
    } catch (error) {
      console.error('Get all emails error:', error);
      return [];
    }
  }

  async getEmailById(emailId: string) {
    try {
      const result = await esClient.get({
        index: this.indexName,
        id: emailId
      });
      return result._source;
    } catch (error) {
      console.error('Get email error:', error);
      return null;
    }
  }

  async deleteEmail(emailId: string) {
    try {
      await esClient.delete({
        index: this.indexName,
        id: emailId
      });
    } catch (error) {
      console.error('Delete email error:', error);
    }
  }

  async getStats(accountId?: string) {
    const must: any[] = [];
    if (accountId) must.push({ term: { accountId } });

    try {
      const result = await esClient.search({
        index: this.indexName,
        body: {
          query: must.length > 0 ? { bool: { must } } : { match_all: {} },
          size: 0,
          aggs: {
            byCategory: {
              terms: { field: 'aiCategory', size: 10 }
            },
            byFolder: {
              terms: { field: 'folder', size: 10 }
            },
            byAccount: {
              terms: { field: 'accountId', size: 10 }
            }
          }
        }
      });

      return {
        total: result.hits.total.value,
        byCategory: result.aggregations.byCategory.buckets.reduce((acc, b) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {}),
        byFolder: result.aggregations.byFolder.buckets.reduce((acc, b) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {}),
        byAccount: result.aggregations.byAccount.buckets.reduce((acc, b) => {
          acc[b.key] = b.doc_count;
          return acc;
        }, {})
      };
    } catch (error) {
      console.error('Get stats error:', error);
      return null;
    }
  }
}

export default new ElasticsearchService();