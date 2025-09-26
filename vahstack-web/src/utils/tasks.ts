/**
 * 按依赖顺序排序：
 * 1. 被依赖的任务（前置任务）排在前面。
 * 2. 如果存在环依赖会抛错。
 */
export function sortTasksByDependency(tasks) {
  const taskMap = new Map();
  tasks.forEach((t) => taskMap.set(t.taskname, t));

  const edges = new Map();
  const indegree = new Map();

  tasks.forEach((t) => {
    edges.set(t.taskname, []);
    indegree.set(t.taskname, 0);
  });

  tasks.forEach((t) => {
    const deps = t.dependencies?.tasks ?? [];
    deps.forEach(({ taskname: depName }) => {
      if (!taskMap.has(depName)) {
        // 如果依赖不在同一批任务里，这里可以选择忽略或抛错
        // 下面演示忽略：直接 return
        return;
      }
      // depName -> t.taskname
      edges.get(depName).push(t.taskname);
      indegree.set(t.taskname, indegree.get(t.taskname) + 1);
    });
  });

  const queue = [];
  indegree.forEach((deg, name) => {
    if (deg === 0) queue.push(name);
  });

  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    result.push(taskMap.get(cur));

    for (const next of edges.get(cur)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }

  /* ------------------ 循环依赖检测 ------------------ */
  if (result.length !== tasks.length) {
    throw new Error('存在循环依赖：无法得到完整拓扑序！');
  }

  return result;
}

/**
 * 解析语雀文档 URL
 * 例：
 *   https://yuque.antfin.com/bn6t5h/pneb19/xppb9vn5m5apcce0
 *   https://www.yuque.com/foo/bar/baz?spm=a2c4g
 * 返回：
 *   { bookId: "bn6t5h/pneb19", docId: "xppb9vn5m5apcce0" }
 *
 * 规则：
 *   • docId  = 路径最后一段
 *   • bookId = 除最后一段外其余部分用 “/” 拼接
 */
export function parseYuqueUrl(url) {
  const { pathname } = new URL(url);
  // 去掉开头/结尾多余的 “/”，再按 “/” 切分
  const segments = pathname
    .replace(/^\/|\/$/g, '')
    .split('/')
    .filter(Boolean);

  if (segments.length < 2) {
    throw new Error('URL 结构不符合预期，最少应包含 2 段路径');
  }

  const docId = segments.pop(); // 最后一段
  const bookId = segments.join('/'); // 剩余部分

  return { bookId, docId };
}

/**
 * 解析任务规划 Markdown，输出任务 JSON 列表
 *
 * 返回字段：
 * id          任务 id，例如 bff-T003
 * taskname    去掉 -Txxx 的短名，例如 bff
 * name        中文任务名称
 * order       在文档中的顺序号（1,2,3…）
 * changeType  新增 | 修改
 * description 任务内容段（去掉 markdown 标记）
 * deps        依赖的任务 id 数组
 */
export function parseTaskPlanning(md) {
  const headingReg = /^###\s*任务(\d+):\s*([^(]+?)\s*\(([^)]+)\)/gm;

  const tasks = [];
  let m;

  /* ---------- 1. 找到所有标题 ---------- */
  while ((m = headingReg.exec(md)) !== null) {
    const order = Number(m[1]);
    const name = m[2].trim();
    const id = m[3].trim();
    const taskname = id.replace(/-T\d+$/i, '');

    tasks.push({ order, name, id, taskname, start: m.index, end: 0 });
  }

  /* ---------- 2. 计算每块正文结束位置 ---------- */
  tasks.forEach((t, i) => {
    t.end = i === tasks.length - 1 ? md.length : tasks[i + 1].start;
  });

  const order2id = Object.fromEntries(tasks.map((t) => [t.order, t.id]));

  /* ---------- 3. 提取类型 / 描述 / 依赖 ---------- */
  tasks.forEach((t) => {
    const block = md.slice(t.start, t.end);

    /* 3.1 类型 */
    const typeMatch = /[*]{2}类型[*]{2}:\s*([^\n]+)/.exec(block);
    t.changeType = typeMatch ? typeMatch[1].trim() : '';

    /* 3.2 描述 */
    const descMatch = /[*]{2}任务内容[*]{2}:[\s\S]*?(?=\n[*]{2}|$)/.exec(block);
    t.description = descMatch
      ? descMatch[0]
          .replace(/[*]{2}任务内容[*]{2}:/, '')
          .trim()
          .replace(/^- /gm, '')
          .replace(/\r?\n\s*-\s*/g, '\n')
      : '';

    /* 3.3 依赖 */
    const depLine = /[*]{2}依赖关系[*]{2}:\s*([^\n]*)/.exec(block);
    if (depLine) {
      const ids = [];
      const numReg = /任务(\d+)/g;
      let m2;
      while ((m2 = numReg.exec(depLine[1])) !== null) {
        const depOrder = Number(m2[1]);
        order2id[depOrder] && ids.push(order2id[depOrder]);
      }
      t.deps = ids;
    } else {
      t.deps = [];
    }

    delete t.start;
    delete t.end;
  });

  return tasks.sort((a, b) => a.order - b.order);
}
