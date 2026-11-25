export type ProxyGroupType = 'select' | 'url-test' | 'fallback' | 'load-balance';

export interface OverwriteSettings {
  outputTarget: 'both' | 'yaml' | 'js';
  skipEmptyRegionGroups: boolean;
  stripExcludedProxies: boolean;
  overwriteDns: boolean;
  dnsAdSinkhole: boolean;
  overwriteSniffer: boolean;
}

export interface ProxyGroupConfig {
  id: string;
  name: string;
  type: ProxyGroupType;
  filter: string;
  excludeFilter: string;
  url: string;
  interval: number;
  tolerance: number;
  strategy: 'consistent-hashing' | 'round-robin';
  includeAllProxies: boolean;
  proxies: string[];
  enabled: boolean;
  isSystem?: boolean;
}

export type RuleSourceFlavor = 'metacubex-mrs' | 'loyalsoldier-yaml';

export type AdBlockLevel = 'light' | 'balanced' | 'ultra' | 'custom';

export interface RuleModuleConfig {
  id: string;
  label: string;
  category: 'reject' | 'ai' | 'streaming' | 'dev' | 'social' | 'service' | 'direct';
  providerName: string;
  behavior: 'domain' | 'ipcidr' | 'classical';
  mrsBehavior?: 'domain' | 'ipcidr' | 'classical';
  tier?: 'light' | 'balanced' | 'ultra';
  mrsUrl: string;
  yamlUrl: string;
  targetGroup: string;
  interval: number;
  enabled: boolean;
  noResolve?: boolean;
  sampleDomains: string[];
}

export interface KernelSettings {
  ipv6: boolean;
  dnsMode: 'fake-ip' | 'redir-host';
  dohChina: string;
  dohGlobal: string;
  ruleSourceFlavor: RuleSourceFlavor;
  adBlockLevel: AdBlockLevel;
  globalExcludeFilter: string;
}

export interface GithubAutomationConfig {
  owner: string;
  repo: string;
  branch: string;
  visibility: 'public' | 'private';
  cronExpression: string;
  cronPreset: '6h' | '12h' | '24h' | 'custom';
  commitMessage: string;
  enableStepSummary: boolean;
}

export interface CustomRulesConfig {
  proxyList: string;
  directList: string;
  rejectList: string;
}

export interface NodeSubscriptionConfig {
  enabled: boolean;
  cronExpression: string;
  sourcesList: string;
}

export interface ClashWorkspaceState {
  overwrite: OverwriteSettings;
  groups: ProxyGroupConfig[];
  ruleModules: RuleModuleConfig[];
  kernel: KernelSettings;
  github: GithubAutomationConfig;
  customRules: CustomRulesConfig;
  nodeSubscription: NodeSubscriptionConfig;
}

export interface GeneratedFile {
  path: string;
  language: 'yaml' | 'javascript' | 'text' | 'markdown' | 'json';
  title: string;
  description: string;
  content: string;
}

export interface YamlValidationResult {
  valid: boolean;
  error: string | null;
  lineCount: number;
}
