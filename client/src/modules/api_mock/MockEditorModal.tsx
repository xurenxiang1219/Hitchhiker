import React from 'react';
import { Modal, Table, Button, Input, Select, Switch, message } from 'antd';
import { ColumnProps } from 'antd/lib/table';
import { MockMode } from '../../common/enum/mock_mode';

const { Option } = Select;
// 兼容 antd v3 Button 在 TS2.9 下的联合类型推断问题
const AnyButton = Button as any;

// 调试日志开关：仅在开发环境输出日志
const DEBUG = process.env.NODE_ENV !== 'production';

interface Field {
    id: string;
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    mockContent: string; // 统一的Mock内容，自动识别是固定值还是表达式
    description: string;
    parentId?: string;
    level: number;
    // 同一父节点下的排序序号（数值越小越靠前）
    order: number;
}

interface MockEditorModalProps {
    visible?: boolean; // inline 模式可不传
    inline?: boolean; // 是否以内嵌方式渲染（替代 Modal 外壳）
    onCancel?: () => void;
    // 扩展：保存时同时返回 res/preview 以便外层直接持久化
    onSave: (result: { fields: Field[]; mode: MockMode; res: string; preview: string }) => void;
    initialData?: string; // JSON字符串格式的初始mock数据
    // 追加：与旧编辑器一致的控制区
    mockEnabled?: boolean;
    mockUrl?: string;
    onToggleMock?: (enabled: boolean) => void;
    initialMode?: MockMode;
    // 新增：字段描述映射，JSON 字符串，如 { "a.b": "desc" }
    initialFieldDescriptions?: string;
    // 新增：自定义弹窗标题（非 inline 模式生效）
    title?: string;
}

interface MockEditorModalState {
    fields: Field[];
    nextId: number;
    mockMode: MockMode;
    tableScrollY: number;
}

class MockEditorModal extends React.Component<MockEditorModalProps, MockEditorModalState> {
    private tableWrapRef: HTMLDivElement | null = null;

    constructor(props: MockEditorModalProps) {
        super(props);
        this.state = {
            fields: [],
            nextId: 1,
            mockMode: typeof props.initialMode === 'number' ? props.initialMode! : MockMode.template,
            tableScrollY: 550,
        };
    }

    componentDidMount() {
        this.loadInitialData();
        this.calcTableScrollY();
        window.addEventListener('resize', this.calcTableScrollY);
    }

    componentDidUpdate(prevProps: Readonly<MockEditorModalProps>, prevState: Readonly<MockEditorModalState>) {
        // 1) 初始数据/描述变化时，重载字段
        if (
            prevProps.initialData !== this.props.initialData ||
            prevProps.initialFieldDescriptions !== this.props.initialFieldDescriptions
        ) {
            if (DEBUG) {
                try {
                    console.log('[MockEditorModal] props change detected', {
                        prevInitLen: (prevProps.initialData || '').length,
                        nextInitLen: (this.props.initialData || '').length,
                        prevDescLen: (prevProps.initialFieldDescriptions || '').length,
                        nextDescLen: (this.props.initialFieldDescriptions || '').length,
                    });
                } catch {}
            }
            this.loadInitialData();
            // 下一帧再计算高度，避免同步刷新时拿到旧布局
            window.requestAnimationFrame(() => this.calcTableScrollY());
        }

        // 2) 同步外部初始模式到内部 mockMode（例如从 /mock/:id 读取到的 mode）
        if (typeof this.props.initialMode === 'number' && this.props.initialMode !== this.state.mockMode) {
            this.setState({ mockMode: this.props.initialMode });
        }

        // 3) 可见性变化、字段数量变化、模式变化等影响布局时，重新计算高度
        if (prevProps.visible !== this.props.visible
            || prevState.fields.length !== this.state.fields.length
            || prevState.mockMode !== this.state.mockMode
        ) {
            window.requestAnimationFrame(() => this.calcTableScrollY());
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.calcTableScrollY);
    }

    // 动态计算表体可用高度（配合固定表头）
    calcTableScrollY = () => {
        if (!this.tableWrapRef) return;
        const wrap = this.tableWrapRef;
        const wrapHeight = wrap.clientHeight; // 外层容器高度
        // 使用实际表头高度，避免不同主题/版本带来的误差
        let headerH = 56;
        try {
            const header = (wrap.querySelector('.ant-table-header') || wrap.querySelector('.ant-table-thead')) as HTMLElement | null;
            if (header && header.offsetHeight) headerH = header.offsetHeight;
        } catch {}
        const padding = 8; // 边框/内间距等少量空间
        // antd 的 scroll.y 是表体高度，因此需要从容器高度中扣除表头高度
        const y = Math.max(120, wrapHeight - headerH - padding);
        if (this.state.tableScrollY !== y) {
            this.setState({ tableScrollY: y });
        }
    };

    // 加载初始数据
    loadInitialData = () => {
        const { initialData, initialFieldDescriptions } = this.props;
        if (DEBUG) {
            try { console.log('[MockEditorModal] loadInitialData enter', { initLen: (initialData || '').length }); } catch {}
        }
        if (!initialData) {
            this.setState({ fields: [], nextId: 1 });
            if (DEBUG) {
                try { console.log('[MockEditorModal] loadInitialData cleared (no initialData)'); } catch {}
            }
            return;
        }

        try {
            const jsonData = JSON.parse(initialData);
            let fields = this.parseJsonToFields(jsonData);

            // 若有初始字段描述，则按路径映射填充到字段 description；
            // 兼容两种格式：
            // 1) 旧格式 { "a.b": "desc" }
            // 2) 新格式 { "a.b": { description: "desc", type: "string|number|boolean|object|array" } }
            if (initialFieldDescriptions) {
                try {
                    const descMap = JSON.parse(initialFieldDescriptions) as { [path: string]: any };
                    if (DEBUG) {
                        // eslint-disable-next-line no-console
                        console.log('[MockEditorModal] parsed initialFieldDescriptions size:', descMap && typeof descMap === 'object' ? Object.keys(descMap).length : 0,
                            Object.keys(descMap || {}).slice(0, 3).reduce((acc, k) => { acc[k] = (descMap as any)[k]; return acc; }, {} as any));
                    }
                    if (descMap && typeof descMap === 'object') {
                        // 构建 id->field 快速索引，辅助构造路径
                        const idMap: { [id: string]: Field } = {};
                        fields.forEach(f => { idMap[f.id] = f; });
                        const getBaseName = (name: string) => (typeof name === 'string' ? name.split('|')[0] : '');
                        const buildPath = (f: Field): string => {
                            const parts: string[] = [];
                            let cur: Field | undefined = f;
                            while (cur) {
                                parts.push(getBaseName(cur.name));
                                cur = cur.parentId ? idMap[cur.parentId] : undefined;
                            }
                            return parts.reverse().join('.');
                        };
                        fields = fields.map(f => {
                            const p = buildPath(f);
                            const entry = (descMap as any)[p];
                            if (!entry) { return f; }
                            // 兼容字符串与对象
                            if (typeof entry === 'string') {
                                const desc = entry.toString();
                                return desc ? { ...f, description: desc } : f;
                            } else if (typeof entry === 'object') {
                                const desc = (entry.description || '').toString();
                                const next: Field = desc ? { ...f, description: desc } : { ...f };
                                const t = entry.type;
                                const allowed = ['string', 'number', 'boolean', 'object', 'array'];
                                if (t && allowed.indexOf(t) >= 0) {
                                    (next as any).type = t as any;
                                }
                                // 回填排序（若有）
                                if (typeof entry.order === 'number') {
                                    (next as any).order = entry.order;
                                }
                                return next;
                            }
                            return f;
                        });
                        if (DEBUG) {
                            // eslint-disable-next-line no-console
                            console.log('[MockEditorModal] applied descriptions to fields');
                        }
                    }
                } catch (e) {
                    if (DEBUG) {
                        // eslint-disable-next-line no-console
                        console.warn('解析 initialFieldDescriptions 失败:', e);
                    }
                }
            }

            this.setState({ 
                fields, 
                nextId: Math.max(...fields.map(f => parseInt(f.id, 10)), 0) + 1 
            });
            if (DEBUG) {
                try { console.log('[MockEditorModal] loadInitialData parsed', { fieldCount: fields.length }); } catch {}
            }
        } catch (error) {
            console.error('解析初始mock数据失败:', error);
            this.setState({ fields: [], nextId: 1 });
        }
    };

    // 将JSON对象转换为字段数组
    parseJsonToFields = (obj: any, parentId?: string, level: number = 0): Field[] => {
        const fields: Field[] = [];
        let fieldIndex = 1;

        const processValue = (key: string, value: any, currentParentId?: string, currentLevel: number = 0): Field[] => {
            const fieldId = `${currentLevel}_${fieldIndex++}`;
            let type: Field['type'] = 'string';
            const subFields: Field[] = [];

            if (Array.isArray(value)) {
                type = 'array';
                // 处理数组的第一个元素作为模板
                if (value.length > 0) {
                    const arrayItemFields = processValue(`${key}[0]`, value[0], fieldId, currentLevel + 1);
                    subFields.push(...arrayItemFields);
                }
            } else if (typeof value === 'object' && value !== null) {
                type = 'object';
                // 递归处理对象属性
                Object.keys(value).forEach(subKey => {
                    const subFieldResults = processValue(subKey, value[subKey], fieldId, currentLevel + 1);
                    subFields.push(...subFieldResults);
                });
            } else if (typeof value === 'number') {
                type = 'number';
            } else if (typeof value === 'boolean') {
                type = 'boolean';
            }

            const field: Field = {
                id: fieldId,
                name: key,
                type,
                mockContent: typeof value === 'string' ? value : JSON.stringify(value),
                description: '',
                parentId: currentParentId,
                level: currentLevel,
                order: fieldIndex // 初始按出现顺序
            };

            return [field, ...subFields];
        };

        Object.keys(obj).forEach(key => {
            const fieldResults = processValue(key, obj[key], parentId, level);
            fields.push(...fieldResults);
        });

        return fields;
    };

    // 添加字段（支持嵌套）
    handleAddField = (parentId?: string) => {
        const parentField = parentId ? this.state.fields.find(f => f.id === parentId) : null;
        const level = parentField ? (parentField.level || 0) + 1 : 0;
        // 计算同级当前最大 order
        const siblingOrders = this.state.fields.filter(f => (f.parentId || null) === (parentId || null)).map(f => (typeof f.order === 'number' ? f.order : 0));
        const nextOrder = (siblingOrders.length > 0 ? Math.max(...siblingOrders) : 0) + 1;
        
        const newField: Field = {
            id: this.state.nextId.toString(),
            name: `field${this.state.fields.length + 1}`,
            type: 'string',
            mockContent: '@string',
            description: '',
            level,
            parentId,
            order: nextOrder
        };
        
        this.setState({
            fields: [...this.state.fields, newField],
            nextId: this.state.nextId + 1
        });
    }

    // 删除字段（递归删除子字段）
    handleRemoveField = (fieldId: string) => {
        const fieldsToRemove = [fieldId];
        const findChildFields = (id: string) => {
            this.state.fields.forEach(field => {
                if (field.parentId === id) {
                    fieldsToRemove.push(field.id);
                    findChildFields(field.id);
                }
            });
        };
        findChildFields(fieldId);
        
        this.setState({
            fields: this.state.fields.filter(f => fieldsToRemove.indexOf(f.id) === -1)
        });
    }

    // 更新字段
    handleFieldUpdate = (fieldId: string, updates: Partial<Field>) => {
        this.setState({
            fields: this.state.fields.map(field => 
                field.id === fieldId ? { ...field, ...updates } : field
            )
        });
    }

    // 保存处理
    handleOk = () => {
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('保存字段:', this.state.fields);
        }
        // 计算 res/preview（根据当前字段生成 JSON）
        const json = this.generateJSON(this.state.fields);
        const resStr = JSON.stringify(json, null, 2);
        const previewStr = resStr;
        this.props.onSave({ fields: this.state.fields, mode: this.state.mockMode, res: resStr, preview: previewStr });
        if (this.props.onCancel && !this.props.inline) {
            this.props.onCancel();
        }
    }

    // 生成JSON预览
    generateJSON = (fields: Field[]): any => {
        const result: any = {};
        
        // 只处理顶级字段（level为0的字段）
        const topLevelFields = this.state.fields.filter(f => f.level === 0);
        
        topLevelFields.forEach(field => {
            const value = this.buildPreviewValue(field, this.state.fields);
            const { baseName } = this.parseNameRule(field.name);
            result[baseName] = value;
        });
        
        return result;
    };

    // 判断是否为Mock表达式（以@开头）
    isMockExpression = (content: string): boolean => {
        return content.startsWith('@');
    };

    // JSON 语法高亮：为预览输出加入简单颜色
    syntaxHighlight = (json: any): string => {
        const jsonStr = typeof json === 'string' ? json : JSON.stringify(json, null, 2);
        const esc = (s: string) => s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        const colored = esc(jsonStr).replace(/(\".*?\")(:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)|([{}\[\],])/g, (match, str, colon, boolNull, number, punct) => {
            if (str) {
                // 区分键和值：键后紧跟冒号
                if (colon) {
                    return `<span style=\"color:#8e44ad\">${str}</span><span style=\"color:#999\">:</span>`;
                }
                return `<span style=\"color:#27ae60\">${str}</span>`; // 字符串值
            }
            if (typeof boolNull !== 'undefined') {
                return `<span style=\"color:#e67e22\">${boolNull}</span>`;
            }
            if (typeof number !== 'undefined') {
                return `<span style=\"color:#2980b9\">${number}</span>`;
            }
            if (punct) {
                return `<span style=\"color:#34495e\">${punct}</span>`;
            }
            return match;
        });
        return colored;
    };

    // 类型颜色
    typeColor = (t: Field['type']): string => {
        switch (t) {
            case 'string': return '#27ae60';
            case 'number': return '#2980b9';
            case 'boolean': return '#e67e22';
            case 'object': return '#8e44ad';
            case 'array': return '#16a085';
            default: return '#666';
        }
    };

    // 将常见的 Mock 表达式转换为示例值（轻量实现，无第三方依赖）
    evaluateMockExpression = (expr: string): any => {
        const e = (expr || '').trim().toLowerCase();
        const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
        const randFloat = (min: number, max: number, digits: number = 2) => parseFloat((Math.random() * (max - min) + min).toFixed(digits));
        const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
        const now = new Date();

        // 简单解析可能存在的括号参数，如 @integer(1,10)
        const parseArgs = (s: string): string[] => {
            const m = s.match(/^@\w+\((.*)\)$/);
            if (!m) return [];
            return m[1].split(',').map(v => v.trim());
        };

        if (e.startsWith('@string')) {
            const args = parseArgs(expr);
            const len = Math.max(3, Math.min(20, parseInt(args[0], 10) || 8));
            return Array.from({ length: len }, () => pick('abcdefghijklmnopqrstuvwxyz'.split(''))).join('');
        }
        if (e.startsWith('@word')) {
            const words = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'lorem', 'ipsum'];
            return pick(words);
        }
        if (e.startsWith('@sentence')) {
            const words = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipisicing', 'elit'];
            const len = randInt(6, 14);
            return Array.from({ length: len }, () => pick(words)).join(' ') + '.';
        }
        if (e.startsWith('@paragraph')) {
            const lines = randInt(2, 4);
            return Array.from({ length: lines }, () => this.evaluateMockExpression('@sentence')).join(' ');
        }
        if (e.startsWith('@integer')) {
            const args = parseArgs(expr);
            const min = parseInt(args[0], 10);
            const max = parseInt(args[1], 10);
            if (!isNaN(min) && !isNaN(max)) return randInt(min, max);
            return randInt(0, 1000);
        }
        if (e.startsWith('@float')) {
            const args = parseArgs(expr);
            const min = parseFloat(args[0]);
            const max = parseFloat(args[1]);
            const digits = parseInt(args[2], 10) || 2;
            if (!isNaN(min) && !isNaN(max)) return randFloat(min, max, digits);
            return randFloat(0, 1000, digits);
        }
        if (e.startsWith('@boolean')) {
            return Math.random() < 0.5;
        }
        if (e.startsWith('@date')) {
            return now.toISOString().slice(0, 10);
        }
        if (e.startsWith('@datetime') || e.startsWith('@now')) {
            return now.toISOString();
        }
        if (e.startsWith('@url')) {
            return `https://example.com/${randInt(1, 9999)}`;
        }
        if (e.startsWith('@email')) {
            return `user${randInt(1, 9999)}@example.com`;
        }
        if (e.startsWith('@name')) {
            const first = ['John', 'Jane', 'Alex', 'Chris', 'Taylor', 'Jordan'];
            const last = ['Smith', 'Doe', 'Brown', 'Johnson', 'Lee', 'Wang'];
            return `${pick(first)} ${pick(last)}`;
        }
        if (e.startsWith('@cname')) {
            const last = ['张', '王', '李', '赵', '刘', '陈'];
            const given = ['伟', '芳', '娜', '敏', '静', '磊'];
            return `${pick(last)}${pick(given)}`;
        }
        if (e.startsWith('@id') || e.startsWith('@guid')) {
            const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
            return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
        }
        if (e.startsWith('@increment')) {
            // 简易自增：使用时间戳+随机偏移
            return Date.now() + randInt(0, 1000);
        }
        // 未识别的表达式，回退到原样字符串
        return expr;
    };

    // 解析字段名中的规则：如 "list|2" 或 "list|1-3"
    parseNameRule = (name: string): { baseName: string; count?: number; range?: [number, number] } => {
        const parts = name.split('|');
        const baseName = parts[0];
        if (parts.length < 2) return { baseName };
        const rule = parts[1];
        if (!rule) return { baseName };
        if (/^\d+$/.test(rule)) {
            return { baseName, count: parseInt(rule, 10) };
        }
        const m = rule.match(/^(\d+)-(\d+)$/);
        if (m) {
            const min = parseInt(m[1], 10);
            const max = parseInt(m[2], 10);
            return { baseName, range: [min, max] };
        }
        return { baseName };
    };

    // 递归构建预览值
    buildPreviewValue = (field: Field, allFields: Field[]): any => {
        if (field.type === 'object') {
            const obj: any = {};
            const childFields = allFields.filter(f => f.parentId === field.id);
            childFields.forEach(child => {
                const { baseName } = this.parseNameRule(child.name);
                obj[baseName] = this.buildPreviewValue(child, allFields);
            });
            return obj;
        } else if (field.type === 'array') {
            const childFields = allFields.filter(f => f.parentId === field.id);
            if (childFields.length > 0) {
                // 根据字段名中的规则决定数组长度，默认1
                const { count, range } = this.parseNameRule(field.name);
                const desired = typeof count === 'number' ? count : (range ? range[0] : 1);
                const arrayItem = this.buildPreviewValue(childFields[0], allFields);
                return Array.from({ length: Math.max(1, desired) }, () => arrayItem);
            }
            return [];
        } else {
            const content = field.mockContent || '';
            // 自动识别是Mock表达式还是固定值
            if (this.isMockExpression(content)) {
                // 评估表达式并返回示例值
                return this.evaluateMockExpression(content);
            } else {
                // 固定值：根据类型转换
                if (field.type === 'number') {
                    const num = parseFloat(content);
                    return isNaN(num) ? 0 : num;
                } else if (field.type === 'boolean') {
                    return content.toLowerCase() === 'true';
                } else {
                    return content;
                }
            }
        }
    };

    // 获取显示字段（按层级排序：同级使用 order 升序）
    getDisplayFields = (): Field[] => {
        const sortFields = (fields: Field[]): Field[] => {
            const result: Field[] = [];
            
            // 先添加根级字段
            const rootFields = fields
                .filter(f => !f.parentId)
                .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
            
            const addFieldAndChildren = (field: Field) => {
                result.push(field);
                const children = fields
                    .filter(f => f.parentId === field.id)
                    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
                children.forEach(addFieldAndChildren);
            };
            
            rootFields.forEach(addFieldAndChildren);
            return result;
        };
        
        return sortFields(this.state.fields);
    }

    // 上移/下移：仅在同级范围内交换 order
    private moveUp = (fieldId: string) => {
        const fields = [...this.state.fields];
        const target = fields.find(f => f.id === fieldId);
        if (!target) return;
        const siblings = fields
            .filter(f => (f.parentId || null) === (target.parentId || null))
            .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
        const idx = siblings.findIndex(f => f.id === fieldId);
        if (idx <= 0) return;
        const prev = siblings[idx - 1];
        const tOrder = typeof target.order === 'number' ? target.order : idx;
        const pOrder = typeof prev.order === 'number' ? prev.order : idx - 1;
        target.order = pOrder;
        prev.order = tOrder;
        this.setState({ fields });
    }

    private moveDown = (fieldId: string) => {
        const fields = [...this.state.fields];
        const target = fields.find(f => f.id === fieldId);
        if (!target) return;
        const siblings = fields
            .filter(f => (f.parentId || null) === (target.parentId || null))
            .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name));
        const idx = siblings.findIndex(f => f.id === fieldId);
        if (idx === -1 || idx >= siblings.length - 1) return;
        const next = siblings[idx + 1];
        const tOrder = typeof target.order === 'number' ? target.order : idx;
        const nOrder = typeof next.order === 'number' ? next.order : idx + 1;
        target.order = nOrder;
        next.order = tOrder;
        this.setState({ fields });
    }

    // 表格列定义
    getColumns = (): ColumnProps<Field>[] => {
        return [
            {
                title: '排序',
                key: 'order',
                width: 70,
                render: (text: any, record: Field) => (
                    <div style={{ display: 'flex', gap: 4 }}>
                        <AnyButton size="small" htmlType="button" onClick={() => this.moveUp(record.id)} icon="up" />
                        <AnyButton size="small" htmlType="button" onClick={() => this.moveDown(record.id)} icon="down" />
                    </div>
                )
            },
            {
                title: '字段名称',
                dataIndex: 'name',
                key: 'name',
                width: 180,
                render: (text: string, record: Field) => (
                    <div style={{ paddingLeft: record.level * 20 }}>
                        <Input
                            value={text}
                            onChange={(e) => this.handleFieldUpdate(record.id, { name: e.target.value })}
                            placeholder="字段名称"
                            size="small"
                        />
                    </div>
                )
            },
            {
                title: '类型',
                dataIndex: 'type',
                key: 'type',
                width: 80,
                render: (text: string, record: Field) => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, backgroundColor: this.typeColor(record.type) }} />
                        <Select
                            value={text}
                            onChange={(value) => this.handleFieldUpdate(record.id, { type: value as any })}
                            size="small"
                            style={{ width: '100%' }}
                        >
                            <Option value="string">String</Option>
                            <Option value="number">Number</Option>
                            <Option value="boolean">Boolean</Option>
                            <Option value="object">Object</Option>
                            <Option value="array">Array</Option>
                        </Select>
                    </div>
                )
            },
            {
                title: 'Mock内容',
                dataIndex: 'mockContent',
                key: 'mockContent',
                width: 240,
                render: (text: string, record: Field) => {
                    if (record.type === 'object' || record.type === 'array') {
                        return <span style={{ color: '#999' }}>-</span>;
                    }
                    
                    return (
                        <Input
                            value={text || ''}
                            onChange={(e) => this.handleFieldUpdate(record.id, { mockContent: e.target.value })}
                            placeholder="输入固定值或Mock表达式（如@string）"
                            size="small"
                            addonAfter={
                                <Select
                                    value={undefined}
                                    placeholder="快捷选择"
                                    onChange={(value) => this.handleFieldUpdate(record.id, { mockContent: value as string })}
                                    size="small"
                                    style={{ width: 100 }}
                                    dropdownMatchSelectWidth={true}
                                >
                                    <Option value="@string">@string</Option>
                                    <Option value="@integer">@integer</Option>
                                    <Option value="@float">@float</Option>
                                    <Option value="@boolean">@boolean</Option>
                                    <Option value="@date">@date</Option>
                                    <Option value="@datetime">@datetime</Option>
                                    <Option value="@now">@now</Option>
                                    <Option value="@url">@url</Option>
                                    <Option value="@email">@email</Option>
                                    <Option value="@name">@name</Option>
                                    <Option value="@cname">@cname</Option>
                                    <Option value="@word">@word</Option>
                                    <Option value="@sentence">@sentence</Option>
                                    <Option value="@paragraph">@paragraph</Option>
                                    <Option value="@id">@id</Option>
                                    <Option value="@guid">@guid</Option>
                                    <Option value="@increment">@increment</Option>
                                </Select>
                            }
                        />
                    );
                }
            },
            {
                title: '描述',
                dataIndex: 'description',
                key: 'description',
                width: 160,
                render: (text: string, record: Field) => (
                    <Input
                        value={text}
                        onChange={(e) => this.handleFieldUpdate(record.id, { description: e.target.value })}
                        placeholder="字段描述"
                        size="small"
                    />
                )
            },
            {
                title: '操作',
                key: 'action',
                width: 60,
                render: (text: any, record: Field) => (
                    <div>
                        {(record.type === 'object' || record.type === 'array') && (
                            <AnyButton
                                size="small"
                                htmlType="button"
                                onClick={() => this.handleAddField(record.id)}
                                style={{ padding: '0 4px' }}
                            >
                                +
                            </AnyButton>
                        )}
                        <AnyButton
                            size="small"
                            htmlType="button"
                            onClick={() => this.handleRemoveField(record.id)}
                            style={{ padding: '0 4px', color: '#ff4d4f' }}
                        >
                            -
                        </AnyButton>
                    </div>
                )
            }
        ];
    }

render() {
    const displayFields = this.getDisplayFields();
    const jsonPreview = this.generateJSON(this.state.fields);

    const content = (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 顶部控制区：Mock 模式 / 开关 / URL 与旧编辑器保持一致 */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <label>Mock模式：</label>
                    <Select
                        value={this.state.mockMode}
                        onChange={(val: MockMode) => this.setState({ mockMode: val })}
                        style={{ width: 200, marginLeft: 10 }}
                        size="small"
                    >
                        <Option value={MockMode.template}>MockJS模板</Option>
                        <Option value={MockMode.nativelData}>原生数据</Option>
                    </Select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 16, gap: 12 }}>
                    <span style={{ color: '#666' }}>开启 Mock：</span>
                    <Switch
                        checked={!!this.props.mockEnabled}
                        onChange={(val) => this.props.onToggleMock && this.props.onToggleMock(val)}
                        size="small"
                    />
                    <span style={{ color: '#666', marginLeft: 12 }}>Mock URL：</span>
                    <Input
                        style={{ width: 320 }}
                        size="small"
                        readOnly
                        placeholder="未配置"
                        value={this.props.mockUrl || ''}
                    />
                    <AnyButton
                        size="small"
                        htmlType="button"
                        onClick={async () => {
                            try {
                                const url = this.props.mockUrl;
                                if (!url) { return; }
                                if (navigator.clipboard && navigator.clipboard.writeText) {
                                    await navigator.clipboard.writeText(url);
                                } else {
                                    const ta = document.createElement('textarea');
                                    ta.value = url;
                                    document.body.appendChild(ta);
                                    ta.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(ta);
                                }
                                message.success('Mock URL 已复制');
                            } catch {
                                message.error('复制失败');
                            }
                        }}
                        disabled={!this.props.mockUrl}
                    >复制</AnyButton>
                    {this.props.inline && (
                        <AnyButton
                            type="primary"
                            size="small"
                            htmlType="button"
                            onClick={this.handleOk}
                            style={{ marginLeft: 12 }}
                        >保存</AnyButton>
                    )}
                </div>
            </div>

            <div style={{ display: 'flex', height: 'calc(100% - 44px)', gap: '20px' }}>
                <div style={{ width: '940px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0 }}>字段结构编辑</h4>
                        <AnyButton
                            type="primary"
                            size="small"
                            htmlType="button"
                            onClick={() => this.handleAddField()}
                        >
                            添加根字段
                        </AnyButton>
                    </div>
                    <div
                        ref={(el) => { this.tableWrapRef = el; }}
                        style={{ 
                            flex: 1, 
                            border: '1px solid #d9d9d9', 
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}
                    >
                        <Table
                            dataSource={displayFields}
                            columns={this.getColumns()}
                            pagination={false}
                            size="small"
                            rowKey="id"
                            scroll={{ y: this.state.tableScrollY }}
                        />
                    </div>
                </div>

                {/* 右侧JSON预览区 */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '400px', maxWidth: '400px' }}>
                    <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ margin: 0 }}>JSON预览</h4>
                    </div>
                    <div style={{ 
                        flex: 1, 
                        border: '1px solid #d9d9d9', 
                        borderRadius: '4px',
                        padding: '16px',
                        backgroundColor: '#f8f9fa',
                        overflow: 'auto'
                    }}>
                        <pre style={{ 
                            margin: 0, 
                            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                            fontSize: '13px',
                            lineHeight: '1.6',
                            whiteSpace: 'pre',
                            wordWrap: 'normal'
                        }}
                            dangerouslySetInnerHTML={{ __html: this.syntaxHighlight(JSON.stringify(jsonPreview, null, 2)) }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );

    if (this.props.inline) {
        return (
            <div style={{ height: '74vh', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 20 }}>
                {content}
            </div>
        );
    }

    return (
        <Modal
            title={this.props.title || 'Mock编辑器 - 树形结构编辑'}
            visible={!!this.props.visible}
            onCancel={this.props.onCancel}
            onOk={this.handleOk}
            okText="保存"
            cancelText="取消"
            width={1400}
            bodyStyle={{ padding: '20px', height: '73vh', minHeight: 560, maxHeight: '85vh', overflow: 'hidden' }}
        >
            <div style={{ height: '100%' }}>
                {content}
            </div>
        </Modal>
    );
}

}
export default MockEditorModal;
