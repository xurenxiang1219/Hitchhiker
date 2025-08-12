import { Logger, configure, getLogger, levels } from 'log4js';
import * as Path from 'path';

export class Log {

    private static logger: Logger;

    static init() {
        configure(Path.join(__dirname, '../../logconfig.json'));
        Log.logger = getLogger('default');
        Log.logger.level = levels.DEBUG;
    }

    static info(info: string) {
        Log.logger.info(info);
    }

    static debug(debug: string) {
        Log.logger.debug(debug);
    }

    static warn(warn: string) {
        Log.logger.warn(warn);
    }

    static error(error: string) {
        Log.logger.error(error);
    }
}