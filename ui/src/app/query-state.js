const TAB_QUERY_NAMES = ['environments', 'tasks', 'accounts', 'settings'];
const DETAIL_TAB_QUERY_NAMES = ['overview', 'diff'];

function getWindowUrl() {
  if (typeof window === 'undefined') {
    return null;
  }
  return new URL(window.location.href);
}

function readTabQuery() {
  const url = getWindowUrl();
  if (!url) {
    return 1;
  }
  const rawTab = (url.searchParams.get('tab') || window.location.hash || '').replace('#', '');
  const tab = rawTab.toLowerCase();
  const tabIndex = TAB_QUERY_NAMES.indexOf(tab);
  return tabIndex === -1 ? 1 : tabIndex;
}

function readTaskIdQuery() {
  const url = getWindowUrl();
  return url?.searchParams.get('taskId') || '';
}

function readDetailTabQuery() {
  const url = getWindowUrl();
  const value = (url?.searchParams.get('detailTab') || '').trim().toLowerCase();
  const detailIndex = DETAIL_TAB_QUERY_NAMES.indexOf(value);
  return detailIndex === -1 ? 0 : detailIndex;
}

function replaceQueryParams(updates) {
  const url = getWindowUrl();
  if (!url) {
    return;
  }

  Object.entries(updates).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      url.searchParams.delete(key);
      return;
    }
    url.searchParams.set(key, value);
  });

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, '', nextUrl);
}

function writeTabQuery(activeTab) {
  const isTasksTab = activeTab === 1;
  replaceQueryParams({
    tab: TAB_QUERY_NAMES[activeTab] || TAB_QUERY_NAMES[1],
    taskId: isTasksTab ? undefined : null,
    detailTab: isTasksTab ? undefined : null
  });
}

function writeTaskIdQuery(taskId, options = {}) {
  const { clearDetailTab = false } = options;
  replaceQueryParams({
    taskId: taskId || null,
    detailTab: clearDetailTab ? null : undefined
  });
}

function writeDetailTabQuery(activeTab) {
  replaceQueryParams({
    detailTab: DETAIL_TAB_QUERY_NAMES[activeTab] || DETAIL_TAB_QUERY_NAMES[0]
  });
}

export {
  DETAIL_TAB_QUERY_NAMES,
  readTabQuery,
  readDetailTabQuery,
  readTaskIdQuery,
  replaceQueryParams,
  TAB_QUERY_NAMES,
  writeDetailTabQuery,
  writeTabQuery,
  writeTaskIdQuery
};
