import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ArrowUpRight,
  Eye,
  FileArchive,
  FileText,
  Layers,
  Search,
  Server,
  Clock,
  BarChart2,
  Activity,
  X,
  AlertCircle
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Custom tooltip component that can be reused
// Custom tooltip component with dynamic positioning
const CustomTooltip = ({ children, content }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState('right');
  const tooltipRef = useRef(null);
  const containerRef = useRef(null);

  const updatePosition = useCallback(() => {
    if (containerRef.current && tooltipRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      // Check if there's enough space on the right side
      const spaceOnRight = viewportWidth - containerRect.right;
      const tooltipWidth = 288; // max-w-xs is roughly 288px

      if (spaceOnRight < tooltipWidth) {
        setPosition('left');
      } else {
        setPosition('right');
      }
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsVisible(true);
    // Small delay to ensure the tooltip is rendered before positioning
    setTimeout(updatePosition, 0);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`absolute z-10 p-2 text-sm bg-gray-800 text-white rounded shadow-lg max-w-xs -mt-2 ${
            position === 'right'
              ? 'left-full ml-2'
              : 'right-full mr-2'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

// Enhanced stat card with icon and value
// Enhanced stat card with icon and value - modified for consistent number alignment
const StatCard = ({ title, value, icon: Icon, isLoading, onClick, tooltip }) => {
  const content = (
    <div
      className={`group relative bg-white dark:bg-dark-secondary p-4 rounded-lg shadow-md transition-colors h-full ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800' : ''}`}
      onClick={onClick}
    >
      {/* Use flex column with justify-between to push content to top and bottom */}
      <div className="flex flex-col justify-between h-full">
        {/* Top content area */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 transition-colors">{title}</h3>
            {Icon && <Icon className="h-5 w-5 text-blue-500 dark:text-blue-400" />}
          </div>
        </div>

        {/* Bottom content area - always at the bottom */}
        <div className="mt-auto">
          {isLoading ? (
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent transition-colors" />
          ) : (
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 transition-colors">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
          )}
        </div>
      </div>

      {onClick && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <ArrowUpRight className="h-4 w-4 text-blue-500" />
        </div>
      )}
    </div>
  );

  return tooltip ? (
    <CustomTooltip content={tooltip}>
      {content}
    </CustomTooltip>
  ) : content;
};

// Section with title and optional action
const DashboardSection = ({ title, children, action }) => (
  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg shadow border border-gray-200 dark:border-gray-800">
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 transition-colors">{title}</h2>
      {action}
    </div>
    {children}
  </div>
);

const POLL_INTERVAL = 5000; // Poll every 5 seconds

const StatsOverview = () => {
  const [stats, setStats] = useState(null);
  const [enrichmentStats, setEnrichmentStats] = useState(null);
  const [failedWorkflows, setFailedWorkflows] = useState(null);
  const [filesOverTime, setFilesOverTime] = useState(null);
  const [findingsOverTime, setFindingsOverTime] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnrichmentLoading, setIsEnrichmentLoading] = useState(true);
  const [isFailedWorkflowsLoading, setIsFailedWorkflowsLoading] = useState(true);
  const [isTimeSeriesLoading, setIsTimeSeriesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrichmentError, setEnrichmentError] = useState(null);
  const [failedWorkflowsError, setFailedWorkflowsError] = useState(null);
  const [timeSeriesError, setTimeSeriesError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);




  const fetchStats = useCallback(async () => {
    try {
      const query = {
        query: `
          query GetStats {
            files_enriched_aggregate {
              aggregate {
                count
              }
            }
            submitted_files: files_enriched_aggregate(
              where: { originating_object_id: { _is_null: true } }
            ) {
              aggregate {
                count
              }
            }
            containers_processed: files_enriched_aggregate(
              where: { is_container: { _eq: true } }
            ) {
              aggregate {
                count
              }
            }
            unviewed_files: files_enriched_aggregate(
              where: {
                _and: [
                  {
                    _or: [
                      { originating_object_id: { _is_null: true } },
                      {
                        _and: [
                          { originating_object_id: { _is_null: false } },
                          { nesting_level: { _is_null: false } },
                          { nesting_level: { _gt: 0 } }
                        ]
                      }
                    ]
                  },
                  {
                    _not: {
                      files_view_histories: {}
                    }
                  }
                ]
              }
            ) {
              aggregate {
                count
              }
            }
            noseyparker_findings: findings_aggregate(
              where: { origin_name: { _eq: "noseyparker" } }
            ) {
              aggregate {
                count
              }
            }
            yara_findings: findings_aggregate(
              where: { origin_name: { _eq: "yara_scanner" } }
            ) {
              aggregate {
                count
              }
            }
            findings_aggregate {
              aggregate {
                count
              }
            }
            yara_rules_aggregate(
              where: { enabled: { _eq: true } }
            ) {
              aggregate {
                count
              }
            }
            untriaged_findings: findings_aggregate(
              where: {
                _not: {
                  finding_triage_histories: {}
                }
              }
            ) {
              aggregate {
                count
              }
            }
            latest_triage_entries: findings_triage_history(
              distinct_on: finding_id
              order_by: [{ finding_id: asc }, { timestamp: desc }]
            ) {
              finding_id
              value
            }
          }
        `,
        variables: {}
      };

      const response = await fetch('/hasura/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': window.ENV.HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      const noseyParkerCount = result.data.noseyparker_findings.aggregate.count;
      const yaraCount = result.data.yara_findings.aggregate.count;

      // Process latest triage entries to get counts by value
      const latestTriageEntries = result.data.latest_triage_entries || [];
      const triageCounts = latestTriageEntries.reduce((acc, entry) => {
        acc[entry.value] = (acc[entry.value] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalFiles: result.data.files_enriched_aggregate.aggregate.count,
        submittedFiles: result.data.submitted_files.aggregate.count,
        containersProcessed: result.data.containers_processed.aggregate.count,
        unviewedFiles: result.data.unviewed_files.aggregate.count,
        totalFindings: result.data.findings_aggregate.aggregate.count,
        noseyParkerMatches: noseyParkerCount,
        yaraMatches: yaraCount,
        enabledYaraRules: result.data.yara_rules_aggregate.aggregate.count,
        untriagedFindings: result.data.untriaged_findings.aggregate.count,
        truePositiveFindings: triageCounts.true_positive || 0,
        falsePositiveFindings: triageCounts.false_positive || 0,
        needsReviewFindings: triageCounts.needs_review || 0
      });



      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Error fetching stats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEnrichmentStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/workflows/status');

      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }

      const data = await response.json();
      setEnrichmentStats(data);
      setEnrichmentError(null);
    } catch (err) {
      console.error('Error fetching enrichment status:', err);
      setEnrichmentError(err.message);
    } finally {
      setIsEnrichmentLoading(false);
    }
  }, []);

  const fetchFailedWorkflows = useCallback(async () => {
    try {
      const response = await fetch('/api/workflows/failed');

      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }

      const data = await response.json();
      setFailedWorkflows(data);
      setFailedWorkflowsError(null);
    } catch (err) {
      console.error('Error fetching failed workflows:', err);
      setFailedWorkflowsError(err.message);
    } finally {
      setIsFailedWorkflowsLoading(false);
    }
  }, []);

  const fetchTimeSeriesData = useCallback(async () => {
    try {
      // Get current date and date 5 days ago
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 5);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // For Hasura we need to use a different approach since we can't do groupBy directly
      // Let's get the data for each day separately
      const getDatesArray = () => {
        const dates = [];
        const currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
          dates.push(new Date(currentDate));
          currentDate.setDate(currentDate.getDate() + 1);
        }

        return dates;
      };

      const dates = getDatesArray();

      // Create a batch query for all dates
      let filesQueryParts = '';
      let findingsQueryParts = '';

      dates.forEach((date, index) => {
        const dateStr = date.toISOString().split('T')[0];
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        filesQueryParts += `
          files_day_${index}: files_enriched_aggregate(
            where: {
              created_at: { _gte: "${dateStr}", _lt: "${nextDateStr}" },
              originating_object_id: { _is_null: true }
            }
          ) {
            aggregate {
              count
            }
          }
        `;

        findingsQueryParts += `
          findings_day_${index}: findings_aggregate(
            where: {
              created_at: { _gte: "${dateStr}", _lt: "${nextDateStr}" }
            }
          ) {
            aggregate {
              count
            }
          }
        `;
      });

      const query = {
        query: `
          query GetTimeSeriesData {
            ${filesQueryParts}
            ${findingsQueryParts}
          }
        `,
        variables: {}
      };

      const response = await fetch('/hasura/v1/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-hasura-admin-secret': window.ENV.HASURA_ADMIN_SECRET,
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`Network response error: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      // Process the response data into time series format
      const filesData = [];
      const findingsData = [];

      dates.forEach((date, index) => {
        const formattedDate = date.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});

        // Get file count for this day
        const fileCount = result.data[`files_day_${index}`]?.aggregate?.count || 0;
        filesData.push({
          date: formattedDate,
          count: fileCount
        });

        // Get findings count for this day
        const findingsCount = result.data[`findings_day_${index}`]?.aggregate?.count || 0;
        findingsData.push({
          date: formattedDate,
          count: findingsCount
        });
      });

      setFilesOverTime(filesData);
      setFindingsOverTime(findingsData);
      setTimeSeriesError(null);
    } catch (err) {
      console.error('Error fetching time series data:', err);
      setTimeSeriesError(err.message);
    } finally {
      setIsTimeSeriesLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch for all data sources
    fetchStats();
    fetchEnrichmentStatus();
    fetchFailedWorkflows();
    fetchTimeSeriesData();

    // Set up polling interval for all
    const statsIntervalId = setInterval(fetchStats, POLL_INTERVAL);
    const enrichmentIntervalId = setInterval(fetchEnrichmentStatus, POLL_INTERVAL);
    const failedWorkflowsIntervalId = setInterval(fetchFailedWorkflows, POLL_INTERVAL);
    const timeSeriesIntervalId = setInterval(fetchTimeSeriesData, POLL_INTERVAL);

    // Cleanup intervals on component unmount
    return () => {
      clearInterval(statsIntervalId);
      clearInterval(enrichmentIntervalId);
      clearInterval(failedWorkflowsIntervalId);
      clearInterval(timeSeriesIntervalId);
    };
  }, [fetchStats, fetchEnrichmentStatus, fetchFailedWorkflows, fetchTimeSeriesData]);

  // Add visibility change handler to pause/resume polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Immediately fetch when tab becomes visible again
        fetchStats();
        fetchEnrichmentStatus();
        fetchFailedWorkflows();
        fetchTimeSeriesData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchStats, fetchEnrichmentStatus, fetchFailedWorkflows, fetchTimeSeriesData]);



  // Processing time breakdown data
  const processingTimeData = enrichmentStats?.metrics?.processing_times && [
    { name: 'Average', value: enrichmentStats.metrics.processing_times.avg_seconds },
    { name: 'Median (P50)', value: enrichmentStats.metrics.processing_times.p50_seconds },
    { name: '90th Percentile', value: enrichmentStats.metrics.processing_times.p90_seconds },
    { name: 'Maximum', value: enrichmentStats.metrics.processing_times.max_seconds }
  ];

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center space-x-2 transition-colors">
        <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
        <div className="flex flex-col">
          <span className="text-red-600 dark:text-red-400">Error loading statistics: {error}</span>
          <span className="text-sm text-red-500 dark:text-red-400">Check browser console for details</span>
        </div>
      </div>
    );
  }

  // Function to handle navigation
  const handleNavigation = (path) => {
    window.location.href = path;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mt-2 ml-2">Nemesis Dashboard</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-1">
          <Clock className="w-4 h-4" />
          <span>{lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Updating...'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Files Overview Section */}
        <DashboardSection
          title="Files Overview"
          action={
            <button
              className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
              onClick={() => handleNavigation('/files')}
            >
              View all <ArrowUpRight className="w-4 h-4 ml-1" />
            </button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              title="Total Submitted Files"
              value={stats?.submittedFiles ?? 0}
              icon={FileText}
              isLoading={isLoading}
              onClick={() => handleNavigation('/files')}
              tooltip="Total files submitted to Nemesis"
            />
            <StatCard
              title="Total Processed Files"
              value={stats?.totalFiles ?? 0}
              icon={Layers}
              isLoading={isLoading}
              onClick={() => handleNavigation('/files')}
              tooltip="Total files processed by Nemesis, including derived files"
            />
            <StatCard
              title="Unviewed Files"
              value={stats?.unviewedFiles ?? 0}
              icon={Eye}
              isLoading={isLoading}
              onClick={() => handleNavigation('/files?view_state=unviewed')}
              tooltip="Files that haven't been viewed by anyone"
            />
            <StatCard
              title="Containers Processed"
              value={stats?.containersProcessed ?? 0}
              icon={FileArchive}
              isLoading={isLoading}
              onClick={() => handleNavigation('/files')}
              tooltip="Archive files (.zip, .7z, etc.) processed"
            />
          </div>

          {!isTimeSeriesLoading && filesOverTime && filesOverTime.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">Files over time</p>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#6B7280" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#6B7280" />
                    <RechartsTooltip
                      formatter={(value) => [`${value} files`, 'Count']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Line type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}


        </DashboardSection>

        {/* Findings Overview Section */}
        <DashboardSection
          title="Findings Overview"
          action={
            <button
              className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
              onClick={() => handleNavigation('/findings')}
            >
              View all <ArrowUpRight className="w-4 h-4 ml-1" />
            </button>
          }
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              title="Total Findings"
              value={stats?.totalFindings ?? 0}
              icon={Search}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings')}
              tooltip="Total findings across all categories"
            />
            <StatCard
              title="NoseyParker Matches"
              value={stats?.noseyParkerMatches ?? 0}
              icon={Search}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings')}
              tooltip="Credentials and sensitive data found"
            />
            <StatCard
              title="Yara Matches"
              value={stats?.yaraMatches ?? 0}
              icon={Search}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings?category=yara_match')}
              tooltip="Files matching enabled Yara rules"
            />
            <StatCard
              title="Enabled Yara Rules"
              value={stats?.enabledYaraRules ?? 0}
              icon={Server}
              isLoading={isLoading}
              onClick={() => handleNavigation('/yara-rules')}
              tooltip="Currently enabled Yara rules"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <StatCard
              title="Untriaged Findings"
              value={stats?.untriagedFindings ?? 0}
              icon={AlertTriangle}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings?triage_state=untriaged')}
              tooltip="Findings that have not been triaged yet"
            />
            <StatCard
              title="True Positives"
              value={stats?.truePositiveFindings ?? 0}
              icon={CheckCircle}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings?triage_state=true_positive')}
              tooltip="Findings marked as true positives"
            />
            <StatCard
              title="False Positives"
              value={stats?.falsePositiveFindings ?? 0}
              icon={X}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings?triage_state=false_positive')}
              tooltip="Findings marked as false positives"
            />
            <StatCard
              title="Needs Review"
              value={stats?.needsReviewFindings ?? 0}
              icon={Clock}
              isLoading={isLoading}
              onClick={() => handleNavigation('/findings?triage_state=needs_review')}
              tooltip="Findings that need further review"
            />
          </div>


        </DashboardSection>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Enrichment Service Section */}
        <DashboardSection title="Enrichment Service">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              title="Active Workflows"
              value={enrichmentStats?.active_workflows ?? 0}
              icon={Activity}
              isLoading={isEnrichmentLoading}
              tooltip="File enrichment workflows currently running"
            />
            <StatCard
              title="Queued Files"
              value={enrichmentStats?.queued_files ?? 0}
              icon={Clock}
              isLoading={isEnrichmentLoading}
              tooltip="Files internally queued by the File Enrichment service"
            />
            <StatCard
              title="Completed Files"
              value={enrichmentStats?.metrics?.completed_count ?? 0}
              icon={FileText}
              isLoading={isEnrichmentLoading}
              tooltip="Files successfully processed by the File Enrichment service"
            />
            <StatCard
              title="Failed Workflows"
              value={failedWorkflows?.failed_count ?? 0}
              icon={X}
              isLoading={isFailedWorkflowsLoading}
              tooltip="Workflows that failed, errored, or timed out"
            />
          </div>

          {!isEnrichmentLoading && processingTimeData && (
            <div className="h-48 mt-4">
              <p className="text-sm text-gray-500 mb-2">Processing times (seconds)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={processingTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#6B7280" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#6B7280" />
                  <RechartsTooltip />
                  <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </DashboardSection>

        {/* Current Enrichment Workflows */}
        <DashboardSection title="Current Enrichment Workflows">
          {/* Remove the nested container div and put content directly in section */}
          <div className="space-y-3">
            {enrichmentStats?.active_details?.map((detail, index) => (
              <div key={detail.id} className="p-3 bg-white dark:bg-gray-700 rounded shadow-sm flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    Workflow {detail.id.substring(0, 8)}
                    {detail.filename && <span className="ml-2 font-normal text-gray-600 dark:text-gray-400">({detail.filename} / {detail.object_id})</span>}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Status: {detail.status}</div>
                </div>
                <div className="text-sm font-medium text-blue-500">
                  {detail.runtime_seconds ? detail.runtime_seconds.toFixed(2) : '0.00'}s
                </div>
              </div>
            ))}

            {/* Show a message when there are no current workflows activities */}
            {(!enrichmentStats?.active_details || enrichmentStats.active_details.length === 0) && (
              <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                No current enrichment workflows running
              </div>
            )}
          </div>
        </DashboardSection>
      </div>

      {/* Failed Workflows Section */}
      <DashboardSection title="Failed Workflows">
        <div className="space-y-3">
          {failedWorkflows?.workflows?.slice(0, 5).map((workflow) => (
            <div key={workflow.id} className="p-3 bg-white dark:bg-gray-700 rounded shadow-sm flex justify-between items-center">
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                  Workflow {workflow.id.substring(0, 8)}
                  {workflow.filename && <span className="ml-2 font-normal text-gray-600 dark:text-gray-400">({workflow.filename} / {workflow.object_id})</span>}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Status: {workflow.status}</div>
                {workflow.error && (
                  <div className="text-xs text-red-500 dark:text-red-400 mt-1 line-clamp-2">
                    Error: {workflow.error}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-red-500">
                  {workflow.runtime_seconds ? workflow.runtime_seconds.toFixed(2) : '0.00'}s
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(workflow.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}

          {/* Show count of additional failures if there are more than 5 */}
          {failedWorkflows?.workflows?.length > 5 && (
            <div className="text-center py-2 text-gray-500 dark:text-gray-400 text-sm">
              +{failedWorkflows.workflows.length - 5} more failed workflows
            </div>
          )}

          {/* Show a message when there are no failed workflows */}
          {(!failedWorkflows?.workflows || failedWorkflows.workflows.length === 0) && (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              No failed workflows
            </div>
          )}
        </div>
      </DashboardSection>

      {enrichmentError && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center space-x-2 transition-colors">
          <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          <div className="flex flex-col">
            <span className="text-yellow-600 dark:text-yellow-400">
              Warning: Enrichment service metrics unavailable: {enrichmentError}
            </span>
          </div>
        </div>
      )}

      {failedWorkflowsError && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center space-x-2 transition-colors mt-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          <div className="flex flex-col">
            <span className="text-yellow-600 dark:text-yellow-400">
              Warning: Failed workflows information unavailable: {failedWorkflowsError}
            </span>
          </div>
        </div>
      )}

      {timeSeriesError && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg flex items-center space-x-2 transition-colors mt-4">
          <AlertTriangle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          <div className="flex flex-col">
            <span className="text-yellow-600 dark:text-yellow-400">
              Warning: Time series data unavailable: {timeSeriesError}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsOverview;