const TAB_QUERY_NAMES = ['environments', 'tasks', 'accounts', 'settings'];

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
  replaceQueryParams({ tab: TAB_QUERY_NAMES[activeTab] || TAB_QUERY_NAMES[1] });
}

function writeTaskIdQuery(taskId) {
  replaceQueryParams({ taskId: taskId || null });
}

export {
  readTabQuery,
  readTaskIdQuery,
  replaceQueryParams,
  TAB_QUERY_NAMES,
  writeTabQuery,
  writeTaskIdQuery
};
