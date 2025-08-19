import * as React from 'react';
import { connect } from 'react-redux';
import { Menu, Dropdown, Icon, Button, Modal, TreeSelect, Input, Tooltip, message } from 'antd';
import { State } from '../../state';
import RecordFolder from './record_folder';
import RecordItem from './record_item';
import CollectionItem from './collection_item';
import { DtoBaseItem, DtoRecord } from '../../common/interfaces/dto_record';
import * as _ from 'lodash';
import { DtoCollection, DtoCommonSetting } from '../../common/interfaces/dto_collection';
import { RecordCategory } from '../../misc/record_category';
import { actionCreator } from '../../action';
import { DeleteCollectionType, SaveCollectionType } from '../../action/collection';
import { DeleteRecordType, SaveRecordType, RemoveTabType, MoveRecordType, SaveAsRecordType } from '../../action/record';
import { StringUtil } from '../../utils/string_util';
import PerfectScrollbar from 'react-perfect-scrollbar';
import { ProjectSelectedDialogMode, ProjectSelectedDialogType } from '../../misc/custom_type';
import { getProjectsIdNameStateSelector, getDisplayCollectionSelector } from './selector';
import { newCollectionName, allProject } from '../../misc/constants';
import RecordTimeline from '../record_timeline';
import { ShowTimelineType, CloseTimelineType } from '../../action/ui';
import CommonSettingDialog from '../common_setting_dialog';
import MockEditorModal from '../../modules/api_mock/MockEditorModal';
import { MockMode } from '../../common/enum/mock_mode';
import RequestManager from '../../utils/request_manager';
import { Urls } from '../../utils/urls';
import Msg from '../../locales';
import './style/index.less';
import LocalesString from '../../locales/string';

const SubMenu = Menu.SubMenu;
const MenuItem = Menu.Item;

interface OwnProps {

    readOnly: boolean;

    activeRecordType: string;

    collectionOpenKeysType: string;

    selectedProjectChangedType: string;

    activeKey: string;

    openKeys: string[];

    selectedProject: string;

    onlyOneOpenKey?: boolean;
}

interface CollectionListStateProps extends OwnProps {

    collections: DtoCollection[];

    records: _.Dictionary<_.Dictionary<DtoBaseItem>>;

    projects: { id: string, name: string }[];

    timelineRecord?: DtoRecord;

    isTimelineDlgOpen: boolean;
}

interface CollectionListDispatchProps {

    activeRecord: (type: string, record: DtoBaseItem) => void;

    deleteRecord(id: string, records: _.Dictionary<DtoBaseItem>);

    deleteCollection(id: string);

    updateRecord(record: DtoBaseItem);

    saveCollection(collection: DtoCollection);

    updateCollection(collection: DtoCollection);

    duplicateRecord(record: DtoBaseItem);

    createRecord(record: DtoBaseItem);

    moveRecord(record: DtoBaseItem);

    openKeysChanged(type: string, openKeys: string[]);

    selectProject(type: string, projectid: string);

    showTimeLine(id: string);

    closeTimeLine();
}

type CollectionListProps = CollectionListStateProps & CollectionListDispatchProps;

interface CollectionListState {

    isProjectSelectedDlgOpen: boolean;

    projectSelectedDlgMode: ProjectSelectedDialogMode;

    selectedProjectInDlg?: string;

    newCollectionName: string;

    shareCollectionId: string;

    isCommonSettingDlgOpen: boolean;

    currentOperatedCollection?: DtoCollection;

    currentOperatedFolder?: DtoBaseItem;

    commonSettingType: 'Collection' | 'Folder';

    isMockEditorVisible: boolean;
    mockEditorRecord?: DtoRecord;

    // Mock editor states reused from RequestOptionPanel
    initialTemplate?: string;
    initialFieldDescriptions?: string;
    initialMode?: MockMode;
    mockEnabled?: boolean;
    mockCollectionId?: string;
    currentMockId?: string;
    hasExistingMock?: boolean;
    templateActionNonce?: number;
}

class CollectionList extends React.Component<CollectionListProps, CollectionListState> {

    private currentNewFolder: DtoBaseItem | undefined;
    private folderRefs: _.Dictionary<RecordFolder | null> = {};
    private newCollectionNameRef: Input | null;
    private psContainer: HTMLElement | null = null;

    // 拖拽自动滚动：根据鼠标位置靠近顶部/底部时自动滚动容器
    private onTreeDragOver = (e: React.DragEvent) => {
        if (!this.psContainer) { return; }
        const rect = this.psContainer.getBoundingClientRect();
        const y = e.clientY;
        const threshold = 40; // px
        const maxSpeed = 20; // px per触发
        if (y < rect.top + threshold) {
            const ratio = (rect.top + threshold - y) / threshold;
            this.psContainer.scrollTop -= Math.round(ratio * maxSpeed);
        } else if (y > rect.bottom - threshold) {
            const ratio = (y - (rect.bottom - threshold)) / threshold;
            this.psContainer.scrollTop += Math.round(ratio * maxSpeed);
        }
        e.preventDefault();
    }

    // 请求展开指定 folder（如果未展开）
    private requestOpenFolder = (folderId: string) => {
        const { openKeys } = this.props;
        if (openKeys && openKeys.indexOf(folderId) >= 0) { return; }
        const next = [...(openKeys || []), folderId];
        this.openKeysChanged(next);
    }

    constructor(props: CollectionListProps) {
        super(props);
        this.state = {
            projectSelectedDlgMode: ProjectSelectedDialogType.create,
            isProjectSelectedDlgOpen: false,
            newCollectionName: newCollectionName(),
            shareCollectionId: '',
            isCommonSettingDlgOpen: false,
            commonSettingType: 'Collection',
            isMockEditorVisible: false,
            mockEditorRecord: undefined,
            initialTemplate: undefined,
            initialFieldDescriptions: undefined,
            initialMode: MockMode.template,
            mockEnabled: false,
            mockCollectionId: undefined,
            currentMockId: undefined,
            hasExistingMock: undefined,
            templateActionNonce: 0,
        };
    }

    componentDidUpdate(_prevProps: CollectionListProps, _prevState: CollectionListState) {
        if (this.currentNewFolder) {
            const folderRef = this.folderRefs[this.currentNewFolder.id];
            if (folderRef) {
                folderRef.edit();
                this.currentNewFolder = undefined;
            }
        }
    }

    private createRecord = (record: DtoBaseItem) => {
        if (!record) {
            return;
        }

        this.currentNewFolder = record.category === RecordCategory.folder ? record : undefined;

        let openKeys = [...this.props.openKeys];
        if (record.collectionId && this.props.openKeys.indexOf(record.collectionId) < 0) {
            openKeys.push(record.collectionId);
        }
        if (record.pid && this.props.openKeys.indexOf(record.pid) < 0) {
            openKeys.push(record.pid);
        }
        if (openKeys.length !== this.props.openKeys.length) {
            this.props.openKeysChanged(this.props.collectionOpenKeysType, openKeys);
        }

        this.props.createRecord(record);

        if (record && record.category === RecordCategory.record) {
            this.props.activeRecord(this.props.activeRecordType, record);
        }
    }

    private changeFolderName = (folder: DtoBaseItem, name: string) => {
        if (name.trim() !== '' && name !== folder.name) {
            this.props.updateRecord({ ...folder, name });
        }
    }

    private changeCollectionName = (collection: DtoCollection, name: string) => {
        if (name.trim() !== '' && name !== collection.name) {
            this.props.updateCollection({ ...collection, name });
        }
    }

    private moveRecordToFolder = (record: DtoBaseItem, collectionId: string, folderId: string) => {
        this.props.moveRecord({ ...record, pid: folderId, collectionId });
    }

    private moveToCollection = (record: DtoBaseItem, collectionId: string) => {
        this.props.moveRecord({ ...record, collectionId, pid: '' });
        if (record.category === RecordCategory.folder) {
            _.values(this.props.records[record.collectionId]).filter(r => r.pid === record.id).forEach(r => {
                this.props.moveRecord({ ...r, collectionId });
            });
        }
    }

    private getProjectMenu = () => {
        const projects = this.props.projects;
        return (
            <Menu style={{ minWidth: 150 }} onClick={e => this.props.selectProject(this.props.selectedProjectChangedType, e.key)} selectedKeys={[this.props.selectedProject]}>
                <Menu.Item key={allProject}>{allProject}</Menu.Item>
                {projects.map(t => <Menu.Item key={t.id}>{t.name}</Menu.Item>)}
            </Menu>
        );
    }

    private getCurrentProject = () => {
        return this.props.projects.find(t => t.id === this.props.selectedProject) || { id: allProject, name: allProject };
    }

    private addCollection = () => {
        this.setState({ ...this.state, isProjectSelectedDlgOpen: true }, () => this.newCollectionNameRef && this.newCollectionNameRef.focus());
    }

    private createCollection = () => {
        if (!this.state.selectedProjectInDlg) {
            return;
        }

        const collection: DtoCollection = {
            id: StringUtil.generateUID(),
            name: this.state.newCollectionName,
            commonPreScript: '',
            commonSetting: { prescript: '', test: '', headers: [] },
            projectId: this.state.selectedProjectInDlg,
            description: ''
        };
        this.props.saveCollection(collection);
        this.setState({ ...this.state, isProjectSelectedDlgOpen: false, newCollectionName: newCollectionName(), selectedProjectInDlg: undefined });
    }

    private duplicateRecord = (record: DtoBaseItem) => {
        let headers = record.headers;
        let queryStrings = record.queryStrings;
        let formDatas = record.formDatas;
        if (headers) {
            headers = headers.map(h => ({ ...h, id: StringUtil.generateUID() }));
        }
        if (queryStrings) {
            queryStrings = queryStrings.map(q => ({ ...q, id: StringUtil.generateUID() }));
        }
        if (formDatas) {
            formDatas = formDatas.map(q => ({ ...q, id: StringUtil.generateUID() }));
        }
        this.props.duplicateRecord({ ...record, id: StringUtil.generateUID(), name: `${record.name}.copy`, headers, queryStrings, formDatas });
    }

    private shareCollection = () => {
        // TODO: share
        console.log('share');
    }

    private saveCommonSetting = (commonSetting: DtoCommonSetting) => {
        const { currentOperatedCollection, currentOperatedFolder, commonSettingType } = this.state;
        if (commonSettingType === 'Collection') {
            if (currentOperatedCollection) {
                this.props.updateCollection({ ...currentOperatedCollection, commonSetting });
            }
        } else if (currentOperatedFolder) {
            this.props.updateRecord({ ...currentOperatedFolder, commonSetting });
        }
        this.setState({ ...this.state, isCommonSettingDlgOpen: false });
    }

    private showMockEditor = async (record: DtoRecord) => {
        await this.tryLoadExistingMock(record);
        this.setState({ isMockEditorVisible: true, mockEditorRecord: record });
    }

    private hideMockEditor = () => {
        this.setState({
            isMockEditorVisible: false,
            mockEditorRecord: undefined
        });
    }

    // ===== Mock helpers (align with RequestOptionPanel) =====
    private normalizePath = (p?: string) => {
        if (!p) { return ''; }
        let s = p.trim();
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
        const prefix = ((): string => { try { return `${window.location.origin}`; } catch { return ''; } })();
        if (cid) {
            return `${prefix}/api/mockapi/${cid}/${normalizedPath}`.replace(/^\/\//, '/');
        }
        return `${prefix}/api/mockapi/${normalizedPath}`.replace(/^\/\//, '/');
    }

    // 基于字段层级生成 path->meta 映射
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
            if (path && (desc.length > 0 || f.type || typeof f.order === 'number')) {
                map[path] = { description: desc, type: f.type, order: typeof f.order === 'number' ? f.order : undefined };
            }
        });
        return map;
    }

    private safePretty = (content?: string) => {
        if (!content) { return undefined; }
        try { return JSON.stringify(JSON.parse(content), null, 2); } catch { return content; }
    }

    private async tryLoadExistingMock(record: DtoRecord) {
        // 预清空，避免串数据
        this.setState(s => ({
            hasExistingMock: false,
            initialTemplate: '',
            initialFieldDescriptions: undefined,
            initialMode: MockMode.template,
            templateActionNonce: (s.templateActionNonce || 0) + 1,
        }));
        if (record && record.id) {
            try {
                const resp: any = await RequestManager.get(`${Urls.getUrl('mock')}/${record.id}`);
                const resById = resp && typeof resp.json === 'function' ? await resp.json() : resp;
                if (resById && resById.success && resById.result) {
                    const existed = resById.result;
                    const pretty = this.safePretty(existed.res);
                    this.setState({
                        initialTemplate: pretty,
                        currentMockId: record.id,
                        hasExistingMock: true,
                        mockEnabled: !!(existed.isEnabled === 1 || existed.isEnabled === true),
                        mockCollectionId: existed.collectionId || (record as any).collectionId,
                        initialFieldDescriptions: existed.fieldDescriptions || undefined,
                        initialMode: typeof existed.mode === 'number' ? existed.mode : MockMode.template,
                    });
                    return;
                }
            } catch (_) { /* treat as new */ }
        }
        // 未命中，则确保默认 Mock 集合ID
        try {
            const resp: any = await RequestManager.post(Urls.getUrl('mock/collection/ensure-default'), { projectId: this.props.selectedProject });
            const data = resp && typeof resp.json === 'function' ? await resp.json() : resp;
            const ensuredId = data && data.success && (data.id || (data.result && data.result.id));
            this.setState(s => ({ currentMockId: record.id, hasExistingMock: false, mockEnabled: false, mockCollectionId: ensuredId || (record as any).collectionId, initialFieldDescriptions: undefined, initialTemplate: '', initialMode: MockMode.template, templateActionNonce: (s.templateActionNonce || 0) + 1 }));
        } catch (_) {
            this.setState(s => ({ currentMockId: record.id, hasExistingMock: false, mockEnabled: false, mockCollectionId: (record as any).collectionId, initialFieldDescriptions: undefined, initialTemplate: '', initialMode: MockMode.template, templateActionNonce: (s.templateActionNonce || 0) + 1 }));
        }
    }

    private async saveMockFromTree(result: { fields: any[]; mode: MockMode; res: string; preview: string }) {
        const record = this.state.mockEditorRecord;
        if (!record) { message.error('无有效的 API 记录'); return; }
        if (!record.id) { message.error('无法保存：缺少 record.id'); return; }
        const fieldMap = this.buildFieldDescriptions(result.fields || []);
        const payload: any = {
            id: record.id,
            name: record.name,
            method: record.method,
            apiUrl: record.url,
            url: record.url,
            collectionId: this.state.mockCollectionId || (record as any).collectionId,
            pid: this.props.selectedProject,
            mode: result.mode,
            res: result.res,
            isEnabled: this.state.mockEnabled ? 1 : 0,
            preview: result.preview,
            fieldDescriptions: JSON.stringify(fieldMap),
        };
        try {
            let resp: any;
            if (this.state.hasExistingMock) {
                resp = await RequestManager.put(Urls.getUrl('mock'), payload);
            } else {
                resp = await RequestManager.post(Urls.getUrl('mock'), payload);
            }
            const data = resp && typeof resp.json === 'function' ? await resp.json() : resp;
            if ((data && data.success) || (resp && resp.ok)) {
                message.success('Mock 已保存');
                await this.tryLoadExistingMock(record);
                this.hideMockEditor();
            } else {
                message.error((data && data.message) || '保存失败');
            }
        } catch (e) {
            message.error('保存失败');
        }
    }

    private loopRecords = (data: DtoBaseItem[], cid: string, inFolder: boolean = false) => {
        const { openKeys, records, deleteRecord, showTimeLine, readOnly } = this.props;

        return data.map(r => {
            const recordStyle = { height: '30px', lineHeight: '30px' };

            if (r.category === RecordCategory.folder) {
                const isOpen = openKeys.indexOf(r.id) > -1;
                const children = _.remove(data, (d) => d.pid === r.id);
                return (
                    <SubMenu
                        className="folder"
                        key={r.id}
                        title={(
                            <RecordFolder
                                ref={ele => this.folderRefs[r.id] = ele}
                                folder={{ ...r }}
                                isOpen={isOpen}
                                deleteRecord={() => deleteRecord(r.id, records[cid])}
                                createRecord={this.createRecord}
                                onNameChanged={(name) => this.changeFolderName(r, name)}
                                moveRecordToFolder={this.moveRecordToFolder}
                                moveToCollection={this.moveToCollection}
                                editCommonSetting={() => this.setState({ ...this.state, isCommonSettingDlgOpen: true, commonSettingType: 'Folder', currentOperatedFolder: r })}
                                onHoverOpen={this.requestOpenFolder}
                                readOnly={readOnly}
                            />
                        )}
                    >
                        {this.loopRecords(children, cid, true)}
                    </SubMenu>
                );
            }
            return (
                <MenuItem key={r.id} style={recordStyle} data={r}>
                    <RecordItem
                        item={{ ...r }}
                        inFolder={inFolder}
                        moveRecordToFolder={this.moveRecordToFolder}
                        moveToCollection={this.moveToCollection}
                        duplicateRecord={() => this.duplicateRecord(r)}
                        deleteRecord={() => deleteRecord(r.id, records[cid])}
                        showTimeline={() => showTimeLine(r.id)}
                        editMock={() => this.showMockEditor(r as DtoRecord)}
                        readOnly={readOnly}
                    />
                </MenuItem>
            );
        });
    }

    private get timelineDialog() {
        const { timelineRecord, isTimelineDlgOpen, closeTimeLine } = this.props;
        return (
            <RecordTimeline
                visible={isTimelineDlgOpen}
                record={timelineRecord}
                onClose={closeTimeLine}
            />
        );
    }

    private get commonSettingDialog() {
        const { isCommonSettingDlgOpen, currentOperatedCollection, currentOperatedFolder, commonSettingType } = this.state;
        let commonSetting: DtoCommonSetting;

        if (commonSettingType === 'Collection') {
            if (!currentOperatedCollection) {
                return;
            }
            commonSetting = { ...currentOperatedCollection.commonSetting, prescript: currentOperatedCollection.commonSetting ? currentOperatedCollection.commonSetting.prescript : currentOperatedCollection.commonPreScript };
        } else {
            const folder = currentOperatedFolder as DtoRecord;
            if (!folder) {
                return;
            }
            commonSetting = { prescript: folder.prescript || '', headers: folder.headers || [], test: folder.test || '' };
        }

        return (
            <CommonSettingDialog
                type={commonSettingType}
                isOpen={isCommonSettingDlgOpen}
                onOk={this.saveCommonSetting}
                commonSetting={commonSetting}
                onCancel={() => this.setState({ ...this.state, isCommonSettingDlgOpen: false })}
            />
        );
    }

    private get projectSelectedDialog() {
        const { projectSelectedDlgMode, isProjectSelectedDlgOpen } = this.state;
        const description = ProjectSelectedDialogType.getDescription(projectSelectedDlgMode);
        return (
            <Modal
                title={ProjectSelectedDialogType.getTitle(projectSelectedDlgMode)}
                visible={isProjectSelectedDlgOpen}
                onOk={ProjectSelectedDialogType.isCreateMode(projectSelectedDlgMode) ? this.createCollection : this.shareCollection}
                onCancel={() => this.setState({ ...this.state, isProjectSelectedDlgOpen: false })}
            >
                {
                    ProjectSelectedDialogType.isCreateMode(projectSelectedDlgMode) ? (
                        <div>
                            <div style={{ marginBottom: '8px' }}>{Msg('Collection.EnterNewCollectionName')}</div>
                            <Input spellCheck={false} ref={ele => this.newCollectionNameRef = ele} style={{ width: '100%', marginBottom: '8px' }} value={this.state.newCollectionName} onChange={e => this.setState({ ...this.state, newCollectionName: e.currentTarget.value })} />
                        </div>
                    ) : ''
                }

                <div style={{ marginBottom: '8px' }}>{description}</div>
                <TreeSelect
                    allowClear={true}
                    style={{ width: '100%' }}
                    dropdownStyle={{ maxHeight: 500, overflow: 'auto' }}
                    placeholder={LocalesString.get('Collection.SelectProject')}
                    treeDefaultExpandAll={true}
                    value={this.state.selectedProjectInDlg}
                    onChange={(e) => this.setState({ ...this.state, selectedProjectInDlg: e })}
                    treeData={this.props.projects.map(t => ({ key: t.id, value: t.id, label: t.name }))}
                />
            </Modal>
        );
    }

    private getSelectedProjectCollections = () => {
        const { collections, selectedProject } = this.props;
        if (selectedProject === allProject) {
            return collections;
        }
        return _.filter(collections, c => c.projectId === selectedProject);
    }

    private openKeysChanged = (keys) => {
        const { collections, collectionOpenKeysType, openKeysChanged, openKeys, onlyOneOpenKey } = this.props;
        if (onlyOneOpenKey) {
            let latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1);
            let isCollectionKey = !!collections.find(c => c.id === latestOpenKey);
            if (isCollectionKey) {
                keys = [...openKeys.filter(k => !collections.find(c => c.id === k)), latestOpenKey];
            }
        }
        openKeysChanged(collectionOpenKeysType, keys);
    }

    private get collectionMenu() {
        const { records, activeRecordType, activeKey, openKeys, deleteCollection, activeRecord, readOnly } = this.props;
        const collections = this.getSelectedProjectCollections();

        return (
            <div className="collection-tree-container" onDragOver={this.onTreeDragOver}>
                <PerfectScrollbar containerRef={(ref: HTMLElement | null) => { this.psContainer = ref; }}>
                    <Menu
                        className="collection-tree"
                        onOpenChange={this.openKeysChanged}
                        mode="inline"
                        inlineIndent={0}
                        openKeys={openKeys || []}
                        selectedKeys={[activeKey]}
                        onSelect={param => activeRecord(activeRecordType, param.item.props.data)}
                    >
                        {
                            collections.map(c => {
                                const recordCount = _.values(records[c.id]).filter(r => r.category === RecordCategory.record).length;
                                let sortRecords = _.chain(records[c.id]).values<DtoBaseItem>().sortBy(['category', 'name']).value();

                                return (
                                    <SubMenu
                                        className={`${c.id !== collections[0].id ? 'collection-separator-line' : ''} collection-item`}
                                        key={c.id}
                                        title={(
                                            <CollectionItem
                                                collection={{ ...c }}
                                                recordCount={recordCount}
                                                onNameChanged={(name) => this.changeCollectionName(c, name)}
                                                deleteCollection={() => deleteCollection(c.id)}
                                                moveToCollection={this.moveToCollection}
                                                createRecord={this.createRecord}
                                                shareCollection={id => this.setState({ ...this.state, isProjectSelectedDlgOpen: true, projectSelectedDlgMode: ProjectSelectedDialogType.share, shareCollectionId: id })}
                                                editCommonSetting={() => this.setState({ ...this.state, isCommonSettingDlgOpen: true, commonSettingType: 'Collection', currentOperatedCollection: c })}
                                                editReqStrictSSL={() => this.props.updateCollection({ ...c, reqStrictSSL: !c.reqStrictSSL })}
                                                editReqFollowRedirect={() => this.props.updateCollection({ ...c, reqFollowRedirect: !c.reqFollowRedirect })}
                                                readOnly={readOnly}
                                            />
                                        )}
                                    >
                                        {
                                            sortRecords.length === 0 ?
                                                <div style={{ height: 20 }} /> :
                                                this.loopRecords(sortRecords, c.id)
                                        }
                                    </SubMenu>
                                );
                            })
                        }
                    </Menu>
                    {collections.length === 0 ? '' : <div className="collection-tree-bottom" />}
                </PerfectScrollbar>
            </div>
        );
    }

    private get collectionHeader() {
        return (
            <div className="small-toolbar">
                <span>{Msg('App.Project')}:</span>
                <span>
                    <Dropdown overlay={this.getProjectMenu()} trigger={['click']}>
                        <a className="ant-dropdown-link" href="#">
                            {this.getCurrentProject().name} <Icon type="down" />
                        </a>
                    </Dropdown>
                </span>
                {
                    this.props.readOnly ? '' : (
                        <Tooltip mouseEnterDelay={1} placement="bottom" title={Msg('Collection.Create')}>
                            <Button className="icon-btn" type="primary" htmlType="button" icon="folder-add" onClick={this.addCollection}>{null}</Button>
                        </Tooltip>
                    )
                }
            </div>
        );
    }

    render() {
        const { isMockEditorVisible, mockEditorRecord } = this.state;
        return (
            <div className="collection-panel">
                {this.collectionHeader}
                {this.collectionMenu}
                {this.props.readOnly ? '' : this.projectSelectedDialog}
                {this.props.readOnly ? '' : this.timelineDialog}
                {this.props.readOnly ? '' : this.commonSettingDialog}
                {!this.props.readOnly && (
                <MockEditorModal
                    key={`${this.state.hasExistingMock ? 'exist' : 'empty'}-${String(this.state.templateActionNonce || 0)}`}
                    visible={!!isMockEditorVisible}
                    title={`Mock编辑器 - ${mockEditorRecord && mockEditorRecord.name ? mockEditorRecord.name : ''}`}
                    initialData={this.state.initialTemplate}
                    initialFieldDescriptions={this.state.initialFieldDescriptions}
                    initialMode={this.state.initialMode || MockMode.template}
                    mockEnabled={!!this.state.mockEnabled}
                    mockUrl={this.buildMockUrl(mockEditorRecord)}
                    onCancel={this.hideMockEditor}
                    onToggleMock={(enabled) => this.setState({ mockEnabled: enabled })}
                    onSave={(result) => this.saveMockFromTree(result)}
                />
            )}
        </div>
    );
}

}

// 使用 factory 以便 memoized selectors
const makeMapStateToProps = () => {
    const selectProjects = getProjectsIdNameStateSelector();
    const selectCollections = getDisplayCollectionSelector();
    return (state: State, _ownProps: OwnProps): CollectionListStateProps => {
        return {
            // 来自 OwnProps 的字段由上层传入并合并，这里只返回 state 驱动的字段
            readOnly: _ownProps.readOnly,
            activeRecordType: _ownProps.activeRecordType,
            collectionOpenKeysType: _ownProps.collectionOpenKeysType,
            selectedProjectChangedType: _ownProps.selectedProjectChangedType,
            activeKey: _ownProps.activeKey,
            openKeys: _ownProps.openKeys,
            selectedProject: _ownProps.selectedProject,

            collections: selectCollections(state),
            records: state.collectionState.collectionsInfo.records,
            projects: selectProjects(state),
            timelineRecord: state.uiState.timelineState.record,
            isTimelineDlgOpen: state.uiState.timelineState.isShow,
        } as CollectionListStateProps;
    };
};

const mapDispatchToProps = (dispatch: any): CollectionListDispatchProps => {
    return {
        activeRecord: (type, record) => dispatch(actionCreator(type, record)),
        deleteRecord: (id, records) => {
            const record = records[id];
            if (record.category === RecordCategory.folder) {
                const children = _.values(records).filter(r => r.pid === id);
                children.forEach(r => dispatch(actionCreator(RemoveTabType, r.id)));
            }
            dispatch(actionCreator(RemoveTabType, id));
            dispatch(actionCreator(DeleteRecordType, record));
        },
        deleteCollection: id => { dispatch(actionCreator(DeleteCollectionType, id)); },
        updateRecord: (record) => dispatch(actionCreator(SaveRecordType, { isNew: false, record })),
        saveCollection: (collection) => { dispatch(actionCreator(SaveCollectionType, { isNew: true, collection })); },
        updateCollection: (collection) => { dispatch(actionCreator(SaveCollectionType, { isNew: false, collection })); },
        duplicateRecord: (record) => dispatch(actionCreator(SaveAsRecordType, { isNew: true, record })),
        createRecord: (record) => dispatch(actionCreator(SaveAsRecordType, { isNew: true, record })),
        moveRecord: record => dispatch(actionCreator(MoveRecordType, { record })),
        openKeysChanged: (type, openKeys) => dispatch(actionCreator(type, openKeys)),
        selectProject: (type, projectId) => dispatch(actionCreator(type, projectId)),
        showTimeLine: id => dispatch(actionCreator(ShowTimelineType, id)),
        closeTimeLine: () => dispatch(actionCreator(CloseTimelineType))
    };
};

export default connect(
    makeMapStateToProps,
    mapDispatchToProps,
)(CollectionList) as any;