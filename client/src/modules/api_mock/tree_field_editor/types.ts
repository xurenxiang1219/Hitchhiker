// 树形字段编辑器的类型定义

export type FieldType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export type MockType = 'Mock' | 'Fixed';

export interface FieldNode {
  id: string;
  key: string;
  type: FieldType;
  value: any;
  description: string;
  mockType: MockType;
  mockValue?: string; // MockJS 语法，如 @name, @email 等
  children?: FieldNode[];
  expanded?: boolean;
  level: number;
  parent?: string; // 父节点ID
}

export interface TreeEditorState {
  rootNodes: FieldNode[];
  selectedNodeId?: string;
  expandedNodes: Set<string>;
}

// 字段类型配置
export const FIELD_TYPE_CONFIG = {
  object: {
    label: 'Object',
    icon: '{}',
    color: '#1890ff',
    defaultValue: {},
    canHaveChildren: true
  },
  array: {
    label: 'Array',
    icon: '[]',
    color: '#52c41a',
    defaultValue: [],
    canHaveChildren: true
  },
  string: {
    label: 'String',
    icon: 'S',
    color: '#fa8c16',
    defaultValue: '',
    canHaveChildren: false
  },
  number: {
    label: 'Number',
    icon: 'N',
    color: '#eb2f96',
    defaultValue: 0,
    canHaveChildren: false
  },
  boolean: {
    label: 'Boolean',
    icon: 'B',
    color: '#722ed1',
    defaultValue: false,
    canHaveChildren: false
  },
  null: {
    label: 'Null',
    icon: 'N',
    color: '#8c8c8c',
    defaultValue: null,
    canHaveChildren: false
  }
};

// MockJS 常用语法配置
export const MOCK_SYNTAX_OPTIONS = [
  { label: '@string', value: '@string', description: '随机字符串' },
  { label: '@name', value: '@name', description: '随机姓名' },
  { label: '@cname', value: '@cname', description: '随机中文姓名' },
  { label: '@email', value: '@email', description: '随机邮箱' },
  { label: '@url', value: '@url', description: '随机URL' },
  { label: '@datetime', value: '@datetime', description: '随机日期时间' },
  { label: '@date', value: '@date', description: '随机日期' },
  { label: '@time', value: '@time', description: '随机时间' },
  { label: '@integer(1,100)', value: '@integer(1,100)', description: '1-100的随机整数' },
  { label: '@float(1,100,2,2)', value: '@float(1,100,2,2)', description: '随机浮点数' },
  { label: '@boolean', value: '@boolean', description: '随机布尔值' },
  { label: '@guid', value: '@guid', description: '随机GUID' },
  { label: '@id', value: '@id', description: '随机ID' },
  { label: '@increment', value: '@increment', description: '自增数字' },
  { label: '@image', value: '@image', description: '随机图片URL' },
  { label: '@color', value: '@color', description: '随机颜色' },
  { label: '@paragraph', value: '@paragraph', description: '随机段落' },
  { label: '@sentence', value: '@sentence', description: '随机句子' },
  { label: '@word', value: '@word', description: '随机单词' },
  { label: '@title', value: '@title', description: '随机标题' },
  { label: '@city', value: '@city', description: '随机城市' },
  { label: '@province', value: '@province', description: '随机省份' },
  { label: '@county', value: '@county', description: '随机县' },
  { label: '@zip', value: '@zip', description: '随机邮编' },
];
