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
import PerfectScrollbar from 'react-perfect-scrollbar';
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

interface DocumentContentState { }

class DocumentContent extends React.Component<DocumentContentProps, DocumentContentState> {

    container: any;

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

    private renderDataMutation = () => {
        // 解析标准返回结构
        const sampleResponse = {
            status: 'success',
            err_code: '',
            err_msg: '',
            data: null
        };
        
        const mutations = this.extractResponseStructure(sampleResponse, 1);
        
        return (
            <div className="section">
                <div className="section-title">Data Mutation</div>
                <table className="param-table">
                    <thead>
                        <tr>
                            <th>Lvl</th>
                            <th>Output</th>
                            <th>Description</th>
                            <th>Sample</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mutations.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.level}</td>
                                <td className="mono">{item.key}</td>
                                <td>{item.description}</td>
                                <td className="mono">{item.sample}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    private extractResponseStructure = (obj: any, level: number): Array<{
        level: number;
        key: string;
        description: string;
        sample: string;
    }> => {
        const result: Array<{ level: number; key: string; description: string; sample: string; }> = [];
        
        if (typeof obj === 'object' && obj !== null) {
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                let description = '';
                let sample = '';
                
                switch (key) {
                    case 'status':
                        description = '请求状态';
                        sample = 'success';
                        break;
                    case 'err_code':
                        description = '错误代码';
                        sample = '';
                        break;
                    case 'err_msg':
                        description = '错误信息';
                        sample = '';
                        break;
                    case 'data':
                        description = '返回数据';
                        sample = 'null';
                        break;
                    default:
                        description = '';
                        sample = typeof value === 'string' ? value : JSON.stringify(value);
                }
                
                result.push({
                    level,
                    key,
                    description,
                    sample
                });
                
                // 如果是对象且不为null，递归处理子级
                if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
                    result.push(...this.extractResponseStructure(value, level + 1));
                }
            });
        }
        
        return result;
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
            <PerfectScrollbar ref={ele => this.container = ele} onScrollY={this.onScrollY}>
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
                    <a
                        className="ant-btn ant-btn-primary document-toolbar-btn"
                        role="button"
                        onClick={() => this.download()}
                    >
                        {LocalesString.get('Common.Download')}
                    </a>
                </div>
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
                                    {this.renderDataMutation()}

                                    {/* Sample output */}
                                    <div className="section">
                                        <div className="section-title">Sample output</div>
                                        <div className="document-code sample-output">
{<HighlightCode code={JSON.stringify({ status: 'success', err_code: '', err_msg: '', data: null }, null, 2)} />}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    }
                </div>
            </PerfectScrollbar>
        );
    }

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

        return needUpdate;
    }

    public componentDidMount() {
        if (this.container && this.container._container) {
            this.container._container.scrollTop = this.props.scrollTop;
        }
    }

    public componentDidUpdate(prevProps: DocumentContentStateProps, _prevState: DocumentContentState) {
        const currentCollection = this.getActiveCollection(this.props);
        const prevCollection = this.getActiveCollection(prevProps);
        if (prevCollection != null &&
            currentCollection != null &&
            prevCollection.id !== currentCollection.id) {
            this.container._container.scrollTop = 0;
        }
    }

    private onScrollY = ref => {
        this.props.onScroll(ref.scrollTop);
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