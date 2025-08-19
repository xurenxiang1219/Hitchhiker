import React from 'react';
import { connect } from 'react-redux';
import { Tag, Input, message, Tree, Icon } from 'antd';
import { State } from '../../state';
import SiderLayout from '../../components/sider_layout';
import CollectionList from '../../components/collection_tree';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { DtoCollection } from '../../common/interfaces/dto_collection';
import { DtoRecord } from '../../common/interfaces/dto_record';
import MockEditorModal from './MockEditorModal';
import { MockGenerator } from '../../utils/mock_generator';
import './style/index.less';
import { DocumentActiveRecordType, DocumentSelectedProjectChangedType, DocumentCollectionOpenKeysType } from '../../action/document';
import * as _ from 'lodash';
import RequestManager from '../../utils/request_manager';
import { Urls } from '../../utils/urls';

const { Search } = Input;
const { TreeNode } = Tree;

interface ApiMockStateProps {
    collections: DtoCollection[];
    records: _.Dictionary<_.Dictionary<DtoRecord>>;
    activeKey: string;
    openKeys: string[];
    selectedProject: string;
}

interface ApiMockDispatchProps {
}

type ApiMockProps = ApiMockStateProps & ApiMockDispatchProps;

interface ApiMockState {
    selectedCollection: string;
    selectedRecord?: DtoRecord;
    searchText: string;
    isEditorVisible: boolean; // deprecated, kept for compatibility
    currentRecord?: DtoRecord; // deprecated, kept for compatibility
    mockList: any[];
    expandedKeys: string[];
    initialTemplate?: string;
    initialFieldDescriptions?: string;
    initialMode?: number;
    templateActionNonce?: number;
    hasExistingMock?: boolean;
    mockEnabled?: boolean;
    mockCollectionId?: string;
}

class ApiMock extends React.Component<ApiMockProps, ApiMockState> {

    constructor(props: ApiMockProps) {
        super(props);
        this.state = {
            selectedCollection: 'all',
            selectedRecord: undefined,
            searchText: '',
            // deprecated states kept for type compatibility
            isEditorVisible: false,
            currentRecord: undefined,
            mockList: [],
            expandedKeys: [],
            initialTemplate: undefined,
            initialFieldDescriptions: undefined,
            initialMode: undefined,
            templateActionNonce: 0,
            hasExistingMock: undefined,
            mockEnabled: false,
            mockCollectionId: undefined,
        };
    }

    // 与 RequestOptionPanel 保持一致的 URL 归一化与 Mock URL 构造
    private normalizePath = (p?: string) => {
        if (!p) { return ''; }
        let s = (p || '').trim();
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
        const cid = this.state.mockCollectionId || (record as any).collectionId;
        const prefix = ((): string => {
            try { return `${window.location.origin}`; } catch { return ''; }
        })();
        if (cid) {
            return `${prefix}/api/mockapi/${cid}/${normalizedPath}`.replace(/^\/\//, '/');
        }
        return `${prefix}/api/mockapi/${normalizedPath}`.replace(/^\/\//, '/');
    }

    componentDidMount() {
        this.loadMockList();
    }

    componentDidUpdate(prevProps: ApiMockProps) {
        // 当左侧 CollectionList 选中记录变化（documentActiveRecord）时，同步右侧 Mock 面板
        if (this.props.activeKey !== prevProps.activeKey) {
            const record = this.findRecordById(this.props.activeKey);
            this.setState({
                selectedRecord: record,
                currentRecord: record,
                initialTemplate: undefined,
                initialFieldDescriptions: undefined,
                initialMode: undefined,
                hasExistingMock: undefined,
                mockList: [],
                templateActionNonce: (this.state.templateActionNonce || 0) + 1,
            }, async () => {
                if (record) {
                    await this.tryLoadExistingMock(record);
                }
            });
        }

        // 切换项目时，清空已选与右侧数据，避免跨项目残留
        if (this.props.selectedProject !== prevProps.selectedProject) {
            this.setState({
                selectedRecord: undefined,
                currentRecord: undefined,
                initialTemplate: undefined,
                initialFieldDescriptions: undefined,
                initialMode: undefined,
                hasExistingMock: undefined,
                mockList: [],
                mockCollectionId: undefined,
                templateActionNonce: (this.state.templateActionNonce || 0) + 1,
            });
        }
    }

    loadMockList = () => {
        // 这里应该调用API获取所有Mock数据
        // 暂时使用模拟数据
        const mockList = [
            {
                id: '1',
                name: '用户登录Mock',
                method: 'POST',
                url: '/api/user/login',
                collection: 'User API',
                isActive: true,
                createTime: new Date().toISOString()
            },
            {
                id: '2',
                name: '获取用户列表Mock',
                method: 'GET',
                url: '/api/users',
                collection: 'User API',
                isActive: false,
                createTime: new Date().toISOString()
            }
        ];
        this.setState({ mockList });
    }

    handleCollectionChange = (value: string) => {
        this.setState({ selectedCollection: value });
    }

    handleSearch = (value: string) => {
        this.setState({ searchText: value }, () => this.updateExpandedKeysForSearch());
    }

    private updateExpandedKeysForSearch = () => {
        const { collections, records } = this.props;
        const { searchText } = this.state;
        if (!searchText) { 
            // 清空搜索时，折叠所有
            this.setState({ expandedKeys: [] });
            return; 
        }
        const expanded: string[] = [];
        collections.forEach(c => {
            const recs = records[c.id] ? _.uniqBy(_.values(records[c.id]), 'id') : [];
            const hasMatch = recs.some(r =>
                (r.name && r.name.toLowerCase().includes(searchText.toLowerCase())) ||
                (r.url && r.url.toLowerCase().includes(searchText.toLowerCase()))
            );
            if (hasMatch) expanded.push(c.id);
        });
        this.setState({ expandedKeys: expanded });
    }

    // 右侧内联编辑保存
    private handleSaveMock = async (mockData: { mode: number; res: string; preview?: string }) => {
        const { selectedRecord } = this.state;
        if (!selectedRecord) { message.error('请先选择一个 API'); return; }
        if (!selectedRecord.id) { message.error('无法保存：缺少 record.id'); return; }
        const payload: any = {
            id: selectedRecord.id,
            name: selectedRecord.name,
            method: selectedRecord.method,
            // 后端将接受 apiUrl 作为原始 API 路径；url 由后端计算为 Mock URL
            apiUrl: selectedRecord.url,
            url: selectedRecord.url, // 兼容旧后端，后端应覆盖为 mockUrl
            collectionId: this.state.mockCollectionId || (selectedRecord as any).collectionId,
            pid: (selectedRecord as any).pid,
            mode: mockData.mode,
            res: mockData.res,
            isEnabled: this.state.mockEnabled ? 1 : 0,
            preview: mockData.preview,
        };
        // 调试日志：确认实际提交内容
        // eslint-disable-next-line no-console
        console.log('[ApiMock] save payload ->', payload);
        try {
            let resp: any;
            if (this.state.hasExistingMock) {
                resp = await RequestManager.put(Urls.getUrl('mock'), payload);
            } else {
                resp = await RequestManager.post(Urls.getUrl('mock'), payload);
            }
            let data: any = null;
            try { data = resp && typeof resp.json === 'function' ? await resp.json() : resp; } catch (_) { /* ignore */ }
            // eslint-disable-next-line no-console
            console.log('[ApiMock] save resp ->', data || resp);
            if (data && data.success) {
                message.success('Mock 已保存');
                await this.tryLoadExistingMock(selectedRecord);
            } else if (resp && resp.ok) {
                message.success('Mock 已保存');
                await this.tryLoadExistingMock(selectedRecord);
            } else {
                message.error((data && data.message) || '保存失败');
            }
        } catch (e) {
            message.error('保存失败');
        }
    }

    getFilteredRecords = () => {
        const { collections, records } = this.props;
        const { selectedCollection, searchText } = this.state;
        
        let allRecords: DtoRecord[] = [];
        
        collections.forEach(collection => {
            if (selectedCollection === 'all' || collection.id === selectedCollection) {
                const collectionRecords = records[collection.id];
                if (collectionRecords) {
                    allRecords = allRecords.concat(_.values(collectionRecords));
                }
            }
        });

        if (searchText) {
            allRecords = allRecords.filter(record => 
                (record.name && record.name.toLowerCase().includes(searchText.toLowerCase())) ||
                (record.url && record.url.toLowerCase().includes(searchText.toLowerCase()))
            );
        }

        return allRecords;
    }

    // removed legacy renderMockList/renderApiList using Card/List to avoid unused symbol errors

    onSelectRecord = async (selectedKeys: string[], info: any) => {
        if (selectedKeys.length > 0) {
            const recordId = selectedKeys[0];
            const record = this.findRecordById(recordId);
            this.setState({ 
                selectedRecord: record,
                currentRecord: record,
                initialTemplate: undefined,
                initialFieldDescriptions: undefined,
                initialMode: undefined,
                hasExistingMock: undefined,
                templateActionNonce: (this.state.templateActionNonce || 0) + 1,
            });
            if (record) {
                await this.tryLoadExistingMock(record);
            }
        }
    }

    onExpandTree = (expandedKeys: string[]) => {
        this.setState({ expandedKeys });
    }

    findRecordById = (recordId: string): DtoRecord | undefined => {
        const { records } = this.props;
        for (const collectionId in records) {
            const collectionRecords = records[collectionId];
            if (collectionRecords && collectionRecords[recordId]) {
                return collectionRecords[recordId];
            }
        }
        return undefined;
    }

    private async tryLoadExistingMock(record?: DtoRecord): Promise<boolean> {
        const r = record || this.state.selectedRecord;
        if (!r || !r.id) { return false; }
        // 预清空：避免在等待请求时显示上一个接口的字段
        try { console.log('[ApiMock] tryLoadExistingMock pre-clear', { id: r.id }); } catch {}
        this.setState({
            hasExistingMock: false,
            initialTemplate: '',
            initialFieldDescriptions: undefined,
            initialMode: undefined,
            mockEnabled: false,
            templateActionNonce: (this.state.templateActionNonce || 0) + 1,
        });
        try {
            const resp: any = await RequestManager.get(`${Urls.getUrl('mock')}/${r.id}`);
            const resById = resp && typeof resp.json === 'function' ? await resp.json() : resp;
            if (resById && resById.success && resById.result) {
                const existed = resById.result;
                // 优先使用 res，其次使用 preview，确保作为合法 JSON 注入到编辑器
                let pretty: string | undefined = undefined;
                const tryPretty = (s?: string) => {
                    if (!s) return undefined;
                    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return undefined; }
                };
                pretty = tryPretty(existed.res) || tryPretty(existed.preview) || undefined;

                // 调试：命中已有 Mock
                try { console.log('[ApiMock] tryLoadExistingMock hit', { id: r.id, prettyLen: (pretty || '').length, mode: existed.mode, isEnabled: existed.isEnabled }); } catch {}

                this.setState({ 
                    initialTemplate: pretty, 
                    initialFieldDescriptions: existed.fieldDescriptions || undefined,
                    initialMode: typeof existed.mode === 'number' ? existed.mode : undefined,
                    hasExistingMock: true,
                    mockEnabled: !!(existed.isEnabled === 1 || existed.isEnabled === true),
                    mockCollectionId: existed.collectionId || (r as any).collectionId,
                });
                return true;
            }
        } catch {
            // treat as new
        }
        // 未命中已有 Mock：确保默认 MockCollectionId
        try {
            const ra: any = r as any;
            const projectId = (ra && (ra.pid || ra.projectId)) || this.props.selectedProject;
            if (projectId) {
                const resp: any = await RequestManager.post(Urls.getUrl('mock/collection/ensure-default'), { projectId });
                const data = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                const ensuredId = data && data.success && (data.id || (data.result && data.result.id));
                try { console.log('[ApiMock] tryLoadExistingMock miss -> ensure default', { id: r.id, projectId, ensuredId }); } catch {}
                this.setState({ 
                    hasExistingMock: false, 
                    initialTemplate: '', 
                    initialFieldDescriptions: undefined,
                    initialMode: undefined,
                    mockEnabled: false,
                    mockCollectionId: ensuredId || (r as any).collectionId,
                    templateActionNonce: (this.state.templateActionNonce || 0) + 1,
                });
            } else {
                try { console.log('[ApiMock] tryLoadExistingMock miss (no projectId)', { id: r.id }); } catch {}
                this.setState({ 
                    hasExistingMock: false, 
                    initialTemplate: '', 
                    initialFieldDescriptions: undefined,
                    initialMode: undefined,
                    mockEnabled: false,
                    mockCollectionId: (r as any).collectionId,
                    templateActionNonce: (this.state.templateActionNonce || 0) + 1,
                });
            }
        } catch (_) {
            try { console.log('[ApiMock] tryLoadExistingMock error, fallback reset', { id: r.id }); } catch {}
            this.setState({ 
                hasExistingMock: false, 
                initialTemplate: '', 
                initialFieldDescriptions: undefined,
                initialMode: undefined,
                mockEnabled: false,
                mockCollectionId: (r as any).collectionId,
                templateActionNonce: (this.state.templateActionNonce || 0) + 1,
            });
        }
        return false;
    }

    loadMockDataForRecord = (record: DtoRecord) => {
        // 这里应该调用API获取该记录的Mock数据
        // 暂时使用生成器生成示例数据
        const sample = MockGenerator.generateSampleData(record);
        const mockList = [
            {
                id: '1',
                name: `${record.name} Mock数据`,
                method: record.method,
                url: record.url,
                isActive: true,
                mockUrl: `/mock/${record.id}`,
                createTime: new Date().toISOString(),
                data: sample,
            }
        ];
        // 若没有已存在的 mock（或 initialTemplate 尚未就绪），用示例数据作为初始模板，保证右侧编辑器有内容
        this.setState((prev) => ({
            mockList,
            initialTemplate: prev.hasExistingMock ? prev.initialTemplate : (prev.initialTemplate || JSON.stringify(sample, null, 2)),
        }));
    }

    toggleMockStatus = (mockId: string) => {
        const { mockList } = this.state;
        const updatedList = mockList.map(mock => 
            mock.id === mockId ? { ...mock, isActive: !mock.isActive } : mock
        );
        this.setState({ mockList: updatedList });
        message.success('Mock状态更新成功！');
    }

    // 已移除“从API响应填充”入口，避免造成误导

    renderProjectTree = () => {
        const { collections, records } = this.props;
        const { expandedKeys, searchText } = this.state;

        return (
            <div className="project-tree-panel">
                <div className="tree-header">
                    <h3 style={{ margin: 0, fontSize: 14, color: '#333' }}>项目与接口</h3>
                    <Search
                        placeholder="搜索API"
                        value={searchText}
                        onChange={(e: any) => this.setState({ searchText: e.target.value }, () => this.updateExpandedKeysForSearch())}
                        onSearch={this.handleSearch}
                        style={{ width: '100%', marginTop: 8 }}
                    />
                </div>
                
                {(() => {
                    // 先构造需要渲染的集合与其过滤后的记录，避免产生 null 子节点
                    const items = collections.map(collection => {
                        const all = records[collection.id] ? _.uniqBy(_.values(records[collection.id]), 'id') : [] as DtoRecord[];
                        const recs = searchText
                            ? all.filter(r =>
                                (r.name && r.name.toLowerCase().includes(searchText.toLowerCase())) ||
                                (r.url && r.url.toLowerCase().includes(searchText.toLowerCase()))
                              )
                            : all;
                        return { collection, recs };
                    }).filter(it => it.recs.length > 0);

                    if (items.length === 0) {
                        return (
                            <div style={{ padding: '8px 12px', color: '#999' }}>无匹配的接口</div>
                        );
                    }

                    return (
                        <Tree
                            showLine
                            onSelect={this.onSelectRecord}
                            onExpand={this.onExpandTree}
                            expandedKeys={expandedKeys}
                            className="api-tree"
                        >
                            {items.map(({ collection, recs }) => (
                                <TreeNode
                                    key={collection.id}
                                    title={
                                        <span className="collection-node">
                                            <Icon type="folder" />
                                            <span className="collection-name">{collection.name}</span>
                                        </span>
                                    }
                                >
                                    {recs.map(record => (
                                        <TreeNode
                                            key={record.id}
                                            title={
                                                <span className="api-node">
                                                    <Tag color="blue">{record.method || 'GET'}</Tag>
                                                    <span className="api-name">{record.name}</span>
                                                </span>
                                            }
                                        />
                                    ))}
                                </TreeNode>
                            ))}
                        </Tree>
                    );
                })()}
            </div>
        );
    }

    renderMockOperationPanel = () => {
        const { selectedRecord, initialTemplate, initialFieldDescriptions, initialMode, mockEnabled } = this.state;
        
        if (!selectedRecord) {
            return (
                <div className="mock-operation-panel">
                    <div className="empty-selection">
                        <Icon type="api" style={{ fontSize: 48, color: '#ccc' }} />
                        <h3>请选择一个API</h3>
                        <p>从左侧项目列表中选择一个API来管理其Mock数据</p>
                    </div>
                </div>
            );
        }

        // 计算可直接访问的 Mock 预览 URL（保持与请求面板一致）
        const mockApiUrl = this.buildMockUrl(selectedRecord);
        const editorKey = `${this.state.hasExistingMock ? 'exist' : 'empty'}-${String(this.state.templateActionNonce || 0)}`;
        try { console.log('[ApiMock] render editor', { recordId: selectedRecord.id, hasExistingMock: this.state.hasExistingMock, tplLen: (this.state.initialTemplate || '').length, editorKey }); } catch {}

        return (
            <div className="mock-operation-panel">
                <div className="api-info-header">
                    <div className="api-basic-info">
                        <Tag color="blue">{selectedRecord.method || 'GET'}</Tag>
                        <span className="api-name">{selectedRecord.name}</span>
                        <span className="api-url">{selectedRecord.url}</span>
                    </div>
                    {/* 去掉右侧“从API响应填充”，该功能暂不生效 */}
                </div>

                <div style={{ marginBottom: 12, color: '#999' }}>下方为内联 Mock 编辑与预览，可直接保存。</div>
                <MockEditorModal
                    key={editorKey}
                    inline
                    // 这里传入初始 JSON（字符串）用于解析生成字段结构
                    initialData={this.state.hasExistingMock ? initialTemplate : ''}
                    initialFieldDescriptions={initialFieldDescriptions}
                    initialMode={initialMode as any}
                    // 顶部控制区：Mock 开关与 URL
                    mockEnabled={!!mockEnabled}
                    mockUrl={mockApiUrl}
                    onToggleMock={(val) => this.setState({ mockEnabled: val })}
                    // 保存时把 res/preview 直接回传给页面进行持久化
                    onSave={(result) => this.handleSaveMock({ mode: result.mode as any, res: result.res, preview: result.preview })}
                />
            </div>
        );
    }

    public render() {
        const { activeKey, openKeys, selectedProject } = this.props;
        return (
            <SiderLayout
                sider={
                    <CollectionList
                        readOnly={true}
                        activeKey={activeKey}
                        openKeys={openKeys}
                        selectedProject={selectedProject}
                        onlyOneOpenKey={true}
                        activeRecordType={DocumentActiveRecordType}
                        collectionOpenKeysType={DocumentCollectionOpenKeysType}
                        selectedProjectChangedType={DocumentSelectedProjectChangedType}
                    />
                }
                content={(
                    <div style={{ height: '100%' }}>
                        <PerfectScrollbar>
                            <div className="mock-header" style={{ padding: '12px 16px' }}>
                                <h2 style={{ marginBottom: 4 }}>API Mock 数据管理</h2>
                                <p style={{ margin: 0, color: '#666' }}>为您的API创建和管理Mock数据，提供真实的测试环境</p>
                            </div>
                            {this.renderMockOperationPanel()}
                        </PerfectScrollbar>
                    </div>
                )}
            />
        );
    }
}

const mapStateToProps = (state: State): ApiMockStateProps => {
    const { collectionsInfo } = state.collectionState;
    const collections = _.chain(collectionsInfo.collections).values().sortBy('name').value() as DtoCollection[];
    const { documentActiveRecord, documentCollectionOpenKeys, documentSelectedProject } = state.documentState;
    return {
        collections,
        records: collectionsInfo.records,
        activeKey: documentActiveRecord,
        openKeys: documentCollectionOpenKeys,
        selectedProject: documentSelectedProject,
    };
};

const mapDispatchToProps = (dispatch: any): ApiMockDispatchProps => {
    return {};
};

export default connect(
    mapStateToProps,
    mapDispatchToProps,
)(ApiMock);