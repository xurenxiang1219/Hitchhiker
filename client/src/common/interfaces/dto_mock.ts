import { MockMode } from '../enum/mock_mode';
import { DtoBaseItem } from './dto_record';

export interface DtoMock extends DtoBaseItem {

    mode: MockMode;

    res?: string;

    // 字段级描述信息，JSON 格式存储 { "field.path": "description" }
    fieldDescriptions?: string;
}