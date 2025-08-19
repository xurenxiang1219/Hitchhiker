import React from 'react';
import { connect } from 'react-redux';
import { Tabs, Radio, Select, Icon, Checkbox, Button, message, Modal } from 'antd';
import RequestTabExtra from './request_tab_extra';
import { DtoHeader } from '../../../common/interfaces/dto_header';
import { actionCreator } from '../../../action/index';
import { SelectReqTabType } from '../../../action/ui';
import { KeyValueEditMode, DataMode } from '../../../misc/custom_type';
import { nameWithTag } from '../../../components/name_with_tag/index';
import Editor from '../../../components/editor';
import KeyValueList from '../../../components/key_value';
import { UpdateDisplayRecordPropertyType, ChangeCurrentParamType } from '../../../action/record';
import { bodyTypes } from '../../../misc/body_type';
import { defaultBodyType, allParameter, noEnvironment } from '../../../misc/constants';
import { getActiveRecordSelector, getReqActiveTabKeySelector, getHeadersEditModeSelector, getActiveRecordStateSelector, getProjectEnvsSelector, getActiveEnvIdSelector } from './selector';
import { DtoRecord } from '../../../common/interfaces/dto_record';
import { ParameterStatusState } from '../../../state/collection';
import { KeyValueEditType } from '../../../misc/custom_type';
import { State } from '../../../state/index';
import * as _ from 'lodash';
import { ParameterType, ReduceAlgorithmType } from '../../../misc/parameter_type';
import { StringUtil } from '../../../utils/string_util';
import { RequestStatus } from '../../../misc/request_status';
import AssertJsonView from '../../../components/assert_json_view';
import { DtoAssert } from '../../../common/interfaces/dto_assert';
import { DtoEnvironment } from '../../../common/interfaces/dto_environment';
import Msg from '../../../locales';
import CopyToClipboard from 'react-copy-to-clipboard';
import { DtoBodyFormData } from '../../../common/interfaces/dto_variable';
import LocalesString from '../../../locales/string';
import { TabWithDot } from '../../../components/tab_dot';
import { Urls } from '../../../utils/urls';
import { getActiveRecordProjectIdSelector } from '../../../components/environment_select/selector';
import MockEditorModal from '../../api_mock/MockEditorModal';
import { MockMode } from '../../../common/enum/mock_mode';
import RequestManager from '../../../utils/request_manager';

const TabPane = Tabs.TabPane;
const RadioGroup = Radio.Group;
const Option = Select.Option;
// 兼容 antd v3 Button 在 TS2.9 下的联合类型推断问题
const AnyButton = Button as any;

// 调试日志开关：仅在开发环境输出日志
const DEBUG = process.env.NODE_ENV !== 'production';

interface RequestOptionPanelStateProps {

    activeKey: string;

    activeTabKey: string;

    headers?: DtoHeader[];

    formDatas?: DtoBodyFormData[];

    body?: string;

    bodyMode: DataMode;

    test?: string;

    prescript?: string;

    bodyType?: string;

    parameters?: string;

    parameterType: ParameterType;

    reduceAlgorithm: ReduceAlgorithmType;

    assertInfos?: _.Dictionary<DtoAssert[]>;

    headersEditMode: KeyValueEditMode;

    favHeaders: DtoHeader[];

    currentParam: string;

    paramReqStatus?: ParameterStatusState;

    envs: DtoEnvironment[];

    currentEnv: string;

    resBody?: string;
    record: DtoRecord;
    activeProjectId: string;
}


interface RequestOptionPanelDispatchProps {

    selectReqTab(recordId: string, tab: string);

    changeRecord(value: { [key: string]: any });

    updateCurrentParam(rid: string, param: string);
}

type RequestOptionPanelProps = RequestOptionPanelStateProps & RequestOptionPanelDispatchProps;

interface RequestOptionPanelState { 
    initialTemplate?: string;
    mockEnabled?: boolean;
    autoFilledOnce?: boolean;
    templateActionNonce?: number;
    mockCollectionId?: string;
    currentMockId?: string;
    hasExistingMock?: boolean;
    mockPreview?: any;
    mockPreviewLoading?: boolean;
    showNewMockEditor?: boolean;
    initialFieldDescriptions?: string;
}

class RequestOptionPanel extends React.Component<RequestOptionPanelProps, RequestOptionPanelState> {

    private bodyEditor: Editor | null;

    public state: RequestOptionPanelState = {
        initialTemplate: undefined,
        mockEnabled: false,
        autoFilledOnce: false,
        templateActionNonce: 0,
        mockCollectionId: undefined,
        currentMockId: undefined,
        hasExistingMock: undefined,
        mockPreview: undefined,
        mockPreviewLoading: false,
    };

    // =============== helpers ===============

    private normalizePath = (p?: string) => {
        if (!p) { return ''; }
        let s = p.trim();
        // 如果是绝对 URL，取 pathname(+search) 部分
        try {
            if (/^https?:\/\//i.test(s)) {
                const u = new URL(s);
                s = u.pathname + (u.search || '');
            }
        } catch (_) { /* ignore */ }
        if (s.startsWith('/')) s = s.slice(1);
        return s;
    }

    private buildMockUrl = (record?: DtoRecord) => {
        if (!record) { return ''; }
        const normalizedPath = this.normalizePath(record.url || '');
        if (!normalizedPath) { return ''; }
        // 优先使用 MockCollectionId（后端规范的 Mock 集合ID）
        const cid = this.state.mockCollectionId || (record as any).collectionId;
        const prefix = ((): string => {
            try { return `${window.location.origin}`; } catch { return ''; }
        })();
        if (cid) {
            return `${prefix}/api/mockapi/${cid}/${normalizedPath}`.replace(/^\/\//, '/');
        }
        // 兼容：无 collectionId 时使用旧路径
        return `${prefix}/api/mockapi/${normalizedPath}`.replace(/^\/\//, '/');
    }

    // 基于字段层级生成 path->meta 映射
    // 路径规则：使用 name 去掉 |rule（如 list|2 => list），父子以点连接；数组不带下标
    // meta 结构：{ description: string, type?: 'string' | 'number' | 'boolean' | 'object' | 'array', order?: number }
    private buildFieldDescriptions(fields: any[]): { [path: string]: { description: string; type?: string; order?: number } } {
        const idMap: { [id: string]: any } = {};
        fields.forEach(f => { idMap[f.id] = f; });

        const getBaseName = (name: string) => (typeof name === 'string' ? name.split('|')[0] : '');
        const buildPath = (f: any): string => {
            const parts: string[] = [];
            let cur: any = f;
            while (cur) {
                parts.push(getBaseName(cur.name));
                cur = cur.parentId ? idMap[cur.parentId] : null;
            }
            return parts.reverse().join('.');
        };

        const map: { [path: string]: { description: string; type?: string; order?: number } } = {};
        fields.forEach(f => {
            const desc = (f.description || '').trim();
            const path = buildPath(f);
            // 当 description 为空但存在类型时也要保存，至少保留 type
            if (path && (desc.length > 0 || f.type || typeof f.order === 'number')) {
                map[path] = { description: desc, type: f.type, order: typeof f.order === 'number' ? f.order : undefined };
            }
        });
        return map;
    }

    private async fetchMockPreview() {
        const { record } = this.props;
        const url = this.buildMockUrl(record);
        if (!url) { this.setState({ mockPreview: undefined, mockPreviewLoading: false }); return; }
        this.setState({ mockPreviewLoading: true });
        try {
            const method = (record && record.method) ? record.method.toUpperCase() : 'GET';
            const resp = await fetch(url, { method });
            const data = await resp.json().catch(() => undefined);
            this.setState({ mockPreview: data, mockPreviewLoading: false });
        } catch (e) {
            this.setState({ mockPreview: undefined, mockPreviewLoading: false });
        }
    }

    shouldComponentUpdate(nextProps: RequestOptionPanelProps, nextState: RequestOptionPanelState) {
        const propsChanged = !_.isEqual(_.omit(this.props, _.functionsIn(this.props)), _.omit(nextProps, _.functionsIn(nextProps)));
        const stateChanged = !_.isEqual(this.state, nextState);
        return propsChanged || stateChanged;
    }

    

    private async tryLoadExistingMock() {
        const { record } = this.props;
        if (!record) { return; }
        // 预清空：防止等待请求期间显示上一次的模板
        if (DEBUG) {
            try { console.log('[RequestOptionPanel] tryLoadExistingMock pre-clear', { rid: record.id }); } catch {}
        }
        this.setState(s => ({
            hasExistingMock: false,
            initialTemplate: '',
            initialFieldDescriptions: undefined,
            templateActionNonce: (s.templateActionNonce || 0) + 1,
        }));
        // 仅使用 /mock/:recordId
        if (record.id) {
            try {
                const resp: any = await RequestManager.get(`${Urls.getUrl('mock')}/${record.id}`);
                const resById = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                if (resById && resById.success && resById.result) {
                    const existed = resById.result;
                    const pretty = this.safePretty(existed.res);
                    if (DEBUG) {
                        // eslint-disable-next-line no-console
                        console.log('[RequestOptionPanel] loaded /mock/:id -> fieldDescriptions(raw):', existed.fieldDescriptions);
                    }
                    this.setState({
                        initialTemplate: pretty,
                        currentMockId: record.id, // 强制以 recordId 作为 mockId 的一对一关联
                        autoFilledOnce: true,
                        hasExistingMock: true,
                        mockEnabled: !!(existed.isEnabled === 1 || existed.isEnabled === true),
                        mockCollectionId: existed.collectionId || (record as any).collectionId,
                        initialFieldDescriptions: existed.fieldDescriptions || undefined,
                    });
                    if (DEBUG) {
                        // eslint-disable-next-line no-console
                        console.log('[RequestOptionPanel] state.initialFieldDescriptions set to:', existed.fieldDescriptions || undefined);
                    }
                    return;
                }
            } catch (e) {
                // 不存在则视为新增
            }
        }
        // 未命中已有 Mock：尝试确保并获取默认 MockCollectionId
        try {
            const { activeProjectId } = this.props;
            if (activeProjectId) {
                const resp: any = await RequestManager.post(Urls.getUrl('mock/collection/ensure-default'), { projectId: activeProjectId });
                const data = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                const ensuredId = data && data.success && (data.id || (data.result && data.result.id));
                this.setState(s => ({ currentMockId: record.id, hasExistingMock: false, mockEnabled: false, mockCollectionId: ensuredId || (record as any).collectionId, initialFieldDescriptions: undefined, initialTemplate: '', templateActionNonce: (s.templateActionNonce || 0) + 1 }));
            } else {
                this.setState(s => ({ currentMockId: record.id, hasExistingMock: false, mockEnabled: false, mockCollectionId: (record as any).collectionId, initialFieldDescriptions: undefined, initialTemplate: '', templateActionNonce: (s.templateActionNonce || 0) + 1 }));
            }
        } catch (_) {
            this.setState(s => ({ currentMockId: record.id, hasExistingMock: false, mockEnabled: false, mockCollectionId: (record as any).collectionId, initialFieldDescriptions: undefined, initialTemplate: '', templateActionNonce: (s.templateActionNonce || 0) + 1 }));
        }
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[RequestOptionPanel] no existing mock, reset initialFieldDescriptions to undefined');
        }
    }

    // 将字段数组转换为JSON对象
    private convertFieldsToJson(fields: any[]): any {
        const result: any = {};
        
        // 只处理顶级字段（level为0的字段）
        const topLevelFields = fields.filter(f => f.level === 0);
        
        topLevelFields.forEach(field => {
            const value = this.buildFieldValue(field, fields);
            result[field.name] = value;
        });
        
        return result;
    }
    
    // 递归构建字段值
    private buildFieldValue(field: any, allFields: any[]): any {
        if (field.type === 'object') {
            const obj: any = {};
            const childFields = allFields.filter(f => f.parentId === field.id);
            childFields.forEach(child => {
                obj[child.name] = this.buildFieldValue(child, allFields);
            });
            return obj;
        } else if (field.type === 'array') {
            const childFields = allFields.filter(f => f.parentId === field.id);
            if (childFields.length > 0) {
                // 返回包含一个元素的数组作为模板
                const arrayItem = this.buildFieldValue(childFields[0], allFields);
                return [arrayItem];
            }
            return [];
        } else {
            const content = field.mockContent || '';
            // 自动识别是Mock表达式还是固定值
            if (content.startsWith('@')) {
                // Mock表达式：返回表达式本身
                return content;
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
    }

    private async saveMock(mockData: { mode: number; res: string; preview?: string; fieldDescriptions?: string }) {
        const { record, activeProjectId } = this.props;
        if (!record) { message.error('无有效的 API 记录'); return; }
        if (!record.id) { message.error('无法保存：缺少 record.id'); return; }
        const payload: any = {
            id: record.id, // 强制使用 record.id 作为 mock.id，确保 /mock/:id 可直接读取
            name: record.name,
            method: record.method,
            // 后端以 apiUrl 存原始 API，url 由后端生成并返回为 Mock URL
            apiUrl: record.url,
            url: record.url, // 兼容旧后端，服务端应覆盖为 mockUrl
            collectionId: this.state.mockCollectionId || (record as any).collectionId,
            pid: activeProjectId, // 明确传入 projectId，后端会规范化到 pid
            mode: mockData.mode,
            res: mockData.res,
            isEnabled: this.state.mockEnabled ? 1 : 0,
            preview: mockData.preview,
            fieldDescriptions: mockData.fieldDescriptions,
        };
        if (DEBUG) {
            // eslint-disable-next-line no-console
            console.log('[RequestOptionPanel] save payload ->', payload);
        }
        try {
            let resp: any;
            if (this.state.hasExistingMock) {
                resp = await RequestManager.put(Urls.getUrl('mock'), payload);
            } else {
                resp = await RequestManager.post(Urls.getUrl('mock'), payload);
            }
            let data: any = null;
            try { data = resp && typeof resp.json === 'function' ? await resp.json() : resp; } catch (_) { /* ignore */ }
            if (DEBUG) {
                // eslint-disable-next-line no-console
                console.log('[RequestOptionPanel] save resp ->', data || resp);
            }
            if (data && data.success) {
                message.success('Mock 已保存');
                // 保存后再查一次，更新 currentMockId，避免后续再次新增
                this.tryLoadExistingMock();
                // 刷新预览
                this.fetchMockPreview();
            } else if (resp && resp.ok) {
                // 兼容后端未包裹 success 的情况
                message.success('Mock 已保存');
                this.tryLoadExistingMock();
                this.fetchMockPreview();
            } else {
                message.error((data && data.message) || '保存失败');
            }
        } catch (e) {
            message.error('保存失败');
        }
    }

    private onTabChanged = (key) => {
        this.props.selectReqTab(this.props.activeKey, key);
    }

    public componentDidUpdate(prevProps: RequestOptionPanelProps, prevState: RequestOptionPanelState) {
        if (this.bodyEditor) {
            this.bodyEditor.forceUpdate();
        }
        // 进入 Mock 页签或关键键(method/url/collectionId)变化时，尝试按键加载已有 Mock
        if (this.props.activeTabKey === 'mock') {
            const prevKey = prevProps && prevProps.record ? `${prevProps.record.method}::${prevProps.record.url}::${(prevProps.record as any).collectionId}` : '';
            const currKey = this.props.record ? `${this.props.record.method}::${this.props.record.url}::${(this.props.record as any).collectionId}` : '';
            const tabSwitched = prevProps.activeTabKey !== 'mock' && this.props.activeTabKey === 'mock';
            const keyChanged = prevKey !== currKey;
            if (tabSwitched || keyChanged) {
                this.tryLoadExistingMock();
            }
        }
        // API 请求成功且无 mock 时，提示快速填充（可配置自动执行）
        const prevBody = prevProps.resBody;
        const currBody = this.props.resBody;
        const justGotValidJson = (!prevBody || prevBody === '') && !!currBody && this.canParseJson(currBody);
        const noMock = this.state.hasExistingMock === false;
        if (justGotValidJson && noMock && !this.state.autoFilledOnce) {
            const autoKey = 'mock.autoFillOnSuccess';
            const auto = ((): boolean => {
                try { return localStorage.getItem(autoKey) === '1'; } catch { return false; }
            })();
            const doFill = () => this.setState(s => ({ initialTemplate: this.safePretty(currBody), templateActionNonce: (s.templateActionNonce || 0) + 1, autoFilledOnce: true }));
            if (auto) {
                doFill();
            } else {
                Modal.confirm({
                    title: '使用当前响应快速生成 Mock 模板？',
                    content: '检测到请求成功且该 API 尚未配置 Mock，是否用本次响应一键填充 Mock 模板？',
                    okText: '立即填充',
                    cancelText: '跳过',
                    onOk: doFill,
                    okType: 'primary',
                    // 提供“记住设置”的二次弹窗
                    onCancel: () => { /* ignore */ },
                });
            }
        }

        // Also prompt when switching into Mock tab with an existing response
        if (
            prevProps.activeTabKey !== 'mock' && this.props.activeTabKey === 'mock' &&
            !this.state.autoFilledOnce && !this.state.initialTemplate && this.props.resBody
        ) {
            const pretty = this.safePretty(this.props.resBody);
            if (pretty) {
                Modal.confirm({
                    title: '使用当前响应填充 Mock 模板？',
                    content: '当前 API 已有成功响应且未设置 Mock 模板，是否一键填充为可编辑模板？',
                    okText: '填充模板',
                    cancelText: '稍后',
                    onOk: () => {
                        this.setState({ initialTemplate: pretty, autoFilledOnce: true });
                        message.success('已用当前响应初始化 Mock 模板');
                    },
                    onCancel: () => this.setState({ autoFilledOnce: true }),
                });
            }
        }
    }

    private onHeadersChanged = (data: DtoHeader[]) => {
        data.forEach((v, i) => v.sort = i);
        this.props.changeRecord({ headers: data });
    }

    private currentBodyType = () => this.props.bodyType || defaultBodyType;

    private onCurrentParamChanged = (value) => {
        this.props.updateCurrentParam(this.props.activeKey, value);
    }

    private currentParam = (arr: any[]) => {
        const { currentParam } = this.props;
        const currParam = arr[Number.parseInt(currentParam)] ? currentParam : allParameter;
        let paramStr = '';
        if (currParam === allParameter) {
            paramStr = arr.map(a => this.generateParamStr(a)).join('\n');
        } else {
            paramStr = this.generateParamStr(arr[Number.parseInt(currentParam)]);
        }
        return (
            <span>
                <Select className="req-res-tabs-param-title-select" dropdownMatchSelectWidth={false} value={currParam} onChange={this.onCurrentParamChanged}>
                    <Option key={allParameter} value={allParameter}>{Msg('Collection.AllParameter')}</Option>
                    {
                        arr.map((e, i) => (
                            <Option key={i.toString()} value={i.toString()}>
                                {this.getParamStatusIcon(StringUtil.toString(e))}
                                {StringUtil.toString(e)}
                            </Option>
                        ))
                    }
                </Select>
                <CopyToClipboard text={paramStr} onCopy={() => message.success(LocalesString.get('Collection.ParamCopied'), 3)}>
                    <AnyButton
                        className="req-copy-btn"
                        style={{ marginLeft: 4 }}
                        type="primary"
                        htmlType="button"
                        icon="copy"
                    />
                </CopyToClipboard>
            </span>
        );
    }

    private generateParamStr(param: any) {
        return Object.keys(param).map(k => `"{{${k}}}"=="${param[k]}"`).join('&&');
    }

    private getParamStatusIcon = (param: string) => {
        const { paramReqStatus } = this.props;
        if (!paramReqStatus || !paramReqStatus[param]) {
            return '';
        }

        switch (paramReqStatus[param]) {
            case RequestStatus.pending:
                return <Icon type="loading" />;
            case RequestStatus.success:
                return <Icon className="res-panel-pass" type="check" />;
            case RequestStatus.failed:
                return <Icon className="res-panel-fail" type="close" />;
            default:
                return '';
        }
    }

    private hasVaildResponseObj = () => {
        const body = this.props.resBody;
        let isResValid = body != null;
        let obj;
        try {
            obj = JSON.parse(body || '');
        } catch (e) {
            isResValid = false;
        }
        return { isResValid, obj };
    }

    private onFormDataChanged = (data: DtoHeader[]) => {
        data.forEach((v, i) => v.sort = i);
        this.props.changeRecord({ formDatas: data });
    }

    private safePretty = (content?: string) => {
        if (!content) { return undefined; }
        try {
            return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
            return content; // 若不是合法JSON，原样返回以便用户自行调整
        }
    }

    private canParseJson = (content?: string) => {
        if (!content) { return false; }
        try { JSON.parse(content); return true; } catch { return false; }
    }

    public render() {

        const { activeTabKey, headers, formDatas, body, parameters, parameterType, reduceAlgorithm, assertInfos, test, prescript, headersEditMode, favHeaders, envs, currentEnv, bodyMode } = this.props;
        const { isValid, msg } = StringUtil.verifyParameters(parameters || '', parameterType);
        let paramArr = StringUtil.getUniqParamArr(parameters, parameterType, reduceAlgorithm);
        const { isResValid, obj } = this.hasVaildResponseObj();
        const { record } = this.props;

        return (
            <Tabs
                className="req-res-tabs"
                defaultActiveKey="headers"
                activeKey={activeTabKey}
                animated={false}
                onChange={this.onTabChanged}
                tabBarExtraContent={React.createElement(RequestTabExtra as any)}
            >
                <TabPane tab={nameWithTag(Msg('Collection.Headers'), headers ? (Math.max(0, headers.length)).toString() : '')} key="headers">
                    <KeyValueList
                        mode={headersEditMode}
                        onHeadersChanged={this.onHeadersChanged}
                        isAutoComplete={true}
                        headers={_.sortBy(_.cloneDeep(headers) || [], 'sort')}
                        showFav={false}
                        showDescription={true}
                        favHeaders={favHeaders}
                    />
                </TabPane>
                <TabPane
                    tab={<TabWithDot content={LocalesString.get('Collection.Parameters')} show={!!parameters && parameters.length > 0} />}
                    key="parameters"
                >
                    <span className="req-res-tabs-param-title">
                        <RadioGroup onChange={v => this.props.changeRecord({ 'parameterType': (v.target as any).value })} value={parameterType}>
                            <Radio value={ParameterType.ManyToMany}>{ParameterType[ParameterType.ManyToMany]}</Radio>
                            <Radio value={ParameterType.OneToOne}>{ParameterType[ParameterType.OneToOne]}</Radio>
                        </RadioGroup>
                        <Checkbox
                            checked={reduceAlgorithm === ReduceAlgorithmType.pairwise}
                            onChange={e => this.props.changeRecord({ reduceAlgorithm: (e.target as any).checked ? ReduceAlgorithmType.pairwise : ReduceAlgorithmType.none })}
                        >
                            {Msg('Collection.ReduceAlgorithm')}
                        </Checkbox>
                        <span>
                            {isValid ? Msg('Collection.ParameterRequest', { length: paramArr.length }) : msg}
                            {isValid ? this.currentParam(paramArr) : ''}
                        </span>
                    </span>
                    <Editor type="json" fixHeight={true} height={258} value={parameters || ''} onChange={v => this.props.changeRecord({ 'parameters': v })} />
                </TabPane>
                <TabPane
                    tab={<TabWithDot content={LocalesString.get('Collection.Body')} show={(!!body && body.length > 0) || (!!formDatas && formDatas.length > 0)} />}
                    key="body"
                >
                    <RadioGroup style={{ marginBottom: 8 }} onChange={v => this.props.changeRecord({ 'dataMode': (v.target as any).value })} value={bodyMode}>
                        <Radio value={DataMode.urlencoded}>x-www-form-urlencoded</Radio>
                        <Radio value={DataMode.raw}>raw</Radio>
                    </RadioGroup>
                    {
                        bodyMode === DataMode.raw ?
                            <Editor ref={ele => this.bodyEditor = ele} type={bodyTypes[this.currentBodyType()]} fixHeight={true} height={300} value={body} onChange={v => this.props.changeRecord({ 'body': v })} /> :
                            <KeyValueList
                                mode={KeyValueEditType.keyValueEdit}
                                onHeadersChanged={this.onFormDataChanged}
                                isAutoComplete={false}
                                headers={_.sortBy(_.cloneDeep(formDatas) || [], 'sort')}
                                showFav={false}
                                showDescription={true}
                            />
                    }

                </TabPane>
                <TabPane
                    tab={<TabWithDot content={LocalesString.get('Collection.PreRequestScript')} show={!!prescript && prescript.length > 0} />}
                    key="prescript"
                >
                    <Editor type="javascript" height={300} fixHeight={true} value={prescript || ''} onChange={v => this.props.changeRecord({ 'prescript': v })} />
                </TabPane>
                <TabPane
                    tab={<TabWithDot content={LocalesString.get('Collection.Test')} show={!!test && test.length > 0} />}
                    key="test"
                >
                    <Editor type="javascript" height={300} fixHeight={true} value={test} onChange={v => this.props.changeRecord({ 'test': v })} />
                </TabPane>
                <TabPane
                    tab={<TabWithDot content={LocalesString.get('Collection.AssertBaseOnUI')} show={!!assertInfos && Object.keys(assertInfos).length > 0} />}
                    key="assert"
                >
                    {isResValid ? (
                        <div style={{ display: 'flex', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <AssertJsonView height={300} envs={envs} currentEnv={currentEnv} data={obj} assertInfos={assertInfos || {}} onAssertInfosChanged={infos => this.props.changeRecord({ 'assertInfos': infos })} />
                            </div>
                            <div style={{ width: 380 }}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                    <strong>Mock 预览</strong>
                                    <AnyButton size="small" htmlType="button" style={{ marginLeft: 'auto' }} loading={!!this.state.mockPreviewLoading} onClick={() => this.fetchMockPreview()}>刷新</AnyButton>
                                </div>
                                {
                                    this.state.mockPreview ? (
                                        <pre style={{ maxHeight: 300, overflow: 'auto' }}>
{JSON.stringify(this.state.mockPreview, null, 2)}
                                        </pre>
                                    ) : (
                                        <div style={{ color: '#999' }}>暂无可预览的 Mock 数据</div>
                                    )
                                }
                            </div>
                        </div>
                    ) : (
                        <div className="req-opt-assert-invalid">{Msg('Collection.NoValidResponseForAssert')}</div>
                    )}
                </TabPane>
                <TabPane
                    tab={<span>Mock</span>}
                    key="mock"
                >
                    <div style={{ padding: 12 }}>
                        <div style={{ marginBottom: 8 }}>
                            <AnyButton
                                style={{ marginLeft: 8 }}
                                htmlType="button"
                                onClick={() => this.setState(s => ({ showNewMockEditor: true, hasExistingMock: false, initialTemplate: '', initialFieldDescriptions: undefined, templateActionNonce: (s.templateActionNonce || 0) + 1 }), () => this.tryLoadExistingMock())}
                            >
                                编辑Mock
                            </AnyButton>
                            <AnyButton
                                style={{ marginLeft: 8 }}
                                htmlType="button"
                                onClick={() => this.fetchMockPreview()}
                            >
                                刷新预览
                            </AnyButton>
                        </div>
                        <div style={{ color: '#999', marginBottom: 8 }}>点击“编辑Mock”在弹窗中编辑 Mock；下方显示当前 Mock 接口的实时预览。</div>
                        {
                            this.state.mockPreview ? (
                                <pre style={{ maxHeight: 300, overflow: 'auto' }}>
{JSON.stringify(this.state.mockPreview, null, 2)}
                                </pre>
                            ) : (
                                <div style={{ color: '#999' }}>暂无可预览的 Mock 数据</div>
                            )
                        }
                    </div>
                </TabPane>
                
                
                {/* 新的Mock编辑器弹窗 */}
                {this.state.showNewMockEditor && (
                    <MockEditorModal
                        key={`${this.state.hasExistingMock ? 'exist' : 'empty'}-${String(this.state.templateActionNonce || 0)}`}
                        visible={true}
                        title={`Mock编辑器 - ${record && record.name ? record.name : '属性结构编辑'}`}
                        initialData={this.state.initialTemplate}
                        initialMode={MockMode.template}
                        mockEnabled={!!this.state.mockEnabled}
                        mockUrl={this.buildMockUrl(record)}
                        onToggleMock={(val) => this.setState({ mockEnabled: val })}
                        initialFieldDescriptions={this.state.initialFieldDescriptions}
                        onCancel={() => this.setState({ showNewMockEditor: false })}
                        onSave={(result) => {
                            // 直接使用编辑器返回的 res（模板）与 preview（预览快照），避免被重算覆盖
                            // 构建字段描述映射
                            const descMap = this.buildFieldDescriptions(result.fields);
                            const descJson = JSON.stringify(descMap);
                            // 保存到后端
                            this.saveMock({
                                mode: result.mode,
                                res: result.res,
                                preview: result.preview,
                                fieldDescriptions: descJson,
                            });
                            this.setState({ showNewMockEditor: false });
                        }}
                    />
                )}
            </Tabs>
        );
    }

}

function getRes(state: State) {
    const record = getActiveRecordSelector()(state);
    const recordState = getActiveRecordStateSelector()(state);
    const activeKey = state.displayRecordsState.activeKey;
    const { currParam, paramArr } = StringUtil.parseParameters(record.parameters, record.parameterType, recordState.parameter, record.reduceAlgorithm);
    const currParamStr = JSON.stringify(currParam);
    const resState = state.displayRecordsState.responseState[activeKey];
    return !resState ? undefined : (paramArr.length === 0 ? resState['runResult'] : (currParam === allParameter ? resState : resState[currParamStr]));
}

const mapStateToProps = (state: State): RequestOptionPanelStateProps => {
    const record = getActiveRecordSelector()(state);
    const res = getRes(state);
    const envs = getProjectEnvsSelector()(state);
    const currEnvId = getActiveEnvIdSelector()(state);
    const activeProjectId = getActiveRecordProjectIdSelector()(state);
    const favHeaders = _.chain(state.collectionState.collectionsInfo.records)
        .values()
        .map(r => _.values(r))
        .flatten()
        .map(r => r.headers || [])
        .flatten()
        .filter(h => h && !!h.isFav)
        .concat(_.chain(state.displayRecordsState.recordStates)
            .values()
            .map(r => r.record)
            .map(r => r.headers || [])
            .flatten()
            .filter(h => h && !!h.isFav)
            .value())
        .sortedUniqBy(h => `${h.key}::${h.value}`)
        .value();
    return {
        activeKey: state.displayRecordsState.activeKey,
        activeTabKey: getReqActiveTabKeySelector()(state),
        headers: record.headers,
        formDatas: record.formDatas,
        body: record.body,
        bodyMode: record.dataMode === undefined ? DataMode.raw : record.dataMode,
        test: record.test,
        prescript: record.prescript,
        bodyType: record.bodyType,
        parameters: record.parameters,
        parameterType: record.parameterType,
        reduceAlgorithm: record.reduceAlgorithm || ReduceAlgorithmType.none,
        assertInfos: record.assertInfos,
        headersEditMode: getHeadersEditModeSelector()(state),
        currentParam: getActiveRecordStateSelector()(state).parameter,
        favHeaders,
        paramReqStatus: getActiveRecordStateSelector()(state).parameterStatus,
        envs: envs,
        currentEnv: currEnvId || noEnvironment,
        resBody: res ? res.body : undefined,
        record,
        activeProjectId,
    };
};

const mapDispatchToProps = (dispatch: any): RequestOptionPanelDispatchProps => {
    return {
        selectReqTab: (recordId, tab) => dispatch(actionCreator(SelectReqTabType, { recordId, tab })),
        changeRecord: (value) => dispatch(actionCreator(UpdateDisplayRecordPropertyType, value)),
        updateCurrentParam: (id, param) => dispatch(actionCreator(ChangeCurrentParamType, { id, param }))
    };
};

export default (connect as any)(
    mapStateToProps as any,
    mapDispatchToProps as any,
)(RequestOptionPanel as any) as any;