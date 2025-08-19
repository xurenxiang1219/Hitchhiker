import React from 'react';
import { connect } from 'react-redux';
import { State } from '../../state/index';
import { DtoCollection } from '../../common/interfaces/dto_collection';
import { getDocumentDisplayCollectionSelector } from '../../components/collection_tree/selector';
import { DtoRecord } from '../../common/interfaces/dto_record';
import * as _ from 'lodash';
import { DtoHeader } from '../../common/interfaces/dto_header';
import HighlightCode from '../../components/highlight_code';
import './style/index.less';
import { DataMode } from '../../misc/custom_type';
import { ScrollDocumentType, DocumentActiveEnvIdType } from '../../action/document';
import { actionCreator } from '../../action/index';
import { RecordCategory } from '../../misc/record_category';
import { mainTpl } from './templates/default';
import { TemplateUtil } from '../../utils/template_util';
import EnvironmentSelect from '../../components/environment_select';
// use a styled anchor instead of antd Button to avoid typing issues in current @types versions
import { DtoEnvironment } from '../../common/interfaces/dto_environment';
import { noEnvironment } from '../../misc/constants';
import LocalesString from '../../locales/string';
import { StringUtil } from '../../utils/string_util';
import { DownloadUtil } from '../../utils/download_util';
// MockGenerator 回退逻辑已移除，使用后端 preview/fieldDescriptions 为准
import RequestManager from '../../utils/request_manager';

interface DocumentContentStateProps {

    collections: DtoCollection[];

    records: _.Dictionary<_.Dictionary<DtoRecord>>;

    activeKey: string;

    openKeys: string[];

    scrollTop: number;

    changeByScroll: boolean;

    activeEnv: _.Dictionary<string>;

    environments: _.Dictionary<DtoEnvironment[]>;
}

interface DocumentContentDispatchProps {

    onScroll(y: number);
}

type DocumentContentProps = DocumentContentStateProps & DocumentContentDispatchProps;

interface DocumentContentState {
    // 缓存每条记录的 mock 数据与字段描述
    mockSamples: {
        [recordId: string]: {
            sample?: any;
            fieldDesc?: { [path: string]: any };
        }
    };
}

class DocumentContent extends React.Component<DocumentContentProps, DocumentContentState> {

    container: any;

    constructor(props: DocumentContentProps) {
        super(props);
        this.state = { mockSamples: {} };
    }

    private renderParamTable = (rows: Array<{ id?: string, key: string, value?: string, description?: string, tag?: string }>) => (
        <table className="param-table">
            <thead>
                <tr>
                    <th>Parameter</th>
                    <th>Description</th>
                    <th>Sample</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, idx) => (
                    <tr key={r.id || `row-${idx}`}>
                        <td className="param-key">
                            {r.tag ? <span className={`kv-tag kv-${r.tag.toLowerCase()}`}>{r.tag}</span> : null}
                            <span className="mono">{r.key}</span>
                        </td>
                        <td className="param-desc">{r.description || ''}</td>
                        <td className="param-value mono">{r.value || ''}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    // Content-Type 单独不再展示，合并在 Parameter 表格中

    private recordName = (id: string, name?: string, method?: string) => {
        const m = (method || 'GET').toUpperCase();
        return (
            <div className="document-record-name">
                <span className={`method-badge method-${m.toLowerCase()}`}>{m}</span>
                <span className="record-title" id={id}>{name || ''}</span>
            </div>
        );
    }

    // Description/URL 统一在 Overview 表中展示

    private renderDataMutation = (record: DtoRecord) => {
        // 仅使用 DB 中的 preview + fieldDescriptions
        const cached = this.state.mockSamples[record.id];
        let mutations: Array<{ level: number, key: string, type: string, description?: string, sample?: any, required?: boolean }> = [];
        if (cached && cached.sample) {
            const fd = cached.fieldDesc || {};
            mutations = this.buildMutationsFromObject(cached.sample, 1, '', fd);
        } else {
            // 留空
            mutations = [];
        }

        return (
            <div className="section">
                <div className="section-title">Data Mutation</div>
                <table className="param-table">
                    <thead>
                        <tr>
                            <th>Lvl</th>
                            <th>Field</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Sample</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mutations.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.level}</td>
                                <td className="mono" style={{ paddingLeft: `${(item.level - 1) * 20}px` }}>
                                    {item.key}
                                    {item.required === false && <span className="optional-tag">?</span>}
                                </td>
                                <td><span className={`type-tag type-${item.type}`}>{item.type}</span></td>
                                <td>{item.description}</td>
                                <td className="mono">{item.sample}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    private generateSampleOutput = (record: DtoRecord) => {
        // 仅使用 DB 中的示例响应数据；无则留空
        const cached = this.state.mockSamples[record.id];
        if (cached && typeof cached.sample !== 'undefined') {
            return cached.sample;
        }
        return undefined;
    }

    private buildMutationsFromObject(value: any, level: number, prefix: string, fieldDesc: { [path: string]: any }): Array<{ level: number, key: string, type: string, description?: string, sample?: any, required?: boolean }> {
        const rows: Array<{ level: number, key: string, type: string, description?: string, sample?: any, required?: boolean }> = [];
        // 路径描述解析：兼容数组 [0] 与重复段写法（如 app[0] <-> app.app）
        const resolveDesc = (p: string | undefined): string => {
            if (!p || !fieldDesc) return '';
            const pick = (val: any) => typeof val === 'string' ? val : (val && val.description) || '';
            // 1) 精确匹配
            if (fieldDesc[p] !== undefined) return pick(fieldDesc[p]);
            // 2) 去掉 [0]
            const noIndex = p.replace(/\[0\]/g, '');
            if (fieldDesc[noIndex] !== undefined) return pick(fieldDesc[noIndex]);
            // 3) 将 X[0] 替换为 X.X[0]（重复段但保留索引）
            const repeatWithIndex = p.replace(/([^\.\[\]]+)\[0\]/g, '$1.$1[0]');
            if (fieldDesc[repeatWithIndex] !== undefined) return pick(fieldDesc[repeatWithIndex]);
            // 4) 将 X[0] 替换为 X.X（重复段且去索引）
            const repeatSeg = p.replace(/([^\.\[\]]+)\[0\]/g, '$1.$1');
            if (fieldDesc[repeatSeg] !== undefined) return pick(fieldDesc[repeatSeg]);
            return '';
        };
        const typeOf = (v: any): string => {
            if (v === null) return 'null';
            if (Array.isArray(v)) return 'array';
            return typeof v;
        };
        const pushRow = (key: string, v: any) => {
            const path = prefix ? `${prefix}.${key}` : key;
            const t = typeOf(v);
            const desc = resolveDesc(path);
            rows.push({ level, key, type: t, description: desc, sample: typeof v === 'object' ? '' : v });
            if (t === 'object' && v) {
                Object.keys(v).forEach(k => {
                    const child = v[k];
                    const childPrefix = path ? `${path}.${k}` : k;
                    rows.push(...this.buildMutationsFromObject(child, level + 1, childPrefix, fieldDesc));
                });
            } else if (t === 'array') {
                const first = (v as any[])[0];
                const nextPath = `${path}[0]`;
                const descArr = resolveDesc(nextPath);
                if (first && typeof first === 'object') {
                    // 展开第一个元素结构
                    rows.push(...this.buildMutationsFromObject(first, level + 1, nextPath, fieldDesc));
                } else {
                    if (typeof first !== 'undefined') {
                        rows.push({ level: level + 1, key: '[0]', type: typeOf(first), description: descArr, sample: first });
                    }
                }
            }
        };
        if (typeOf(value) === 'object' && value) {
            Object.keys(value).forEach(k => pushRow(k, value[k]));
        } else if (typeOf(value) === 'array') {
            // 当前值为数组：为数组本身推一行，然后展开第一个元素
            const match = prefix ? prefix.match(/([^\.\[\]]+)(?:\[[0-9]+\])?$/) : null;
            const keyName = match ? match[1] : '(root)';
            const desc = resolveDesc(prefix);
            rows.push({ level, key: keyName, type: 'array', description: desc, sample: '' });
            const first = (value as any[])[0];
            const nextPath = `${prefix}[0]`;
            const descArr = resolveDesc(nextPath);
            if (first && typeof first === 'object') {
                rows.push(...this.buildMutationsFromObject(first, level + 1, nextPath, fieldDesc));
            } else if (typeof first !== 'undefined') {
                rows.push({ level: level + 1, key: '[0]', type: typeOf(first), description: descArr, sample: first });
            }
        } else {
            // 叶子节点（原始类型）：使用 prefix 的最后一段作为字段名
            const match = prefix ? prefix.match(/([^\.\[\]]+)(?:\[[0-9]+\])?$/) : null;
            const keyName = match ? match[1] : '(root)';
            const desc = resolveDesc(prefix);
            rows.push({ level, key: keyName, type: typeOf(value), description: desc, sample: typeof value === 'object' ? '' : value });
        }
        return rows;
    }

    private renderBasicInfo = (method?: string, url?: string, description?: string) => {
        const m = (method || 'GET').toUpperCase();
        return (
            <table className="basic-info-table">
                <tbody>
                    <tr>
                        <td className="info-key">Description</td>
                        <td className="info-value">{description || ''}</td>
                    </tr>
                    <tr>
                        <td className="info-key">URL</td>
                        <td className="info-value mono">{url || ''}</td>
                    </tr>
                    <tr>
                        <td className="info-key">Content-Type</td>
                        <td className="info-value">application/json</td>
                    </tr>
                </tbody>
            </table>
        );
    }

    private recordParameters = (headers?: DtoHeader[], queryStrings?: DtoHeader[], formData?: DtoHeader[]) => {
        const rows: Array<{ id?: string, key: string, value?: string, description?: string, tag?: string }> = [];
        (headers || []).filter(h => h.isActive).forEach(h => rows.push({ id: h.id, key: `header ${h.key}`, value: h.value, description: h.description, tag: 'Header' }));
        (queryStrings || []).filter(q => q.isActive).forEach(q => rows.push({ id: q.id, key: `${q.key}`, value: q.value, description: q.description, tag: 'Query' }));
        (formData || []).filter(f => f.isActive).forEach(f => rows.push({ id: f.id, key: `${f.key}`, value: f.value, description: f.description, tag: 'Form' }));
        if (rows.length === 0) { return null; }
        return (
            <div className="document-block">
                <div className="document-header-name">Parameter</div>
                {this.renderParamTable(rows)}
            </div>
        );
    }

    private recordBody = (dataMode?: DataMode, body?: string, formData?: DtoHeader[]) => {
        if (dataMode === DataMode.urlencoded) {
            return formData && formData.length > 0 ? (
                <div className="document-block">
                    <div className="document-header-name">Parameter</div>
                    {this.renderParamTable((formData || []).filter(f => f.isActive).map(f => ({ id: f.id, key: `${f.key}`, value: f.value, description: f.description, tag: 'Form' })))}
                </div>
            ) : '';
        } else {
            return body ? (
                <div className="document-block">
                    <div className="document-header-name">Request Body</div>
                    <div className="document-code">{<HighlightCode code={body || ''} />}</div>
                </div>
            ) : '';
        }
    }

    private getOpenKeys = (props: DocumentContentStateProps) => {
        const { openKeys, collections } = props;
        let keys = [...openKeys];
        if (!keys || keys.length === 0) {
            keys = collections.length > 0 ? [collections[0].id] : [];
        }
        return keys;
    }

    private getActiveCollection = (props: DocumentContentStateProps) => {
        const { collections } = props;
        let keys = this.getOpenKeys(props);
        return collections.find(c => keys.indexOf(c.id) >= 0) || (collections.length > 0 ? collections[0] : null);
    }

    private generateDoc(sortRecords: DtoRecord[]) {

        const { activeEnv, environments } = this.props;
        const activeCollection = this.getActiveCollection(this.props);

        if (!activeCollection) {
            return null;
        }

        const activeProjectId = activeCollection.projectId;

        return (
            <div>
                <div className="document-toolbar">
                    <span>{LocalesString.get('Project.Environments')}: </span>
                    <EnvironmentSelect
                        className="document-toolbar-env"
                        activeEnvId={activeEnv[activeProjectId] || noEnvironment}
                        activeRecordProjectId={activeCollection.projectId}
                        switchEnvType={DocumentActiveEnvIdType}
                        envs={environments[activeProjectId] || []}
                        onlyEnvSelect={true}
                    />
                    <div className="document-toolbar-actions">
                        <a
                            className="ant-btn hh-btn hh-btn--ghost"
                            role="button"
                            onClick={() => this.download()}
                        >
                            {LocalesString.get('Common.Download')}
                        </a>
                        <a
                            className="ant-btn hh-btn hh-btn--ghost"
                            role="button"
                            onClick={() => this.downloadPostman()}
                        >
                            {LocalesString.get('Document.ExportPostman')}
                        </a>
                    </div>
                </div>
                <div ref={ele => this.container = ele} onScroll={this.onScrollDiv} className="document-scroll">
                    <div id="document-main" className="document-main">
                        {
                            sortRecords.filter(r => r.category !== RecordCategory.folder).map(record => {
                                const r = this.applyEnvironmentVariable(record);
                                return (
                                    <div key={r.id} className="document-record card">
                                        <div className="doc-card-header">
                                            {this.recordName(r.id, r.name, r.method)}
                                        </div>

                                        {/* Basic Info Table */}
                                        {this.renderBasicInfo(r.method, r.url, r.description)}

                                        {/* Content-Type 已包含在 Parameter 中，这里不再单独显示 */}

                                        {/* Parameter */}
                                        {this.recordParameters(r.headers, r.queryStrings, r.formDatas)}

                                        {/* Request Body or Form */}
                                        {this.recordBody(r.dataMode, r.body, r.formDatas)}

                                        {/* Data Mutation */}
                                        {this.renderDataMutation(r)}

                                        {/* Sample output */}
                                        <div className="section">
                                            <div className="section-title">Sample output</div>
                                            <div className="document-code sample-output">
                                                {(() => {
                                                    const sample = this.generateSampleOutput(r);
                                                    const codeStr = typeof sample === 'undefined' ? '' : JSON.stringify(sample, null, 2);
                                                    return <HighlightCode code={codeStr} />;
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        }
                    </div>
                </div>
            </div>
        );
    }

    // 预取当前集合内记录的 mock 数据（仅通过 /api/mock/:recordId 获取 preview 与 fieldDescriptions）
    private async prefetchMockForRecords(records: DtoRecord[], _collectionId: string) {
        const updates: DocumentContentState['mockSamples'] = { ...this.state.mockSamples };
        await Promise.all((records || []).filter(r => r.category !== RecordCategory.folder).map(async (r) => {
            try {
                // 仅调用一次，直接取 preview + fieldDescriptions
                const byIdRes = await RequestManager.get(`/api/mock/${r.id}`);
                const byIdJson = await byIdRes.json();
                const result = byIdJson && byIdJson.result ? byIdJson.result : undefined;
                let sample: any = undefined;
                let fieldDesc: { [path: string]: string } | undefined = undefined;
                if (result) {
                    // 解析 preview
                    try {
                        if (typeof result.preview === 'string' && result.preview.length) {
                            sample = JSON.parse(result.preview);
                        }
                    } catch { /* ignore bad preview json */ }
                    // 解析字段描述
                    try {
                        if (typeof result.fieldDescriptions === 'string' && result.fieldDescriptions.length) {
                            fieldDesc = JSON.parse(result.fieldDescriptions);
                        }
                    } catch { /* ignore bad fieldDescriptions json */ }
                }
                updates[r.id] = { sample, fieldDesc };
            } catch { /* ignore single record errors */ }
        }));
        this.setState({ mockSamples: updates });
    }

    // no helpers

    private applyEnvironmentVariable = (r: DtoRecord) => {
        const activeCollection = this.getActiveCollection(this.props);
        if (!activeCollection) {
            return r;
        }

        const env = (this.props.environments[activeCollection.projectId] || []).find(e => e.id === this.props.activeEnv[activeCollection.projectId]);
        const variables = {};
        ((env ? env.variables : []) || []).filter(v => v.isActive).forEach(v => { if (v.key) { variables[v.key] = v.value; } });
        const record = { ...r };

        record.url = StringUtil.applyTemplate(record.url, variables);
        record.body = StringUtil.applyTemplate(record.body, variables);
        record.test = StringUtil.applyTemplate(record.test, variables);
        record.prescript = StringUtil.applyTemplate(record.prescript, variables);

        record.headers = (r.headers || []).map(header => ({
            ...header,
            key: StringUtil.applyTemplate(header.key, variables),
            value: StringUtil.applyTemplate(header.value, variables)
        }));

        record.queryStrings = (r.queryStrings || []).map(queryString => ({
            ...queryString,
            key: StringUtil.applyTemplate(queryString.key, variables),
            value: StringUtil.applyTemplate(queryString.value, variables)
        }));

        record.formDatas = (r.formDatas || []).map(formData => ({
            ...formData,
            key: StringUtil.applyTemplate(formData.key, variables),
            value: StringUtil.applyTemplate(formData.value, variables)
        }));

        return record;
    }

    public shouldComponentUpdate(nextProps: DocumentContentStateProps, _nextState: DocumentContentState) {
        const currentCollection = this.getActiveCollection(this.props);
        const nextCollection = this.getActiveCollection(nextProps);
        const currentEnv = this.props.activeEnv[(currentCollection || { projectId: '' }).projectId];
        const nextEnv = nextProps.activeEnv[(nextCollection || { projectId: '' }).projectId];

        const needUpdate = nextCollection == null ||
            currentCollection == null ||
            nextEnv !== currentEnv ||
            nextCollection.id !== currentCollection.id;

        // 当 state.mockSamples 更新（预取完数据）时需要刷新
        const samplesChanged = _nextState && (_nextState as any).mockSamples !== (this.state as any).mockSamples;
        return needUpdate || samplesChanged;
    }

    public componentDidMount() {
        if (this.container) {
            this.container.scrollTop = this.props.scrollTop;
        }
        const activeCollection = this.getActiveCollection(this.props);
        if (activeCollection) {
            const sortRecords = this.getSortedRecords(activeCollection.id);
            this.prefetchMockForRecords(sortRecords, activeCollection.id);
        }
    }

    public componentDidUpdate(prevProps: DocumentContentStateProps, _prevState: DocumentContentState) {
        const currentCollection = this.getActiveCollection(this.props);
        const prevCollection = this.getActiveCollection(prevProps);
        if (prevCollection != null &&
            currentCollection != null &&
            prevCollection.id !== currentCollection.id) {
            if (this.container) { this.container.scrollTop = 0; }
            // 集合切换时预取 mock
            const sortRecords = this.getSortedRecords(currentCollection.id);
            this.prefetchMockForRecords(sortRecords, currentCollection.id);
        }
    }

    private onScrollDiv = (e: React.UIEvent<HTMLDivElement>) => {
        this.props.onScroll((e.currentTarget as HTMLDivElement).scrollTop);
    }

    private getSortedRecords = (collectionId: string | null, useForDownload: boolean = false) => {
        if (!collectionId || !this.props.records[collectionId]) {
            return [];
        }
        let sortRecords = _.chain(this.props.records[collectionId]).values().sortBy(['category', 'name']).value() as DtoRecord[];
        let topLvRecords = sortRecords.filter(r => !r.pid);
        for (let i = topLvRecords.length - 1; i >= 0; i--) {
            if (topLvRecords[i].category === RecordCategory.folder) {
                let children = sortRecords.filter(r => r.pid === topLvRecords[i].id);
                if (useForDownload) {
                    topLvRecords[i].children = children;
                } else {
                    topLvRecords.splice(i + 1, 0, ...children);
                }
            }
        }
        return topLvRecords;
    }

    private download = () => {
        const doc = (document.getElementById('document-main') || { innerHTML: '' }).innerHTML;
        const activeCollection = this.getActiveCollection(this.props);

        if (!activeCollection) {
            return;
        }

        const data = { doc, collectionName: activeCollection.name, records: this.getSortedRecords(activeCollection.id, true) };

        DownloadUtil.download('document.html', TemplateUtil.apply(mainTpl, data), '');
    }

    private downloadPostman = () => {
        const activeCollection = this.getActiveCollection(this.props);
        if (!activeCollection) { return; }
        const records = this.getSortedRecords(activeCollection.id, true) as any[];
        const activeProjectId = activeCollection.projectId;
        const activeEnv = this.props.activeEnv[activeProjectId];
        const env = (this.props.environments[activeProjectId] || []).find(e => e.id === activeEnv);

        const toPmHeaders = (headers?: any[]) =>
            (headers || []).filter(h => h && h.isActive && h.key).map(h => ({ key: String(h.key), value: String(h.value || ''), description: h.description || '' }));

        const toPmQuery = (queries?: any[]) =>
            (queries || []).filter(q => q && q.isActive && q.key).map(q => ({ key: String(q.key), value: String(q.value || ''), description: q.description || '' }));

        const toPmBody = (rec: any) => {
            if (rec.dataMode === 1 /* urlencoded */) {
                const formItems = (rec.formDatas || []).filter(f => f && f.isActive && f.key).map(f => ({ key: String(f.key), value: String(f.value || ''), description: f.description || '', type: 'text' }));
                return formItems.length ? { mode: 'urlencoded', urlencoded: formItems } : undefined;
            }
            const raw = rec.body || '';
            return raw ? { mode: 'raw', raw, options: { raw: { language: 'json' } } } : undefined;
        };

        const safeUrlObj = (rawUrl?: string) => {
            const raw = rawUrl || '';
            try {
                const u = new URL(raw);
                const query: Array<{ key: string; value: string }> = [];
                // older lib.dom typings may not include entries(); use forEach for compatibility
                (u.searchParams as any).forEach((value: string, key: string) => { query.push({ key, value }); });
                return { raw, protocol: u.protocol ? u.protocol.replace(':', '') : undefined, host: u.host ? u.host.split('.') : undefined, path: u.pathname ? u.pathname.split('/').filter(Boolean) : undefined, query };
            } catch {
                return { raw } as any;
            }
        };

        // 合并 headers（忽略大小写去重）
        const mergeHeaders = (base: Array<{ key: string; value: string; description?: string }>, extra: Array<{ key: string; value: string; description?: string }>) => {
            const seen = new Set(base.map(h => h.key.toLowerCase()));
            const merged = base.slice();
            extra.forEach(h => {
                const k = (h.key || '').toLowerCase();
                if (!k) return;
                if (!seen.has(k)) {
                    seen.add(k);
                    merged.push(h);
                }
            });
            return merged;
        };

        const commonHeaders = toPmHeaders((activeCollection.commonSetting && activeCollection.commonSetting.headers) || []);
        void commonHeaders; // common headers are injected via prerequest script, not request.header
        void mergeHeaders; // silence unused, kept for potential future merge logic

        const buildShimLines = (listen: 'prerequest' | 'test') => {
            const lines: string[] = [];
            // 通用变量函数映射
            lines.push(
                'const setEnvVariable = (k, v) => pm.environment.set(String(k), v);',
                'const getEnvVariable = (k) => pm.environment.get(String(k));',
                'const removeEnvVariable = (k) => pm.environment.unset(String(k));',
                'const environment = () => (pm.environment && pm.environment.name && pm.environment.name()) || "";',
            );
            // require 兼容（有限支持 lodash / crypto-js）
            lines.push(
                'const require = (name) => {',
                '  if (name === "lodash" && typeof _ !== "undefined") return _;',
                '  if (name === "crypto-js" && typeof CryptoJS !== "undefined") return CryptoJS;',
                '  throw new Error("require is not supported in Postman sandbox: " + name);',
                '};'
            );
            // 文件函数占位（Postman不支持），保持接口一致
            lines.push(
                'const readFile = () => { throw new Error("readFile is not supported in Postman export"); };',
                'const readFileByReader = () => { throw new Error("readFileByReader is not supported in Postman export"); };',
                'const saveFile = () => { throw new Error("saveFile is not supported in Postman export"); };',
                'const removeFile = () => { throw new Error("removeFile is not supported in Postman export"); };'
            );
            if (listen === 'test') {
                // 响应对象兼容
                lines.push(
                    'const responseBody = pm.response.text();',
                    'let responseObj = null; try { responseObj = pm.response.json(); } catch (e) { responseObj = null; }',
                    'const responseHeaders = pm.response.headers.toObject();',
                    'const responseTime = pm.response.responseTime;'
                );
            }
            return lines;
        };

        const buildFolderEvent = () => {
            const lines: string[] = [...buildShimLines('prerequest')];
            const pres = (activeCollection.commonSetting && activeCollection.commonSetting.prescript) || '';
            if (pres) { lines.push(...String(pres).split('\n')); }
            const hs = (activeCollection.commonSetting && activeCollection.commonSetting.headers) || [];
            hs.filter((h: any) => h && h.key).forEach((h: any) => {
                const key = String(h.key).replace(/`/g, '\\`');
                const val = String(h.value || '').replace(/`/g, '\\`');
                const commentRaw = (h.description || h.remark || h.comment || h.desc || '') as any;
                const comment = commentRaw ? String(commentRaw).replace(/\r?\n/g, ' ').replace(/`/g, '\\`') : '';
                lines.push(`pm.request.headers.add({ key: \`${key}\`, value: \`${val}\` });${comment ? ' // ' + comment : ''}`);
            });
            return lines.length ? [{ listen: 'prerequest', script: { type: 'text/javascript', exec: lines } }] : undefined;
        };

        const mapRecordToItem = (rec: any): any => {
            if (rec.category === 0 /* folder */ || (rec.children && rec.children.length)) {
                return {
                    name: rec.name || 'Folder',
                    event: buildFolderEvent(),
                    item: (rec.children || []).map(mapRecordToItem)
                };
            }
            const applied = this.applyEnvironmentVariable(rec);
            const requestObj = {
                method: (applied.method || 'GET').toUpperCase(),
                header: toPmHeaders(applied.headers),
                url: {
                    ...safeUrlObj(applied.url),
                    query: toPmQuery(applied.queryStrings)
                },
                body: toPmBody(applied)
            };
            // map Authorization header (Bearer) to postman auth
            try {
                const authHeader = (applied.headers || []).find((h: any) => String(h.key || '').toLowerCase() === 'authorization');
                const authVal = authHeader && String(authHeader.value || '');
                if (authVal && authVal.toLowerCase().startsWith('bearer ')) {
                    const token = authVal.substring(7).trim();
                    if (token) {
                        (requestObj as any).auth = { type: 'bearer', bearer: [{ key: 'token', value: token, type: 'string' }] };
                    }
                }
            } catch { /* ignore auth mapping errors */ }
            const events: any[] = [];
            if (applied.prescript) {
                const exec = [...buildShimLines('prerequest'), ...String(applied.prescript).split('\n')];
                events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec } });
            }
            if (applied.test) {
                const exec = [...buildShimLines('test'), ...String(applied.test).split('\n')];
                events.push({ listen: 'test', script: { type: 'text/javascript', exec } });
            }
            const cached = this.state.mockSamples[rec.id];
            const responses: any[] = [];
            if (cached && typeof cached.sample !== 'undefined') {
                const buildFieldDescMarkdown = (fd?: { [path: string]: any }) => {
                    if (!fd) return '';
                    const lines: string[] = ['Field Descriptions:', '', '| Field | Description |', '| --- | --- |'];
                    Object.keys(fd).forEach(k => {
                        const v = fd[k];
                        const desc = typeof v === 'string' ? v : (v && v.description) || '';
                        lines.push(`| ${k} | ${desc} |`);
                    });
                    return lines.join('\n');
                };
                const responseDesc = buildFieldDescMarkdown(cached.fieldDesc);
                // 根据方法与是否有示例体选择更合适的状态码/状态文本
                const m = (requestObj.method || 'GET').toUpperCase();
                let code = 200;
                let status = 'OK';
                const hasBody = typeof cached.sample !== 'undefined' && cached.sample !== null && !(Array.isArray(cached.sample) && cached.sample.length === 0) && !(typeof cached.sample === 'object' && Object.keys(cached.sample || {}).length === 0);
                if (m === 'POST') { code = 201; status = 'Created'; }
                else if ((m === 'DELETE' || m === 'PUT' || m === 'PATCH') && !hasBody) { code = 204; status = 'No Content'; }
                else if (m === 'HEAD' || m === 'OPTIONS') { code = 204; status = 'No Content'; }
                else { code = 200; status = 'OK'; }
                const resp: any = {
                    name: 'Example',
                    originalRequest: requestObj,
                    status,
                    code,
                    header: [{ key: 'Content-Type', value: 'application/json' }],
                    description: responseDesc
                };
                if (code !== 204) {
                    resp.body = JSON.stringify(cached.sample, null, 2);
                }
                responses.push(resp);
            }
            // also attach field descriptions into request description for quick reference
            const requestDesc = (() => {
                const fd = cached && cached.fieldDesc ? cached.fieldDesc : undefined;
                if (!fd) return undefined;
                const md = Object.keys(fd).map(k => {
                    const v = (fd as any)[k];
                    const desc = typeof v === 'string' ? v : (v && v.description) || '';
                    return `- ${k}: ${desc}`;
                }).join('\n');
                return md || undefined;
            })();
            return {
                name: applied.name || '',
                request: requestDesc ? { ...requestObj, description: requestDesc } : requestObj,
                event: events.length ? events : undefined,
                response: responses.length ? responses : undefined
            };
        };

        const hasTopLevelRequests = Array.isArray(records) && records.some((r: any) => !(r && (r.category === 0 || (r.children && r.children.length))));
        const collection = {
            info: {
                name: activeCollection.name || 'API Collection',
                schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
            },
            event: hasTopLevelRequests ? buildFolderEvent() : undefined,
            item: records.map(mapRecordToItem),
            variable: ((env ? env.variables : []) || [])
                .filter((v: any) => v && v.isActive && v.key)
                .map((v: any) => ({ key: String(v.key), value: String(v.value || ''), type: 'string' }))
        };

        DownloadUtil.download(`${(activeCollection.name || 'collection').replace(/\s+/g, '_')}_postman.json`, JSON.stringify(collection, null, 2), 'application/json');
    }

    public render() {
        const activeCollection = this.getActiveCollection(this.props);

        if (!activeCollection) {
            return null;
        }

        const sortRecords = this.getSortedRecords(activeCollection.id);
        return this.generateDoc(sortRecords);
    }
}

const mapStateToProps = (state: State): DocumentContentStateProps => {
    const { collectionsInfo } = state.collectionState;
    const { documentActiveRecord, documentCollectionOpenKeys, scrollTop, changeByScroll, activeEnv } = state.documentState;

    return {
        collections: getDocumentDisplayCollectionSelector()(state),
        records: collectionsInfo.records,
        activeKey: documentActiveRecord,
        openKeys: documentCollectionOpenKeys,
        scrollTop,
        changeByScroll,
        activeEnv,
        environments: state.environmentState.environments
    };
};

const mapDispatchToProps = (dispatch: any): DocumentContentDispatchProps => {
    return {
        onScroll: (scrollTop) => dispatch(actionCreator(ScrollDocumentType, scrollTop))
    };
};

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(DocumentContent);