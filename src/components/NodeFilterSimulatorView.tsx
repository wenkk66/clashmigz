import React, { useMemo, useState } from 'react';
import { RotateCcw, Eraser } from 'lucide-react';
import { ClashWorkspaceState } from '../types/clash';
import { SAMPLE_NODE_LIST } from '../data/presets';
import { simulateNodeFilters } from '../utils/simulator';

interface NodeFilterSimulatorViewProps {
  state: ClashWorkspaceState;
  onChange: (next: ClashWorkspaceState) => void;
}

export const NodeFilterSimulatorView: React.FC<NodeFilterSimulatorViewProps> = ({
  state,
  onChange,
}) => {
  const [rawNodesText, setRawNodesText] = useState<string>(SAMPLE_NODE_LIST);
  const [statusFilter, setStatusFilter] = useState<'all' | 'kept' | 'excluded'>('all');

  const simulation = useMemo(
    () =>
      simulateNodeFilters(
        rawNodesText,
        state.kernel.globalExcludeFilter,
        state.groups
      ),
    [rawNodesText, state.kernel.globalExcludeFilter, state.groups]
  );

  const visibleItems = useMemo(() => {
    if (statusFilter === 'kept') return simulation.items.filter((i) => !i.excluded);
    if (statusFilter === 'excluded') return simulation.items.filter((i) => i.excluded);
    return simulation.items;
  }, [simulation.items, statusFilter]);

  return (
    <div className="space-y-6">
      {/* KPI Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">模拟订阅节点总数</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-900 mt-1">
            {simulation.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">覆写后保留可用节点</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-emerald-600 mt-1">
            {simulation.kept}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">正则剔除无效/高倍率</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-amber-600 mt-1">
            {simulation.excludedCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs text-slate-500">未归入地区组节点</div>
          <div className="text-2xl font-semibold font-mono tabular-nums text-slate-700 mt-1">
            {simulation.unmatchedCount}
          </div>
        </div>
      </div>

      {/* Main Two-Column Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Input & Global Regex */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">模拟任意机场订阅节点列表</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                验证覆写模板套用到不同机场订阅时的分组与清洗结果
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRawNodesText(SAMPLE_NODE_LIST)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                载入示例
              </button>
              <button
                type="button"
                onClick={() => setRawNodesText('')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 rounded transition-colors whitespace-nowrap"
              >
                <Eraser className="w-3 h-3" />
                清空
              </button>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              全局排除正则 (实时同步到 YAML / JS 覆写模板)
            </label>
            <input
              type="text"
              value={state.kernel.globalExcludeFilter}
              onChange={(e) =>
                onChange({
                  ...state,
                  kernel: { ...state.kernel, globalExcludeFilter: e.target.value },
                })
              }
              className={`w-full font-mono text-xs border rounded-md px-3 py-2 focus:outline-none ${
                simulation.globalRegexError
                  ? 'border-red-400 bg-red-50 text-red-900'
                  : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-blue-500'
              }`}
            />
            {simulation.globalRegexError && (
              <p className="text-xs text-red-600 mt-1">
                正则语法错误: {simulation.globalRegexError}
              </p>
            )}
          </div>

          <textarea
            value={rawNodesText}
            onChange={(e) => setRawNodesText(e.target.value)}
            rows={14}
            placeholder="每行粘贴一个节点名称，例如：&#10;🇭🇰 香港 IEPL 01&#10;剩余流量：500 GB"
            className="mt-4 flex-1 w-full font-mono text-xs bg-slate-900 text-slate-100 rounded-md p-3.5 border border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
          />
        </div>

        {/* Right: Group Distribution & Evaluation Table */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">分组命中与空组跳过预览</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'all', label: `全部 (${simulation.total})` },
                  { id: 'kept', label: `保留 (${simulation.kept})` },
                  { id: 'excluded', label: `已剔除 (${simulation.excludedCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Per-Group Clean Text Breakdown */}
          <div className="py-3 border-b border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            {simulation.groupCounts.map((gc) => (
              <div key={gc.id} className="flex items-center gap-1.5">
                <span className="text-slate-700 font-medium">{gc.name}</span>
                <span
                  className={`font-mono tabular-nums ${
                    gc.count === 0 && state.overwrite.skipEmptyRegionGroups
                      ? 'text-slate-400'
                      : 'text-slate-600'
                  }`}
                >
                  {gc.regexError
                    ? '正则错误'
                    : gc.count === 0 && state.overwrite.skipEmptyRegionGroups
                      ? '0 (JS 自动跳过)'
                      : `${gc.count}`}
                </span>
              </div>
            ))}
          </div>

          {/* Result Rows */}
          <div className="flex-1 overflow-y-auto max-h-[420px] mt-2">
            {visibleItems.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                暂无匹配的节点记录，请在左侧输入节点列表或切换筛选视图。
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-3">节点名称</th>
                    <th className="py-2 pr-3 w-20">状态</th>
                    <th className="py-2">归属策略组 / 剔除原因</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {visibleItems.map((item, idx) => (
                    <tr key={`${item.name}-${idx}`} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 font-mono text-slate-900 break-all">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {item.excluded ? (
                          <span className="text-amber-700 font-medium">已剔除</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">保留</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-600">
                        {item.excluded ? (
                          <span className="text-amber-700">{item.excludeReason}</span>
                        ) : item.matchedGroups.length > 0 ? (
                          <span>{item.matchedGroups.join(' · ')}</span>
                        ) : (
                          <span className="text-slate-400">未匹配特定地区组</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
