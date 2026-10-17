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
let activeModalResolver = null;

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
  tagList.reduce(
    (sum, tag) => sum + (Array.isArray(tag?.groupList) ? tag.groupList.length : 0),
    0,
  );

const countTabs = tagList =>
  tagList.reduce((sum, tag) => {
    const groups = Array.isArray(tag?.groupList) ? tag.groupList : [];
    const tabCount = groups.reduce(
      (innerSum, group) =>
        innerSum + (Array.isArray(group?.tabList) ? group.tabList.length : 0),
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

const closeModal = result => {
  if (typeof activeModalResolver === 'function') {
    const resolver = activeModalResolver;
    activeModalResolver = null;
    const modal = document.querySelector('.web-modal-overlay');
    if (modal?.parentNode) {
      modal.parentNode.removeChild(modal);
    }
    resolver(result);
  }
};

const showModal = ({
  title,
  message,
  mode = 'confirm',
  defaultValue = '',
  confirmText = '确定',
  cancelText = '取消',
}) => {
  if (activeModalResolver) {
    closeModal(mode === 'confirm' ? false : null);
  }

  return new Promise(resolve => {
    activeModalResolver = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'web-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'web-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    const titleEl = createText('div', title, 'web-modal-title');
    const messageEl = createText('div', message, 'web-modal-message');
    modal.appendChild(titleEl);
    modal.appendChild(messageEl);

    let input = null;
    if (mode === 'prompt') {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'web-modal-input';
      input.value = defaultValue;
      modal.appendChild(input);
    }

    const actions = document.createElement('div');
    actions.className = 'web-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'web-modal-btn web-modal-btn-cancel';
    cancelBtn.textContent = cancelText;
    cancelBtn.addEventListener('click', () =>
      closeModal(mode === 'confirm' ? false : null),
    );

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'web-modal-btn web-modal-btn-confirm';
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => {
      if (mode === 'prompt') {
        closeModal(input ? input.value.trim() : '');
        return;
      }
      closeModal(true);
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeModal(mode === 'confirm' ? false : null);
      }
    });

    const keyHandler = event => {
      if (!activeModalResolver) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal(mode === 'confirm' ? false : null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (mode === 'prompt') {
          closeModal(input ? input.value.trim() : '');
          return;
        }
        closeModal(true);
      }
    };

    document.addEventListener('keydown', keyHandler);

    window.requestAnimationFrame(() => {
      if (input) {
        input.focus();
        input.select();
      } else {
        confirmBtn.focus();
      }
    });
  });
};

const promptInput = async (message, defaultValue) => {
  return showModal({
    title: '请输入',
    message,
    mode: 'prompt',
    defaultValue: defaultValue || '',
  });
};

const confirmAction = async message => {
  return showModal({
    title: '确认操作',
    message,
    mode: 'confirm',
  });
};

const showTabEditorModal = async ({
  title,
  message,
  defaultTitle = '',
  defaultUrl = '',
}) => {
  if (activeModalResolver) {
    closeModal(null);
  }

  return new Promise(resolve => {
    activeModalResolver = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'web-modal-overlay';

    const modal = document.createElement('div');
    modal.className = 'web-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.appendChild(createText('div', title, 'web-modal-title'));
    modal.appendChild(createText('div', message, 'web-modal-message'));

    const form = document.createElement('div');
    form.className = 'web-modal-form';

    const titleField = document.createElement('div');
    titleField.className = 'web-modal-field';
    titleField.appendChild(createText('label', '标题', 'web-modal-label'));
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'web-modal-input';
    titleInput.value = defaultTitle;
    titleField.appendChild(titleInput);

    const urlField = document.createElement('div');
    urlField.className = 'web-modal-field';
    urlField.appendChild(createText('label', 'URL', 'web-modal-label'));
    const urlInput = document.createElement('input');
    urlInput.type = 'text';
    urlInput.className = 'web-modal-input';
    urlInput.value = defaultUrl;
    urlField.appendChild(urlInput);

    form.appendChild(titleField);
    form.appendChild(urlField);
    modal.appendChild(form);

    const actions = document.createElement('div');
    actions.className = 'web-modal-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'web-modal-btn web-modal-btn-cancel';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => closeModal(null));

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'web-modal-btn web-modal-btn-confirm';
    confirmBtn.textContent = '确定';
    confirmBtn.addEventListener('click', () => {
      closeModal({
        title: titleInput.value.trim(),
        url: urlInput.value.trim(),
      });
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeModal(null);
      }
    });

    const keyHandler = event => {
      if (!activeModalResolver) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal(null);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        closeModal({
          title: titleInput.value.trim(),
          url: urlInput.value.trim(),
        });
      }
    };

    document.addEventListener('keydown', keyHandler);

    window.requestAnimationFrame(() => {
      titleInput.focus();
      titleInput.select();
    });
  });
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
    tagActions.appendChild(
      createActionButton('删除', () => deleteTag(tagIndex), 'danger'),
    );
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
        groupHeader.appendChild(
          createText('div', group.groupName || '未命名标签组', 'group-title'),
        );

        const groupActions = document.createElement('div');
        groupActions.className = 'item-actions';
        groupActions.appendChild(
          createActionButton('改名', () => renameGroup(tagIndex, groupIndex)),
        );
        groupActions.appendChild(
          createActionButton('新增页', () => addTab(tagIndex, groupIndex)),
        );
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
              createActionButton(
                '删除',
                () => deleteTab(tagIndex, groupIndex, tabIndex),
                'danger',
              ),
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

const addTag = async () => {
  const defaultName = `分类 ${editableData.length + 1}`;
  const tagName = await promptInput('输入分类名称', defaultName);
  if (tagName === null) {
    return;
  }

  editableData.push({
    tagName: tagName || defaultName,
    groupList: [],
  });

  applyLocalChange();
};

const renameTag = async tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const nextName = await promptInput('修改分类名称', tag.tagName || '');
  if (nextName === null) {
    return;
  }

  tag.tagName = nextName || '未命名分类';
  applyLocalChange();
};

const deleteTag = async tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const title = tag.tagName || `分类 ${tagIndex + 1}`;
  if (!(await confirmAction(`确认删除分类“${title}”吗？`))) {
    return;
  }

  editableData.splice(tagIndex, 1);
  applyLocalChange();
};

const addGroup = async tagIndex => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const defaultName = `标签组 ${groups.length + 1}`;
  const groupName = await promptInput('输入标签组名称', defaultName);
  if (groupName === null) {
    return;
  }

  groups.push({
    groupName: groupName || defaultName,
    tabList: [],
  });

  applyLocalChange();
};

const renameGroup = async (tagIndex, groupIndex) => {
  const tag = editableData[tagIndex];
  if (!tag) {
    return;
  }
  const groups = ensureGroupList(tag);
  const group = groups[groupIndex];
  if (!group) {
    return;
  }
  const nextName = await promptInput('修改标签组名称', group.groupName || '');
  if (nextName === null) {
    return;
  }

  group.groupName = nextName || '未命名标签组';
  applyLocalChange();
};

const deleteGroup = async (tagIndex, groupIndex) => {
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
  if (!(await confirmAction(`确认删除标签组“${title}”吗？`))) {
    return;
  }

  groups.splice(groupIndex, 1);
  applyLocalChange();
};

const addTab = async (tagIndex, groupIndex) => {
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
  const formData = await showTabEditorModal({
    title: '新增标签页',
    message: '请同时填写标题与 URL（可只填一项）',
    defaultTitle,
    defaultUrl: 'https://',
  });
  if (formData === null) {
    return;
  }

  tabs.push({
    title: formData.title || formData.url || defaultTitle,
    url: formData.url || '',
  });

  applyLocalChange();
};

const editTab = async (tagIndex, groupIndex, tabIndex) => {
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

  const formData = await showTabEditorModal({
    title: '修改标签页',
    message: '请修改标题与 URL，然后一次确认提交',
    defaultTitle: tab.title || '',
    defaultUrl: tab.url || '',
  });
  if (formData === null) {
    return;
  }

  tab.title = formData.title || formData.url || 'Untitled';
  tab.url = formData.url || '';
  applyLocalChange();
};

const deleteTab = async (tagIndex, groupIndex, tabIndex) => {
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
  if (!(await confirmAction(`确认删除标签页“${title}”吗？`))) {
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

const canDiscardLocalChanges = async () => {
  if (!hasPendingChanges) {
    return true;
  }
  return confirmAction('当前有未提交变更，刷新会丢失本地修改，是否继续？');
};

const updateBackToTopVisibility = () => {
  if (!backToTopBtn) {
    return;
  }
  backToTopBtn.classList.toggle('is-visible', window.scrollY > 0);
};

refreshBtn.addEventListener('click', async () => {
  if (!(await canDiscardLocalChanges())) {
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
