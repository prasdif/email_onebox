"use strict";
// backend/src/routes/index.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const emailRoutes_1 = __importDefault(require("./emailRoutes"));
const accountRoutes_1 = __importDefault(require("./accountRoutes"));
const router = (0, express_1.Router)();
// Mount routes
router.use('/emails', emailRoutes_1.default);
router.use('/accounts', accountRoutes_1.default);
exports.default = router;
//# sourceMappingURL=index.js.map