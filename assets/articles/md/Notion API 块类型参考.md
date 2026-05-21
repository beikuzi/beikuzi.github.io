用于改进 Notion 同步脚本的参考文档。

---

## 一、需要支持的块类型

### 1.1 Callout（高亮提示框）

**API type**: `callout`

**读取结构**:

```json
{
  "type": "callout",
  "callout": {
    "rich_text": [...],
    "icon": {"type": "emoji", "emoji": "💡"},
    "color": "blue_background"
  }
}
```

**转 Markdown 建议**:

- 自定义标记: `:::callout{图标} 内容 :::`
- 或降级为引用: `> 💡 内容`

**可用颜色**:

- 文字色: gray, brown, orange, yellow, green, blue, purple, pink, red
- 背景色: 加 `_background` 后缀，如 `blue_background`

---

### 1.2 Table（表格）

**API type**: `table` + `table_row`

**读取结构**:

```json
{
  "type": "table",
  "table": {
    "table_width": 2,
    "has_column_header": true,
    "has_row_header": false
  },
  "has_children": true
}
```

**子块 table_row**:

```json
{
  "type": "table_row",
  "table_row": {
    "cells": [
      [{"type": "text", "text": {"content": "单元格1"}}],
      [{"type": "text", "text": {"content": "单元格2"}}]
    ]
  }
}
```

**转 Markdown**:

```javascript
| 列A | 列B |
|-----|-----|
| 值1 | 值2 |
```

**注意**: 表格是父子结构，需要先获取 table 块，再获取其 children

---

### 1.3 To-do（待办事项）

**API type**: `to_do`

**读取结构**:

```json
{
  "type": "to_do",
  "to_do": {
    "rich_text": [...],
    "checked": false,
    "color": "default"
  }
}
```

**转 Markdown**: `- [ ] 未完成` 或 `- [x] 已完成`

**创建结构**:

```json
{
  "type": "to_do",
  "to_do": {
    "rich_text": [{"type": "text", "text": {"content": "任务内容"}}],
    "checked": false
  }
}
```

---

### 1.4 Toggle（折叠块）

**API type**: `toggle`

**读取结构**:

```json
{
  "type": "toggle",
  "toggle": {
    "rich_text": [...],
    "color": "default"
  },
  "has_children": true
}
```

**转 Markdown 建议**:

```html
<details>
<summary>标题</summary>
内容...
</details>
```

**注意**: Toggle 有子内容，需要递归获取

---

## 二、已支持的块类型（确认无误）

| 类型 | API type | Markdown |
|---|---|---|
| 段落 | paragraph | 纯文本 |
| 标题 | heading 1/2/3 | # ## ### |
| 无序列表 | bulleted list item | - |
| 有序列表 | numbered list item | 1. |
| 引用 | quote | > |
| 代码块 | code | ` |
| 分割线 | divider | --- |
| 图片 | image | ! |

---

## 三、Pull 脚本修改要点

### 3.1 处理 Callout

```python
elif block_type == 'callout':
    icon = block_data.get('icon', {})
    emoji = icon.get('emoji', '💡') if icon else '💡'
    color = block_data.get('color', 'default')
    # 保留完整信息
    md_lines.append(f':::callout[{emoji}][{color}]')
    md_lines.append(text)
    md_lines.append(':::')
```

### 3.2 处理 Table

```python
elif block_type == 'table':
    # 获取表格子块
    rows = self.get_page_blocks(block['id'])
    if rows:
        # 生成 Markdown 表格
        for i, row in enumerate(rows):
            cells = row.get('table_row', {}).get('cells', [])
            cell_texts = [self._extract_cell_text(c) for c in cells]
            md_lines.append('| ' + ' | '.join(cell_texts) + ' |')
            if i == 0:  # 表头后加分隔线
                md_lines.append('|' + '---|' * len(cells))
```

### 3.3 处理 To-do

```python
elif block_type == 'to_do':
    checked = 'x' if block_data.get('checked', False) else ' '
    md_lines.append(f'- [{checked}] {text}')
```

---

## 四、Sync 脚本修改要点

### 4.1 解析 Markdown 表格

```python
# 检测表格起始
elif stripped.startswith('|') and '|' in stripped[1:]:
    # 收集所有表格行
    table_lines = [stripped]
    i += 1
    while i < len(lines) and lines[i].strip().startswith('|'):
        table_lines.append(lines[i].strip())
        i += 1
    blocks.append(self._create_table_block(table_lines))
    continue
```

### 4.2 解析 To-do

```python
# 在列表处理前添加
import re
todo_match = re.match(r'-\s*\[([ xX])\]\s*(.*)', stripped)
if todo_match:
    checked = todo_[match.group](http://match.group/)(1).lower() == 'x'
    content = todo_[match.group](http://match.group/)(2)
    blocks.append(self._todo_block(content, checked))
```

### 4.3 解析 Callout

```python
# 匹配自定义 callout 标记
elif stripped.startswith(':::callout'):
    # 提取 icon 和 color
    # 收集内容直到 :::
    ...
```

---

## 五、API 限制注意

- **单次创建最多 100 个块**
- **单个文本块最多 2000 字符**
- **表格需先创建父块再 append 子块**
- **图片只能用外部 URL，不能直接上传**