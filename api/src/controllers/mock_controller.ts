import { POST, PUT, DELETE, GET, BodyParam, PathParam, QueryParam, BaseController } from 'webapi-router';
import { ResObject } from '../interfaces/res_object';
import * as Koa from 'koa';
import { SessionService } from '../services/session_service';
import { MockCollectionService } from '../services/mock_collection_service';
import { DtoMockCollection } from '../common/interfaces/dto_mock_collection';
import { DtoMock } from '../common/interfaces/dto_mock';
import { MockService } from '../services/mock_service';
import { Message } from '../utils/message';
import { CollectionService } from '../services/collection_service';
import { ConnectionManager } from '../services/connection_manager';
import { Mock } from '../models/mock';

export default class MockController extends BaseController {

    @POST('/mock/collection')
    async createCollection(ctx: Koa.Context, @BodyParam collection: DtoMockCollection): Promise<ResObject> {
        const userId = SessionService.getUserId(ctx);
        return await MockCollectionService.create(collection, userId);
    }

    @PUT('/mock/collection')
    async updateCollection(@BodyParam collection: DtoMockCollection): Promise<ResObject> {
        return await MockCollectionService.update(collection);
    }

    @DELETE('/mock/collection/:id')
    async deleteCollection(@PathParam('id') id: string): Promise<ResObject> {
        return await MockCollectionService.delete(id);
    }

    @POST('/mock/collection/ensure-default')
    async ensureDefaultCollection(ctx: Koa.Context, @BodyParam body: { projectId: string }): Promise<ResObject> {
        const userId = SessionService.getUserId(ctx);
        const projectId = body && body.projectId;
        if (!projectId) {
            return { success: false, message: Message.get('projectIdRequired') } as any;
        }
        const collection = await MockCollectionService.ensureDefault(projectId, userId);
        return { success: true, message: Message.get('mockCollectionEnsureSuccess'), id: collection.id } as any;
    }

    @GET('/mock/:id')
    async getById(@PathParam('id') id: string): Promise<ResObject> {
        const mock = await MockService.getById(id, true);
        if (mock) {
            return { success: true, message: '', result: MockService.toDto(mock) };
        }
        return { success: false, message: Message.get('recordNotFound') };
    }

    @GET('/mock/by-key')
    async getByKey(ctx: Koa.Context, @QueryParam('method') method: string, @QueryParam('url') url: string, @QueryParam('collectionId') collectionId: string): Promise<ResObject> {
        if (!method || !url || !collectionId) {
            return { success: false, message: Message.get('parameterInvalid') };
        }
        const userId = SessionService.getUserId(ctx);
        // 允许传入普通 Collection.id，自动映射为 MockCollection.id
        let mockCollectionId = collectionId;
        const mc = await MockCollectionService.getById(collectionId);
        if (!mc) {
            const collection = await CollectionService.getById(collectionId);
            if (collection && collection.project && collection.project.id) {
                const ensured = await MockCollectionService.ensureDefault(collection.project.id, userId);
                mockCollectionId = ensured.id;
            }
        }
        const connection = await ConnectionManager.getInstance();
        const existed = await connection.getRepository(Mock)
            .createQueryBuilder('mock')
            .where('mock.method = :method', { method })
            .andWhere('mock.url = :url', { url })
            .andWhere('mock.collectionId = :collectionId', { collectionId: mockCollectionId })
            .orderBy('mock.updateDate', 'DESC')
            .getOne();
        if (existed) {
            return { success: true, message: '', result: MockService.toDto(existed) };
        }
        return { success: false, message: Message.get('recordNotFound') };
    }

    @POST('/mock')
    async create(ctx: Koa.Context, @BodyParam mock: DtoMock): Promise<ResObject> {
        const userId = SessionService.getUserId(ctx);
        // 临时调试日志：观察前端是否传来字段描述
        try {
            const fd = (mock as any)?.fieldDescriptions;
            console.log('[MockController.create] incoming fieldDescriptions:', fd);
            console.log('[MockController.create] id/method/url/collectionId:', mock && mock.id, mock && mock.method, mock && mock.url, mock && (mock as any).collectionId);
        } catch { /* ignore log errors */ }
        // 预处理：如果前端传的是普通 CollectionId，则映射到默认 MockCollectionId
        if (mock && mock.collectionId) {
            const mc = await MockCollectionService.getById(mock.collectionId);
            if (!mc) {
                const collection = await CollectionService.getById(mock.collectionId);
                if (collection && collection.project && collection.project.id) {
                    const ensured = await MockCollectionService.ensureDefault(collection.project.id, userId);
                    mock.collectionId = ensured.id;
                }
            }
        }
        // Upsert：若未携带 id，但 method+url+collectionId 命中已有记录，则转为 update
        if (!mock.id && mock.method && mock.url && mock.collectionId) {
            const connection = await ConnectionManager.getInstance();
            const existed = await connection.getRepository(Mock)
                .createQueryBuilder('mock')
                .where('mock.method = :method', { method: mock.method })
                .andWhere('mock.url = :url', { url: mock.url })
                .andWhere('mock.collectionId = :collectionId', { collectionId: mock.collectionId })
                .orderBy('mock.updateDate', 'DESC')
                .getOne();
            if (existed) {
                mock.id = existed.id;
                return await this.update(ctx, mock);
            }
        }
        return await MockService.create(MockService.fromDto(mock));
    }

    @PUT('/mock')
    async update(ctx: Koa.Context, @BodyParam record: DtoMock): Promise<ResObject> {
        const userId = SessionService.getUserId(ctx);
        // 临时调试日志：观察前端是否传来字段描述
        try {
            const fd = (record as any)?.fieldDescriptions;
            console.log('[MockController.update] incoming fieldDescriptions:', fd);
            console.log('[MockController.update] id/method/url/collectionId:', record && record.id, record && record.method, record && record.url, record && (record as any).collectionId);
        } catch { /* ignore log errors */ }
        if (record && record.collectionId) {
            const mc = await MockCollectionService.getById(record.collectionId);
            if (!mc) {
                const collection = await CollectionService.getById(record.collectionId);
                if (collection && collection.project && collection.project.id) {
                    const ensured = await MockCollectionService.ensureDefault(collection.project.id, userId);
                    record.collectionId = ensured.id;
                }
            }
        }
        // Upsert for update: 若缺少 id，但 method+url+collectionId 能命中，补齐 id
        if (!record.id && record.method && record.url && record.collectionId) {
            const connection = await ConnectionManager.getInstance();
            const existed = await connection.getRepository(Mock)
                .createQueryBuilder('mock')
                .where('mock.method = :method', { method: record.method })
                .andWhere('mock.url = :url', { url: record.url })
                .andWhere('mock.collectionId = :collectionId', { collectionId: record.collectionId })
                .orderBy('mock.updateDate', 'DESC')
                .getOne();
            if (existed) {
                record.id = existed.id;
            }
        }
        return await MockService.update(MockService.fromDto(record));
    }

    @DELETE('/mock/:id')
    async delete(@PathParam('id') id: string): Promise<ResObject> {
        return await MockService.delete(id);
    }
}