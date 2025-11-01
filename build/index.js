import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { scanAppDirectory, printRouteTree } from './scan-app.js'
import { prerenderStaticRoutes } from './render-static.js'

/**
 * Mini Next.js App Router 构建系统
 *
 * 构建流程：
 * 1. 扫描 app/ 目录，构建路由树
 * 2. 分析 Client Components
 * 3. 使用 Vite 构建客户端代码
 * 4. 生成路由清单
 * 5. 预渲染 SSG 页面
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

console.log('\n🚀 Mini Next.js App Router 构建开始...\n')

// ==================== 第一步：清理输出目录 ====================
console.log('1️⃣  清理输出目录...')
const outputDir = path.join(projectRoot, '.next')

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true })
}

// 只创建 static 目录，cache 目录会由 metadata.js 按需创建
fs.mkdirSync(path.join(outputDir, 'static'), { recursive: true })

console.log('  ✓ 输出目录已清理\n')

// ==================== 第二步：扫描 app/ 目录 ====================
console.log('2️⃣  扫描 app/ 目录...')
const appDir = path.join(projectRoot, 'app')

if (!fs.existsSync(appDir)) {
  console.error('❌ app/ 目录不存在，请创建 app 目录')
  process.exit(1)
}

const routeTree = scanAppDirectory(appDir)

console.log('\n📍 路由树结构:')
printRouteTree(routeTree)
console.log()

// ==================== 第三步：构建客户端代码 ====================
console.log('3️⃣  构建客户端代码...')

try {
  // 使用 Vite 构建
  execSync('npx vite build', {
    cwd: projectRoot,
    stdio: 'inherit'
  })

  console.log('  ✓ 客户端构建完成\n')
} catch (error) {
  console.error('❌ 客户端构建失败')
  process.exit(1)
}

// ==================== 第四步：生成路由清单 ====================
console.log('4️⃣  生成路由清单...')

const manifest = {
  routeTree,
  buildTime: new Date().toISOString(),
  version: '1.0.0',
  prerendered: []  // 将在预渲染后填充
}

const manifestPath = path.join(outputDir, 'manifest.json')

console.log('  ✓ 路由清单已生成\n')

// ==================== 第五步：预渲染静态页面 ====================
try {
  // 构建 Client Component 映射表
  const clientComponentMap = await buildClientComponentMap(routeTree)

  // 预渲染所有静态路由
  const prerendered = await prerenderStaticRoutes(routeTree, clientComponentMap)

  // 更新 manifest
  manifest.prerendered = prerendered
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

} catch (error) {
  console.error('❌ 预渲染失败:', error.message)
  console.log('  继续构建流程...\n')

  // 即使预渲染失败，也保存 manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

// ==================== 构建完成 ====================
console.log('✅ 构建完成!\n')
console.log('运行 npm start 启动服务器\n')

/**
 * 构建 Client Component 映射表
 */
async function buildClientComponentMap(routeTree) {
  const clientComponentMap = new Map()
  const { isClientComponent } = await import('../shared/detect-client.js')

  // 扫描路由树中的 Client Components
  async function scanNode(node) {
    // 检查 page
    if (node.page?.isClient) {
      const componentModule = await import(node.page.absolutePath)
      const Component = componentModule.default

      const relativePath = './' + path.relative(projectRoot, node.page.absolutePath)

      clientComponentMap.set(Component, {
        id: relativePath,
        chunks: [path.basename(node.page.file, path.extname(node.page.file))],
        name: 'default'
      })
    }

    // 检查 layout
    if (node.layout?.isClient) {
      const componentModule = await import(node.layout.absolutePath)
      const Component = componentModule.default

      const relativePath = './' + path.relative(projectRoot, node.layout.absolutePath)

      clientComponentMap.set(Component, {
        id: relativePath,
        chunks: [path.basename(node.layout.file, path.extname(node.layout.file))],
        name: 'default'
      })
    }

    // 递归扫描子节点
    if (node.children) {
      for (const child of node.children) {
        await scanNode(child)
      }
    }
  }

  // 扫描 client/ 目录
  const clientDir = path.join(projectRoot, 'client')
  if (fs.existsSync(clientDir)) {
    const clientFiles = fs.readdirSync(clientDir)
      .filter(f => f.endsWith('.jsx') || f.endsWith('.js'))

    for (const file of clientFiles) {
      const absolutePath = path.join(clientDir, file)
      try {
        const componentModule = await import(absolutePath)
        const Component = componentModule.default

        if (Component) {
          const relativePath = './' + path.relative(projectRoot, absolutePath)

          clientComponentMap.set(Component, {
            id: relativePath,
            chunks: [path.basename(file, path.extname(file))],
            name: 'default'
          })
        }
      } catch (error) {
        // 跳过无法导入的文件
      }
    }
  }

  await scanNode(routeTree)

  return clientComponentMap
}
