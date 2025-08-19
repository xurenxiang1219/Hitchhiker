import * as _ from 'lodash';
import { DtoRecord } from '../common/interfaces/dto_record';

export interface MockTemplate {
    [key: string]: any;
}

export interface ResponseStructureItem {
    level: number;
    key: string;
    type: string;
    description: string;
    sample: string;
    required?: boolean;
}

export class MockGenerator {
    
    /**
     * 根据API记录生成mock模板
     */
    static generateMockTemplate(record: DtoRecord): MockTemplate {
        // 基础响应结构
        const baseTemplate = {
            status: 'success',
            err_code: '',
            err_msg: '',
            data: null
        };

        // 根据API类型和名称推断数据结构
        const dataTemplate = this.inferDataStructure(record);
        
        return {
            ...baseTemplate,
            data: dataTemplate
        };
    }

    /**
     * 根据记录推断数据结构
     */
    private static inferDataStructure(record: DtoRecord): any {
        const method = (record.method || 'GET').toUpperCase();
        const name = (record.name || '').toLowerCase();
        const url = (record.url || '').toLowerCase();

        // 根据URL路径和方法推断返回数据类型
        if (method === 'GET') {
            if (url.includes('/list') || url.includes('/search') || name.includes('list')) {
                return this.generateListTemplate(name);
            } else if (url.includes('/detail') || url.includes('/:id') || name.includes('detail')) {
                return this.generateDetailTemplate(name);
            } else if (name.includes('count') || name.includes('total')) {
                return '@integer(0, 1000)';
            }
        } else if (method === 'POST') {
            if (name.includes('create') || name.includes('add')) {
                return {
                    id: '@guid',
                    created_at: '@datetime'
                };
            } else if (name.includes('login') || name.includes('auth')) {
                return {
                    token: '@string(32)',
                    expires_in: '@integer(3600, 86400)',
                    user_info: {
                        id: '@guid',
                        name: '@cname',
                        email: '@email'
                    }
                };
            }
        } else if (method === 'PUT' || method === 'PATCH') {
            return {
                id: '@guid',
                updated_at: '@datetime'
            };
        } else if (method === 'DELETE') {
            return {
                deleted_id: '@guid',
                deleted_at: '@datetime'
            };
        }

        // 默认返回通用对象模板
        return this.generateGenericTemplate(name);
    }

    /**
     * 生成列表模板
     */
    private static generateListTemplate(name: string): any {
        const itemTemplate = this.generateItemTemplate(name);
        return {
            'list|5-10': [itemTemplate],
            total: '@integer(50, 500)',
            page: '@integer(1, 10)',
            page_size: '@integer(10, 50)'
        };
    }

    /**
     * 生成详情模板
     */
    private static generateDetailTemplate(name: string): any {
        return this.generateItemTemplate(name);
    }

    /**
     * 生成单个项目模板
     */
    private static generateItemTemplate(name: string): any {
        const baseItem = {
            id: '@guid',
            name: '@ctitle(3, 8)',
            created_at: '@datetime',
            updated_at: '@datetime'
        };

        // 根据名称添加特定字段
        if (name.includes('user')) {
            return {
                ...baseItem,
                email: '@email',
                phone: '@phone',
                avatar: '@image(100x100)',
                status: '@pick(["active", "inactive", "pending"])'
            };
        } else if (name.includes('product')) {
            return {
                ...baseItem,
                price: '@float(10, 1000, 2, 2)',
                description: '@cparagraph(1, 3)',
                category: '@ctitle(2, 4)',
                stock: '@integer(0, 100)'
            };
        } else if (name.includes('order')) {
            return {
                ...baseItem,
                order_no: '@string("upper", 10)',
                amount: '@float(10, 1000, 2, 2)',
                status: '@pick(["pending", "paid", "shipped", "completed", "cancelled"])',
                user_id: '@guid'
            };
        }

        return baseItem;
    }

    /**
     * 生成通用模板
     */
    private static generateGenericTemplate(name: string): any {
        return {
            id: '@guid',
            name: '@ctitle(3, 8)',
            description: '@cparagraph(1, 2)',
            status: '@pick(["active", "inactive"])',
            created_at: '@datetime',
            updated_at: '@datetime'
        };
    }

    /**
     * 解析响应结构为文档表格数据
     */
    static parseResponseStructure(template: any, level: number = 1): ResponseStructureItem[] {
        const result: ResponseStructureItem[] = [];

        if (typeof template === 'object' && template !== null) {
            Object.keys(template).forEach(key => {
                const value = template[key];
                const item = this.analyzeField(key, value, level);
                result.push(item);

                // 递归处理嵌套对象
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // 检查是否是MockJS模板
                    if (!this.isMockJSTemplate(value)) {
                        result.push(...this.parseResponseStructure(value, level + 1));
                    }
                } else if (Array.isArray(value) && value.length > 0) {
                    // 处理数组类型
                    const arrayItem = value[0];
                    if (typeof arrayItem === 'object' && arrayItem !== null) {
                        result.push(...this.parseResponseStructure(arrayItem, level + 1));
                    }
                }
            });
        }

        return result;
    }

    /**
     * 分析字段类型和描述
     */
    private static analyzeField(key: string, value: any, level: number): ResponseStructureItem {
        let type: string = typeof value;
        let description = '';
        let sample = '';
        let required = true;

        // 特殊字段描述
        const fieldDescriptions: { [key: string]: string } = {
            'status': '请求状态',
            'err_code': '错误代码',
            'err_msg': '错误信息',
            'data': '返回数据',
            'id': '唯一标识',
            'name': '名称',
            'title': '标题',
            'description': '描述',
            'created_at': '创建时间',
            'updated_at': '更新时间',
            'deleted_at': '删除时间',
            'email': '邮箱地址',
            'phone': '手机号码',
            'avatar': '头像地址',
            'price': '价格',
            'amount': '金额',
            'total': '总数',
            'page': '页码',
            'page_size': '每页数量',
            'list': '列表数据',
            'token': '访问令牌',
            'expires_in': '过期时间(秒)'
        };

        description = fieldDescriptions[key] || this.generateDescription(key);

        // 分析类型和示例值
        if (typeof value === 'string') {
            if (this.isMockJSTemplate(value)) {
                const mockInfo = this.parseMockJSTemplate(value);
                type = mockInfo.type;
                sample = mockInfo.sample;
            } else {
                type = 'string';
                sample = value;
            }
        } else if (typeof value === 'number') {
            type = Number.isInteger(value) ? 'integer' : 'float';
            sample = value.toString();
        } else if (typeof value === 'boolean') {
            type = 'boolean';
            sample = value.toString();
        } else if (Array.isArray(value)) {
            type = 'array';
            sample = `Array[${value.length}]`;
        } else if (typeof value === 'object' && value !== null) {
            type = 'object';
            sample = 'Object';
        } else {
            type = 'null';
            sample = 'null';
        }

        return {
            level,
            key,
            type,
            description,
            sample,
            required
        };
    }

    /**
     * 判断是否是MockJS模板
     */
    private static isMockJSTemplate(value: any): boolean {
        if (typeof value !== 'string') return false;
        return value.startsWith('@') || value.includes('|');
    }

    /**
     * 解析MockJS模板
     */
    private static parseMockJSTemplate(template: string): { type: string; sample: string } {
        if (template.startsWith('@guid')) {
            return { type: 'string', sample: '550e8400-e29b-41d4-a716-446655440000' };
        } else if (template.startsWith('@string')) {
            return { type: 'string', sample: 'example_string' };
        } else if (template.startsWith('@integer')) {
            return { type: 'integer', sample: '42' };
        } else if (template.startsWith('@float')) {
            return { type: 'float', sample: '3.14' };
        } else if (template.startsWith('@boolean')) {
            return { type: 'boolean', sample: 'true' };
        } else if (template.startsWith('@datetime')) {
            return { type: 'string', sample: '2023-12-01 10:30:00' };
        } else if (template.startsWith('@date')) {
            return { type: 'string', sample: '2023-12-01' };
        } else if (template.startsWith('@time')) {
            return { type: 'string', sample: '10:30:00' };
        } else if (template.startsWith('@email')) {
            return { type: 'string', sample: 'user@example.com' };
        } else if (template.startsWith('@phone')) {
            return { type: 'string', sample: '13800138000' };
        } else if (template.startsWith('@url')) {
            return { type: 'string', sample: 'https://example.com' };
        } else if (template.startsWith('@image')) {
            return { type: 'string', sample: 'https://via.placeholder.com/100x100' };
        } else if (template.startsWith('@cname')) {
            return { type: 'string', sample: '张三' };
        } else if (template.startsWith('@ctitle')) {
            return { type: 'string', sample: '示例标题' };
        } else if (template.startsWith('@cparagraph')) {
            return { type: 'string', sample: '这是一段示例文本内容。' };
        } else if (template.startsWith('@pick')) {
            const match = template.match(/\["([^"]+)"/);
            return { type: 'string', sample: match ? match[1] : 'option1' };
        }

        return { type: 'string', sample: template };
    }

    /**
     * 生成字段描述
     */
    private static generateDescription(key: string): string {
        // 根据字段名推断描述
        if (key.includes('_id') || key.endsWith('Id')) {
            return '关联ID';
        } else if (key.includes('_at') || key.includes('time')) {
            return '时间';
        } else if (key.includes('url') || key.includes('link')) {
            return '链接地址';
        } else if (key.includes('count') || key.includes('num')) {
            return '数量';
        } else if (key.includes('status') || key.includes('state')) {
            return '状态';
        } else if (key.includes('type') || key.includes('category')) {
            return '类型';
        }

        return '字段描述';
    }

    /**
     * 生成示例响应数据
     */
    static generateSampleResponse(template: any): any {
        try {
            // 尝试使用mockjs生成数据，如果没有安装则返回模板
            if (typeof require !== 'undefined') {
                const Mock = require('mockjs');
                return Mock.mock(template);
            }
            return template;
        } catch (error) {
            console.warn('MockJS未安装或加载失败，使用模板数据:', error);
            return template;
        }
    }

    static generateSampleData(record: any): any {
        const template = this.generateMockTemplate(record);
        return this.generateSampleResponse(template);
    }

    /**
     * 简单的mock数据生成（不依赖MockJS库）
     */
    private static mockData(template: any): any {
        if (typeof template === 'string') {
            if (template.startsWith('@')) {
                return this.parseMockJSTemplate(template).sample;
            }
            return template;
        } else if (typeof template === 'object' && template !== null) {
            if (Array.isArray(template)) {
                return template.map(item => this.mockData(item));
            } else {
                const result: any = {};
                Object.keys(template).forEach(key => {
                    // 处理MockJS数组语法 "key|min-max": [template]
                    if (key.includes('|')) {
                        const [realKey, rule] = key.split('|');
                        const value = template[key];
                        if (Array.isArray(value) && value.length > 0) {
                            const [min, max] = rule.split('-').map(n => parseInt(n) || 1);
                            const count = Math.floor(Math.random() * (max - min + 1)) + min;
                            result[realKey] = Array.from({ length: count }, () => this.mockData(value[0]));
                        } else {
                            result[realKey] = this.mockData(value);
                        }
                    } else {
                        result[key] = this.mockData(template[key]);
                    }
                });
                return result;
            }
        }

        return template;
    }
}
