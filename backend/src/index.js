"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// backend/src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const emailRoutes_1 = __importDefault(require("./routes/emailRoutes"));
const database_1 = require("./config/database");
const elasticsearch_1 = require("./config/elasticsearch");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, cors_1.default)({
    origin: 'http://localhost:3001',
    credentials: true
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});
// Routes
app.use('/api/emails', emailRoutes_1.default);
// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: {
            api: 'running',
            elasticsearch: 'connected',
            database: 'connected'
        }
    });
});
// Root route
app.get('/', (req, res) => {
    res.json({
        name: 'Email Onebox API',
        version: '1.0.0',
        endpoints: {
            emails: '/api/emails',
            health: '/health'
        }
    });
});
// Initialize services
async function initializeServices() {
    console.log('🚀 Initializing services...');
    // Initialize Database
    try {
        await (0, database_1.initializeDatabase)();
        console.log('✅ Database initialized');
    }
    catch (dbError) {
        console.error('❌ Database initialization failed:', dbError);
        throw dbError; // Database is critical, exit if it fails
    }
    // Initialize Elasticsearch (optional - don't fail if it's not available)
    try {
        await (0, elasticsearch_1.initializeIndex)();
        console.log('✅ Elasticsearch initialized');
    }
    catch (esError) {
        console.warn('⚠️ Elasticsearch initialization failed');
        console.warn('⚠️ Continuing without Elasticsearch...');
        console.warn('⚠️ Error:', esError.message);
    }
    console.log('✅ Services initialized\n');
}
// Start server
async function startServer() {
    try {
        await initializeServices();
        app.listen(PORT, () => {
            console.log(`\n🎉 Server running on http://localhost:${PORT}`);
            console.log(`📧 API available at http://localhost:${PORT}/api`);
            console.log(`🏥 Health check at http://localhost:${PORT}/health\n`);
        });
    }
    catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}
// Error handling
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: err.message || 'Internal server error'
    });
});
// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});
// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map