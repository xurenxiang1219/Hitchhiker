import React from 'react';
import { Modal, Button, Select, Input, message, Switch, Form } from 'antd';
import { FormComponentProps } from 'antd/lib/form';
import { DtoRecord } from '../../common/interfaces/dto_record';
import { MockGenerator } from '../../utils/mock_generator';
import HighlightCode from '../../components/highlight_code';
import './style/index.less';
import { MockMode } from '../../common/enum/mock_mode';

const { Option } = Select;
const { TextArea } = Input;
// Tabs removed from modal/inline layouts

interface MockEditorProps extends FormComponentProps {
    visible?: boolean; // inline 模式下可忽略
    record?: DtoRecord;
    onCancel: () => void;
    onSave: (mockData: any) => void;
    initialTemplate?: string;
    inline?: boolean; // 页面内编辑+预览
    mockEnabled?: boolean; // 外部传入Mock开关
    mockUrl?: string; // 外部传入可访问的Mock URL
    onToggleMock?: (enabled: boolean) => void; // 切换回调
    templateActionNonce?: number; // 用于强制触发模板重应用
}

interface MockEditorState {
    mockTemplate: string;
    mockMode: MockMode;
    sampleData: any;
    activeTab: string;
    errorMsg?: string;
    // 实时预览（来自接口返回）
    liveData?: any;
    liveError?: string;
    useLivePreview: boolean;
}

class MockEditor extends React.Component<MockEditorProps, MockEditorState> {

    constructor(props: MockEditorProps) {
        super(props);
        this.state = {
            mockTemplate: '',
            mockMode: MockMode.template,
            sampleData: null,
            activeTab: 'template',
            liveData: undefined,
            liveError: undefined,
            useLivePreview: true,
        };
    }

    componentDidMount() {
        const { initialTemplate } = this.props;
        if (initialTemplate) {
            this.applyInitialTemplate(initialTemplate);
        } else {
            this.generateInitialTemplate();
        }
        if (this.props.mockUrl) {
            this.fetchLivePreview();
        }
    }

    componentDidUpdate(prevProps: MockEditorProps, prevState: MockEditorState) {
        // initialTemplate 变更：有值 -> 套用；无值 -> 生成自动模板
        if (this.props.initialTemplate !== prevProps.initialTemplate) {
            if (this.props.initialTemplate) {
                this.applyInitialTemplate(this.props.initialTemplate);
            } else {
                this.generateInitialTemplate();
            }
        } else if (this.props.templateActionNonce !== prevProps.templateActionNonce) {
            // 非覆盖型但需要强制刷新时使用（例如两次设置相同模板值）
            if (this.props.initialTemplate && this.props.initialTemplate.trim()) {
                this.applyInitialTemplate(this.props.initialTemplate);
            } else {
                this.generateInitialTemplate();
            }
        } else if (this.props.record !== prevProps.record && this.props.record) {
            // 记录改变时也重新生成自动模板
            this.generateInitialTemplate();
        }
        if (this.state.mockTemplate !== prevState.mockTemplate) {
            this.updatePreviewDebounced(this.state.mockTemplate);
        }
        // mockUrl 变化时自动刷新实时预览
        if (this.props.mockUrl && this.props.mockUrl !== prevProps.mockUrl) {
            this.fetchLivePreview();
        }
    }

    componentWillUnmount() {
        if (this.previewDebounceTimer) {
            window.clearTimeout(this.previewDebounceTimer);
        }
    }

    private applyInitialTemplate = (templateStr: string) => {
        try {
            const template = JSON.parse(templateStr);
            const sampleData = MockGenerator.generateSampleResponse(template);
            this.setState({
                mockTemplate: JSON.stringify(template, null, 2),
                sampleData,
                errorMsg: undefined,
            });
        } catch (e) {
            // 如果 initialTemplate 不是合法 JSON，则直接放入编辑器，预览保持不变
            this.setState({ mockTemplate: templateStr, errorMsg: '模板不是合法的 JSON（已原样填充），请修正后查看预览。' });
        }
    }

    private previewDebounceTimer?: number;

    private updatePreviewDebounced = (next: string) => {
        if (this.previewDebounceTimer) {
            window.clearTimeout(this.previewDebounceTimer);
        }
        this.previewDebounceTimer = window.setTimeout(() => {
            try {
                const template = JSON.parse(next);
                const sampleData = MockGenerator.generateSampleResponse(template);
                this.setState({ sampleData, errorMsg: undefined });
            } catch (err) {
                this.setState({ errorMsg: '模板解析失败：' + (err && err.message ? err.message : '未知错误') });
            }
        }, 250);
    }

    // 从 mockUrl 拉取实时预览数据
    private async fetchLivePreview() {
        const url = this.props.mockUrl;
        if (!url) { return; }
        try {
            this.setState({ liveError: undefined });
            const method = (this.props.record && this.props.record.method) ? this.props.record.method.toUpperCase() : 'GET';
            const res = await fetch(url, { method, credentials: 'same-origin' });
            const text = await res.text();
            let data: any = undefined;
            try {
                data = JSON.parse(text);
            } catch {
                data = text; // 非 JSON 原样展示
            }
            this.setState({ liveData: data, useLivePreview: true });
        } catch (e) {
            this.setState({ liveError: '实时预览请求失败' });
        }
    }

    private handleRegenerate = () => {
        const { mockTemplate } = this.state;
        this.updatePreviewDebounced(mockTemplate);
    }

    private handleCopyUrl = async () => {
        const { mockUrl } = this.props;
        if (!mockUrl) { return; }
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(mockUrl);
                message.success('Mock URL 已复制');
            } else {
                // 旧浏览器降级
                const ta = document.createElement('textarea');
                ta.value = mockUrl;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                message.success('Mock URL 已复制');
            }
        } catch {
            message.error('复制失败');
        }
    }

    generateInitialTemplate = () => {
        if (this.props.record) {
            const template = MockGenerator.generateMockTemplate(this.props.record);
            const templateStr = JSON.stringify(template, null, 2);
            const sampleData = MockGenerator.generateSampleResponse(template);
            this.setState({
                mockTemplate: templateStr,
                sampleData,
                errorMsg: undefined,
            });
        } else {
            this.setState({ mockTemplate: '', sampleData: null, errorMsg: undefined });
        }
    }

    handleTemplateChange = (value: string) => {
        this.setState({ mockTemplate: value });
        this.updateSampleData(value);
    }

    updateSampleData = (templateStr: string) => {
        try {
            const template = JSON.parse(templateStr);
            const sampleData = MockGenerator.generateSampleResponse(template);
            this.setState({ sampleData });
        } catch (error) {
            // ignore parse error; preview will fallback
        }
    }

    handleModeChange = (mode: MockMode) => {
        this.setState({ mockMode: mode });
    }

    handleSave = () => {
        const { mockTemplate, mockMode } = this.state;
        
        try {
            // 验证JSON格式
            if (mockMode === MockMode.template) {
                JSON.parse(mockTemplate);
            }

            const r = this.props.record;
            const mockData: any = {
                // 不传 id，确保新建使用 POST；后续后端返回 id 后再更新
                method: (r && r.method) || 'GET',
                url: (r && r.url) || '',
                mode: mockMode,
                res: mockTemplate,
                collectionId: r && r.collectionId,
                name: (r && r.name) || 'Mock',
                description: r && r.description,
                // 传递预览数据，父组件会决定是否序列化
                preview: this.state && this.state.sampleData ? JSON.stringify(this.state.sampleData) : undefined,
            };

            // 调试输出：MockEditor 发给父组件的内容
            // eslint-disable-next-line no-console
            console.log('[MockEditor] onSave ->', mockData);
            this.props.onSave(mockData);
            // 成功提示交由父组件根据后端响应决定，避免出现“成功+失败”双提示
        } catch (error) {
            message.error('JSON格式错误，请检查模板');
        }
    }

    renderTemplateEditor = () => {
        const { mockTemplate } = this.state;
        
        return (
            <div className="mock-template-editor" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="editor-header">
                    <h4>Mock模板编辑器</h4>
                    <p>使用MockJS语法创建动态数据模板</p>
                </div>
                <div style={{ flex: 1, minHeight: 0 }}>
                    <TextArea
                        value={mockTemplate}
                        onChange={(e) => this.handleTemplateChange(e.target.value)}
                        placeholder="输入Mock模板JSON..."
                        className="template-textarea"
                        style={{ height: '100%', resize: 'none' }}
                    />
                </div>
                <div className="template-tips">
                    <h5>常用MockJS语法：</h5>
                    <ul>
                        <li><code>@guid</code> - 生成GUID</li>
                        <li><code>@cname</code> - 生成中文姓名</li>
                        <li><code>@email</code> - 生成邮箱</li>
                        <li><code>@datetime</code> - 生成日期时间</li>
                        <li><code>@integer(1,100)</code> - 生成1-100的整数</li>
                        <li><code>"list|5-10": [{}]</code> - 生成5-10个数组项</li>
                    </ul>
                </div>
            </div>
        );
    }

    renderPreview = () => {
        const { mockTemplate, liveData, useLivePreview, liveError } = this.state;
        const code = (() => {
            // 优先根据当前模板实时生成，确保编辑时右侧能实时变化
            try {
                if (mockTemplate && mockTemplate.trim()) {
                    const tpl = JSON.parse(mockTemplate);
                    const gen = MockGenerator.generateSampleResponse(tpl);
                    const out = (gen === null || gen === undefined) ? tpl : gen;
                    return JSON.stringify(out, null, 2);
                }
            } catch {}
            // 如果模板为空或解析失败，且开启了实时预览并已获取到数据，则展示实时数据
            if (useLivePreview && (liveData !== undefined)) {
                try { return JSON.stringify(liveData, null, 2); } catch { return String(liveData); }
            }
            return mockTemplate || 'null';
        })();

        return (
            <div className="mock-preview" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className="preview-header">
                    <h4>预览效果</h4>
                    <p>基于模板生成的示例数据</p>
                </div>
                <div className="preview-content" style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, flex: '0 0 auto' }}>
                        <Switch
                            size="small"
                            checked={useLivePreview}
                            onChange={(v) => {
                                this.setState({ useLivePreview: v }, () => {
                                    if (v) { this.fetchLivePreview(); }
                                });
                            }}
                        />
                        <span style={{ margin: '0 8px' }}>使用实时预览</span>
                        <Button size="small" onClick={() => this.fetchLivePreview()} disabled={!this.props.mockUrl}>刷新实时预览</Button>
                        {liveError && <span style={{ color: '#d4380d', marginLeft: 8 }}>{liveError}</span>}
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                        <HighlightCode key={code} code={code} language="json" />
                    </div>
                </div>
            </div>
        );
    }

    render() {
        const { visible, onCancel, record, inline } = this.props;
        const { mockMode } = this.state;

        if (inline) {
            return (
                <div className="mock-editor-inline">
                    <div className="mock-editor-toolbar" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                        <div className="mock-mode-selector" style={{ display: 'flex', alignItems: 'center' }}>
                            <label>Mock模式：</label>
                            <Select
                                value={mockMode}
                                onChange={this.handleModeChange}
                                style={{ width: 200, marginLeft: 10 }}
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
                            />
                            <span style={{ color: '#666', marginLeft: 12 }}>Mock URL：</span>
                            <Input
                                style={{ width: 280 }}
                                size="small"
                                readOnly
                                placeholder="未配置"
                                value={this.props.mockUrl || ''}
                            />
                            <Button size="small" onClick={this.handleCopyUrl} disabled={!this.props.mockUrl}>复制</Button>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <Button type="primary" onClick={this.handleSave}>保存</Button>
                            {onCancel && <Button style={{ marginLeft: 8 }} onClick={onCancel}>取消</Button>}
                        </div>
                    </div>
                    <div className="mock-editor-sections" style={{ display: 'flex', gap: 12 }}>
                        <div className="mock-editor-section left" style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                                <strong>模板编辑</strong>
                                <div style={{ marginLeft: 'auto' }}>
                                    <Button onClick={this.handleRegenerate}>重新生成预览</Button>
                                </div>
                            </div>
                            {this.renderTemplateEditor()}
                            {this.state.errorMsg && (
                                <div style={{ color: '#d4380d', marginTop: 6 }}>{this.state.errorMsg}</div>
                            )}
                        </div>
                        <div className="mock-editor-section right" style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ display: 'block', marginBottom: 6 }}>预览效果</strong>
                            {this.renderPreview()}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <Modal
                title={`编辑Mock数据 - ${record && record.name || '未命名API'}`}
                visible={visible}
                onCancel={onCancel}
                width={960}
                bodyStyle={{ height: '74vh', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
                footer={[
                    <Button key="cancel" onClick={onCancel}>
                        取消
                    </Button>,
                    <Button key="save" type="primary" onClick={this.handleSave}>
                        保存
                    </Button>
                ]}
                className="mock-editor-modal"
            >
                <div className="mock-editor-toolbar" style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <div className="mock-mode-selector" style={{ display: 'flex', alignItems: 'center' }}>
                        <label>Mock模式：</label>
                        <Select
                            value={mockMode}
                            onChange={this.handleModeChange}
                            style={{ width: 200, marginLeft: 10 }}
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
                        />
                        <span style={{ color: '#666', marginLeft: 12 }}>Mock URL：</span>
                        <Input
                            style={{ width: 320 }}
                            size="small"
                            readOnly
                            placeholder="未配置"
                            value={this.props.mockUrl || ''}
                        />
                        <Button size="small" onClick={this.handleCopyUrl} disabled={!this.props.mockUrl}>复制</Button>
                    </div>
                </div>
                <div className="mock-editor-sections" style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
                    <div className="mock-editor-section left" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                            <strong>模板编辑</strong>
                            <div style={{ marginLeft: 'auto' }}>
                                <Button onClick={this.handleRegenerate}>重新生成预览</Button>
                            </div>
                        </div>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                            {this.renderTemplateEditor()}
                            {this.state.errorMsg && (
                                <div style={{ color: '#d4380d', marginTop: 6 }}>{this.state.errorMsg}</div>
                            )}
                        </div>
                    </div>
                    <div className="mock-editor-section right" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                            {this.renderPreview()}
                        </div>
                    </div>
                </div>
            </Modal>
        );
    }
}

export default Form.create()(MockEditor);
