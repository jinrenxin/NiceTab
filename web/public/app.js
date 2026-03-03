const statusText = document.getElementById('statusText');
const metaText = document.getElementById('metaText');
const countText = document.getElementById('countText');
const content = document.getElementById('content');
const navList = document.getElementById('navList');
const navListMobile = document.getElementById('navListMobile');
const refreshBtn = document.getElementById('refreshBtn');
const addTagBtn = document.getElementById('addTagBtn');
const saveChangesBtn = document.getElementById('saveChangesBtn');
const backToTopBtn = document.getElementById('backToTopBtn');

let editableData = [];
let hasPendingChanges = false;
let currentProvider = '';
let currentGistId = '';
let currentFileName = '';
let currentUpdatedAt = '';

const clearNode = node => {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
};

const createText = (tag, text, className) => {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  el.textContent = text;
  return el;
};

const createLink = (url, title) => {
  const el = document.createElement('a');
  el.href = url || '#';
  el.target = '_blank';
  el.rel = 'noopener noreferrer';
  el.textContent = title || url || 'Untitled';
  return el;
};

const createActionButton = (text, handler, extraClassName) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `item-action-btn${extraClassName ? ` ${extraClassName}` : ''}`;
  button.textContent = text;
  button.addEventListener('click', handler);
  return button;
};

const cloneData = data => JSON.parse(JSON.stringify(data || []));

const countGroups = tagList =>
  tagList.reduce((sum, tag) => sum + (Array.isArray(tag?.groupList) ? tag.groupList.length : 0), 0);

const countTabs = tagList =>
  tagList.reduce((sum, tag) => {
    const groups = Array.isArray(tag?.groupList) ? tag.groupList : [];
    const tabCount = groups.reduce(
      (innerSum, group) => innerSum + (Array.isArray(group?.tabList) ? group.tabList.length : 0),
      0,
    );
    return sum + tabCount;
  }, 0);

const ensureGroupList = tag => {
  if (!Array.isArray(tag.groupList)) {
    tag.groupList = [];
  }
  return tag.groupList;
};

const ensureTabList = group => {
  if (!Array.isArray(group.tabList)) {
    group.tabList = [];
  }
  return group.tabList;
};

const promptInput = (message, defaultValue) => {
  const value = window.prompt(message, defaultValue || '');
  if (value === null) {
    return null;
  }
  return value.trim();
};

const refreshCountText = () => {
  const tagCount = editableData.length || 0;
  const groupCount = countGroups(editableData);
  const tabCount = countTabs(editableData);
  const pending = hasPendingChanges ? ' | 有未提交变更' : '';
  countText.textContent = `分类 ${tagCount} | 标签组 ${groupCount} | 标签页 ${tabCount}${pending}`;
};

const refreshMetaText = () => {
  const provider = currentProvider || '-';
  const gistId = currentGistId || '-';
  const fileName = currentFileName || '-';
  const updatedAt = currentUpdatedAt ? `更新于 ${currentUpdatedAt}` : '更新时间未知';
  metaText.textContent = `${provider} | ${gistId} | ${fileName} | ${updatedAt}`;
};

const setPendingState = pending => {
  hasPendingChanges = pending;
  if (saveChangesBtn) {
    saveChangesBtn.disabled = !pending;
  }
  refreshCountText();
};

const render = data => {
  clearNode(content);
  clearNode(navList);
  clearNode(navListMobile);

  if (!data?.length) {
    content.appendChild(createText('div', '没有可展示的标签页数据', 'empty'));
    navList.appendChild(createText('div', '暂无目录', 'nav-empty'));
    navListMobile.appendChild(createText('div', '暂无目录', 'nav-empty'));
    return;
  }

  data.forEach((tag, tagIndex) => {
    const tagId = `tag-${tagIndex + 1}`;
    const title = tag.tagName || `未命名分类 ${tagIndex + 1}`;

    const createNavButton = () => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'nav-item';
      button.textContent = title;
      button.addEventListener('click', () => {
        const target = document.getElementById(tagId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
      return button;
    };

    navList.appendChild(createNavButton());
    navListMobile.appendChild(createNavButton());

    const wrapper = document.createElement('section');
    wrapper.className = 'tag';
    wrapper.id = tagId;

    const tagHeader = document.createElement('div');
    tagHeader.className = 'tag-header';
    tagHeader.appendChild(createText('div', title, 'tag-title'));

    const tagActions = document.createElement('div');
    tagActions.className = 'item-actions';
    tagActions.appendChild(createActionButton('改名', () => renameTag(tagIndex)));
    tagActions.appendChild(createActionButton('新增组', () => addGroup(tagIndex)));
    tagActions.appendChild(createActionButton('删除', () => deleteTag(tagIndex), 'danger'));
    tagHeader.appendChild(tagActions);

    wrapper.appendChild(tagHeader);

    const groups = Array.isArray(tag.groupList) ? tag.groupList : [];
    if (!groups.length) {
      wrapper.appendChild(createText('div', '暂无标签组', 'empty'));
    } else {
      groups.forEach((group, groupIndex) => {
        const groupEl = document.createElement('div');
        groupEl.className = 'group';

        const groupHeader = document.createElement('div');
        groupHeader.className = 'group-header';
        groupHeader.appendChild(createText('div', group.groupName || '未命名标签组', 'group-title'));

        const groupActions = document.createElement('div');
        groupActions.className = 'item-actions';
        groupActions.appendChild(createActionButton('改名', () => renameGroup(tagIndex, groupIndex)));
        groupActions.appendChild(createActionButton('新增页', () => addTab(tagIndex, groupIndex)));
        groupActions.appendChild(
          createActionButton('删除', () => deleteGroup(tagIndex, groupIndex), 'danger'),
        );
        groupHeader.appendChild(groupActions);

        groupEl.appendChild(groupHeader);

        const tabs = Array.isArray(group.tabList) ? group.tabList : [];
        if (!tabs.length) {
          groupEl.appendChild(createText('div', '暂无标签页', 'empty'));
        } else {
          const list = document.createElement('ul');
          list.className = 'tab-list';

          tabs.forEach((tab, tabIndex) => {
            const li = document.createElement('li');
            li.className = 'tab-item';

            const row = document.createElement('div');
            row.className = 'tab-row';

            const main = document.createElement('div');
            main.className = 'tab-main';
            const tabTitle = tab.title || tab.url || 'Untitled';
            main.appendChild(createLink(tab.url, tabTitle));
            if (tab.url && tab.title && tab.title !== tab.url) {
              main.appendChild(createText('div', tab.url, 'tab-url'));
            }
            row.appendChild(main);

            const tabActions = document.createElement('div');
            tabActions.className = 'item-actions';
            tabActions.appendChild(
              createActionButton('修改', () => editTab(tagIndex, groupIndex, tabIndex)),
            );
            tabActions.appendChild(
              createActionButton('删除', () => deleteTab(tagIndex, groupIndex, tabIndex), 'danger'),
            );
            row.appendChild(tabActions);

            li.appendChild(row);
            list.appendChild(li);
          });

          groupEl.appendChild(list);
        }

        wrapper.appendChild(groupEl);
      });
    }

    content.appendChild(wrapper);
  });
};

const applyLocalChange = () => {
  setPendingState(true);
  render(editableData);
};

const addTag = () => {
  const defaultName = `分类 ${editableData.length + 1}`;
  const tagName = promptInput('输入分类名称', defaultName);
  if (tagName === null) {
    return;
  }

  editableData.push({
    tagName: tagName || defaultName,
    groupList: [],
  });

  applyLocalChange();
};

const renameTag = tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const nextName = promptInput('修改分类名称', tag.tagName || '');
  if (nextName === null) {
    return;
  }

  tag.tagName = nextName || '未命名分类';
  applyLocalChange();
};

const deleteTag = tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const title = tag.tagName || `分类 ${tagIndex + 1}`;
  if (!window.confirm(`确认删除分类“${title}”吗？`)) {
    return;
  }

  editableData.splice(tagIndex, 1);
  applyLocalChange();
};

const addGroup = tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const defaultName = `标签组 ${groups.length + 1}`;
  const groupName = promptInput('输入标签组名称', defaultName);
  if (groupName === null) {
    return;
  }

  groups.push({
    groupName: groupName || defaultName,
    tabList: [],
  });

  applyLocalChange();
};

const renameGroup = (tagIndex, groupIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const nextName = promptInput('修改标签组名称', group.groupName || '');
  if (nextName === null) {
    return;
  }

  group.groupName = nextName || '未命名标签组';
  applyLocalChange();
};

const deleteGroup = (tagIndex, groupIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const title = group.groupName || `标签组 ${groupIndex + 1}`;
  if (!window.confirm(`确认删除标签组“${title}”吗？`)) {
    return;
  }

  groups.splice(groupIndex, 1);
  applyLocalChange();
};

const addTab = (tagIndex, groupIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const tabs = ensureTabList(group);

  const defaultTitle = `标签页 ${tabs.length + 1}`;
  const titleInput = promptInput('输入标签页标题', defaultTitle);
  if (titleInput === null) {
    return;
  }
  const urlInput = promptInput('输入标签页 URL', 'https://');
  if (urlInput === null) {
    return;
  }

  tabs.push({
    title: titleInput || urlInput || defaultTitle,
    url: urlInput || '',
  });

  applyLocalChange();
};

const editTab = (tagIndex, groupIndex, tabIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const tabs = ensureTabList(group);
  const tab = tabs[tabIndex];
  if (!tab) {
    return;
  }

  const titleInput = promptInput('修改标签页标题', tab.title || '');
  if (titleInput === null) {
    return;
  }
  const urlInput = promptInput('修改标签页 URL', tab.url || '');
  if (urlInput === null) {
    return;
  }

  tab.title = titleInput || urlInput || 'Untitled';
  tab.url = urlInput || '';
  applyLocalChange();
};

const deleteTab = (tagIndex, groupIndex, tabIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const tabs = ensureTabList(group);
  const tab = tabs[tabIndex];
  if (!tab) {
    return;
  }
  const title = tab.title || tab.url || `标签页 ${tabIndex + 1}`;
  if (!window.confirm(`确认删除标签页“${title}”吗？`)) {
    return;
  }

  tabs.splice(tabIndex, 1);
  applyLocalChange();
};

const loadData = async () => {
  statusText.textContent = '加载中';
  metaText.textContent = '';
  countText.textContent = '';
  try {
    const response = await fetch('/api/tabs');
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `请求失败 ${response.status}`);
    }

    const result = await response.json();
    editableData = cloneData(result.data || []);
    currentProvider = result.provider || '';
    currentGistId = result.gistId || '';
    currentFileName = result.fileName || '';
    currentUpdatedAt = result.updatedAt || '';

    setPendingState(false);
    render(editableData);
    refreshMetaText();

    statusText.textContent = '加载成功';
  } catch (error) {
    statusText.textContent = '加载失败';
    metaText.textContent = error instanceof Error ? error.message : '未知错误';
    clearNode(content);
    clearNode(navList);
    clearNode(navListMobile);
    content.appendChild(createText('div', '加载失败，请检查配置', 'empty'));
    navList.appendChild(createText('div', '暂无目录', 'nav-empty'));
    navListMobile.appendChild(createText('div', '暂无目录', 'nav-empty'));
  }
};

const saveChanges = async () => {
  if (!hasPendingChanges) {
    return;
  }

  statusText.textContent = '提交中';
  if (saveChangesBtn) {
    saveChangesBtn.disabled = true;
  }

  try {
    const response = await fetch('/api/tabs', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        data: editableData,
        fileName: currentFileName,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `提交失败 ${response.status}`);
    }

    const result = await response.json();
    editableData = cloneData(result.data || editableData);
    currentProvider = result.provider || currentProvider;
    currentGistId = result.gistId || currentGistId;
    currentFileName = result.fileName || currentFileName;
    currentUpdatedAt = result.updatedAt || currentUpdatedAt;

    setPendingState(false);
    render(editableData);
    refreshMetaText();
    statusText.textContent = '提交成功';
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    statusText.textContent = `提交失败：${message}`;
    setPendingState(true);
  }
};

const canDiscardLocalChanges = () => {
  if (!hasPendingChanges) {
    return true;
  }
  return window.confirm('当前有未提交变更，刷新会丢失本地修改，是否继续？');
};

const updateBackToTopVisibility = () => {
  if (!backToTopBtn) {
    return;
  }
  backToTopBtn.classList.toggle('is-visible', window.scrollY > 0);
};

refreshBtn.addEventListener('click', () => {
  if (!canDiscardLocalChanges()) {
    return;
  }
  loadData();
});

if (addTagBtn) {
  addTagBtn.addEventListener('click', addTag);
}

if (saveChangesBtn) {
  saveChangesBtn.addEventListener('click', saveChanges);
}

if (backToTopBtn) {
  backToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
window.addEventListener('beforeunload', event => {
  if (!hasPendingChanges) {
    return;
  }
  event.preventDefault();
  event.returnValue = '';
});

updateBackToTopVisibility();
loadData();
