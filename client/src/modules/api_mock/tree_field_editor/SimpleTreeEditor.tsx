import React, { Component } from 'react';
import { Button, Input, Select } from 'antd';

const { Option } = Select;

// 简化的字段类型
type SimpleFieldType = 'object' | 'array' | 'string' | 'number' | 'boolean';

interface SimpleFieldNode {
  id: string;
  key: string;
  type: SimpleFieldType;
  value: any;
  description: string;
  mockValue?: string;
  useMock: boolean;
  children?: SimpleFieldNode[];
  expanded: boolean;
  level: number;
}

// 字段类型配置
const FIELD_TYPES = {
  object: { label: 'Object', color: '#1890ff', defaultValue: {}, canHaveChildren: true },
  array: { label: 'Array', color: '#52c41a', defaultValue: [], canHaveChildren: true },
  string: { label: 'String', color: '#fa8c16', defaultValue: '', canHaveChildren: false },
  number: { label: 'Number', color: '#eb2f96', defaultValue: 0, canHaveChildren: false },
  boolean: { label: 'Boolean', color: '#722ed1', defaultValue: false, canHaveChildren: false }
};

// MockJS 语法选项
const MOCK_OPTIONS = [
  { label: '@string', value: '@string' },
  { label: '@name', value: '@name' },
  { label: '@cname', value: '@cname' },
  { label: '@email', value: '@email' },
  { label: '@datetime', value: '@datetime' },
  { label: '@integer(1,100)', value: '@integer(1,100)' },
  { label: '@boolean', value: '@boolean' },
  { label: '@guid', value: '@guid' }
];

interface SimpleTreeEditorProps {
  initialData?: any;
  fieldDescriptions?: { [key: string]: string };
  onChange?: (data: any, descriptions: { [key: string]: string }) => void;
  style?: React.CSSProperties;
}

interface SimpleTreeEditorState {
  nodes: SimpleFieldNode[];
}

// 生成唯一ID
const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 从JSON转换为树节点
const jsonToNodes = (obj: any, level = 0): SimpleFieldNode[] => {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.keys(obj).map(key => {
    const value = obj[key];
    let type: SimpleFieldType = 'string';
    let children: SimpleFieldNode[] = [];
    
    if (value === null) {
      type = 'string';
    } else if (Array.isArray(value)) {
      type = 'array';
      if (value.length > 0) {
        children = jsonToNodes({ '0': value[0] }, level + 1);
      }
    } else if (typeof value === 'object') {
      type = 'object';
      children = jsonToNodes(value, level + 1);
    } else if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    }
    
    return {
      id: generateId(),
      key,
      type,
      value,
      description: '',
      useMock: false,
      children,
      expanded: level < 2,
      level
    };
  });
};

// 从树节点转换为JSON
const nodesToJson = (nodes: SimpleFieldNode[]): any => {
  const result: any = {};
  
  nodes.forEach(node => {
    let value = node.value;
    
    if (node.type === 'object' && node.children && node.children.length > 0) {
      value = nodesToJson(node.children);
    } else if (node.type === 'array' && node.children && node.children.length > 0) {
      const itemValue = nodesToJson(node.children);
      value = [itemValue];
    } else if (node.useMock && node.mockValue) {
      value = node.mockValue;
    } else {
      value = FIELD_TYPES[node.type].defaultValue;
    }
    
    result[node.key] = value;
  });
  
  return result;
};

const SimpleTreeEditor: React.FC<SimpleTreeEditorProps> = ({
  initialData = {},
  fieldDescriptions = {},
  onChange,
  style
}) => {
  const [nodes, setNodes] = useState<SimpleFieldNode[]>([]);
  
  // 初始化
  useEffect(() => {
    const initialNodes = jsonToNodes(initialData);
    
    // 应用描述
    const applyDescriptions = (nodes: SimpleFieldNode[], pathPrefix = ''): SimpleFieldNode[] => {
      return nodes.map(node => {
        const fullPath = pathPrefix ? `${pathPrefix}.${node.key}` : node.key;
        const description = fieldDescriptions[fullPath] || '';
        
        let updatedNode = { ...node, description };
        if (node.children) {
          updatedNode.children = applyDescriptions(node.children, fullPath);
        }
        
        return updatedNode;
      });
    };
    
    setNodes(applyDescriptions(initialNodes));
  }, [initialData, fieldDescriptions]);
  
  // 通知变化
  useEffect(() => {
    if (onChange) {
      const data = nodesToJson(nodes);
      const descriptions: { [key: string]: string } = {};
      
      const collectDescriptions = (nodes: SimpleFieldNode[], pathPrefix = '') => {
        nodes.forEach(node => {
          const fullPath = pathPrefix ? `${pathPrefix}.${node.key}` : node.key;
          if (node.description) {
            descriptions[fullPath] = node.description;
          }
          if (node.children) {
            collectDescriptions(node.children, fullPath);
          }
        });
      };
      
      collectDescriptions(nodes);
      onChange(data, descriptions);
    }
  }, [nodes, onChange]);
  
  // 更新节点
  const updateNode = (nodeId: string, updates: Partial<SimpleFieldNode>) => {
    const updateInTree = (nodes: SimpleFieldNode[]): SimpleFieldNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          const updated = { ...node, ...updates };
          if (updates.type && updates.type !== node.type) {
            const config = FIELD_TYPES[updates.type];
            updated.value = config.defaultValue;
            updated.children = config.canHaveChildren ? [] : undefined;
          }
          return updated;
        }
        if (node.children) {
          return { ...node, children: updateInTree(node.children) };
        }
        return node;
      });
    };
    
    setNodes(updateInTree);
  };
  
  // 删除节点
  const deleteNode = (nodeId: string) => {
    const removeFromTree = (nodes: SimpleFieldNode[]): SimpleFieldNode[] => {
      return nodes.filter(node => {
        if (node.id === nodeId) return false;
        if (node.children) {
          node.children = removeFromTree(node.children);
        }
        return true;
      });
    };
    
    setNodes(removeFromTree);
  };
  
  // 添加子节点
  const addChild = (parentId: string) => {
    const addToTree = (nodes: SimpleFieldNode[]): SimpleFieldNode[] => {
      return nodes.map(node => {
        if (node.id === parentId) {
          const children = node.children || [];
          const newKey = `newField${children.length + 1}`;
          const newNode: SimpleFieldNode = {
            id: generateId(),
            key: newKey,
            type: 'string',
            value: '',
            description: '',
            useMock: false,
            expanded: true,
            level: node.level + 1
          };
          return {
            ...node,
            children: [...children, newNode],
            expanded: true
          };
        }
        if (node.children) {
          return { ...node, children: addToTree(node.children) };
        }
        return node;
      });
    };
    
    setNodes(addToTree);
  };
  
  // 添加根节点
  const addRootNode = () => {
    const newKey = `newField${nodes.length + 1}`;
    const newNode: SimpleFieldNode = {
      id: generateId(),
      key: newKey,
      type: 'string',
      value: '',
      description: '',
      useMock: false,
      expanded: true,
      level: 0
    };
    
    setNodes([...nodes, newNode]);
  };
  
  // 切换展开
  const toggleExpand = (nodeId: string) => {
    const foundNode = nodes.find(n => findNodeById(n, nodeId));
    if (foundNode) {
      const targetNode = findNodeById(foundNode, nodeId);
      updateNode(nodeId, { expanded: !(targetNode && targetNode.expanded) });
    }
  };
  
  // 查找节点
  const findNodeById = (node: SimpleFieldNode, id: string): SimpleFieldNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNodeById(child, id);
        if (found) return found;
      }
    }
    return null;
  };
  
  // 渲染单个节点
  const renderNode = (node: SimpleFieldNode, siblings: SimpleFieldNode[]): React.ReactNode => {
    const config = FIELD_TYPES[node.type];
    const hasChildren = node.children && node.children.length > 0;
    const indent = node.level * 20;
    
    return (
      <div key={node.id}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '6px 8px',
          borderBottom: '1px solid #f0f0f0',
          marginLeft: indent
        }}>
          {/* 展开按钮 */}
          <div style={{ width: 20 }}>
            {config.canHaveChildren && (
              <Button
                size="small"
                style={{ width: 16, height: 16, padding: 0, fontSize: 12 }}
                onClick={() => toggleExpand(node.id)}
              >
                {hasChildren ? (node.expanded ? '▼' : '▶') : ''}
              </Button>
            )}
          </div>
          
          {/* 字段名 */}
          <Input
            size="small"
            value={node.key}
            onChange={(e) => updateNode(node.id, { key: e.target.value })}
            style={{ width: 100, marginLeft: 8 }}
          />
          
          {/* 类型选择 */}
          <Select
            size="small"
            value={node.type}
            onChange={(type: SimpleFieldType) => updateNode(node.id, { type })}
            style={{ width: 80, marginLeft: 8 }}
          >
            {Object.keys(FIELD_TYPES).map((type) => {
              const config = FIELD_TYPES[type as SimpleFieldType];
              return (
                <Option key={type} value={type}>
                  <span style={{ color: config.color }}>{config.label}</span>
                </Option>
              );
            })}
          </Select>
          
          {/* Mock开关 */}
          <Button
            size="small"
            style={{ 
              marginLeft: 8, 
              backgroundColor: node.useMock ? '#1890ff' : '#f0f0f0',
              color: node.useMock ? '#fff' : '#666'
            }}
            onClick={() => updateNode(node.id, { useMock: !node.useMock })}
          >
            {node.useMock ? 'Mock' : '固定'}
          </Button>
          
          {/* 值编辑 */}
          <div style={{ marginLeft: 8, width: 120 }}>
            {config.canHaveChildren ? (
              <span style={{ color: '#999', fontSize: 12 }}>
                {node.type === 'object' ? '{}' : '[]'} {hasChildren ? `${node.children!.length} items` : '0 items'}
              </span>
            ) : node.useMock ? (
              <Select
                size="small"
                value={node.mockValue}
                onChange={(mockValue) => updateNode(node.id, { mockValue: mockValue as string })}
                placeholder="选择Mock语法"
                style={{ width: '100%' }}
              >
                {MOCK_OPTIONS.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            ) : node.type === 'boolean' ? (
              <Select
                size="small"
                value={node.value}
                onChange={(value) => updateNode(node.id, { value })}
                style={{ width: '100%' }}
              >
                <Option value="true">true</Option>
                <Option value="false">false</Option>
              </Select>
            ) : (
              <Input
                size="small"
                value={node.value}
                onChange={(e) => {
                  let value: any = e.target.value;
                  if (node.type === 'number') {
                    value = parseFloat(value) || 0;
                  }
                  updateNode(node.id, { value });
                }}
                style={{ width: '100%' }}
              />
            )}
          </div>
          
          {/* 描述 */}
          <Input
            size="small"
            value={node.description}
            onChange={(e) => updateNode(node.id, { description: e.target.value })}
            placeholder="描述"
            style={{ width: 100, marginLeft: 8 }}
          />
          
          {/* 操作按钮 */}
          <div style={{ marginLeft: 8, display: 'flex', gap: 4 }}>
            {config.canHaveChildren && (
              <Button size="small" onClick={() => addChild(node.id)}>+</Button>
            )}
            <Button size="small" onClick={() => deleteNode(node.id)} style={{ color: '#ff4d4f' }}>×</Button>
          </div>
        </div>
        
        {/* 子节点 */}
        {node.children && node.expanded && (
          <div>
            {node.children.map(child => renderNode(child, node.children!))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div style={{ 
      border: '1px solid #d9d9d9', 
      borderRadius: 6, 
      backgroundColor: '#fafafa',
      ...style 
    }}>
      {/* 头部 */}
      <div style={{ 
        padding: '8px 12px', 
        borderBottom: '1px solid #e8e8e8',
        backgroundColor: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span style={{ fontWeight: 'bold', fontSize: 13 }}>数据结构</span>
        <Button size="small" onClick={addRootNode}>添加字段</Button>
      </div>

      {/* 列标题 */}
      <div style={{ 
        padding: '6px 8px', 
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e8e8e8',
        fontSize: 12,
        color: '#666',
        display: 'flex',
        alignItems: 'center'
      }}>
        <span style={{ width: 20 }}></span>
        <span style={{ width: 100, marginLeft: 8 }}>字段名</span>
        <span style={{ width: 80, marginLeft: 8 }}>类型</span>
        <span style={{ width: 50, marginLeft: 8 }}>模式</span>
        <span style={{ width: 120, marginLeft: 8 }}>值</span>
        <span style={{ width: 100, marginLeft: 8 }}>描述</span>
        <span style={{ marginLeft: 8 }}>操作</span>
      </div>

      {/* 节点列表 */}
      <div style={{ 
        maxHeight: 400, 
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        {nodes.length === 0 ? (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: '#999'
          }}>
            暂无字段，点击"添加字段"开始创建
          </div>
        ) : (
          nodes.map(node => renderNode(node, nodes))
        )}
      </div>
    </div>
  );
};

export default SimpleTreeEditor;
