"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ElasticsearchService = void 0;
// backend/src/services/search/elasticsearchService.ts
const elasticsearch_1 = require("@elastic/elasticsearch");
const esClient = new elasticsearch_1.Client({
    node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
});
class ElasticsearchService {
    indexName = 'emails';
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
    async indexEmail(email) {
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
        }
        catch (error) {
            console.error('Failed to index email:', error);
        }
    }
    async bulkIndexEmails(emails) {
        const operations = emails.flatMap(email => [
            { index: { _index: this.indexName, _id: email.id } },
            { ...email, timestamp: new Date() }
        ]);
        if (operations.length === 0)
            return;
        try {
            const result = await esClient.bulk({ body: operations });
            console.log(`✅ Bulk indexed ${emails.length} emails`);
            return result;
        }
        catch (error) {
            console.error('Bulk index error:', error);
        }
    }
    async searchEmails(query, filters) {
        const must = [];
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
        }
        catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }
    async getAllEmails(accountId, folder) {
        const must = [];
        if (accountId)
            must.push({ term: { accountId } });
        if (folder)
            must.push({ term: { folder } });
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
        }
        catch (error) {
            console.error('Get all emails error:', error);
            return [];
        }
    }
    async getEmailById(emailId) {
        try {
            const result = await esClient.get({
                index: this.indexName,
                id: emailId
            });
            return result._source;
        }
        catch (error) {
            console.error('Get email error:', error);
            return null;
        }
    }
    async deleteEmail(emailId) {
        try {
            await esClient.delete({
                index: this.indexName,
                id: emailId
            });
        }
        catch (error) {
            console.error('Delete email error:', error);
        }
    }
    async getStats(accountId) {
        const must = [];
        if (accountId)
            must.push({ term: { accountId } });
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
        }
        catch (error) {
            console.error('Get stats error:', error);
            return null;
        }
    }
}
exports.ElasticsearchService = ElasticsearchService;
exports.default = new ElasticsearchService();
//# sourceMappingURL=ElasticsearchService.js.map