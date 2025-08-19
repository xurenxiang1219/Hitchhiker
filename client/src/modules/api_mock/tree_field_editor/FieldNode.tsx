import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Select, Tooltip, Popover } from 'antd';
import { FieldNode as FieldNodeType, FieldType, MockType, FIELD_TYPE_CONFIG, MOCK_SYNTAX_OPTIONS } from './types';

const { Option } = Select;
const { TextArea } = Input;

interface FieldNodeProps {
  node: FieldNodeType;
  siblings: FieldNodeType[];
  onUpdate: (nodeId: string, updates: Partial<FieldNodeType>) => void;
  onDelete: (nodeId: string) => void;
  onAddChild: (parentId: string) => void;
  onToggleExpand: (nodeId: string) => void;
}

const FieldNode: React.FC<FieldNodeProps> = ({
  node,
  siblings,
  onUpdate,
  onDelete,
  onAddChild,
  onToggleExpand
}) => {
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [editingKey, setEditingKey] = useState(node.key);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const keyInputRef = useRef<Input>(null);

  const config = FIELD_TYPE_CONFIG[node.type];
  const hasChildren = node.children && node.children.length > 0;
  const canHaveChildren = config.canHaveChildren;

  // 处理字段名编辑
  const handleKeyEdit = () => {
    setIsEditingKey(true);
    setEditingKey(node.key);
  };

  const handleKeyConfirm = () => {
    const trimmedKey = editingKey.trim();
    if (trimmedKey && trimmedKey !== node.key) {
      // 检查是否与兄弟节点重名
      const isDuplicate = siblings.some(sibling => 
        sibling.id !== node.id && sibling.key === trimmedKey
      );
      
      if (!isDuplicate) {
        onUpdate(node.id, { key: trimmedKey });
      }
    }
    setIsEditingKey(false);
  };

  const handleKeyCancel = () => {
    setEditingKey(node.key);
    setIsEditingKey(false);
  };

  // 处理类型变更
  const handleTypeChange = (newType: FieldType) => {
    onUpdate(node.id, { type: newType });
  };

  // 处理Mock类型变更
  const handleMockTypeChange = (newMockType: MockType) => {
    onUpdate(node.id, { mockType: newMockType });
  };

  // 处理Mock值变更
  const handleMockValueChange = (mockValue: string) => {
    onUpdate(node.id, { mockValue });
  };

  // 处理描述变更
  const handleDescriptionChange = (description: string) => {
    onUpdate(node.id, { description });
  };

  // 处理固定值变更
  const handleFixedValueChange = (value: any) => {
    onUpdate(node.id, { value });
  };

  useEffect(() => {
    if (isEditingKey && keyInputRef.current) {
      keyInputRef.current.focus();
    }
  }, [isEditingKey]);

  // 渲染展开/折叠按钮
  const renderExpandButton = () => {
    if (!canHaveChildren) return <div style={{ width: 16 }} />;
    
    return (
      <Button
        type="text"
        size="small"
        style={{ width: 16, height: 16, padding: 0, minWidth: 16 }}
        onClick={() => onToggleExpand(node.id)}
        icon={
          hasChildren ? (
            node.expanded ? <CaretDownOutlined /> : <CaretRightOutlined />
          ) : null
        }
      />
    );
  };

  // 渲染字段名
  const renderFieldKey = () => {
    if (isEditingKey) {
      return (
        <Input
          ref={keyInputRef}
          size="small"
          value={editingKey}
          onChange={(e) => setEditingKey(e.target.value)}
          onPressEnter={handleKeyConfirm}
          onBlur={handleKeyConfirm}
          style={{ width: 120 }}
        />
      );
    }

    return (
      <span
        style={{
          cursor: 'pointer',
          padding: '2px 4px',
          borderRadius: 2,
          minWidth: 80,
          display: 'inline-block'
        }}
        onClick={handleKeyEdit}
      >
        {node.key}
      </span>
    );
  };

  // 渲染类型选择器
  const renderTypeSelector = () => {
    return (
      <Select
        size="small"
        value={node.type}
        onChange={handleTypeChange}
        style={{ width: 80 }}
      >
        {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => (
          <Option key={type} value={type}>
            <span style={{ color: config.color }}>
              {config.icon} {config.label}
            </span>
          </Option>
        ))}
      </Select>
    );
  };

  // 渲染Mock类型选择器
  const renderMockTypeSelector = () => {
    return (
      <Select
        size="small"
        value={node.mockType}
        onChange={handleMockTypeChange}
        style={{ width: 60 }}
      >
        <Option value="Fixed">固定</Option>
        <Option value="Mock">Mock</Option>
      </Select>
    );
  };

  // 渲染值编辑器
  const renderValueEditor = () => {
    if (canHaveChildren) {
      return <span style={{ color: '#999', fontSize: 12 }}>
        {node.type === 'object' ? '{}' : '[]'} {hasChildren ? `${node.children!.length} items` : '0 items'}
      </span>;
    }

    if (node.mockType === 'Mock') {
      return (
        <Select
          size="small"
          value={node.mockValue}
          onChange={handleMockValueChange}
          placeholder="选择Mock语法"
          style={{ width: 150 }}
          showSearch
          optionFilterProp="children"
        >
          {MOCK_SYNTAX_OPTIONS.map(option => (
            <Option key={option.value} value={option.value} title={option.description}>
              {option.label}
            </Option>
          ))}
        </Select>
      );
    }

    // 固定值编辑
    if (node.type === 'boolean') {
      return (
        <Select
          size="small"
          value={node.value}
          onChange={handleFixedValueChange}
          style={{ width: 80 }}
        >
          <Option value={true}>true</Option>
          <Option value={false}>false</Option>
        </Select>
      );
    }

    return (
      <Input
        size="small"
        value={node.value}
        onChange={(e) => {
          let value: any = e.target.value;
          if (node.type === 'number') {
            value = parseFloat(value) || 0;
          }
          handleFixedValueChange(value);
        }}
        placeholder={`输入${config.label}值`}
        style={{ width: 120 }}
      />
    );
  };

  // 渲染描述
  const renderDescription = () => {
    const descriptionContent = (
      <div style={{ width: 200 }}>
        <TextArea
          size="small"
          value={node.description}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          placeholder="添加字段描述..."
          rows={3}
          style={{ resize: 'none' }}
        />
      </div>
    );

    return (
      <Popover
        content={descriptionContent}
        title="字段描述"
        trigger="click"
        placement="topLeft"
      >
        <Input
          size="small"
          value={node.description}
          placeholder="描述"
          readOnly
          style={{ 
            width: 100, 
            cursor: 'pointer',
            backgroundColor: node.description ? '#f0f0f0' : 'transparent'
          }}
        />
      </Popover>
    );
  };

  // 渲染操作按钮
  const renderActions = () => {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {canHaveChildren && (
          <Tooltip title="添加子字段">
            <Button
              type="text"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => onAddChild(node.id)}
              style={{ width: 24, height: 24 }}
            />
          </Tooltip>
        )}
        <Tooltip title="删除字段">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => onDelete(node.id)}
            style={{ width: 24, height: 24, color: '#ff4d4f' }}
          />
        </Tooltip>
      </div>
    );
  };

  const indentWidth = node.level * 20;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 8px',
        borderBottom: '1px solid #f0f0f0',
        backgroundColor: '#fff',
        marginLeft: indentWidth
      }}
    >
      {renderExpandButton()}
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, marginLeft: 8 }}>
        {renderFieldKey()}
        {renderTypeSelector()}
        {renderMockTypeSelector()}
        {renderValueEditor()}
        {renderDescription()}
        {renderActions()}
      </div>
    </div>
  );
};

export default FieldNode;
