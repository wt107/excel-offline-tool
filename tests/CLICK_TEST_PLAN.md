# Excel 离线工具 - 逐一点击操作测试计划

## 测试目标
确保每一个按钮、每一个可点击元素都被测试到。

---

## 点击操作清单

### 1. 模式选择按钮 (5个)
| 按钮 | onclick | 测试状态 |
|-----|---------|---------|
| 按工作表拆分 | `switchMode('split-sheet')` | ✅ |
| 按列拆分(横向) | `switchMode('split-column')` | ✅ |
| 按列拆分(竖向) | `switchMode('split-column-vertical')` | ✅ |
| 文件合并 | `switchMode('merge-file')` | ✅ |
| 工作表数据合并 | `switchMode('merge-sheet')` | ✅ |

### 2. 步骤导航按钮 (8个)
| 按钮 | onclick | 位置 | 测试状态 |
|-----|---------|------|---------|
| 下一步 (步骤1) | `goToStep(2)` | #step1Next | ✅ |
| 上一步 (步骤2) | `goToStep(1)` | step2 | ❌ |
| 下一步 (步骤2) | `goToStepFrom2()` | #step2Next | ✅ |
| 上一步 (步骤3) | `goToStep(2)` | step3 | ❌ |
| 下一步 (步骤3) | `goToStep(4)` | #step3Next | ✅ |
| 上一步 (步骤4) | `goToStep(3)` | step4 | ❌ |
| 重新开始 | `resetTool()` | step4 | ✅ |
| 下载文件 | `downloadAllFiles()` | #downloadBtn | ✅ |

### 3. 选择操作按钮 (8个)
| 按钮 | onclick | 位置 | 测试状态 |
|-----|---------|------|---------|
| 全选 | `selectAllSheets()` | splitSheetOptions | ❌ |
| 取消全选 | `deselectAllSheets()` | splitSheetOptions | ❌ |
| 全选(竖向固定列) | `selectAllVerticalColumns()` | splitColumnVerticalOptions | ❌ |
| 取消全选(竖向固定列) | `deselectAllVerticalColumns()` | splitColumnVerticalOptions | ❌ |
| 全选(合并文件) | `selectAllSheets()` | mergeFileOptions | ❌ |
| 取消全选(合并文件) | `deselectAllSheets()` | mergeFileOptions | ❌ |
| 全选(合并工作表) | `selectAllSheets()` | mergeSheetOptions | ❌ |
| 取消全选(合并工作表) | `deselectAllSheets()` | mergeSheetOptions | ❌ |

### 4. 列表项点击 (动态生成)
| 元素 | 点击事件 | 位置 | 测试状态 |
|-----|---------|------|---------|
| 工作表项 | `toggleSheetSelection()` | #sheetList | ✅ |
| 工作表单选 | `selectSingleSheet()` | #sheetList | ✅ |
| 拆分列选择 | `selectColumn()` | #columnList | ✅ |
| 竖向固定列 | `toggleVerticalKeyColumn()` | #verticalKeyColumnList | ❌ |
| 竖向数据列 | `toggleVerticalColumn()` | #verticalColumnList | ❌ |
| 合并文件工作表 | `toggleSheetSelection()` | #mergeFileSheetSelection | ❌ |
| 结果文件下载 | `downloadSingleFile()` | #resultFileList | ❌ |
| 已上传文件删除 | `removeFile()` | #fileList | ❌ |

### 5. 文件上传区域
| 元素 | 事件 | 测试状态 |
|-----|------|---------|
| 上传区域点击 | `click()` 触发 fileInput | ✅ |
| 拖拽上传 | `drop` 事件 | ❌ |

### 6. 其他交互
| 元素 | 事件 | 测试状态 |
|-----|------|---------|
| 表头行数输入 | `input` 事件 | ✅ |
| 自测面板关闭 | `remove()` | ❌ |

---

## 缺失测试统计

| 类别 | 已测试 | 未测试 | 总计 |
|-----|--------|--------|------|
| 模式按钮 | 5 | 0 | 5 |
| 步骤导航 | 4 | 4 | 8 |
| 选择按钮 | 2 | 6 | 8 |
| 列表项点击 | 4 | 4 | 8 |
| 文件上传 | 1 | 1 | 2 |
| 其他 | 1 | 1 | 2 |
| **总计** | **17** | **16** | **33** |

---

## 待补充测试

### 高优先级
1. 所有"上一步"按钮的点击测试
2. 全选/取消全选按钮测试
3. 单个文件下载按钮测试
4. 文件删除按钮测试

### 中优先级
5. 竖向拆分的列选择测试
6. 拖拽上传测试
7. 合并文件模式的工作表选择测试

### 低优先级
8. 自测面板关闭按钮
