import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Pin,
} from 'lucide-react';
import {
  AdBlockLevel,
  ClashWorkspaceState,
  ProxyGroupConfig,
  ProxyGroupType,
} from '../types/clash';
import {
  AD_BLOCK_LEVEL_PRESETS,
  DEFAULT_GLOBAL_EXCLUDE,
  inferAdBlockLevel,
} from '../data/presets';
import { ProxyGroupTopology } from './ProxyGroupTopology';

interface ConfigBuilderViewProps {
  state: ClashWorkspaceState;
  onChange: (next: ClashWorkspaceState) => void;
  onJumpToSimulator: () => void;
}

export const ConfigBuilderView: React.FC<ConfigBuilderViewProps> = ({
  state,
  onChange,
  onJumpToSimulator,
}) => {
  const [activeCustomTab, setActiveCustomTab] = useState<'proxy' | 'direct' | 'reject'>('proxy');
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>('grp-select');

  const updateGroup = (id: string, patch: Partial<ProxyGroupConfig>) => {
    onChange({
      ...state,
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
    });
  };

  const moveGroup = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= state.groups.length) return;
    const next = [...state.groups];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    onChange({ ...state, groups: next });
  };

  const pinAutoFirst = () => {
    const autoIndex = state.groups.findIndex(
      (g) => g.id === 'grp-auto' || g.type === 'url-test'
    );
    if (autoIndex === -1) return;
    const autoGroup = state.groups[autoIndex];
    const reordered = [
      { ...autoGroup, enabled: true },
      ...state.groups.filter((_, idx) => idx !== autoIndex),
    ].map((g) => {
      if (g.id === 'grp-select' && g.proxies.includes(autoGroup.name)) {
        return {
          ...g,
          proxies: [
            autoGroup.name,
            ...g.proxies.filter((name) => name !== autoGroup.name),
          ],
        };
      }
      return g;
    });
    onChange({ ...state, groups: reordered });
  };

  const moveSubProxy = (groupId: string, refIdx: number, action: -1 | 1 | 'top') => {
    onChange({
      ...state,
      groups: state.groups.map((g) => {
        if (g.id !== groupId) return g;
        const list = [...g.proxies];
        if (refIdx < 0 || refIdx >= list.length) return g;
        if (action === 'top') {
          const [item] = list.splice(refIdx, 1);
          list.unshift(item);
          return { ...g, proxies: list };
        }
        const target = refIdx + action;
        if (target < 0 || target >= list.length) return g;
        const [item] = list.splice(refIdx, 1);
        list.splice(target, 0, item);
        return { ...g, proxies: list };
      }),
    });
  };

  const addCustomGroup = () => {
    const newGroup: ProxyGroupConfig = {
      id: `grp-${Date.now()}`,
      name: '🌍 自定义地区节点',
      type: 'url-test',
      filter: '新加坡|日本|SG|JP',
      excludeFilter: state.kernel.globalExcludeFilter,
      url: 'https://www.gstatic.com/generate_204',
      interval: 300,
      tolerance: 50,
      strategy: 'consistent-hashing',
      includeAllProxies: true,
      proxies: [],
      enabled: true,
    };
    onChange({ ...state, groups: [...state.groups, newGroup] });
  };

  const removeGroup = (id: string) => {
    onChange({
      ...state,
      groups: state.groups.filter((g) => g.id !== id),
    });
  };

  const applyAdBlockLevel = (level: Exclude<AdBlockLevel, 'custom'>) => {
    const enabledSet = new Set(AD_BLOCK_LEVEL_PRESETS[level].enabledRuleIds);
    const nextRuleModules = state.ruleModules.map((mod) =>
      mod.category === 'reject'
        ? { ...mod, enabled: enabledSet.has(mod.id) }
        : mod
    );
    onChange({
      ...state,
      ruleModules: nextRuleModules,
      kernel: {
        ...state.kernel,
        adBlockLevel: level,
      },
    });
  };

  const toggleRuleModule = (id: string, enabled: boolean) => {
    const nextRuleModules = state.ruleModules.map((r) =>
      r.id === id ? { ...r, enabled } : r
    );
    const nextLevel = inferAdBlockLevel(nextRuleModules);
    onChange({
      ...state,
      ruleModules: nextRuleModules,
      kernel: {
        ...state.kernel,
        adBlockLevel: nextLevel,
      },
    });
  };

  const enabledGroups = state.groups.filter((g) => g.enabled);
  const firstEnabledGroup = enabledGroups[0];
  const isAutoFirst =
    Boolean(firstEnabledGroup) &&
    (firstEnabledGroup.id === 'grp-auto' || firstEnabledGroup.type === 'url-test');

  const activeRejectModules = state.ruleModules.filter(
    (r) => r.category === 'reject' && r.enabled
  );
  const totalRejectModules = state.ruleModules.filter(
    (r) => r.category === 'reject'
  ).length;
  const activeAdLevel = state.kernel.adBlockLevel || inferAdBlockLevel(state.ruleModules);

  const selectableGroupNames = [
    ...enabledGroups.map((g) => g.name),
    'DIRECT',
    'REJECT',
  ];

  const handleCronPreset = (preset: '6h' | '12h' | '24h' | 'custom') => {
    const map: Record<string, string> = {
      '6h': '0 */6 * * *',
      '12h': '0 */12 * * *',
      '24h': '0 19 * * *',
    };
    onChange({
      ...state,
      github: {
        ...state.github,
        cronPreset: preset,
        cronExpression: preset === 'custom' ? state.github.cronExpression : map[preset],
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Section 1: Clash Mi 全局覆写模板模式 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            01. Clash Mi 覆写模板架构（全订阅通用）
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            无需在仓库中填入机场链接。将生成的覆写链接添加到 Clash Mi「覆写」页面后，客户端内切换任意订阅均自动生效。
          </p>
        </div>

        <div className="mt-4 space-y-5">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">
              输出覆写文件类型（对应 Clash Mi 覆写页的 .yaml 与 .js 订阅）
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(
                [
                  {
                    id: 'both',
                    title: 'YAML + JS 双模板（推荐）',
                    desc: '同时生成 override/diversion.yaml 与 override/clash-mi-override.js，按需导入',
                  },
                  {
                    id: 'js',
                    title: '仅 JS 智能覆写脚本 (.js)',
                    desc: '通过 main(config) 动态过滤空地区组并直接清洗节点列表，兼容任意机场',
                  },
                  {
                    id: 'yaml',
                    title: '仅 YAML 分流模板 (.yaml)',
                    desc: '基于 Mihomo include-all 语法的纯声明式覆写配置文件',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    onChange({
                      ...state,
                      overwrite: { ...state.overwrite, outputTarget: opt.id },
                    })
                  }
                  className={`text-left p-3.5 rounded-md border transition-colors ${
                    state.overwrite.outputTarget === opt.id
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-semibold text-slate-900">{opt.title}</div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-x-6 gap-y-2.5">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.overwrite.skipEmptyRegionGroups}
                onChange={(e) =>
                  onChange({
                    ...state,
                    overwrite: {
                      ...state.overwrite,
                      skipEmptyRegionGroups: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              JS 覆写自动跳过无节点地区组（防止小机场缺地区报错）
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.overwrite.stripExcludedProxies}
                onChange={(e) =>
                  onChange({
                    ...state,
                    overwrite: {
                      ...state.overwrite,
                      stripExcludedProxies: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              直接从订阅 proxies 中删除匹配排除正则的无效节点
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.overwrite.overwriteDns}
                onChange={(e) =>
                  onChange({
                    ...state,
                    overwrite: { ...state.overwrite, overwriteDns: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              覆写防泄漏 DNS (nameserver-policy)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.overwrite.dnsAdSinkhole !== false}
                disabled={!state.overwrite.overwriteDns}
                onChange={(e) =>
                  onChange({
                    ...state,
                    overwrite: { ...state.overwrite, dnsAdSinkhole: e.target.checked },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-40"
              />
              DNS 层广告黑洞 (rcode://success，拦截前先阻断解析)
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.overwrite.overwriteSniffer}
                onChange={(e) =>
                  onChange({
                    ...state,
                    overwrite: {
                      ...state.overwrite,
                      overwriteSniffer: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              覆写域名嗅探 (Sniffer TLS/QUIC)
            </label>
          </div>
        </div>
      </section>

      {/* Section 2: 可视化策略分组列表与顺序编排 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              02. 可视化策略分组列表与节点正则过滤
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              列表顺序即 Clash Mi 客户端「代理」页的展示顺序，默认将「♻️ 自动测速优选」放在第 1 位并支持逐组调序。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isAutoFirst && (
              <button
                type="button"
                onClick={pinAutoFirst}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors whitespace-nowrap shrink-0"
              >
                <Pin className="w-3.5 h-3.5" />
                将自动选择置顶首位
              </button>
            )}
            <button
              type="button"
              onClick={onJumpToSimulator}
              className="px-3.5 py-2 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0"
            >
              在模拟器中测试正则
            </button>
            <button
              type="button"
              onClick={addCustomGroup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              新增地区分组
            </button>
          </div>
        </div>

        {/* Interactive Strategy Group Topology & Clash Mi Mobile Preview */}
        <ProxyGroupTopology
          state={state}
          selectedGroupId={expandedGroupId}
          onSelectGroup={(groupId) => setExpandedGroupId(groupId)}
          onMoveGroup={moveGroup}
          onPinAutoFirst={pinAutoFirst}
          onInspectInTable={(groupId) => {
            setExpandedGroupId(groupId);
            requestAnimationFrame(() => {
              const el = document.getElementById(`group-row-${groupId}`);
              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          }}
        />

        {/* Global Exclude Regex */}
        <div className="mt-4 pb-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-slate-700">
              全局无效节点排除正则 (exclude-filter)
            </label>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...state,
                  kernel: { ...state.kernel, globalExcludeFilter: DEFAULT_GLOBAL_EXCLUDE },
                })
              }
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
            >
              <RotateCcw className="w-3 h-3" />
              恢复默认过滤词
            </button>
          </div>
          <input
            type="text"
            value={state.kernel.globalExcludeFilter}
            onChange={(e) =>
              onChange({
                ...state,
                kernel: { ...state.kernel, globalExcludeFilter: e.target.value },
              })
            }
            className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-slate-800 focus:outline-none focus:border-blue-500"
            placeholder="剩余流量|套餐到期|官网|倍率.*[3-9]"
          />
        </div>

        {/* Groups Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3 w-20">位置</th>
                <th className="py-2.5 pr-3 w-10">启用</th>
                <th className="py-2.5 pr-3">分组名称</th>
                <th className="py-2.5 pr-3 w-36">调度模式</th>
                <th className="py-2.5 pr-3">包含正则 / 默认首选子项</th>
                <th className="py-2.5 pr-3 text-right w-24">容差 (ms)</th>
                <th className="py-2.5 text-right w-20">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {state.groups.map((grp, idx) => {
                const isExpanded = expandedGroupId === grp.id;
                return (
                  <React.Fragment key={grp.id}>
                    <tr
                      id={`group-row-${grp.id}`}
                      className={`transition-colors ${
                        isExpanded ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="py-2.5 pr-3">
                        <div className="inline-flex items-center gap-1">
                          <span className="font-mono tabular-nums text-xs text-slate-500 w-6">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveGroup(idx, -1)}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25"
                            title="上移"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === state.groups.length - 1}
                            onClick={() => moveGroup(idx, 1)}
                            className="p-0.5 text-slate-400 hover:text-slate-800 disabled:opacity-25"
                            title="下移"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="checkbox"
                          checked={grp.enabled}
                          disabled={grp.isSystem}
                          onChange={(e) => updateGroup(grp.id, { enabled: e.target.checked })}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 disabled:opacity-50"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={grp.name}
                          onChange={(e) => updateGroup(grp.id, { name: e.target.value })}
                          className="w-full text-sm font-medium text-slate-900 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white rounded px-2 py-1 focus:outline-none"
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={grp.type}
                          onChange={(e) =>
                            updateGroup(grp.id, { type: e.target.value as ProxyGroupType })
                          }
                          className="w-full font-mono text-xs bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
                        >
                          <option value="select">select (手动)</option>
                          <option value="url-test">url-test (测速)</option>
                          <option value="fallback">fallback (容灾)</option>
                          <option value="load-balance">load-balance (均衡)</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-3">
                        {grp.proxies.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => setExpandedGroupId(isExpanded ? null : grp.id)}
                            className="text-left text-xs text-slate-600 hover:text-blue-700 transition-colors"
                          >
                            <span>首选：{grp.proxies[0]}</span>
                            <span className="text-slate-400 mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-slate-500">
                              {grp.proxies.length} 项{grp.includeAllProxies ? ' + 全部节点' : ''}
                            </span>
                          </button>
                        ) : (
                          <input
                            type="text"
                            value={grp.filter}
                            onChange={(e) => updateGroup(grp.id, { filter: e.target.value })}
                            placeholder="全部保留（仅执行全局排除）"
                            className="w-full font-mono text-xs bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        {grp.type === 'url-test' ? (
                          <input
                            type="number"
                            value={grp.tolerance}
                            min={0}
                            step={10}
                            onChange={(e) =>
                              updateGroup(grp.id, { tolerance: Number(e.target.value) || 50 })
                            }
                            className="w-20 text-right font-mono tabular-nums text-xs bg-white border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-xs text-slate-300 font-mono">-</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setExpandedGroupId(isExpanded ? null : grp.id)}
                            className="text-xs text-slate-500 hover:text-slate-900 p-1"
                            title="展开高级参数与成员顺序"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          {!grp.isSystem && (
                            <button
                              type="button"
                              onClick={() => removeGroup(grp.id)}
                              className="text-slate-400 hover:text-red-600 p-1"
                              title="删除分组"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={7} className="px-4 py-4 space-y-4">
                          {grp.proxies.length > 0 && (
                            <div className="pb-3 border-b border-slate-200/80">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-slate-700">
                                  组内成员优先顺序（第 1 位为 Clash Mi 默认选中项）
                                </span>
                                <span className="text-xs text-slate-500">
                                  可点击左右调序或直接置顶
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {grp.proxies.map((member, mIdx) => (
                                  <div
                                    key={`${grp.id}-${member}`}
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs ${
                                      mIdx === 0
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                        : 'bg-white border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <span className="font-mono tabular-nums text-[11px] text-slate-400">
                                      {mIdx + 1}
                                    </span>
                                    <span className="whitespace-nowrap">{member}</span>
                                    <button
                                      type="button"
                                      disabled={mIdx === 0}
                                      onClick={() => moveSubProxy(grp.id, mIdx, -1)}
                                      className="p-0.5 text-slate-400 hover:text-slate-900 disabled:opacity-25"
                                      title="前移"
                                    >
                                      <ArrowLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={mIdx === grp.proxies.length - 1}
                                      onClick={() => moveSubProxy(grp.id, mIdx, 1)}
                                      className="p-0.5 text-slate-400 hover:text-slate-900 disabled:opacity-25"
                                      title="后移"
                                    >
                                      <ArrowRight className="w-3 h-3" />
                                    </button>
                                    {mIdx > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => moveSubProxy(grp.id, mIdx, 'top')}
                                        className="text-[11px] text-blue-600 hover:text-blue-800 ml-0.5 whitespace-nowrap"
                                      >
                                        置顶
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                              <label className="block font-medium text-slate-600 mb-1">
                                组内独立排除正则 (exclude-filter)
                              </label>
                              <input
                                type="text"
                                value={grp.excludeFilter}
                                onChange={(e) =>
                                  updateGroup(grp.id, { excludeFilter: e.target.value })
                                }
                                className="w-full font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800"
                                placeholder="例如 港|HK"
                              />
                            </div>
                            <div>
                              <label className="block font-medium text-slate-600 mb-1">
                                测速 URL / 间隔 (秒)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={grp.url}
                                  onChange={(e) => updateGroup(grp.id, { url: e.target.value })}
                                  className="flex-1 font-mono bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800"
                                  placeholder="https://www.gstatic.com/generate_204"
                                />
                                <input
                                  type="number"
                                  value={grp.interval}
                                  onChange={(e) =>
                                    updateGroup(grp.id, {
                                      interval: Number(e.target.value) || 300,
                                    })
                                  }
                                  className="w-20 font-mono tabular-nums bg-white border border-slate-200 rounded px-2 py-1.5 text-slate-800"
                                />
                              </div>
                            </div>
                            <div className="flex items-end pb-1.5">
                              <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={grp.includeAllProxies}
                                  onChange={(e) =>
                                    updateGroup(grp.id, {
                                      includeAllProxies: e.target.checked,
                                    })
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                                />
                                自动纳管当前订阅全部节点 (include-all)
                              </label>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 3: 分流规则集、设备性能去广告开关与自定义列表 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              03. 分流规则集、设备性能去广告等级与自定义规则
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              内置 AdGuard 基础、Privacy 隐私追踪、反运营商劫持、移动端 App 增强与 217heidai 全量去广告规则，支持按手机/路由器性能一键切换拦截等级。
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...state,
                  kernel: { ...state.kernel, ruleSourceFlavor: 'metacubex-mrs' },
                })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                state.kernel.ruleSourceFlavor === 'metacubex-mrs'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              MetaCubeX .mrs 二进制 (推荐)
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...state,
                  kernel: { ...state.kernel, ruleSourceFlavor: 'loyalsoldier-yaml' },
                })
              }
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                state.kernel.ruleSourceFlavor === 'loyalsoldier-yaml'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              YAML / Text 文本规则
            </button>
          </div>
        </div>

        {/* One-Click Device Performance Ad-Block Switcher */}
        <div className="mt-4 pb-5 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <span className="text-xs font-semibold text-slate-800">
              设备性能去广告拦截等级（一键开关）
            </span>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              已启用 {activeRejectModules.length} / {totalRejectModules} 个去广告规则集
              {activeAdLevel === 'custom' ? ' · 当前为手动自定义组合' : ''}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(['light', 'balanced', 'ultra'] as const).map((levelKey) => {
              const preset = AD_BLOCK_LEVEL_PRESETS[levelKey];
              const isActive = activeAdLevel === levelKey;
              return (
                <button
                  key={levelKey}
                  type="button"
                  onClick={() => applyAdBlockLevel(levelKey)}
                  className={`text-left p-3.5 rounded-md border transition-colors ${
                    isActive
                      ? 'border-blue-600 bg-blue-50/50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      {preset.title}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {preset.enabledRuleIds.length} 组拦截源
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-blue-700 mt-0.5">
                    {preset.deviceHint}
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {preset.summary}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2 pr-3 w-10">启用</th>
                <th className="py-2 pr-3">规则模块</th>
                <th className="py-2 pr-3">层级 / Provider</th>
                <th className="py-2 pr-3">行为类型</th>
                <th className="py-2 pr-3 w-52">目标策略组</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {state.ruleModules.map((mod) => {
                const isMrsMode = state.kernel.ruleSourceFlavor === 'metacubex-mrs';
                const chosenUrl = isMrsMode ? mod.mrsUrl : mod.yamlUrl;
                const fmt = chosenUrl.endsWith('.mrs')
                  ? 'mrs'
                  : chosenUrl.endsWith('.txt')
                    ? 'text'
                    : 'yaml';
                const effectiveBehavior = isMrsMode
                  ? mod.mrsBehavior || (fmt === 'mrs' && mod.behavior === 'classical' ? 'domain' : mod.behavior)
                  : mod.behavior;
                const tierText =
                  mod.tier === 'light'
                    ? '轻量必备'
                    : mod.tier === 'balanced'
                      ? '均衡强效'
                      : mod.tier === 'ultra'
                        ? '极客满血'
                        : null;

                return (
                  <tr key={mod.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 pr-3">
                      <input
                        type="checkbox"
                        checked={mod.enabled}
                        onChange={(e) => toggleRuleModule(mod.id, e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                    </td>
                    <td className="py-2.5 pr-3 font-medium text-slate-900">{mod.label}</td>
                    <td className="py-2.5 pr-3 text-xs text-slate-500">
                      <span className="font-mono">{mod.providerName}</span>
                      {tierText && (
                        <>
                          <span className="mx-1.5 text-slate-300" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={
                              mod.tier === 'ultra'
                                ? 'text-amber-700 font-medium'
                                : mod.tier === 'balanced'
                                  ? 'text-blue-700 font-medium'
                                  : 'text-emerald-700 font-medium'
                            }
                          >
                            {tierText}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {effectiveBehavior} · {fmt}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={mod.targetGroup}
                        onChange={(e) =>
                          onChange({
                            ...state,
                            ruleModules: state.ruleModules.map((r) =>
                              r.id === mod.id ? { ...r, targetGroup: e.target.value } : r
                            ),
                          })
                        }
                        className="w-full text-xs bg-white border border-slate-200 rounded px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500"
                      >
                        {selectableGroupNames.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Custom Rules Editor */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                仓库独立自定义规则文件 (rules/*.list)
              </h3>
              <p className="text-xs text-slate-500">
                在 GitHub 仓库中直接编辑 rules/*.list 提交后，Actions 会自动同步合并进覆写模板。
              </p>
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'proxy', label: 'custom-proxy.list' },
                  { id: 'direct', label: 'custom-direct.list' },
                  { id: 'reject', label: 'custom-reject.list' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCustomTab(tab.id)}
                  className={`px-3 py-1.5 font-mono text-xs rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeCustomTab === tab.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={5}
            value={
              activeCustomTab === 'proxy'
                ? state.customRules.proxyList
                : activeCustomTab === 'direct'
                  ? state.customRules.directList
                  : state.customRules.rejectList
            }
            onChange={(e) =>
              onChange({
                ...state,
                customRules: {
                  ...state.customRules,
                  ...(activeCustomTab === 'proxy'
                    ? { proxyList: e.target.value }
                    : activeCustomTab === 'direct'
                      ? { directList: e.target.value }
                      : { rejectList: e.target.value }),
                },
              })
            }
            className="w-full font-mono text-xs bg-slate-900 text-slate-100 rounded-md p-3.5 border border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed"
          />
        </div>
      </section>

      {/* Section 4: DNS 与 GitHub Actions 自动同步 */}
      <section className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">
            04. DNS 覆写参数与 GitHub Actions 规则同步
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            配置覆写后的防泄露 DNS 参数，以及 GitHub Actions 自动合并规则和校验脚本语法的频率。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-5">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">DNS 覆写设置</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  DNS 增强模式
                </label>
                <select
                  value={state.kernel.dnsMode}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      kernel: {
                        ...state.kernel,
                        dnsMode: e.target.value as 'fake-ip' | 'redir-host',
                      },
                    })
                  }
                  className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2"
                >
                  <option value="fake-ip">fake-ip (低延迟推荐)</option>
                  <option value="redir-host">redir-host (真实 IP)</option>
                </select>
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={state.kernel.ipv6}
                    onChange={(e) =>
                      onChange({
                        ...state,
                        kernel: { ...state.kernel, ipv6: e.target.checked },
                      })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  启用 IPv6 DNS 解析
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  国内 DoH 上游（可用逗号填多个）
                </label>
                <input
                  type="text"
                  value={state.kernel.dohChina}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      kernel: { ...state.kernel, dohChina: e.target.value },
                    })
                  }
                  className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  海外 DoH / DoT 上游（可用逗号填多个防单点超时）
                </label>
                <input
                  type="text"
                  value={state.kernel.dohGlobal}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      kernel: { ...state.kernel, dohGlobal: e.target.value },
                    })
                  }
                  className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-800">GitHub Actions 自动编译同步</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  定时校验与同步频率
                </label>
                <select
                  value={state.github.cronPreset}
                  onChange={(e) =>
                    handleCronPreset(e.target.value as '6h' | '12h' | '24h' | 'custom')
                  }
                  className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800"
                >
                  <option value="6h">每 6 小时检查同步</option>
                  <option value="12h">每 12 小时检查同步</option>
                  <option value="24h">每日凌晨 03:00 (UTC+8)</option>
                  <option value="custom">自定义 Cron 表达式</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Cron 表达式 (UTC)
                </label>
                <input
                  type="text"
                  value={state.github.cronExpression}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      github: {
                        ...state.github,
                        cronPreset: 'custom',
                        cronExpression: e.target.value,
                      },
                    })
                  }
                  className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={state.github.enableStepSummary}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      github: { ...state.github, enableStepSummary: e.target.checked },
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
                在 Actions 中执行 JS 沙箱干跑校验并输出报告
              </label>
            </div>
          </div>
        </div>

        {/* Sub-section: 每日自动提取节点生成订阅工作流 */}
        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">
                每日自动提取节点并生成订阅工作流 (.github/workflows/fetch-nodes-sub.yml)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                每天按 Cron 自动抓取上游 YAML / Hysteria2 JSON 节点源，去重后输出 Clash Mi YAML 订阅与通用 Base64 订阅。
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={state.nodeSubscription?.enabled !== false}
                onChange={(e) =>
                  onChange({
                    ...state,
                    nodeSubscription: {
                      ...state.nodeSubscription,
                      enabled: e.target.checked,
                    },
                  })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              启用节点订阅工作流
            </label>
          </div>

          {state.nodeSubscription?.enabled !== false && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    节点提取预设频率
                  </label>
                  <select
                    value={
                      ['0 22 * * *', '0 0 * * *', '0 */12 * * *', '0 */6 * * *'].includes(
                        state.nodeSubscription.cronExpression
                      )
                        ? state.nodeSubscription.cronExpression
                        : 'custom'
                    }
                    onChange={(e) => {
                      if (e.target.value !== 'custom') {
                        onChange({
                          ...state,
                          nodeSubscription: {
                            ...state.nodeSubscription,
                            cronExpression: e.target.value,
                          },
                        });
                      }
                    }}
                    className="w-full text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800"
                  >
                    <option value="0 22 * * *">每日北京时间 06:00 (UTC 22:00)</option>
                    <option value="0 0 * * *">每日北京时间 08:00 (UTC 00:00)</option>
                    <option value="0 */12 * * *">每 12 小时自动提取一次</option>
                    <option value="0 */6 * * *">每 6 小时自动提取一次</option>
                    <option value="custom">自定义 Cron 表达式</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    提取工作流 Cron 表达式 (UTC)
                  </label>
                  <input
                    type="text"
                    value={state.nodeSubscription.cronExpression}
                    onChange={(e) =>
                      onChange({
                        ...state,
                        nodeSubscription: {
                          ...state.nodeSubscription,
                          cronExpression: e.target.value,
                        },
                      })
                    }
                    className="w-full font-mono text-xs bg-white border border-slate-200 rounded-md px-3 py-2 text-slate-800 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-600">
                    节点提取源列表 (rules/node-sources.txt)
                  </label>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {
                      state.nodeSubscription.sourcesList
                        .split('\n')
                        .map((l) => l.trim())
                        .filter((l) => l && !l.startsWith('#') && !l.startsWith('//')).length
                    }{' '}
                    个源 URL
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={state.nodeSubscription.sourcesList}
                  onChange={(e) =>
                    onChange({
                      ...state,
                      nodeSubscription: {
                        ...state.nodeSubscription,
                        sourcesList: e.target.value,
                      },
                    })
                  }
                  className="w-full font-mono text-xs bg-slate-900 text-slate-100 rounded-md p-3.5 border border-slate-800 focus:outline-none focus:border-blue-500 leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
