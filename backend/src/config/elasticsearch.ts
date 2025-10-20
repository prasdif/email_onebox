// backend/src/config/elasticsearch.ts
import { Client } from '@elastic/elasticsearch';

const esClient = new Client({
  node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});

interface SearchOptions {
  accountId?: string;
  folder?: string;
  category?: string;
  size?: number;
  from?: number;
}

export async function searchEmails(query: string, options: SearchOptions = {}) {
  const { accountId, folder, category, size = 50, from = 0 } = options;

  const must: any[] = [];

  // Add query if provided
  if (query) {
    must.push({
      multi_match: {
        query,
        fields: ['subject^3', 'body^2', 'from_address', 'to_address'],
        type: 'best_fields',
        fuzziness: 'AUTO'
      }
    });
  }

  // Add filters
  if (accountId) {
    must.push({ term: { account_id: accountId } });
  }
  if (folder) {
    must.push({ term: { 'folder.keyword': folder } });
  }
  if (category) {
    must.push({ term: { 'category.keyword': category } });
  }

  const queryBody = must.length > 0 
    ? { bool: { must } }
    : { match_all: {} };

  try {
    const result = await esClient.search({
      index: 'emails',
      query: queryBody,
      sort: [{ received_at: 'desc' }],
      size,
      from
    });

    const total = typeof result.hits.total === 'number' 
      ? result.hits.total 
      : result.hits.total?.value || 0;

    return {
      emails: result.hits.hits.map(hit => hit._source),
      total
    };
  } catch (error) {
    console.error('Elasticsearch search error:', error);
    return { emails: [], total: 0 };
  }
}

export async function indexEmail(email: any) {
  try {
    await esClient.index({
      index: 'emails',
      id: email.message_id,
      document: email
    });
  } catch (error) {
    console.error('Elasticsearch index error:', error);
  }
}

export async function updateEmailCategory(messageId: string, category: string) {
  try {
    await esClient.update({
      index: 'emails',
      id: messageId,
      doc: {
        category,
        updated_at: new Date()
      }
    });
  } catch (error) {
    console.error('Elasticsearch update error:', error);
  }
}

export async function initializeIndex() {
  try {
    const indexExists = await esClient.indices.exists({ index: 'emails' });

    if (!indexExists) {
      await esClient.indices.create({
        index: 'emails',
        mappings: {
          properties: {
            message_id: { type: 'keyword' },
            account_id: { type: 'keyword' },
            from_address: { type: 'text', fields: { keyword: { type: 'keyword' } } },
            to_address: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            received_at: { type: 'date' },
            folder: { type: 'keyword' },
            category: { type: 'keyword' },
            is_read: { type: 'boolean' },
            updated_at: { type: 'date' }
          }
        }
      });
      console.log('✅ Elasticsearch index created');
    }
  } catch (error) {
    console.error('❌ Elasticsearch initialization error:', error);
    throw error;
  }
}

export default esClient;