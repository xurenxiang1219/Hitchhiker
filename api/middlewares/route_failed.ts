import { Message } from '../common/message';
import { Log } from '../utils/log';

export default function routeFailed(): (ctx: any, next: Function) => Promise<void> {
    return async (ctx, next) => {
        Log.info(`api 不存在 ....${ctx.url}`)
        ctx.body = { success: false, message: Message.get('apiNotExist') };
        return await next();
    };
}