import { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  Download,
  FileCode2,
  FileText,
  FolderGit2,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { ClashWorkspaceState } from './types/clash';
import { INITIAL_WORKSPACE_STATE } from './data/presets';
import { generateAllRepoFiles, validateYamlString } from './utils/generators';
import { ConfigBuilderView } from './components/ConfigBuilderView';
import { NodeFilterSimulatorView } from './components/NodeFilterSimulatorView';
import { RuleAndFileInspectorView } from './components/RuleAndFileInspectorView';
import { RepoDeployView } from './components/RepoDeployView';

type ActiveTab = 'builder' | 'simulator' | 'inspector' | 'deploy';

const STORAGE_KEY = 'clash_mi_override_workspace_v7';

export default function App() {
  const [workspace, setWorkspace] = useState<ClashWorkspaceState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved) as ClashWorkspaceState;
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_WORKSPACE_STATE;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('builder');
  const [selectedFilePath, setSelectedFilePath] = useState<string>('override/clash-mi-override.js');
  const [exportingZip, setExportingZip] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
    } catch {
      // ignore quota errors
    }
  }, [workspace]);

  const generatedFiles = useMemo(() => generateAllRepoFiles(workspace), [workspace]);

  const yamlValidation = useMemo(() => {
    const mainYaml = generatedFiles.find((f) => f.path === 'override/diversion.yaml');
    if (!mainYaml) {
      return { valid: true, error: null, lineCount: 0 };
    }
    return validateYamlString(mainYaml.content);
  }, [generatedFiles]);

  const enabledGroupsCount = workspace.groups.filter((g) => g.enabled).length;
  const enabledRulesCount = workspace.ruleModules.filter((r) => r.enabled).length;
  const outputModeLabel =
    workspace.overwrite.outputTarget === 'both'
      ? 'YAML+JS'
      : workspace.overwrite.outputTarget === 'js'
        ? 'JS'
        : 'YAML';

  const handleDownloadZip = async () => {
    setExportingZip(true);
    try {
      const zip = new JSZip();
      for (const file of generatedFiles) {
        zip.file(file.path, file.content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspace.github.repo || 'clash-mi-override'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingZip(false);
    }
  };

  const handleSelectSidebarFile = (path: string) => {
    setSelectedFilePath(path);
    setActiveTab('inspector');
  };

  const handleResetDefaults = () => {
    setWorkspace(INITIAL_WORKSPACE_STATE);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('builder');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Clash Mi 覆写编排台
          </a>

          {/* Zone 2: 4 clean single-line text nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {(
              [
                { id: 'builder', label: '覆写编排' },
                { id: 'simulator', label: '节点过滤测试' },
                { id: 'inspector', label: '规则与文件审查' },
                { id: 'deploy', label: '仓库与导入' },
              ] as const
            ).map((nav) => (
              <button
                key={nav.id}
                type="button"
                onClick={() => setActiveTab(nav.id)}
                className={`py-4 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === nav.id
                    ? 'border-blue-600 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {nav.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary CTA button */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={exportingZip}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingZip ? '打包中...' : '导出仓库 ZIP'}
            </button>
          </div>
        </div>

        {/* Mobile Nav Row */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {(
            [
              { id: 'builder', label: '覆写编排' },
              { id: 'simulator', label: '节点过滤' },
              { id: 'inspector', label: '文件审查' },
              { id: 'deploy', label: '仓库与导入' },
            ] as const
          ).map((nav) => (
            <button
              key={nav.id}
              type="button"
              onClick={() => setActiveTab(nav.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                activeTab === nav.id
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {nav.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6">
        {/* Left Sidebar (264px on desktop) */}
        <aside className="w-full lg:w-[264px] shrink-0 space-y-5">
          {/* Repo Overview */}
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
              <FolderGit2 className="w-4 h-4 text-slate-500 shrink-0" />
              <span className="font-mono truncate">
                {workspace.github.owner}/{workspace.github.repo}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>分支 {workspace.github.branch}</span>
              <span aria-hidden="true">·</span>
              <span>{workspace.github.visibility === 'private' ? 'Private' : 'Public'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{workspace.github.cronExpression}</span>
            </div>

            <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-mono text-xs font-semibold text-slate-900 leading-5">
                  {outputModeLabel}
                </div>
                <div className="text-[11px] text-slate-500">覆写格式</div>
              </div>
              <div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                  {enabledGroupsCount}
                </div>
                <div className="text-[11px] text-slate-500">策略组</div>
              </div>
              <div>
                <div className="font-mono tabular-nums text-sm font-semibold text-slate-900">
                  {enabledRulesCount}
                </div>
                <div className="text-[11px] text-slate-500">规则集</div>
              </div>
            </div>

            {workspace.overwrite.outputTarget !== 'js' && (
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 font-medium ${
                    yamlValidation.valid ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {yamlValidation.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      YAML 模板有效
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      YAML 语法异常
                    </>
                  )}
                </span>
                <span className="font-mono tabular-nums text-slate-400">
                  {yamlValidation.lineCount} 行
                </span>
              </div>
            )}
          </div>

          {/* Repository File Tree */}
          <div className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-700">仓库生成文件清单</h3>
              <span className="font-mono tabular-nums text-xs text-slate-400">
                {generatedFiles.length} 个
              </span>
            </div>
            <ul className="space-y-1">
              {generatedFiles.map((file) => {
                const isSelected =
                  activeTab === 'inspector' && selectedFilePath === file.path;
                const Icon = file.language === 'text' || file.language === 'markdown' ? FileText : FileCode2;
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      onClick={() => handleSelectSidebarFile(file.path)}
                      className={`w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2 font-mono text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0 opacity-75" />
                      <span className="truncate">{file.path}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                恢复默认模板
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deploy')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                获取覆写链接 →
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0">
          {activeTab === 'builder' && (
            <ConfigBuilderView
              state={workspace}
              onChange={setWorkspace}
              onJumpToSimulator={() => setActiveTab('simulator')}
            />
          )}
          {activeTab === 'simulator' && (
            <NodeFilterSimulatorView state={workspace} onChange={setWorkspace} />
          )}
          {activeTab === 'inspector' && (
            <RuleAndFileInspectorView
              state={workspace}
              files={generatedFiles}
              selectedFilePath={selectedFilePath}
              onSelectFile={setSelectedFilePath}
              yamlValidation={yamlValidation}
            />
          )}
          {activeTab === 'deploy' && (
            <RepoDeployView
              state={workspace}
              files={generatedFiles}
              onChange={setWorkspace}
              onDownloadZip={handleDownloadZip}
            />
          )}
        </main>
      </div>
    </div>
  );
}
