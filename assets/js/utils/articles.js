/**
 * 文章管理模块
 * 负责加载、解析和搜索文章列表
 */

// 文章数据缓存
let __articlesCache = null;
let __articlesLoaded = false;

/**
 * 解析 Markdown 格式的文章列表
 * 格式：
 * - 分类名 | 分类描述
 *     - [文章标题](阅读时长)(封面图片或留空)(标签1, 标签2, ...)
 * 
 * 封面图片规则：
 * - 留空 () → 自动提取文章第一张图片
 * - 相对路径 → 相对于 /assets/articles/
 * - 以 / 开头 → 网站根目录路径
 * - http 开头 → 外部链接
 * 
 * @param {string} text - Markdown 文本
 * @returns {{ categories: Object, articles: Array }}
 */
export function parseArticlesMarkdown(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length);
  const categories = {}; // { name: desc }
  const articles = [];
  
  let currentCategory = null;
  
  const parseIndent = (s) => {
    const m = s.match(/^(\s*)-/);
    if (!m) return 0;
    const ws = m[1] || '';
    const tabs = (ws.match(/\t/g) || []).length;
    const spaces = (ws.match(/ /g) || []).length;
    return tabs + Math.floor(spaces / 2);
  };
  
  // 解析文章项: [标题](时长)(封面)(标签1, 标签2)
  const parseArticle = (s) => {
    // 匹配格式: [标题](时长)(封面)(标签列表)
    const m = s.match(/\[([^\]]+)\]\(([^)]*)\)\(([^)]*)\)\(([^)]*)\)/);
    if (!m) return null;
    
    const title = m[1].trim();
    const readTime = m[2].trim();
    const coverRaw = m[3].trim();
    const tagsStr = m[4].trim();
    const tags = tagsStr ? tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
    
    // 处理封面路径
    let cover = null;
    if (coverRaw) {
      if (coverRaw.startsWith('http://') || coverRaw.startsWith('https://')) {
        // 外部链接
        cover = coverRaw;
      } else if (coverRaw.startsWith('/')) {
        // 绝对路径
        cover = coverRaw;
      } else {
        // 相对路径，相对于 /assets/articles/
        cover = `/assets/articles/${coverRaw}`;
      }
    }
    
    return { title, readTime, cover, tags };
  };
  
  // 解析分类: "分类名 | 描述" 或 "分类名"
  const parseCategory = (s) => {
    const pipeMatch = s.match(/^(.+?)\s*[|｜]\s*(.+)$/);
    if (pipeMatch) {
      return { name: pipeMatch[1].trim(), desc: pipeMatch[2].trim() };
    }
    return { name: s.trim(), desc: '' };
  };
  
  lines.forEach(raw => {
    const line = raw.trimEnd();
    const ind = parseIndent(raw);
    const content = line.replace(/^[-\s]+/, '');
    
    if (ind === 0) {
      // 顶级分类
      const catInfo = parseCategory(content);
      currentCategory = catInfo.name;
      if (!categories[currentCategory]) {
        categories[currentCategory] = catInfo.desc;
      }
    } else {
      // 文章项
      const article = parseArticle(content);
      if (article && currentCategory) {
        articles.push({
          ...article,
          category: currentCategory
        });
      }
    }
  });
  
  return { categories, articles };
}

/**
 * 尝试获取 WebP 版本的图片 URL
 * @param {string} originalUrl - 原始图片 URL
 * @returns {Promise<string>} WebP URL 或原始 URL
 */
export async function tryWebPVersion(originalUrl) {
  // 如果是外部链接，直接返回
  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    return originalUrl;
  }
  
  // 尝试 WebP 版本
  const webpUrl = originalUrl.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp');
  
  // 检查 WebP 版本是否存在
  try {
    const response = await fetch(webpUrl, { method: 'HEAD', cache: 'no-store' });
    if (response.ok) {
      return webpUrl;
    }
  } catch (error) {
    // 如果检查失败，使用原始 URL
  }
  
  return originalUrl;
}

/**
 * 从 Markdown 内容中提取第一张图片
 * @param {string} mdContent - Markdown 内容
 * @param {string} title - 文章标题（用于构建相对路径）
 * @returns {string|null} 图片 URL 或 null
 */
export function extractFirstImage(mdContent, title) {
  // 匹配 Markdown 图片语法: ![alt](url) 或 ![](url)
  const imgMatch = mdContent.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (!imgMatch) return null;
  
  let imgPath = imgMatch[1].trim();
  
  // 处理相对路径
  if (imgPath.startsWith('./')) {
    imgPath = imgPath.substring(2);
  }
  
  // 如果是相对路径，转换为绝对路径
  if (!imgPath.startsWith('http://') && !imgPath.startsWith('https://') && !imgPath.startsWith('/')) {
    imgPath = `/assets/articles/${imgPath}`;
  }
  
  return imgPath;
}

/**
 * 加载文章内容并提取第一张图片（优先使用 WebP）
 * @param {string} title - 文章标题
 * @returns {Promise<string|null>} 图片 URL 或 null
 */
export async function loadArticleFirstImage(title) {
  try {
    const res = await fetch(`/assets/articles/${encodeURIComponent(title)}.md`, { cache: 'no-store' });
    if (!res.ok) return null;
    const content = await res.text();
    const imageUrl = extractFirstImage(content, title);
    if (!imageUrl) return null;
    
    // 尝试使用 WebP 版本
    return await tryWebPVersion(imageUrl);
  } catch (error) {
    console.warn(`[Articles] 加载文章图片失败: ${title}`, error);
    return null;
  }
}

/**
 * 加载文章列表
 * @returns {Promise<{ categories: Object, articles: Array }>}
 */
export async function loadArticles() {
  if (__articlesLoaded && __articlesCache) {
    return __articlesCache;
  }
  
  const mdUrl = '/assets/docs/articles_list.md';
  try {
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res || !res.ok) {
      console.warn('[Articles] 无法加载文章列表');
      return { categories: {}, articles: [] };
    }
    const text = await res.text();
    __articlesCache = parseArticlesMarkdown(text);
    __articlesLoaded = true;
    return __articlesCache;
  } catch (error) {
    console.warn('[Articles] 加载文章列表失败:', error);
    return { categories: {}, articles: [] };
  }
}

/**
 * 搜索文章
 * @param {string} query - 搜索关键词
 * @param {Array} articles - 文章列表（可选，默认使用缓存）
 * @returns {Array} 匹配的文章列表
 */
export function searchArticles(query, articles = null) {
  const list = articles || (__articlesCache ? __articlesCache.articles : []);
  if (!query || !query.trim()) {
    return list;
  }
  
  const q = query.trim().toLowerCase();
  
  return list.filter(article => {
    // 标题匹配
    if (article.title.toLowerCase().includes(q)) {
      return true;
    }
    // 标签匹配
    if (article.tags && article.tags.some(tag => tag.toLowerCase().includes(q))) {
      return true;
    }
    // 分类匹配
    if (article.category && article.category.toLowerCase().includes(q)) {
      return true;
    }
    return false;
  });
}

/**
 * 按分类分组文章
 * @param {Array} articles - 文章列表
 * @returns {Object} { 分类名: [文章列表] }
 */
export function groupByCategory(articles) {
  const groups = {};
  articles.forEach(article => {
    const cat = article.category || '未分类';
    if (!groups[cat]) {
      groups[cat] = [];
    }
    groups[cat].push(article);
  });
  return groups;
}

/**
 * 获取所有标签
 * @param {Array} articles - 文章列表（可选，默认使用缓存）
 * @returns {Array} 标签列表（去重）
 */
export function getAllTags(articles = null) {
  const list = articles || (__articlesCache ? __articlesCache.articles : []);
  const tagSet = new Set();
  
  list.forEach(article => {
    if (article.tags) {
      article.tags.forEach(tag => tagSet.add(tag));
    }
  });
  
  return [...tagSet].sort();
}

/**
 * 按标签筛选文章
 * @param {string} tag - 标签名
 * @param {Array} articles - 文章列表（可选，默认使用缓存）
 * @returns {Array} 匹配的文章列表
 */
export function filterByTag(tag, articles = null) {
  const list = articles || (__articlesCache ? __articlesCache.articles : []);
  if (!tag) {
    return list;
  }
  
  return list.filter(article => 
    article.tags && article.tags.includes(tag)
  );
}

/**
 * 重置缓存（用于重新加载）
 */
export function resetCache() {
  __articlesCache = null;
  __articlesLoaded = false;
}

/**
 * 获取缓存的文章数据
 * @returns {{ categories: Object, articles: Array } | null}
 */
export function getCachedData() {
  return __articlesCache;
}

