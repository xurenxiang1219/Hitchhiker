// 树形字段编辑器的工具函数

import { FieldNode, FieldType, FIELD_TYPE_CONFIG } from './types';

// 生成唯一ID
export const generateId = (): string => {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// 从JSON对象转换为树形节点
export const jsonToTreeNodes = (obj: any, parentId?: string, level: number = 0): FieldNode[] => {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  const nodes: FieldNode[] = [];
  
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    const nodeId = generateId();
    
    let type: FieldType = 'string';
    let children: FieldNode[] = [];
    
    if (value === null) {
      type = 'null';
    } else if (Array.isArray(value)) {
      type = 'array';
      // 对于数组，我们创建一个示例项
      if (value.length > 0) {
        children = jsonToTreeNodes({ '0': value[0] }, nodeId, level + 1);
      }
    } else if (typeof value === 'object') {
      type = 'object';
      children = jsonToTreeNodes(value, nodeId, level + 1);
    } else if (typeof value === 'number') {
      type = 'number';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else {
      type = 'string';
    }

    const node: FieldNode = {
      id: nodeId,
      key,
      type,
      value,
      description: '',
      mockType: 'Fixed',
      children,
      expanded: level < 2, // 默认展开前两层
      level,
      parent: parentId
    };

    nodes.push(node);
  });

  return nodes;
};

// 从树形节点转换为JSON对象
export const treeNodesToJson = (nodes: FieldNode[]): any => {
  const result: any = {};

  nodes.forEach(node => {
    let value = node.value;

    if (node.type === 'object' && node.children && node.children.length > 0) {
      value = treeNodesToJson(node.children);
    } else if (node.type === 'array' && node.children && node.children.length > 0) {
      // 对于数组，我们生成一个包含示例项的数组
      const itemValue = treeNodesToJson(node.children);
      value = [itemValue];
    } else if (node.mockType === 'Mock' && node.mockValue) {
      value = node.mockValue;
    } else {
      // 使用默认值
      value = FIELD_TYPE_CONFIG[node.type].defaultValue;
    }

    result[node.key] = value;
  });

  return result;
};

// 创建新的字段节点
export const createNewFieldNode = (
  key: string = 'newField',
  type: FieldType = 'string',
  parentId?: string,
  level: number = 0
): FieldNode => {
  return {
    id: generateId(),
    key,
    type,
    value: FIELD_TYPE_CONFIG[type].defaultValue,
    description: '',
    mockType: 'Fixed',
    children: type === 'object' || type === 'array' ? [] : undefined,
    expanded: true,
    level,
    parent: parentId
  };
};

// 在树中查找节点
export const findNodeById = (nodes: FieldNode[], id: string): FieldNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

// 更新树中的节点
export const updateNodeInTree = (
  nodes: FieldNode[],
  nodeId: string,
  updates: Partial<FieldNode>
): FieldNode[] => {
  return nodes.map(node => {
    if (node.id === nodeId) {
      const updatedNode = { ...node, ...updates };
      
      // 如果类型改变，需要重置相关属性
      if (updates.type && updates.type !== node.type) {
        const config = FIELD_TYPE_CONFIG[updates.type];
        updatedNode.value = config.defaultValue;
        updatedNode.children = config.canHaveChildren ? [] : undefined;
        updatedNode.mockValue = undefined;
      }
      
      return updatedNode;
    }
    
    if (node.children) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeId, updates)
      };
    }
    
    return node;
  });
};

// 删除树中的节点
export const removeNodeFromTree = (nodes: FieldNode[], nodeId: string): FieldNode[] => {
  return nodes.filter(node => {
    if (node.id === nodeId) {
      return false;
    }
    
    if (node.children) {
      node.children = removeNodeFromTree(node.children, nodeId);
    }
    
    return true;
  });
};

// 添加子节点
export const addChildToNode = (
  nodes: FieldNode[],
  parentId: string,
  newNode: FieldNode
): FieldNode[] => {
  return nodes.map(node => {
    if (node.id === parentId) {
      const children = node.children || [];
      return {
        ...node,
        children: [...children, { ...newNode, parent: parentId, level: node.level + 1 }],
        expanded: true // 添加子节点时自动展开
      };
    }
    
    if (node.children) {
      return {
        ...node,
        children: addChildToNode(node.children, parentId, newNode)
      };
    }
    
    return node;
  });
};

// 验证字段名是否有效
export const isValidFieldKey = (key: string, siblings: FieldNode[], currentNodeId?: string): boolean => {
  if (!key || key.trim() === '') {
    return false;
  }
  
  // 检查是否与兄弟节点重名
  return !siblings.some(node => 
    node.key === key && node.id !== currentNodeId
  );
};

// 生成唯一的字段名
export const generateUniqueFieldKey = (baseName: string, siblings: FieldNode[]): string => {
  let counter = 1;
  let newKey = baseName;
  
  while (!isValidFieldKey(newKey, siblings)) {
    newKey = `${baseName}${counter}`;
    counter++;
  }
  
  return newKey;
};
