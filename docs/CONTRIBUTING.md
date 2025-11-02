# 贡献指南

感谢你对 Mini Next.js App Router 项目感兴趣！这是一个教学向的项目，欢迎各种形式的贡献。

## 📋 如何贡献

### 报告问题

如果你发现了 bug 或有改进建议：

1. 在 [Issues](https://github.com/junejuneli/mini-nextjs-app-router/issues) 中搜索是否已有类似问题
2. 如果没有，创建新 Issue，并包含：
   - 清晰的标题和描述
   - 重现步骤（如果是 bug）
   - 预期行为 vs 实际行为
   - 环境信息（Node.js 版本、操作系统等）

### 提交代码

1. **Fork 项目**
   ```bash
   # 在 GitHub 上 Fork 本仓库
   git clone git@github.com:YOUR_USERNAME/mini-nextjs-app-router.git
   cd mini-nextjs-app-router
   ```

2. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

3. **进行修改**
   - 保持代码风格一致（使用中文注释）
   - 添加必要的注释和文档
   - 确保代码能正常运行

4. **测试修改**
   ```bash
   npm run build
   npm start
   # 访问 http://localhost:3000 测试功能
   ```

5. **提交修改**
   ```bash
   git add .
   git commit -m "feat: 添加某某功能"
   # 或
   git commit -m "fix: 修复某某问题"
   ```

6. **推送并创建 PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   然后在 GitHub 上创建 Pull Request

## 📝 代码规范

### 提交信息格式

使用语义化提交信息：

- `feat:` 新功能
- `fix:` Bug 修复
- `docs:` 文档更新
- `refactor:` 重构代码
- `style:` 代码格式调整
- `test:` 添加测试
- `chore:` 构建/工具相关

**示例：**
```
feat: 添加 error.tsx 错误边界示例
fix: 修复客户端路由缓存问题
docs: 更新 README 中的安装说明
```

### 代码风格

- **注释语言**：使用中文（这是一个教学项目）
- **文件编码**：UTF-8
- **缩进**：2 空格
- **文件名**：kebab-case（小写 + 连字符）
- **React 组件**：PascalCase

### 注释要求

这是一个教学项目，请为关键逻辑添加详细注释：

```javascript
/**
 * 函数功能说明
 *
 * @param {string} param1 - 参数说明
 * @returns {object} 返回值说明
 */
function example(param1) {
  // 步骤说明
  const result = doSomething(param1)

  // 为什么这样做的解释
  return result
}
```

## 🎯 贡献方向

### 欢迎的贡献

1. **文档改进**
   - 修正文档中的错误
   - 添加更多使用示例
   - 改进代码注释
   - 翻译文档（英文版）

2. **示例页面**
   - 添加新的示例场景
   - 完善现有示例
   - 添加交互式示例

3. **功能增强**
   - 实现 Next.js 的更多特性
   - 优化现有实现
   - 提升性能

4. **Bug 修复**
   - 修复已知问题
   - 改进错误处理

### 不建议的修改

由于这是教学项目，以下修改可能不会被接受：

- 过度复杂的实现（会降低可读性）
- 引入过多依赖
- 偏离 Next.js App Router 原始设计的修改
- 移除教学用的日志和注释

## 🤝 行为准则

- 尊重他人，友善交流
- 接受建设性批评
- 关注项目的教学目标
- 帮助新手理解代码

## 📮 联系方式

- 通过 [GitHub Issues](https://github.com/junejuneli/mini-nextjs-app-router/issues) 讨论
- 在 Pull Request 中与维护者交流

## 🙏 致谢

感谢所有贡献者让这个项目变得更好！

---

**再次感谢你的贡献！** 🎉
