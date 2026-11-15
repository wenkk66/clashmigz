import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ClashWorkspaceState, GeneratedFile } from '../types/clash';
import {
  GithubUserInfo,
  PushProgress,
  pushFilesToGitHubRepo,
  verifyGitHubToken,
} from '../utils/githubApi';

interface RepoDeployViewProps {
  state: ClashWorkspaceState;
  files: GeneratedFile[];
  onChange: (next: ClashWorkspaceState) => void;
  onDownloadZip: () => void;
}

export const RepoDeployView: React.FC<RepoDeployViewProps> = ({
  state,
  files,
  onChange,
  onDownloadZip,
}) => {
  const [token, setToken] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [verifying, setVerifying] = useState<boolean>(false);
  const [verifiedUser, setVerifiedUser] = useState<GithubUserInfo | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  const [pushing, setPushing] = useState<boolean>(false);
  const [pushProgress, setPushProgress] = useState<PushProgress | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushedRepoUrl, setPushedRepoUrl] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { github, overwrite } = state;
  const rawBase = `https://raw.githubusercontent.com/${github.owner}/${github.repo}/${github.branch}`;
  const cdnBase = `https://cdn.jsdelivr.net/gh/${github.owner}/${github.repo}@${github.branch}`;

  const yamlRawUrl = `${rawBase}/override/diversion.yaml`;
  const jsRawUrl = `${rawBase}/override/clash-mi-override.js`;
  const yamlCdnUrl = `${cdnBase}/override/diversion.yaml`;
  const jsCdnUrl = `${cdnBase}/override/clash-mi-override.js`;

  const gitCliSnippet = `mkdir ${github.repo} && cd ${github.repo}
# 解压下载的仓库压缩包后执行：
git init -b ${github.branch}
git add .
git commit -m "${github.commitMessage}"
git remote add origin https://github.com/${github.owner}/${github.repo}.git
git push -u origin ${github.branch}`;

  const handleCopyText = async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleVerifyToken = async () => {
    if (!token.trim()) {
      setAuthError('请先输入 GitHub Personal Access Token');
      return;
    }
    setVerifying(true);
    setAuthError(null);
    try {
      const user = await verifyGitHubToken(token);
      setVerifiedUser(user);
      if (
        state.github.owner === 'your-github-username' ||
        state.github.owner.trim() === ''
      ) {
        onChange({
          ...state,
          github: { ...state.github, owner: user.login },
        });
      }
    } catch (err) {
      setVerifiedUser(null);
      setAuthError(err instanceof Error ? err.message : 'Token 验证失败');
    } finally {
      setVerifying(false);
    }
  };

  const handlePushToGithub = async () => {
    if (!token.trim()) {
      setPushError('请先填写具有 repo 与 workflow 权限的 GitHub Token');
      return;
    }
    if (!github.owner.trim() || !github.repo.trim()) {
      setPushError('请填写 GitHub 用户名和仓库名称');
      return;
    }
    setPushing(true);
    setPushError(null);
    setPushedRepoUrl(null);
    try {
      const result = await pushFilesToGitHubRepo({
        token,
        owner: github.owner.trim(),
        repo: github.repo.trim(),
        branch: github.branch.trim() || 'main',
        isPrivate: github.visibility === 'private',
        commitMessage: github.commitMessage,
        files,
        onProgress: setPushProgress,
      });
      setPushedRepoUrl(result.repoUrl);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : '推送仓库失败');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Section 1: 仓库坐标与 Clash Mi 覆写链接 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            01. 目标 GitHub 仓库与 Clash Mi 覆写订阅链接
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            将生成的 .yaml 或 .js 链接添加到 Clash Mi「覆写」页，所有机场订阅即可自动套用同一套分流与过滤规则。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              GitHub 用户名 / 组织
            </label>
            <input
              type="text"
              value={github.owner}
              onChange={(e) =>
                onChange({ ...state, github: { ...state.github, owner: e.target.value } })
              }
              className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              仓库名称
            </label>
            <input
              type="text"
              value={github.repo}
              onChange={(e) =>
                onChange({ ...state, github: { ...state.github, repo: e.target.value } })
              }
              className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              默认分支
            </label>
            <input
              type="text"
              value={github.branch}
              onChange={(e) =>
                onChange({ ...state, github: { ...state.github, branch: e.target.value } })
              }
              className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              仓库可见性
            </label>
            <select
              value={github.visibility}
              onChange={(e) =>
                onChange({
                  ...state,
                  github: { ...state.github, visibility: e.target.value as 'public' | 'private' },
                })
              }
              className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500"
            >
              <option value="public">Public 公开仓库 (不含敏感信息，推荐)</option>
              <option value="private">Private 私有仓库</option>
            </select>
          </div>
        </div>

        {/* Overwrite URLs */}
        <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
          {overwrite.outputTarget !== 'yaml' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-700">
                  JS 智能覆写脚本 URL (推荐添加到 Clash Mi 覆写页)
                </div>
                <div className="font-mono text-xs text-slate-900 truncate mt-0.5">
                  {jsRawUrl}
                </div>
                {github.visibility === 'public' && (
                  <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                    CDN: {jsCdnUrl}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyText('js-raw', jsRawUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                >
                  {copiedKey === 'js-raw' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'js-raw' ? '已复制' : '复制 JS 直链'}
                </button>
                {github.visibility === 'public' && (
                  <button
                    type="button"
                    onClick={() => handleCopyText('js-cdn', jsCdnUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                  >
                    {copiedKey === 'js-cdn' ? '已复制 CDN' : '复制 CDN'}
                  </button>
                )}
              </div>
            </div>
          )}

          {overwrite.outputTarget !== 'js' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5">
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-700">
                  YAML 分流覆写模板 URL (精细分流.yaml)
                </div>
                <div className="font-mono text-xs text-slate-900 truncate mt-0.5">
                  {yamlRawUrl}
                </div>
                {github.visibility === 'public' && (
                  <div className="font-mono text-[11px] text-slate-500 truncate mt-0.5">
                    CDN: {yamlCdnUrl}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyText('yaml-raw', yamlRawUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                >
                  {copiedKey === 'yaml-raw' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedKey === 'yaml-raw' ? '已复制' : '复制 YAML 直链'}
                </button>
                {github.visibility === 'public' && (
                  <button
                    type="button"
                    onClick={() => handleCopyText('yaml-cdn', yamlCdnUrl)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 whitespace-nowrap"
                  >
                    {copiedKey === 'yaml-cdn' ? '已复制 CDN' : '复制 CDN'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Section 2: 一键推送到 GitHub 或下载 ZIP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Direct GitHub Push */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                02. 一键创建仓库并推送文件 (GitHub API)
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Token 仅在浏览器内存中用于直接请求 api.github.com，不会上传至任何第三方服务器。
              </p>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  GitHub Personal Access Token (需勾选 repo 与 workflow 权限)
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx 或 github_pat_..."
                      className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md pl-3 pr-9 py-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      aria-label={showToken ? '隐藏 Token' : '显示 Token'}
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyToken}
                    disabled={verifying}
                    className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {verifying ? '验证中...' : '验证身份'}
                  </button>
                </div>

                {verifiedUser && (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>已验证 GitHub 账号: @{verifiedUser.login}</span>
                  </div>
                )}
                {authError && (
                  <div className="mt-2 inline-flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{authError}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Git Commit 提交说明
                </label>
                <input
                  type="text"
                  value={github.commitMessage}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      github: { ...state.github, commitMessage: e.target.value },
                    })
                  }
                  className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800"
                />
              </div>

              {pushProgress && (
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium">{pushProgress.step}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {pushProgress.completed}/{pushProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-200"
                      style={{
                        width: `${Math.round((pushProgress.completed / pushProgress.total) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {pushError && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pushError}</span>
                </div>
              )}

              {pushedRepoUrl && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-md p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    全部 {files.length} 个覆写模板与规则文件已推送到 GitHub
                  </div>
                  <p className="text-xs text-emerald-800">
                    现在即可复制上方 .js 或 .yaml 覆写链接，在 Clash Mi「覆写」页点击云朵图标导入。
                  </p>
                  <div className="flex flex-wrap gap-3 pt-1">
                    <a
                      href={pushedRepoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 underline"
                    >
                      打开 GitHub 仓库
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={`${pushedRepoUrl}/actions`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 underline"
                    >
                      查看 Actions 自动同步状态
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              将写入 {files.length} 个文件至 {github.owner}/{github.repo}
            </span>
            <button
              type="button"
              onClick={handlePushToGithub}
              disabled={pushing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              {pushing ? '正在推送文件...' : '推送全部文件到 GitHub'}
            </button>
          </div>
        </section>

        {/* Clash Mi Import Guide & ZIP Export */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-4">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">
                03. Clash Mi 导入步骤与本地导出
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                添加覆写模板后，无需逐一修改机场订阅，全订阅自动生效。
              </p>
            </div>

            <ol className="space-y-2.5 text-xs text-slate-700 leading-relaxed list-decimal list-inside">
              <li>
                打开 <span className="font-semibold text-slate-900">Clash Mi</span>，进入{' '}
                <span className="font-semibold text-slate-900">覆写</span> 页面。
              </li>
              <li>
                点击右上角 <span className="font-semibold text-slate-900">云朵图标</span>（URL 导入），粘贴上方的{' '}
                <span className="font-mono text-slate-900">.js</span> 或{' '}
                <span className="font-mono text-slate-900">.yaml</span> 订阅链接；或下载单文件后点{' '}
                <span className="font-mono text-slate-900">+</span> 从本地导入。
              </li>
              <li>
                点击选中刚添加的覆写项（字体变为蓝色即生效），后续在客户端内切换任何机场订阅都会自动套用该分流与过滤逻辑。
              </li>
            </ol>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-800">
                  Git 本地推送命令
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyText('cli', gitCliSnippet)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {copiedKey === 'cli' ? '已复制命令' : '复制命令'}
                </button>
              </div>
              <pre className="font-mono text-xs bg-slate-900 text-slate-100 rounded-md p-3 overflow-x-auto leading-relaxed">
                {gitCliSnippet}
              </pre>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onDownloadZip}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors"
            >
              <Download className="w-4 h-4" />
              下载完整仓库压缩包 ({github.repo}.zip)
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
