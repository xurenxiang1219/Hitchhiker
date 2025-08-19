import { GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS, PathParam, BaseController } from 'webapi-router';
import { MockService } from '../services/mock_service';
import * as Koa from 'koa';
import { SessionService } from '../services/session_service';
import { MockCollectionService } from '../services/mock_collection_service';
import { CollectionService } from '../services/collection_service';

export default class MockApiController extends BaseController {

    // Preferred url rule: /mockapi/:collectionId/.. (avoid cross-project collision)
    @GET('/mockapi/:collectionId/:path*')
    async getWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'GET', path, collectionId);
    }

    @POST('/mockapi/:collectionId/:path*')
    async postWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'POST', path, collectionId);
    }

    @PUT('/mockapi/:collectionId/:path*')
    async putWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'PUT', path, collectionId);
    }

    @DELETE('/mockapi/:collectionId/:path*')
    async deleteWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'DELETE', path, collectionId);
    }

    @PATCH('/mockapi/:collectionId/:path*')
    async patchWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'PATCH', path, collectionId);
    }

    @HEAD('/mockapi/:collectionId/:path*')
    async headWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'HEAD', path, collectionId);
    }

    @OPTIONS('/mockapi/:collectionId/:path*')
    async optionsWithCollection(ctx: Koa.Context, @PathParam('collectionId') collectionId: string, @PathParam('path') path: any) {
        return await this.getMockData(ctx, 'OPTIONS', path, collectionId);
    }

    // Backward-compatible routes without collectionId
    @GET('/mockapi/:path*')
    async get(@PathParam('path') path: any) {
        return await this.getMockDataCompat('GET', path);
    }

    @POST('/mockapi/:path*')
    async post(@PathParam('path') path: any) {
        return await this.getMockDataCompat('POST', path);
    }

    @PUT('/mockapi/:path*')
    async put(@PathParam('path') path: any) {
        return await this.getMockDataCompat('PUT', path);
    }

    @DELETE('/mockapi/:path*')
    async delete(@PathParam('path') path: any) {
        return await this.getMockDataCompat('DELETE', path);
    }

    @PATCH('/mockapi/:path*')
    async patch(@PathParam('path') path: any) {
        return await this.getMockDataCompat('PATCH', path);
    }

    @HEAD('/mockapi/:path*')
    async head(@PathParam('path') path: any) {
        return await this.getMockDataCompat('HEAD', path);
    }

    @OPTIONS('/mockapi/:path*')
    async options(@PathParam('path') path: any) {
        return await this.getMockDataCompat('OPTIONS', path);
    }

    private async mapToMockCollectionId(ctx: Koa.Context, incomingId?: string): Promise<string | undefined> {
        if (!incomingId) { return undefined; }
        // 如果本身就是 MockCollection.id，直接返回
        const mc = await MockCollectionService.getById(incomingId);
        if (mc) { return mc.id; }
        // 否则当作普通 Collection.id，映射到对应项目的默认 MockCollection
        const collection = await CollectionService.getById(incomingId);
        const projectId = (collection as any)?.project?.id;
        if (!projectId) { return undefined; }
        const userId = SessionService.getUserId(ctx);
        const ensured = await MockCollectionService.ensureDefault(projectId, userId);
        return ensured?.id;
    }

    async getMockData(ctx: Koa.Context, method: string, path: string, collectionId?: string) {
        const mapped = await this.mapToMockCollectionId(ctx, collectionId);
        const res = await MockService.getMockRes(method, `mockapi/${path}`, mapped);
        // 成功时直接返回原始 mock 数据，失败时返回标准错误对象
        return res && (res as any).success ? (res as any).result : res;
    }

    // 兼容旧路由：不带 collectionId 的情况
    async getMockDataCompat(method: string, path: string) {
        const res = await MockService.getMockRes(method, `mockapi/${path}`);
        return res && (res as any).success ? (res as any).result : res;
    }
}