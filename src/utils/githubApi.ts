import { GeneratedFile } from '../types/clash';

export interface GithubUserInfo {
  login: string;
  avatar_url: string;
  html_url: string;
}

export interface PushProgress {
  step: string;
  completed: number;
  total: number;
}

function encodeBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function githubFetch(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.trim()}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

export async function verifyGitHubToken(token: string): Promise<GithubUserInfo> {
  const res = await githubFetch('https://api.github.com/user', token);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `Token 验证失败 (HTTP ${res.status})`);
  }
  return res.json();
}

export async function pushFilesToGitHubRepo(params: {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  isPrivate: boolean;
  commitMessage: string;
  files: GeneratedFile[];
  onProgress?: (progress: PushProgress) => void;
}): Promise<{ repoUrl: string; branch: string }> {
  const { token, owner, repo, branch, isPrivate, commitMessage, files, onProgress } = params;
  const totalSteps = files.length + 1;

  onProgress?.({ step: `检查或创建仓库 ${owner}/${repo}...`, completed: 0, total: totalSteps });

  let effectiveBranch = branch;
  const checkRes = await githubFetch(`https://api.github.com/repos/${owner}/${repo}`, token);
  if (checkRes.status === 404) {
    const createRes = await githubFetch('https://api.github.com/user/repos', token, {
      method: 'POST',
      body: JSON.stringify({
        name: repo,
        private: isPrivate,
        description: 'Clash Mi (Mihomo) 自动化分流与节点过滤订阅仓库',
        auto_init: true,
      }),
    });
    if (!createRes.ok) {
      const errBody = await createRes.json().catch(() => ({}));
      throw new Error(`创建仓库失败: ${errBody.message || createRes.statusText}`);
    }
    const createdRepo = await createRes.json().catch(() => null);
    if (createdRepo?.default_branch) {
      effectiveBranch = createdRepo.default_branch;
    }
    // Wait briefly for GitHub to finish initializing default branch
    await new Promise((r) => setTimeout(r, 1200));
  } else if (!checkRes.ok) {
    const errBody = await checkRes.json().catch(() => ({}));
    throw new Error(`访问仓库失败: ${errBody.message || checkRes.statusText}`);
  } else {
    const existingRepo = await checkRes.json().catch(() => null);
    if (existingRepo?.default_branch) {
      effectiveBranch = existingRepo.default_branch;
    }
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    onProgress?.({
      step: `正在提交 ${file.path} (${i + 1}/${files.length})`,
      completed: i + 1,
      total: totalSteps,
    });

    const contentEndpoint = `https://api.github.com/repos/${owner}/${repo}/contents/${file.path}`;
    let existingSha: string | undefined;

    const getFileRes = await githubFetch(`${contentEndpoint}?ref=${encodeURIComponent(effectiveBranch)}`, token);
    if (getFileRes.ok) {
      const existingData = await getFileRes.json();
      existingSha = existingData.sha;
    }

    const putRes = await githubFetch(contentEndpoint, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: `${commitMessage} [${file.path}]`,
        content: encodeBase64Utf8(file.content),
        branch: effectiveBranch,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errBody = await putRes.json().catch(() => ({}));
      throw new Error(`推送 ${file.path} 失败: ${errBody.message || putRes.statusText}`);
    }
  }

  onProgress?.({ step: '全部文件推送完成', completed: totalSteps, total: totalSteps });

  return {
    repoUrl: `https://github.com/${owner}/${repo}`,
    branch: effectiveBranch,
  };
}
