import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Eye,
  GitBranch,
  Pin,
  Smartphone,
  SlidersHorizontal,
} from 'lucide-react';
import { ClashWorkspaceState, ProxyGroupConfig } from '../types/clash';
import { DEFAULT_GLOBAL_EXCLUDE, SAMPLE_NODE_LIST } from '../data/presets';
import { simulateNodeFilters } from '../utils/simulator';

interface ProxyGroupTopologyProps {
  state: ClashWorkspaceState;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onMoveGroup: (index: number, delta: -1 | 1) => void;
  onPinAutoFirst: () => void;
  onInspectInTable: (groupId: string) => void;
}

interface IngressItem {
  id: string;
  label: string;
  sublabel: string;
  targetNodeId: string;
  tone: 'reject' | 'direct' | 'proxy' | 'fallback';
  ruleNames: string[];
}

interface TopologyEdge {
  id: string;
  from: string;
  to: string;
  kind: 'ingress' | 'route' | 'intra';
  tone: 'reject' | 'direct' | 'proxy' | 'auto' | 'fallback';
  priority?: number;
}

interface ComputedPath {
  id: string;
  d: string;
  tone: TopologyEdge['tone'];
  kind: TopologyEdge['kind'];
  highlighted: boolean;
  dimmed: boolean;
  endX: number;
  endY: number;
}

const NODE_POOL_ID = 'term:node-pool';
const DIRECT_ID = 'term:DIRECT';
const REJECT_ID = 'term:REJECT';
const REJECT_DROP_ID = 'term:REJECT-DROP';

function groupTypeLabel(type: ProxyGroupConfig['type']): string {
  switch (type) {
    case 'url-test':
      return '自动测速 url-test';
    case 'fallback':
      return '故障转移 fallback';
    case 'load-balance':
      return '负载均衡 load-balance';
    default:
      return '手动选择 select';
  }
}

function countNonEmptyRuleLines(raw: string): number {
  return raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('//')).length;
}

function isRegionGroup(grp: ProxyGroupConfig): boolean {
  return (
    grp.proxies.length === 0 &&
    grp.includeAllProxies &&
    grp.filter.trim().length > 0 &&
    grp.id !== 'grp-auto' &&
    grp.id !== 'grp-failover' &&
    grp.id !== 'grp-balance' &&
    grp.id !== 'grp-manual'
  );
}

export const ProxyGroupTopology: React.FC<ProxyGroupTopologyProps> = ({
  state,
  selectedGroupId,
  onSelectGroup,
  onMoveGroup,
  onPinAutoFirst,
  onInspectInTable,
}) => {
  const [viewMode, setViewMode] = useState<'topology' | 'mobile'>('topology');
  const [focusedNodeId, setFocusedNodeId] = useState<string>(() =>
    selectedGroupId ? `grp:${selectedGroupId}` : 'grp:grp-select'
  );

  // Sync external table selection into topology focus when group is selected
  useEffect(() => {
    if (selectedGroupId) {
      setFocusedNodeId(`grp:${selectedGroupId}`);
    }
  }, [selectedGroupId]);

  const enabledGroups = useMemo(
    () => state.groups.filter((g) => g.enabled),
    [state.groups]
  );

  const groupIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    state.groups.forEach((g, idx) => map.set(g.id, idx));
    return map;
  }, [state.groups]);

  const enabledRankMap = useMemo(() => {
    const map = new Map<string, number>();
    enabledGroups.forEach((g, idx) => map.set(g.id, idx + 1));
    return map;
  }, [enabledGroups]);

  const groupByName = useMemo(() => {
    const map = new Map<string, ProxyGroupConfig>();
    enabledGroups.forEach((g) => map.set(g.name, g));
    return map;
  }, [enabledGroups]);

  const primarySelectGroup =
    enabledGroups.find((g) => g.id === 'grp-select') || enabledGroups[0] || null;
  const adsGroup = enabledGroups.find((g) => g.id === 'grp-ads') || null;
  const fallbackGroup =
    enabledGroups.find((g) => g.id === 'grp-fallback') || primarySelectGroup;
  const firstEnabledGroup = enabledGroups[0] || null;
  const isAutoFirst =
    Boolean(firstEnabledGroup) &&
    (firstEnabledGroup.id === 'grp-auto' || firstEnabledGroup.type === 'url-test');

  const coreAndBusinessGroups = useMemo(
    () => enabledGroups.filter((g) => !isRegionGroup(g)),
    [enabledGroups]
  );
  const regionGroups = useMemo(
    () => enabledGroups.filter((g) => isRegionGroup(g)),
    [enabledGroups]
  );

  // Build rule ingress buckets grouped by resolved destination
  const ingressItems = useMemo<IngressItem[]>(() => {
    const enabledRules = state.ruleModules.filter((r) => r.enabled);
    const items: IngressItem[] = [];

    const buckets = new Map<
      string,
      {
        targetNodeId: string;
        targetLabel: string;
        tone: IngressItem['tone'];
        ruleNames: string[];
        extraCount: number;
      }
    >();

    const resolveTargetNodeId = (targetName: string): string => {
      if (targetName === 'DIRECT') return DIRECT_ID;
      if (targetName === 'REJECT') return REJECT_ID;
      if (targetName === 'REJECT-DROP') return REJECT_DROP_ID;
      const g = groupByName.get(targetName);
      if (g) return `grp:${g.id}`;
      return primarySelectGroup ? `grp:${primarySelectGroup.id}` : DIRECT_ID;
    };

    const pushToBucket = (
      key: string,
      targetNodeId: string,
      targetLabel: string,
      tone: IngressItem['tone'],
      ruleLabel: string,
      extraCount = 0
    ) => {
      const existing = buckets.get(key);
      if (existing) {
        existing.ruleNames.push(ruleLabel);
        existing.extraCount += extraCount;
      } else {
        buckets.set(key, {
          targetNodeId,
          targetLabel,
          tone,
          ruleNames: [ruleLabel],
          extraCount,
        });
      }
    };

    // Custom rule files
    const rejectCustomCount = countNonEmptyRuleLines(state.customRules.rejectList);
    if (rejectCustomCount > 0) {
      const adsTargetId = adsGroup ? `grp:${adsGroup.id}` : REJECT_ID;
      pushToBucket(
        adsTargetId,
        adsTargetId,
        adsGroup?.name || 'REJECT',
        'reject',
        `custom-reject.list (${rejectCustomCount} 条)`,
        rejectCustomCount
      );
    }

    const directCustomCount = countNonEmptyRuleLines(state.customRules.directList);
    if (directCustomCount > 0) {
      pushToBucket(
        DIRECT_ID,
        DIRECT_ID,
        'DIRECT',
        'direct',
        `custom-direct.list (${directCustomCount} 条)`,
        directCustomCount
      );
    }

    const proxyCustomCount = countNonEmptyRuleLines(state.customRules.proxyList);
    if (proxyCustomCount > 0 && primarySelectGroup) {
      const pId = `grp:${primarySelectGroup.id}`;
      pushToBucket(
        pId,
        pId,
        primarySelectGroup.name,
        'proxy',
        `custom-proxy.list (${proxyCustomCount} 条)`,
        proxyCustomCount
      );
    }

    // Enabled rule modules
    for (const mod of enabledRules) {
      const targetNodeId = resolveTargetNodeId(mod.targetGroup);
      const tone: IngressItem['tone'] =
        mod.category === 'reject'
          ? 'reject'
          : mod.targetGroup === 'DIRECT'
            ? 'direct'
            : 'proxy';
      pushToBucket(
        targetNodeId,
        targetNodeId,
        mod.targetGroup,
        tone,
        mod.providerName
      );
    }

    // QUIC UDP 443 drop
    const hasQuicDrop =
      enabledRules.some((r) => r.providerName === 'youtube') ||
      enabledRules.some((r) => r.providerName === 'category-ads-all');
    if (hasQuicDrop) {
      items.push({
        id: 'ing:quic-drop',
        label: 'QUIC UDP 443 阻断',
        sublabel: 'YouTube + 广告 SDK 防绕过',
        targetNodeId: REJECT_DROP_ID,
        tone: 'reject',
        ruleNames: ['AND UDP:443 (youtube / category-ads-all) → REJECT-DROP'],
      });
    }

    for (const [key, b] of buckets.entries()) {
      const previewList = b.ruleNames.slice(0, 3).join(', ');
      const suffix = b.ruleNames.length > 3 ? ` 等 ${b.ruleNames.length} 项` : '';
      items.push({
        id: `ing:${key}`,
        label:
          b.tone === 'reject'
            ? '广告 / 隐私 / HTTPDNS 规则'
            : b.tone === 'direct'
              ? '国内域名 / LAN / 直连规则'
              : `${b.targetLabel.replace(/^[^\u4e00-\u9fa5A-Za-z0-9]+/, '')} 匹配规则`,
        sublabel: `${previewList}${suffix}`,
        targetNodeId: b.targetNodeId,
        tone: b.tone,
        ruleNames: b.ruleNames,
      });
    }

    // MATCH fallback
    if (fallbackGroup) {
      items.push({
        id: 'ing:match',
        label: 'MATCH 最终兜底',
        sublabel: `未命中以上规则 → ${fallbackGroup.name}`,
        targetNodeId: `grp:${fallbackGroup.id}`,
        tone: 'fallback',
        ruleNames: [`MATCH,${fallbackGroup.name}`],
      });
    }

    return items;
  }, [
    state.ruleModules,
    state.customRules,
    groupByName,
    primarySelectGroup,
    adsGroup,
    fallbackGroup,
  ]);

  // Build topology edges
  const edges = useMemo<TopologyEdge[]>(() => {
    const list: TopologyEdge[] = [];
    const col2Ids = new Set(coreAndBusinessGroups.map((g) => `grp:${g.id}`));
    const col3Ids = new Set(regionGroups.map((g) => `grp:${g.id}`));

    for (const ing of ingressItems) {
      list.push({
        id: `e:${ing.id}->${ing.targetNodeId}`,
        from: ing.id,
        to: ing.targetNodeId,
        kind: 'ingress',
        tone: ing.tone,
      });
    }

    for (const grp of enabledGroups) {
      const fromId = `grp:${grp.id}`;
      grp.proxies.forEach((ref, idx) => {
        let toId: string | null = null;
        let tone: TopologyEdge['tone'] = 'proxy';
        if (ref === 'DIRECT') {
          toId = DIRECT_ID;
          tone = 'direct';
        } else if (ref === 'REJECT') {
          toId = REJECT_ID;
          tone = 'reject';
        } else if (ref === 'REJECT-DROP') {
          toId = REJECT_DROP_ID;
          tone = 'reject';
        } else {
          const targetGrp = groupByName.get(ref);
          if (targetGrp) {
            toId = `grp:${targetGrp.id}`;
            if (targetGrp.type === 'url-test') tone = 'auto';
            else if (targetGrp.type === 'fallback') tone = 'fallback';
          }
        }
        if (!toId) return;
        const isIntra = col2Ids.has(fromId) && col2Ids.has(toId);
        list.push({
          id: `e:${fromId}->${toId}:${idx}`,
          from: fromId,
          to: toId,
          kind: isIntra ? 'intra' : 'route',
          tone,
          priority: idx + 1,
        });
      });

      if (grp.includeAllProxies && (col3Ids.has(fromId) || col2Ids.has(fromId))) {
        list.push({
          id: `e:${fromId}->pool`,
          from: fromId,
          to: NODE_POOL_ID,
          kind: 'route',
          tone: grp.type === 'url-test' ? 'auto' : 'proxy',
        });
      }
    }

    return list;
  }, [ingressItems, enabledGroups, coreAndBusinessGroups, regionGroups, groupByName]);

  // Determine connected node & edge sets for highlighting
  const { activeNodeIds, activeEdgeIds } = useMemo(() => {
    const nodeSet = new Set<string>();
    const edgeSet = new Set<string>();
    if (!focusedNodeId) {
      return { activeNodeIds: nodeSet, activeEdgeIds: edgeSet };
    }
    nodeSet.add(focusedNodeId);
    for (const e of edges) {
      if (e.from === focusedNodeId || e.to === focusedNodeId) {
        edgeSet.add(e.id);
        nodeSet.add(e.from);
        nodeSet.add(e.to);
      }
    }
    // 1-hop upstream rule ingress when a group is focused, or downstream terminals when ingress is focused
    if (focusedNodeId.startsWith('ing:')) {
      const target = ingressItems.find((i) => i.id === focusedNodeId)?.targetNodeId;
      if (target) {
        for (const e of edges) {
          if (e.from === target) {
            edgeSet.add(e.id);
            nodeSet.add(e.to);
          }
        }
      }
    }
    return { activeNodeIds: nodeSet, activeEdgeIds: edgeSet };
  }, [focusedNodeId, edges, ingressItems]);

  // SVG layout computation
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgSize, setSvgSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const [computedPaths, setComputedPaths] = useState<ComputedPath[]>([]);

  const recomputePaths = useCallback(() => {
    const container = containerRef.current;
    if (!container || viewMode !== 'topology') return;

    const cRect = container.getBoundingClientRect();
    if (cRect.width < 640) {
      // On narrow viewports stacked vertically, hide cross-column SVG lines cleanly
      setSvgSize({ width: 0, height: 0 });
      setComputedPaths([]);
      return;
    }

    const nodeRects = new Map<string, DOMRect>();
    const els = container.querySelectorAll<HTMLElement>('[data-topo-node]');
    els.forEach((el) => {
      const id = el.getAttribute('data-topo-node');
      if (id) nodeRects.set(id, el.getBoundingClientRect());
    });

    const paths: ComputedPath[] = [];
    let intraSlot = 0;

    for (const edge of edges) {
      const fromRect = nodeRects.get(edge.from);
      const toRect = nodeRects.get(edge.to);
      if (!fromRect || !toRect) continue;

      const highlighted = activeEdgeIds.has(edge.id);
      const dimmed = Boolean(focusedNodeId) && !highlighted;

      // Only draw non-highlighted intra-column edges when directly involved, to keep the canvas crisp
      if (edge.kind === 'intra' && !highlighted) {
        continue;
      }

      if (edge.kind === 'intra') {
        // Draw neat right-gutter arc between two Column 2 cards
        const startX = fromRect.right - cRect.left;
        const startY = fromRect.top + fromRect.height / 2 - cRect.top;
        const endX = toRect.right - cRect.left;
        const endY = toRect.top + toRect.height / 2 - cRect.top;
        const offset = 24 + (intraSlot % 4) * 8;
        intraSlot++;
        const ctrlX = Math.max(startX, endX) + offset;
        const d = `M ${startX} ${startY} C ${ctrlX} ${startY}, ${ctrlX} ${endY}, ${endX} ${endY}`;
        paths.push({
          id: edge.id,
          d,
          tone: edge.tone,
          kind: edge.kind,
          highlighted,
          dimmed,
          endX,
          endY,
        });
        continue;
      }

      const startX = fromRect.right - cRect.left;
      const startY = fromRect.top + fromRect.height / 2 - cRect.top;
      const endX = toRect.left - cRect.left;
      const endY = toRect.top + toRect.height / 2 - cRect.top;
      const dx = Math.max(28, (endX - startX) * 0.48);
      const d = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

      paths.push({
        id: edge.id,
        d,
        tone: edge.tone,
        kind: edge.kind,
        highlighted,
        dimmed,
        endX,
        endY,
      });
    }

    setSvgSize({ width: cRect.width, height: cRect.height });
    setComputedPaths(paths);
  }, [edges, activeEdgeIds, focusedNodeId, viewMode]);

  useLayoutEffect(() => {
    recomputePaths();
  }, [recomputePaths]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      recomputePaths();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recomputePaths]);

  // Selected group inspection details
  const focusedGroup: ProxyGroupConfig | null = useMemo(() => {
    if (focusedNodeId.startsWith('grp:')) {
      const id = focusedNodeId.slice(4);
      return enabledGroups.find((g) => g.id === id) || null;
    }
    if (focusedNodeId.startsWith('ing:')) {
      const item = ingressItems.find((i) => i.id === focusedNodeId);
      if (item?.targetNodeId.startsWith('grp:')) {
        const id = item.targetNodeId.slice(4);
        return enabledGroups.find((g) => g.id === id) || null;
      }
    }
    return primarySelectGroup;
  }, [focusedNodeId, enabledGroups, ingressItems, primarySelectGroup]);

  const focusedGroupUpstream = useMemo(() => {
    if (!focusedGroup) return { ingMatches: [] as IngressItem[], parentGroups: [] as ProxyGroupConfig[] };
    const targetId = `grp:${focusedGroup.id}`;
    const ingMatches = ingressItems.filter((i) => i.targetNodeId === targetId);
    const parentGroups = enabledGroups.filter((g) =>
      g.proxies.includes(focusedGroup.name)
    );
    return { ingMatches, parentGroups };
  }, [focusedGroup, ingressItems, enabledGroups]);

  // Mobile preview simulation based on SAMPLE_NODE_LIST
  const nodeSimulation = useMemo(
    () =>
      simulateNodeFilters(
        SAMPLE_NODE_LIST,
        state.kernel.globalExcludeFilter || DEFAULT_GLOBAL_EXCLUDE,
        state.groups
      ),
    [state.kernel.globalExcludeFilter, state.groups]
  );

  const mobilePreviewGroup = focusedGroup || firstEnabledGroup;
  const mobileCleanedNodes = useMemo(() => {
    if (!mobilePreviewGroup) return [];
    const kept = nodeSimulation.items.filter((i) => !i.excluded);
    if (!mobilePreviewGroup.includeAllProxies) return [];
    let incRe: RegExp | null = null;
    let excRe: RegExp | null = null;
    try {
      if (mobilePreviewGroup.filter.trim()) {
        incRe = new RegExp(mobilePreviewGroup.filter.trim(), 'i');
      }
    } catch {
      incRe = null;
    }
    try {
      if (mobilePreviewGroup.excludeFilter.trim()) {
        excRe = new RegExp(mobilePreviewGroup.excludeFilter.trim(), 'i');
      }
    } catch {
      excRe = null;
    }
    return kept
      .map((i) => i.name)
      .filter((name) => {
        if (excRe && excRe.test(name)) return false;
        if (incRe && !incRe.test(name)) return false;
        return true;
      });
  }, [mobilePreviewGroup, nodeSimulation.items]);

  const handleClickGroupNode = (grp: ProxyGroupConfig) => {
    setFocusedNodeId(`grp:${grp.id}`);
    onSelectGroup(grp.id);
  };

  const strokeColor = (tone: TopologyEdge['tone']) => {
    switch (tone) {
      case 'reject':
        return '#DC2626';
      case 'direct':
        return '#059669';
      case 'auto':
        return '#059669';
      case 'fallback':
        return '#D97706';
      default:
        return '#2563EB';
    }
  };

  return (
    <div className="mt-4 pb-5 border-b border-slate-100 space-y-4">
      {/* Toolbar: Segmented Switch + Rank Summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode('topology')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'topology'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            策略拓扑关系图
          </button>
          <button
            type="button"
            onClick={() => setViewMode('mobile')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              viewMode === 'mobile'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Clash Mi 客户端预览
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-mono tabular-nums">
          <span>已启用 {enabledGroups.length} 组</span>
          <span aria-hidden="true">·</span>
          <span className={isAutoFirst ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
            首位：{firstEnabledGroup?.name || '-'}
          </span>
          <span aria-hidden="true">·</span>
          <span>点击任意节点高亮上游规则与下游链路</span>
        </div>
      </div>

      {viewMode === 'topology' ? (
        <div className="space-y-4">
          {/* 3-Column Topology Graph */}
          <div
            ref={containerRef}
            className="relative bg-slate-50/70 border border-slate-200 rounded-lg p-4 md:p-5 overflow-hidden"
          >
            {/* Dynamic SVG Connectors */}
            {svgSize.width > 0 && (
              <svg
                className="hidden md:block absolute inset-0 pointer-events-none"
                width={svgSize.width}
                height={svgSize.height}
                viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
              >
                {computedPaths.map((p) => {
                  const color = strokeColor(p.tone);
                  return (
                    <g key={p.id}>
                      <path
                        d={p.d}
                        fill="none"
                        stroke={color}
                        strokeWidth={p.highlighted ? 2 : 1.25}
                        strokeDasharray={p.tone === 'fallback' ? '4 3' : undefined}
                        strokeOpacity={p.highlighted ? 0.9 : p.dimmed ? 0.1 : 0.28}
                      />
                      {p.highlighted && (
                        <circle
                          cx={p.endX}
                          cy={p.endY}
                          r={3}
                          fill={color}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            )}

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-8 items-start">
              {/* Column 1: Rule Ingress */}
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
                  <span>1. 流量规则入口</span>
                  <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                    {ingressItems.length} 组路由
                  </span>
                </div>
                <div className="space-y-2">
                  {ingressItems.map((ing) => {
                    const isFocused = focusedNodeId === ing.id;
                    const isConnected = activeNodeIds.has(ing.id);
                    const dimmed = Boolean(focusedNodeId) && !isConnected;
                    return (
                      <button
                        key={ing.id}
                        type="button"
                        data-topo-node={ing.id}
                        onClick={() => setFocusedNodeId(ing.id)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-opacity transition-colors ${
                          isFocused
                            ? 'bg-white border-blue-600'
                            : ing.tone === 'reject'
                              ? 'bg-white border-red-200 hover:border-red-300'
                              : ing.tone === 'direct'
                                ? 'bg-white border-emerald-200 hover:border-emerald-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                        } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {ing.label}
                          </span>
                          <span
                            className={`font-mono tabular-nums text-[11px] shrink-0 ${
                              ing.tone === 'reject'
                                ? 'text-red-600'
                                : ing.tone === 'direct'
                                  ? 'text-emerald-700'
                                  : ing.tone === 'fallback'
                                    ? 'text-amber-700'
                                    : 'text-blue-600'
                            }`}
                          >
                            {ing.ruleNames.length} 项
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                          {ing.sublabel}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Core & Business Groups */}
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
                  <span>2. 核心与业务策略组</span>
                  <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                    {coreAndBusinessGroups.length} 组
                  </span>
                </div>
                <div className="space-y-2">
                  {coreAndBusinessGroups.map((grp) => {
                    const nodeId = `grp:${grp.id}`;
                    const rank = enabledRankMap.get(grp.id) || 0;
                    const isFocused = focusedNodeId === nodeId;
                    const isConnected = activeNodeIds.has(nodeId);
                    const dimmed = Boolean(focusedNodeId) && !isConnected;

                    return (
                      <button
                        key={grp.id}
                        type="button"
                        data-topo-node={nodeId}
                        onClick={() => handleClickGroupNode(grp)}
                        className={`w-full text-left px-3 py-2 rounded-md border transition-opacity transition-colors ${
                          isFocused
                            ? 'bg-blue-50/70 border-blue-600'
                            : rank === 1
                              ? 'bg-emerald-50/40 border-emerald-300 hover:border-emerald-400'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                        } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            <span className="font-mono tabular-nums text-slate-500 mr-1.5">
                              #{String(rank).padStart(2, '0')}
                            </span>
                            {grp.name}
                          </span>
                          <span
                            className={`font-mono text-[11px] shrink-0 ${
                              grp.type === 'url-test'
                                ? 'text-emerald-700'
                                : grp.type === 'fallback'
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {grp.type}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {grp.proxies.length > 0 ? (
                            <span>
                              首选 {grp.proxies[0]}
                              <span className="mx-1 text-slate-300">·</span>
                              <span className="font-mono tabular-nums">
                                {grp.proxies.length} 子项
                                {grp.includeAllProxies ? '+全节点' : ''}
                              </span>
                            </span>
                          ) : (
                            <span>
                              全节点池 ({grp.type === 'url-test' ? `${grp.tolerance}ms` : `${grp.interval}s`})
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: Region Url-Test Groups & Terminals */}
              <div className="md:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
                  <span>3. 地区自动测速与出口</span>
                  <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                    {regionGroups.length} 地区 + 出口
                  </span>
                </div>
                <div className="space-y-2">
                  {regionGroups.map((grp) => {
                    const nodeId = `grp:${grp.id}`;
                    const rank = enabledRankMap.get(grp.id) || 0;
                    const isFocused = focusedNodeId === nodeId;
                    const isConnected = activeNodeIds.has(nodeId);
                    const dimmed = Boolean(focusedNodeId) && !isConnected;
                    return (
                      <button
                        key={grp.id}
                        type="button"
                        data-topo-node={nodeId}
                        onClick={() => handleClickGroupNode(grp)}
                        className={`w-full text-left px-3 py-1.5 rounded-md border transition-opacity transition-colors ${
                          isFocused
                            ? 'bg-blue-50/70 border-blue-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-slate-900 truncate">
                            <span className="font-mono tabular-nums text-slate-400 mr-1.5">
                              #{String(rank).padStart(2, '0')}
                            </span>
                            {grp.name}
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-emerald-700 shrink-0">
                            {grp.type} · {grp.tolerance}ms
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {/* Terminal Outlets */}
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    {[
                      {
                        id: NODE_POOL_ID,
                        title: '节点池 (include-all)',
                        desc: '正则清洗后的全部可用机场节点',
                        tone: 'proxy',
                      },
                      {
                        id: DIRECT_ID,
                        title: 'DIRECT 直连出站',
                        desc: '国内域名 / LAN / 直连策略',
                        tone: 'direct',
                      },
                      {
                        id: REJECT_ID,
                        title: 'REJECT 拒绝拦截',
                        desc: '广告域名 / 隐私追踪响应阻断',
                        tone: 'reject',
                      },
                      {
                        id: REJECT_DROP_ID,
                        title: 'REJECT-DROP 静默丢包',
                        desc: 'QUIC UDP 443 强制回退 TCP',
                        tone: 'reject',
                      },
                    ].map((term) => {
                      const isFocused = focusedNodeId === term.id;
                      const isConnected = activeNodeIds.has(term.id);
                      const dimmed = Boolean(focusedNodeId) && !isConnected;
                      return (
                        <button
                          key={term.id}
                          type="button"
                          data-topo-node={term.id}
                          onClick={() => setFocusedNodeId(term.id)}
                          className={`w-full text-left px-3 py-1.5 rounded-md border transition-opacity transition-colors ${
                            isFocused
                              ? 'bg-slate-900 text-white border-slate-900'
                              : term.tone === 'reject'
                                ? 'bg-white border-red-200 text-slate-900 hover:border-red-300'
                                : term.tone === 'direct'
                                  ? 'bg-white border-emerald-200 text-slate-900 hover:border-emerald-300'
                                  : 'bg-white border-blue-200 text-slate-900 hover:border-blue-300'
                          } ${dimmed ? 'opacity-35' : 'opacity-100'}`}
                        >
                          <div className="text-xs font-semibold truncate">{term.title}</div>
                          <div
                            className={`text-[11px] truncate ${
                              isFocused ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {term.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Group Chain Detail Strip */}
          {focusedGroup && (
            <div className="bg-slate-50/70 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular-nums text-xs font-semibold text-blue-700">
                      #{String(enabledRankMap.get(focusedGroup.id) || 0).padStart(2, '0')}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {focusedGroup.name}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {groupTypeLabel(focusedGroup.type)}
                    </span>
                    {focusedGroup.type === 'url-test' && (
                      <>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-mono tabular-nums text-xs text-slate-500">
                          容差 {focusedGroup.tolerance}ms / {focusedGroup.interval}s
                        </span>
                      </>
                    )}
                  </div>
                  {focusedGroup.filter && (
                    <div className="text-xs text-slate-500 font-mono mt-1 truncate">
                      包含正则: {focusedGroup.filter}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isAutoFirst && (
                    <button
                      type="button"
                      onClick={onPinAutoFirst}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-300 rounded-md hover:bg-emerald-50 transition-colors whitespace-nowrap shrink-0"
                    >
                      <Pin className="w-3 h-3" />
                      自动选择置顶
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={(groupIndexMap.get(focusedGroup.id) ?? 0) === 0}
                    onClick={() => {
                      const idx = groupIndexMap.get(focusedGroup.id);
                      if (typeof idx === 'number') onMoveGroup(idx, -1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <ArrowUp className="w-3 h-3" />
                    上移
                  </button>
                  <button
                    type="button"
                    disabled={
                      (groupIndexMap.get(focusedGroup.id) ?? state.groups.length) >=
                      state.groups.length - 1
                    }
                    onClick={() => {
                      const idx = groupIndexMap.get(focusedGroup.id);
                      if (typeof idx === 'number') onMoveGroup(idx, 1);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-100 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <ArrowDown className="w-3 h-3" />
                    下移
                  </button>
                  <button
                    type="button"
                    onClick={() => onInspectInTable(focusedGroup.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    在下方列表调整成员
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium text-slate-600 mb-1.5">
                    上游输入来源（命中规则或上级策略组）
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {focusedGroupUpstream.ingMatches.map((ing) => (
                      <button
                        key={ing.id}
                        type="button"
                        onClick={() => setFocusedNodeId(ing.id)}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:border-blue-400 transition-colors whitespace-nowrap"
                      >
                        {ing.label}
                      </button>
                    ))}
                    {focusedGroupUpstream.parentGroups.map((pg) => (
                      <button
                        key={pg.id}
                        type="button"
                        onClick={() => handleClickGroupNode(pg)}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:border-blue-400 transition-colors whitespace-nowrap"
                      >
                        {pg.name}
                      </button>
                    ))}
                    {focusedGroupUpstream.ingMatches.length === 0 &&
                      focusedGroupUpstream.parentGroups.length === 0 && (
                        <span className="text-slate-400">
                          作为全局策略组成员供手动/自动切换引用
                        </span>
                      )}
                  </div>
                </div>

                <div>
                  <div className="font-medium text-slate-600 mb-1.5">
                    下游出口顺序（第 1 项为 Clash Mi 默认选中）
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {focusedGroup.proxies.map((ref, mIdx) => {
                      const refGrp = groupByName.get(ref);
                      return (
                        <React.Fragment key={`${focusedGroup.id}-ref-${ref}`}>
                          {mIdx > 0 && (
                            <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              if (refGrp) handleClickGroupNode(refGrp);
                              else setFocusedNodeId(`term:${ref}`);
                            }}
                            className={`px-2.5 py-1 rounded border whitespace-nowrap transition-colors ${
                              mIdx === 0
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'
                            }`}
                          >
                            <span className="font-mono tabular-nums text-[11px] mr-1 opacity-70">
                              [{mIdx + 1}]
                            </span>
                            {ref}
                          </button>
                        </React.Fragment>
                      );
                    })}
                    {focusedGroup.includeAllProxies && (
                      <>
                        {focusedGroup.proxies.length > 0 && (
                          <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                        )}
                        <button
                          type="button"
                          onClick={() => setFocusedNodeId(NODE_POOL_ID)}
                          className="px-2.5 py-1 rounded border border-blue-200 bg-white text-blue-700 hover:border-blue-400 whitespace-nowrap"
                        >
                          + 清洗后节点池 ({focusedGroup.filter ? '按地区正则' : '全量单节点'})
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Clash Mi Mobile Client Preview */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50/70 border border-slate-200 rounded-lg p-4 md:p-5">
          {/* Left: Clash Mi Android Proxy Groups Order */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
              <span>Clash Mi 安卓「代理」页顺序</span>
              <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                共 {enabledGroups.length} 组
              </span>
            </div>
            <div className="bg-white border border-slate-200 rounded-md divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
              {enabledGroups.map((grp, idx) => {
                const isSelected = mobilePreviewGroup?.id === grp.id;
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleClickGroupNode(grp)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        <span className="font-mono tabular-nums text-slate-400 mr-2">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        {grp.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5 pl-7">
                        默认：{grp.proxies[0] || (grp.type === 'url-test' ? '最低延迟节点' : '可用节点')}
                      </div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {grp.type}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Expanded Group Detail (Sub-groups + Cleaned Nodes) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
              <span className="inline-flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                展开查看：{mobilePreviewGroup?.name || '-'}
              </span>
              <span className="font-mono tabular-nums text-[11px] font-normal text-slate-500">
                子策略 {(mobilePreviewGroup?.proxies.length ?? 0)} 项 · 模拟节点 {mobileCleanedNodes.length} 条
              </span>
            </div>

            {mobilePreviewGroup && (
              <div className="bg-white border border-slate-200 rounded-md p-4 space-y-4 max-h-[380px] overflow-y-auto">
                {mobilePreviewGroup.proxies.length > 0 && (
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 mb-2">
                      策略组成员（按默认优先级排列）
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {mobilePreviewGroup.proxies.map((member, mIdx) => (
                        <div
                          key={`${mobilePreviewGroup.id}-m-${member}`}
                          className={`px-3 py-2 rounded border text-xs flex items-center justify-between gap-2 ${
                            mIdx === 0
                              ? 'border-emerald-300 bg-emerald-50/50 text-emerald-950 font-medium'
                              : 'border-slate-200 bg-slate-50/50 text-slate-800'
                          }`}
                        >
                          <span className="truncate">{member}</span>
                          <span className="font-mono tabular-nums text-[11px] text-slate-400 shrink-0">
                            {mIdx === 0 ? '默认选中' : `#${mIdx + 1}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {mobilePreviewGroup.includeAllProxies && (
                  <div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-2">
                      <span>纳管清洗后单节点（示例订阅模拟）</span>
                      <span className="font-mono tabular-nums">
                        已过滤 {nodeSimulation.excludedCount} 条无效/高倍率提示
                      </span>
                    </div>
                    {mobileCleanedNodes.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mobileCleanedNodes.map((nodeName) => (
                          <div
                            key={nodeName}
                            className="px-3 py-2 rounded border border-slate-200 bg-white text-xs font-mono text-slate-800 truncate"
                          >
                            {nodeName}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 py-3">
                        当前示例订阅中无匹配该正则的节点（JS 覆写模式将自动跳过空地区组）。
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
