import React, { useState, useEffect, useMemo } from 'react';
import { Button, Divider } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import FieldNode from './FieldNode';
import { 
  FieldNode as FieldNodeType, 
  TreeEditorState 
} from './types';
import {
  jsonToTreeNodes,
  treeNodesToJson,
  createNewFieldNode,
  updateNodeInTree,
  removeNodeFromTree,
  addChildToNode,
  generateUniqueFieldKey
} from './utils';

interface TreeFieldEditorProps {
  initialData?: any;
  fieldDescriptions?: { [key: string]: string };
  onChange?: (data: any, descriptions: { [key: string]: string }) => void;
  style?: React.CSSProperties;
}

const TreeFieldEditor: React.FC<TreeFieldEditorProps> = ({
  initialData = {},
  fieldDescriptions = {},
  onChange,
  style
}) => {
  const [state, setState] = useState<TreeEditorState>({
    rootNodes: [],
    expandedNodes: new Set()
  });

  // 初始化数据
  useEffect(() => {
    const nodes = jsonToTreeNodes(initialData);
    
    // 应用字段描述
    const applyDescriptions = (nodes: FieldNodeType[], pathPrefix = ''): FieldNodeType[] => {
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

    const nodesWithDescriptions = applyDescriptions(nodes);
    
    setState({
      rootNodes: nodesWithDescriptions,
      expandedNodes: new Set(nodesWithDescriptions.filter(n => n.expanded).map(n => n.id))
    });
  }, [initialData, fieldDescriptions]);

  // 生成当前的JSON数据和描述
  const currentData = useMemo(() => {
    return treeNodesToJson(state.rootNodes);
  }, [state.rootNodes]);

  const currentDescriptions = useMemo(() => {
    const descriptions: { [key: string]: string } = {};
    
    const collectDescriptions = (nodes: FieldNodeType[], pathPrefix = '') => {
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
    
    collectDescriptions(state.rootNodes);
    return descriptions;
  }, [state.rootNodes]);

  // 通知父组件数据变化
  useEffect(() => {
    if (onChange) {
      onChange(currentData, currentDescriptions);
    }
  }, [currentData, currentDescriptions, onChange]);

  // 更新节点
  const handleUpdateNode = (nodeId: string, updates: Partial<FieldNodeType>) => {
    setState(prev => ({
      ...prev,
      rootNodes: updateNodeInTree(prev.rootNodes, nodeId, updates)
    }));
  };

  // 删除节点
  const handleDeleteNode = (nodeId: string) => {
    setState(prev => ({
      ...prev,
      rootNodes: removeNodeFromTree(prev.rootNodes, nodeId)
    }));
  };

  // 添加根节点
  const handleAddRootNode = () => {
    const newKey = generateUniqueFieldKey('newField', state.rootNodes);
    const newNode = createNewFieldNode(newKey, 'string', undefined, 0);
    
    setState(prev => ({
      ...prev,
      rootNodes: [...prev.rootNodes, newNode]
    }));
  };

  // 添加子节点
  const handleAddChildNode = (parentId: string) => {
    const parentNode = findNodeInTree(state.rootNodes, parentId);
    if (!parentNode) return;
    
    const siblings = parentNode.children || [];
    const newKey = generateUniqueFieldKey('newField', siblings);
    const newNode = createNewFieldNode(newKey, 'string', parentId, parentNode.level + 1);
    
    setState(prev => ({
      ...prev,
      rootNodes: addChildToNode(prev.rootNodes, parentId, newNode)
    }));
  };

  // 切换展开/折叠
  const handleToggleExpand = (nodeId: string) => {
    setState(prev => {
      const newExpandedNodes = new Set(prev.expandedNodes);
      if (newExpandedNodes.has(nodeId)) {
        newExpandedNodes.delete(nodeId);
      } else {
        newExpandedNodes.add(nodeId);
      }
      
      return {
        ...prev,
        expandedNodes: newExpandedNodes,
        rootNodes: updateNodeInTree(prev.rootNodes, nodeId, { 
          expanded: newExpandedNodes.has(nodeId) 
        })
      };
    });
  };

  // 在树中查找节点
  const findNodeInTree = (nodes: FieldNodeType[], id: string): FieldNodeType | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeInTree(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // 渲染节点树
  const renderNodes = (nodes: FieldNodeType[], parentNodes: FieldNodeType[] = []): React.ReactNode => {
    return nodes.map(node => {
      const siblings = parentNodes.length > 0 ? parentNodes : state.rootNodes;
      
      return (
        <div key={node.id}>
          <FieldNode
            node={node}
            siblings={siblings}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
            onAddChild={handleAddChildNode}
            onToggleExpand={handleToggleExpand}
          />
          {node.children && node.expanded && (
            <div>
              {renderNodes(node.children, node.children)}
            </div>
          )}
        </div>
      );
    });
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 'bold', fontSize: 13 }}>数据结构</span>
          <span style={{ fontSize: 12, color: '#666' }}>
            {state.rootNodes.length} 个字段
          </span>
        </div>
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleAddRootNode}
        >
          添加字段
        </Button>
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
        <div style={{ width: 16 }}></div>
        <div style={{ marginLeft: 8, display: 'flex', gap: 8 }}>
          <span style={{ width: 120 }}>字段名</span>
          <span style={{ width: 80 }}>类型</span>
          <span style={{ width: 60 }}>模式</span>
          <span style={{ width: 150 }}>值</span>
          <span style={{ width: 100 }}>描述</span>
          <span style={{ width: 60 }}>操作</span>
        </div>
      </div>

      {/* 节点列表 */}
      <div style={{ 
        maxHeight: 400, 
        overflowY: 'auto',
        backgroundColor: '#fff'
      }}>
        {state.rootNodes.length === 0 ? (
          <div style={{ 
            padding: 40, 
            textAlign: 'center', 
            color: '#999',
            fontSize: 14
          }}>
            暂无字段，点击"添加字段"开始创建数据结构
          </div>
        ) : (
          renderNodes(state.rootNodes)
        )}
      </div>
    </div>
  );
};

export default TreeFieldEditor;
