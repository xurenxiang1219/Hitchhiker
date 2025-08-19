import React from 'react';
import { Modal, Button, message, List, Tag, Icon } from 'antd';
import { DtoRecord } from '../../common/interfaces/dto_record';
import MockEditorModal from '../api_mock/MockEditorModal';
import { MockMode } from '../../common/enum/mock_mode';
import { MockGenerator } from '../../utils/mock_generator';
import './style/mock_manager.less';

interface MockManagerProps {
    visible: boolean;
    record?: DtoRecord;
    onClose: () => void;
}

interface MockManagerState {
    isEditorVisible: boolean;
    mockList: any[];
    currentMock?: any;
}

class MockManager extends React.Component<MockManagerProps, MockManagerState> {
    
    constructor(props: MockManagerProps) {
        super(props);
        this.state = {
            isEditorVisible: false,
            mockList: [],
            currentMock: undefined
        };
    }

    componentDidMount() {
        this.loadMockList();
    }

    componentDidUpdate(prevProps: MockManagerProps) {
        if (this.props.record !== prevProps.record && this.props.record) {
            this.loadMockList();
        }
    }

    loadMockList = () => {
        // 这里应该调用API获取mock数据列表
        // 暂时使用模拟数据
        if (this.props.record) {
            const mockList = [
                {
                    id: '1',
                    name: '默认Mock数据',
                    method: this.props.record.method,
                    url: this.props.record.url,
                    isActive: true,
                    mode: 'template',
                    createTime: new Date().toISOString(),
                    data: MockGenerator.generateSampleData(this.props.record)
                }
            ];
            this.setState({ mockList });
        }
    }

    showEditor = (mock?: any) => {
        this.setState({
            isEditorVisible: true,
            currentMock: mock
        });
    }

    hideEditor = () => {
        this.setState({
            isEditorVisible: false,
            currentMock: undefined
        });
    }

    handleSaveMock = (mockData: any) => {
        console.log('保存Mock数据:', mockData);
        message.success('Mock数据保存成功！------');
        this.hideEditor();
        this.loadMockList();
    }

    handleToggleActive = (mockId: string) => {
        const { mockList } = this.state;
        const updatedList = mockList.map(mock => 
            mock.id === mockId ? { ...mock, isActive: !mock.isActive } : mock
        );
        this.setState({ mockList: updatedList });
        message.success('Mock状态更新成功！');
    }

    handleDeleteMock = (mockId: string) => {
        const { mockList } = this.state;
        const updatedList = mockList.filter(mock => mock.id !== mockId);
        this.setState({ mockList: updatedList });
        message.success('Mock数据删除成功！');
    }

    render() {
        const { visible, record, onClose } = this.props;
        const { isEditorVisible, mockList, currentMock } = this.state;

        if (!record) {
            return null;
        }

        return (
            <div>
                <Modal
                    title={`Mock数据管理 - ${record.name}`}
                    visible={visible}
                    onCancel={onClose}
                    width={800}
                    footer={[
                        <Button key="close" onClick={onClose}>
                            关闭
                        </Button>
                    ]}
                >
                    <div className="mock-manager">
                        <div className="api-info">
                            <Tag color="blue">{record.method}</Tag>
                            <span className="api-url">{record.url}</span>
                        </div>
                        <div className="mock-list">
                            <div className="mock-list-header">
                                <h4>Mock数据列表</h4>
                                <Button onClick={this.showEditor}>
                                    <Icon type="plus" /> 新建Mock
                                </Button>
                            </div>
                            
                            <List
                                dataSource={mockList}
                                renderItem={(mock: any) => (
                                    <List.Item
                                        actions={[
                                            <Button size="small" onClick={() => this.showEditor(mock)}>
                                                编辑
                                            </Button>,
                                            <Button size="small" onClick={() => this.handleToggleActive(mock.id)}>
                                                {mock.isActive ? '禁用' : '启用'}
                                            </Button>,
                                            <Button size="small" onClick={() => this.handleDeleteMock(mock.id)}>
                                                删除
                                            </Button>
                                        ]}
                                    >
                                        <List.Item.Meta
                                            title={
                                                <div>
                                                    {mock.name}
                                                    {mock.isActive && <Tag color="green" style={{ marginLeft: 8 }}>启用中</Tag>}
                                                </div>
                                            }
                                            description={`${mock.mode === 'template' ? 'MockJS模板' : '原生数据'} - 创建于 ${new Date(mock.createTime).toLocaleString()}`}
                                        />
                                    </List.Item>
                                )}
                            />
                        </div>

                        {currentMock && (
                            <div className="mock-preview">
                                <h4>Mock预览</h4>
                                <pre className="mock-preview-content">
                                    {JSON.stringify(currentMock.data, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </Modal>

                <MockEditorModal
                    visible={isEditorVisible}
                    title={`Mock编辑器 - ${record && record.name ? record.name : ''}`}
                    initialData={undefined}
                    initialMode={MockMode.template}
                    mockEnabled={true}
                    mockUrl={record ? record.url : ''}
                    onCancel={this.hideEditor}
                    onSave={(result) => this.handleSaveMock(result)}
                />
            </div>
        );
    }
}

export default MockManager;
