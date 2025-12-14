
import React, { useState, useEffect, useCallback } from 'react';
import { CampaignLog, GrowthInput, ComputedMetrics, GrowthReport, SocialMetrics, CalendarEvent, StrategyTask, TrendItem, BrandConfig } from '../types';
import { computeGrowthMetrics, getSocialMetrics, fetchSocialMetrics, getHandle } from '../services/analytics';
import { generateGrowthReport, generateStrategicAnalysis, generateTweet, generateWeb3Graphic } from '../services/gemini';
import { fetchMarketPulse } from '../services/pulse';
import { Button } from './Button';
import { loadIntegrationKeys, saveIntegrationKeys } from '../services/storage';

interface GrowthEngineProps {
  brandName: string;
  calendarEvents?: CalendarEvent[];
  brandConfig?: BrandConfig;
  onSchedule?: (content: string, image?: string, date?: string) => void;
}

interface ContractInput {
  id: string;
  label: string;
  address: string;
  type: string;
}

// Internal Component for Top-Row Stats
const StatCard = ({ label, value, trend, trendDirection, subtext, icon, isLoading }: any) => (
    <div className="bg-white p-6 rounded-xl border border-brand-border shadow-sm flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
            <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">{label}</span>
            {trend && (
                <span className={`font-bold text-xs ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {trendDirection === 'up' ? '▲' : '▼'} {trend}
                </span>
            )}
        </div>
        <div className="space-y-1">
            {isLoading ? (
                <div className="h-8 w-24 bg-gray-100 animate-pulse rounded" />
            ) : (
                <div className="text-3xl font-display font-bold text-brand-text tracking-tight">{value}</div>
            )}
            <div className="text-xs text-brand-muted">{subtext}</div>
        </div>
    </div>
);

export const GrowthEngine: React.FC<GrowthEngineProps> = ({ brandName, calendarEvents, brandConfig, onSchedule }) => {
  // --- TABS ---
  const [activeTab, setActiveTab] = useState<'analytics' | 'strategy'>('analytics');

  // --- ANALYTICS STATE ---
  const [socialMetrics, setSocialMetrics] = useState<SocialMetrics | null>(null);
  const [isSocialLoading, setIsSocialLoading] = useState(false);
  const [isOnChainConnected, setIsOnChainConnected] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [contracts, setContracts] = useState<ContractInput[]>([]);
  
  // Keys persisted state
  const [duneKey, setDuneKey] = useState('');
  const [apifyKey, setApifyKey] = useState('');
  
  const [campaigns, setCampaigns] = useState<CampaignLog[]>([]);
  const [chainMetrics, setChainMetrics] = useState<ComputedMetrics | null>(null);
  const [report, setReport] = useState<GrowthReport | null>(null);

  // --- STRATEGY STATE ---
  const [strategyTasks, setStrategyTasks] = useState<StrategyTask[]>([]);
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isExecutingStrategy, setIsExecutingStrategy] = useState<string | null>(null);
  const [hasRunStrategy, setHasRunStrategy] = useState(false);

  // Load Real Data Helper
  const loadRealSocialData = useCallback(async (keyToUse?: string) => {
        setIsSocialLoading(true);
        try {
            const realMetrics = await fetchSocialMetrics(brandName, keyToUse || apifyKey);
            setSocialMetrics(realMetrics);
        } catch (e) {
            console.warn("Failed to load real social metrics", e);
        } finally {
            setIsSocialLoading(false);
        }
  }, [brandName, apifyKey]);

  // Load persisted keys on mount
  useEffect(() => {
      const savedKeys = loadIntegrationKeys();
      if (savedKeys.dune) {
          setDuneKey(savedKeys.dune);
          setIsOnChainConnected(true);
      }
      if (savedKeys.apify) {
          setApifyKey(savedKeys.apify);
      }
  }, []);

  const handleSaveKeys = () => {
      saveIntegrationKeys({ dune: duneKey, apify: apifyKey });
      if (duneKey) setIsOnChainConnected(true);
      performAnalysis(); // Auto-run analysis on save
      setIsSettingUp(false);
  };

  const handleSkipToSimulation = () => {
      setIsSettingUp(false);
      performAnalysis({ forceSimulation: true });
  };

  // Analysis Logic
  const performAnalysis = useCallback(async (overrideParams?: { socialOnly?: boolean, forceSimulation?: boolean }) => {
    // If forcing simulation, skip connection check
    if (!overrideParams?.forceSimulation && !overrideParams?.socialOnly && (contracts.length === 0 || !duneKey)) return;

    setIsSettingUp(false);
    setIsProcessing(true);
    
    try {
      let computed = null;

      if (overrideParams?.socialOnly) {
          setProcessingStatus('Fetching social data...');
          await loadRealSocialData();
      } else {
          setProcessingStatus('Aggregating on-chain data...');
          await new Promise(r => setTimeout(r, 1000)); // Simulate delay
          computed = await computeGrowthMetrics({
            contracts: contracts.map(c => ({ label: c.label, address: c.address, type: c.type as any })),
            duneApiKey: duneKey, // If empty, computeGrowthMetrics handles simulation
            excludedWallets: [],
            campaigns: campaigns
          });
      }

      setChainMetrics(computed);
      setProcessingStatus('Generating Strategy Brief via Gemini...');
      const metricsForReport = (overrideParams?.socialOnly) ? await fetchSocialMetrics(brandName, apifyKey) : (socialMetrics || getSocialMetrics(brandName));
      const aiReport = await generateGrowthReport(computed, campaigns, metricsForReport);
      
      setReport(aiReport);
    } catch (e) {
      console.error(e);
      setProcessingStatus('Analysis interrupted.');
    } finally {
        setIsProcessing(false);
    }
  }, [brandName, contracts, duneKey, campaigns, socialMetrics, apifyKey, loadRealSocialData]);

  const handleSocialOnlyAnalysis = () => {
      performAnalysis({ socialOnly: true });
  };

  // Strategy Logic
  const performStrategyAudit = async () => {
      if (!calendarEvents || !brandConfig) return;
      setIsStrategyLoading(true);
      try {
          const trends = await fetchMarketPulse(brandName);
          // NEW: Pass the report to the strategy engine
          const tasks = await generateStrategicAnalysis(brandName, calendarEvents, trends, brandConfig, report);
          setStrategyTasks(tasks);
          setHasRunStrategy(true);
      } catch (e) { console.error(e); } finally { setIsStrategyLoading(false); }
  };

  const executeStrategyTask = async (task: StrategyTask) => {
      if (!brandConfig || !onSchedule) return;
      setIsExecutingStrategy(task.id);
      try {
          const copy = await generateTweet(task.executionPrompt, brandName, brandConfig, 'Professional');
          const image = await generateWeb3Graphic({
              prompt: `Editorial graphic for ${brandName}. Context: ${task.title}`,
              size: '1K',
              aspectRatio: '16:9',
              brandConfig,
              brandName
          });
          onSchedule(copy, image, task.suggestedDate);
          setStrategyTasks(prev => prev.filter(t => t.id !== task.id));
      } catch (e) { console.error(e); } finally { setIsExecutingStrategy(null); }
  };

  const handleDirectiveAction = async (directive: { action: string, subject: string, reasoning: string }) => {
      // Trigger a specific strategy generation based on this directive
      if (!brandConfig || !calendarEvents) return;
      setActiveTab('strategy');
      setIsStrategyLoading(true);
      
      try {
          // Manual construction of a task based on directive, instead of full re-analysis
          const newTask: StrategyTask = {
              id: `dir-${Date.now()}`,
              type: directive.action === 'KILL' ? 'GAP_FILL' : 'CAMPAIGN_IDEA',
              title: `${directive.action}: ${directive.subject}`,
              description: `Strategic execution based on report directive: ${directive.reasoning}`,
              reasoning: directive.reasoning,
              impactScore: 10,
              executionPrompt: `Write a high-impact tweet about ${directive.subject}. Strategy: ${directive.action === 'KILL' ? 'Pivot away from previous angle.' : 'Amplify and double down on this success.'}`
          };
          
          setStrategyTasks(prev => [newTask, ...prev]);
          setHasRunStrategy(true);
      } finally {
          setIsStrategyLoading(false);
      }
  };

  const dismissTask = (id: string) => {
      setStrategyTasks(prev => prev.filter(t => t.id !== id));
  };

  // Defaults & Init
  useEffect(() => {
    setSocialMetrics(getSocialMetrics(brandName));
    loadRealSocialData();
    // Do not reset keys here, they are loaded separately
    setChainMetrics(null);
    setReport(null);
    setStrategyTasks([]);
    setHasRunStrategy(false);
    
    // Default Inputs
    let initialCampaigns: CampaignLog[] = [];
    let initialContracts: ContractInput[] = [];

    if (brandName === 'ENKI') {
        initialContracts = [{ id: 'c1', label: '$ENKI Token', address: '0xENKI...Token', type: 'token' }];
        initialCampaigns = [{ id: '1', name: 'Sequencer Launch', startDate: '2024-02-01', endDate: '2024-02-14', budget: 15000, channel: 'Twitter' }];
        // Only set default if user hasn't provided one
        if (!duneKey) setDuneKey('dune_live_showcase_key_enki_v3');
        if (!apifyKey) setApifyKey('apify_live_twitter_scraper_v2');
        setContracts(initialContracts);
        setCampaigns(initialCampaigns);
    } 
  }, [brandName]); 

  // --- Derived Metrics ---
  const engRate = socialMetrics?.engagementRate || 0;
  const growthScore = Math.min((engRate * 1.5) + (socialMetrics?.comparison.engagementChange || 0 > 0 ? 0.5 : 0), 10).toFixed(1);
  const activeAudience = chainMetrics ? chainMetrics.activeWallets : socialMetrics?.totalFollowers || 0;
  const retention = chainMetrics ? `${chainMetrics.retentionRate.toFixed(1)}%` : `${socialMetrics?.engagementRate}%`;

  return (
    <div className="space-y-8 animate-fadeIn pb-10 w-full h-full flex flex-col">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-xl border border-brand-border shadow-sm">
          <div>
            <h2 className="text-2xl font-display font-bold text-brand-text">Growth & Strategy Hub</h2>
            <div className="flex items-center gap-2 mt-1">
                <p className="text-brand-muted text-sm">Unified command center for analysis and AI strategic planning.</p>
                {/* Visual Connection Status Indicators */}
                {duneKey && <span className="flex items-center text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200 font-bold">● On-Chain</span>}
                {apifyKey && <span className="flex items-center text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 font-bold">● Social</span>}
            </div>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg mt-4 md:mt-0">
               <button 
                  onClick={() => setActiveTab('analytics')}
                  className={`px-6 py-2 text-xs font-bold rounded-md transition-all ${activeTab === 'analytics' ? 'bg-white text-brand-text shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
               >
                  Performance Data
               </button>
               <button 
                  onClick={() => setActiveTab('strategy')}
                  className={`px-6 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${activeTab === 'strategy' ? 'bg-white text-purple-700 shadow-sm' : 'text-brand-muted hover:text-brand-text'}`}
               >
                  <span className="text-[10px]">⚡</span> Gaia Strategy
               </button>
          </div>
      </div>

      {/* STATS ROW (Always Visible) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Growth Index" 
            value={`${growthScore}`} 
            subtext="Composite Score (0-10)"
            trend={Math.abs(socialMetrics?.comparison.engagementChange || 0) / 10}
            trendDirection={(socialMetrics?.comparison.engagementChange || 0) >= 0 ? 'up' : 'down'}
            isLoading={isSocialLoading}
          />
          <StatCard 
            label={chainMetrics ? "Active Addresses" : "Total Audience"} 
            value={(activeAudience > 1000 ? (activeAudience/1000).toFixed(1) + 'K' : activeAudience)} 
            subtext={chainMetrics ? "7d Unique Wallets" : "Followers"}
            trend={Math.abs(socialMetrics?.comparison.followersChange || 0)}
            trendDirection={(socialMetrics?.comparison.followersChange || 0) >= 0 ? 'up' : 'down'}
            isLoading={isSocialLoading}
          />
          <StatCard 
            label={chainMetrics ? "Retention" : "Engagement"} 
            value={retention} 
            subtext={chainMetrics ? ">2 Tx / Month" : "Interactions / View"}
            trend="2.1%"
            trendDirection="up"
            isLoading={isSocialLoading}
          />
           <StatCard 
            label="Active Campaigns" 
            value={campaigns.length}
            subtext="Tracking Attribution"
            isLoading={isSocialLoading}
          />
      </div>

      {/* TAB CONTENT: ANALYTICS */}
      {activeTab === 'analytics' && (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 animate-fadeIn flex-1">
          {/* Main Chart/Report Area */}
          <div className="lg:col-span-3 space-y-6">
              <div className="bg-white rounded-xl border border-brand-border shadow-sm p-8 relative min-h-[500px]">
                   <div className="flex justify-between items-start mb-6 pb-4 border-b border-gray-100">
                       <h3 className="text-lg font-bold text-brand-text">Performance Audit</h3>
                       {!isOnChainConnected ? (
                           <Button onClick={() => setIsSettingUp(true)} className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700">Connect Data Sources</Button>
                       ) : (
                           <Button onClick={() => setIsSettingUp(true)} variant="secondary" className="h-8 text-xs">Manage Sources</Button>
                       )}
                   </div>
                   
                   {isProcessing ? (
                       <div className="py-24 text-center">
                           <div className="w-12 h-12 border-4 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                           <p className="text-sm text-brand-muted animate-pulse font-medium">{processingStatus}</p>
                       </div>
                   ) : report ? (
                       <div className="prose prose-sm max-w-none text-brand-text">
                           <div className="bg-gray-50 p-6 rounded-xl border border-brand-border mb-8">
                               <p className="whitespace-pre-line text-base leading-relaxed">{report.executiveSummary}</p>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                               <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                   <h4 className="font-bold text-gray-900 mb-2">On-Chain Health</h4>
                                   <div className="text-sm text-gray-600">
                                       <div className="flex justify-between py-1 border-b border-gray-50"><span>New Wallets</span> <span className="font-mono font-bold text-brand-text">{chainMetrics?.netNewWallets || 'N/A'}</span></div>
                                       <div className="flex justify-between py-1 border-b border-gray-50"><span>TVL Change</span> <span className="font-mono font-bold text-green-600">+{chainMetrics ? '$' + chainMetrics.tvlChange.toLocaleString() : 'N/A'}</span></div>
                                       <div className="flex justify-between py-1 pt-2"><span>Retention</span> <span className="font-mono font-bold text-brand-text">{chainMetrics ? chainMetrics.retentionRate.toFixed(1) + '%' : 'N/A'}</span></div>
                                   </div>
                               </div>
                               <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                                   <h4 className="font-bold text-gray-900 mb-2">Social Health</h4>
                                   <div className="text-sm text-gray-600">
                                       <div className="flex justify-between py-1 border-b border-gray-50"><span>Followers</span> <span className="font-mono font-bold text-brand-text">{socialMetrics?.totalFollowers.toLocaleString()}</span></div>
                                       <div className="flex justify-between py-1 border-b border-gray-50"><span>Engagement</span> <span className="font-mono font-bold text-brand-text">{socialMetrics?.engagementRate}%</span></div>
                                       <div className="flex justify-between py-1 pt-2"><span>Mentions</span> <span className="font-mono font-bold text-brand-text">{socialMetrics?.mentions}</span></div>
                                   </div>
                               </div>
                           </div>
                       </div>
                   ) : (
                       <div className="bg-gray-50 border border-brand-border rounded-lg p-12 text-center h-64 flex flex-col items-center justify-center">
                           <p className="text-brand-muted text-sm mb-4">Connect data to generate a performance audit.</p>
                           <div className="flex gap-2">
                                <Button onClick={handleSocialOnlyAnalysis} variant="secondary" className="text-xs h-8">Run Social-Only Audit</Button>
                                <Button onClick={handleSkipToSimulation} variant="outline" className="text-xs h-8">Run Full Simulation</Button>
                           </div>
                       </div>
                   )}
              </div>
          </div>

          {/* Sidebar: Directives */}
          <div className="space-y-6">
              <div className="bg-white rounded-xl border border-brand-border shadow-sm p-6 h-full flex flex-col">
                  <h3 className="font-bold text-brand-text mb-6 text-xs uppercase tracking-wider">Strategic Directives</h3>
                  <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                      {report?.strategicPlan ? report.strategicPlan.map((plan, idx) => {
                          const badgeColor = 
                              plan.action === 'KILL' ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 
                              plan.action === 'DOUBLE_DOWN' ? 'bg-green-50 text-green-700 ring-1 ring-green-100' : 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-100';
                          
                          return (
                              <div key={idx} className="pb-4 border-b border-gray-100 last:border-0 group">
                                  <div className="flex justify-between items-start mb-2">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${badgeColor}`}>
                                          {plan.action}
                                      </span>
                                  </div>
                                  <h4 className="text-sm font-bold text-brand-text mb-1 leading-snug">{plan.subject}</h4>
                                  <p className="text-xs text-brand-muted mb-3">{plan.reasoning}</p>
                                  <button 
                                    onClick={() => handleDirectiveAction(plan)}
                                    className="w-full text-center text-xs bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded font-medium border border-gray-200 transition-colors"
                                  >
                                      Generate Plan
                                  </button>
                              </div>
                          );
                      }) : (
                          <div className="text-center py-10 text-brand-muted text-xs bg-gray-50 rounded-lg border border-dashed border-gray-200">
                              Waiting for analysis...
                          </div>
                      )}
                  </div>
              </div>
          </div>
      </div>
      )}

      {/* TAB CONTENT: STRATEGY (GAIA) */}
      {activeTab === 'strategy' && (
          <div className="animate-fadeIn space-y-6 flex-1">
             {/* Strategy Header */}
             <div className="bg-gradient-to-r from-purple-50 to-white p-6 rounded-xl border border-purple-100 flex justify-between items-center">
                 <div className="flex gap-4 items-center">
                     <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center text-xl shadow-sm">⚡</div>
                     <div>
                         <h3 className="text-lg font-bold text-purple-900">Gaia (AI Strategist)</h3>
                         <p className="text-sm text-purple-700">I will analyze your calendar gaps and market trends to propose specific tasks.</p>
                     </div>
                 </div>
                 <Button onClick={performStrategyAudit} disabled={isStrategyLoading} className="bg-purple-600 hover:bg-purple-700 text-white border-transparent shadow-lg shadow-purple-500/20">
                     {isStrategyLoading ? 'Analyzing...' : 'Run Strategy Audit'}
                 </Button>
             </div>
             
             {/* Alert if report is available */}
             {report && !hasRunStrategy && (
                 <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-center text-sm text-blue-800 animate-fadeIn">
                     <span><strong>New Performance Data Available.</strong> Run an audit to get optimized tasks based on recent metrics.</span>
                     <button onClick={performStrategyAudit} className="underline font-bold">Run Now</button>
                 </div>
             )}

             {/* Task Grid - 4 Columns Layout */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {strategyTasks.map((task) => (
                     <div key={task.id} className="bg-white border border-brand-border rounded-xl p-6 shadow-sm hover:shadow-lg transition-all relative group flex flex-col h-full">
                         {/* Dismiss Button */}
                         <button 
                            onClick={() => dismissTask(task.id)}
                            className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                         >
                             ✕
                         </button>

                         <div className="flex justify-between items-start mb-4">
                             <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${
                                 task.type === 'GAP_FILL' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 
                                 task.type === 'TREND_JACK' ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                             }`}>
                                 {task.type.replace('_', ' ')}
                             </span>
                             <span className="text-[10px] font-bold text-brand-muted">Impact: {task.impactScore}/10</span>
                         </div>
                         <h3 className="font-bold text-brand-text mb-3 text-lg leading-tight">{task.title}</h3>
                         <p className="text-sm text-brand-muted mb-4 flex-1">{task.description}</p>
                         <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                             <p className="text-xs text-gray-500 italic">"{task.reasoning}"</p>
                         </div>
                         <Button 
                            onClick={() => executeStrategyTask(task)} 
                            disabled={isExecutingStrategy !== null}
                            isLoading={isExecutingStrategy === task.id}
                            className="w-full text-xs h-10"
                         >
                             Execute & Schedule
                         </Button>
                     </div>
                 ))}
                 
                 {hasRunStrategy && strategyTasks.length === 0 && (
                     <div className="col-span-4 text-center py-24 bg-white rounded-xl border border-brand-border text-brand-muted">
                         <div className="text-4xl mb-4">✨</div>
                         <p>No critical gaps found. Your strategy is optimized.</p>
                     </div>
                 )}
                 
                 {!hasRunStrategy && !isStrategyLoading && (
                     <div className="col-span-4 text-center py-24 text-brand-muted bg-gray-50 rounded-xl border border-dashed border-gray-200">
                         Click "Run Strategy Audit" to generate tasks.
                     </div>
                 )}
             </div>
          </div>
      )}

      {/* SETUP MODAL */}
      {isSettingUp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold text-brand-text">Data Sources</h3>
                      <button onClick={() => setIsSettingUp(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  
                  <div className="space-y-6">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                           <h4 className="font-bold text-sm text-brand-text mb-2 flex items-center gap-2">
                               {duneKey && <span className="text-green-500">●</span>} Dune Analytics (On-Chain)
                           </h4>
                           <label className="text-xs text-brand-muted block mb-1">API Key</label>
                           <input 
                                type="password" 
                                value={duneKey} 
                                onChange={e => setDuneKey(e.target.value)} 
                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent" 
                                placeholder="dune_..."
                           />
                           <p className="text-[10px] text-gray-500 mt-1">Required for Wallet Retention and TVL tracking.</p>
                      </div>

                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                           <h4 className="font-bold text-sm text-brand-text mb-2 flex items-center gap-2">
                               {apifyKey && <span className="text-green-500">●</span>} Apify (Social)
                           </h4>
                           <label className="text-xs text-brand-muted block mb-1">API Token</label>
                           <input 
                                type="password" 
                                value={apifyKey} 
                                onChange={e => setApifyKey(e.target.value)} 
                                className="w-full border border-brand-border rounded p-2 text-sm focus:outline-none focus:border-brand-accent" 
                                placeholder="apify_api_..."
                           />
                           <p className="text-[10px] text-gray-500 mt-1">Required for real-time Twitter scraping.</p>
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                          <button 
                            onClick={handleSkipToSimulation}
                            className="px-4 py-2 text-xs font-bold text-brand-muted hover:text-brand-text transition-colors mr-auto"
                          >
                              Skip & Simulate Data
                          </button>
                          <Button onClick={() => setIsSettingUp(false)} variant="secondary">Cancel</Button>
                          <Button onClick={handleSaveKeys}>Save & Connect</Button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};
