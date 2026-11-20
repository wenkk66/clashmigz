import React, { useMemo, useState } from 'react';
import { Check, Copy, Download, Search, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ClashWorkspaceState, GeneratedFile, YamlValidationResult } from '../types/clash';
import { traceRuleMatch } from '../utils/simulator';

interface RuleAndFileInspectorViewProps {
  state: ClashWorkspaceState;
  files: GeneratedFile[];
  selectedFilePath: string;
  onSelectFile: (path: string) => void;
  yamlValidation: YamlValidationResult;
}

const QUICK_TEST_DOMAINS = [
  'chatgpt.com',
  'youtube.com',
  'ads.youtube.com',
  'imasdk.googleapis.com',
  'analytics.tiktok.com',
  'sdk.e.qq.com',
  'tiktok.com',
  'github.com',
  'google.com',
  'steampowered.com',
  'bilibili.com',
  'doubleclick.net',
  '192.168.1.10',
  'cursor.sh',
];

export const RuleAndFileInspectorView: React.FC<RuleAndFileInspectorViewProps> = ({
  state,
  files,
  selectedFilePath,
  onSelectFile,
  yamlValidation,
}) => {
  const [domainInput, setDomainInput] = useState<string>('chatgpt.com');
  const [copied, setCopied] = useState<boolean>(false);

  const trace = useMemo(() => traceRuleMatch(domainInput, state), [domainInput, state]);
  const activeFile = files.find((f) => f.path === selectedFilePath) || files[0];
  const lines = useMemo(() => activeFile.content.split('\n'), [activeFile.content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownloadSingle = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFile.path.split('/').pop() || 'file.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Rule Routing Tracer */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            分流规则命中模拟器
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            输入任意域名或 IPv4 地址，验证 Mihomo 从上至下的第一匹配规则链与 DNS 解析策略。
          </p>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="输入域名或 IP，例如 api.openai.com、bilibili.com、192.168.1.1"
              className="w-full font-mono text-sm pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_TEST_DOMAINS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => setDomainInput(sample)}
                className={`px-2.5 py-1.5 font-mono text-xs rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                  domainInput === sample
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {/* Trace Result Grid */}
        <div className="mt-5 grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs text-slate-500">命中规则指令</div>
            <div className="font-mono text-xs font-medium text-slate-900 mt-1 break-all">
              {trace.ruleLine}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">规则来源</div>
            <div className="text-xs font-medium text-slate-800 mt-1">{trace.sourceLabel}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">最终出口策略组</div>
            <div
              className={`text-sm font-semibold mt-1 ${
                trace.targetGroup === 'REJECT' || trace.targetGroup.includes('广告拦截')
                  ? 'text-red-600'
                  : trace.targetGroup === 'DIRECT'
                    ? 'text-emerald-600'
                    : 'text-blue-600'
              }`}
            >
              {trace.targetGroup}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">DNS 路由建议</div>
            <div className="text-xs font-mono text-slate-700 mt-1">{trace.dnsHint}</div>
          </div>
        </div>
      </section>

      {/* Section 2: File Code Inspector */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold font-mono text-slate-900">
                {activeFile.path}
              </h2>
              {activeFile.path === 'override/diversion.yaml' && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium ${
                    yamlValidation.valid ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {yamlValidation.valid ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      YAML 语法校验通过
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      {yamlValidation.error}
                    </>
                  )}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{activeFile.title}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{lines.length} 行</span>
              <span aria-hidden="true">·</span>
              <span>{activeFile.description}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? '已复制' : '复制文件内容'}
            </button>
            <button
              type="button"
              onClick={handleDownloadSingle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              下载此文件
            </button>
          </div>
        </div>

        {/* File Tabs Strip */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={`px-3 py-1.5 font-mono text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                file.path === activeFile.path
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-medium'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {file.path}
            </button>
          ))}
        </div>

        {/* Code Viewport */}
        <div className="bg-slate-900 text-slate-100 p-4 overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="w-full border-collapse font-mono text-xs leading-6">
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} className="hover:bg-slate-800/50">
                  <td className="select-none pr-4 text-right text-slate-500 tabular-nums w-10 align-top">
                    {idx + 1}
                  </td>
                  <td className="whitespace-pre text-slate-100">{line || ' '}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
