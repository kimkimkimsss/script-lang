import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  databaseURL: "https://script01-d56c4-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let clientId = localStorage.getItem('brainstorm_client_id');
if (!clientId) {
  clientId = 'user_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('brainstorm_client_id', clientId);
}

let topicsData = {};
let currentTabId = null;
let ideasData = {};
let currentModalIdeaId = null;
let searchQuery = '';
let currentSort = 'latest';

const tabsList = document.getElementById('tabs-list');
const addTabBtn = document.getElementById('add-tab-btn');

const board = document.getElementById('board');
const ideaInput = document.getElementById('idea-input');
const submitBtn = document.getElementById('submit-btn');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit-btn');
const sidebarInputGroup = document.getElementById('sidebar-input-group');

const top3Btn = document.getElementById('top3-btn');
const top3ModalOverlay = document.getElementById('top3-modal-overlay');
const top3List = document.getElementById('top3-list');

const searchInput = document.getElementById('search-input');
const searchResultCount = document.getElementById('search-result-count');
const searchResultList = document.getElementById('search-result-list');
const filterBtns = document.querySelectorAll('.filter-btn');

const searchSidebar = document.getElementById('search-sidebar');
const commentSidebar = document.getElementById('comment-sidebar');

let activeResizer = null;

if (searchSidebar) {
  searchSidebar.addEventListener('mousedown', (e) => {
    const rect = searchSidebar.getBoundingClientRect();
    if (rect.right - e.clientX <= 12) {
      activeResizer = 'left';
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    }
  });
}

if (commentSidebar) {
  commentSidebar.addEventListener('mousedown', (e) => {
    const rect = commentSidebar.getBoundingClientRect();
    if (e.clientX - rect.left <= 12) {
      activeResizer = 'right';
      document.body.style.cursor = 'ew-resize';
      e.preventDefault();
    }
  });
}

document.addEventListener('mousemove', (e) => {
  if (!activeResizer) return;
  if (activeResizer === 'left' && searchSidebar) {
    let newWidth = e.clientX;
    if (newWidth >= 240 && newWidth <= 480) {
      searchSidebar.style.width = `${newWidth}px`;
    }
  } else if (activeResizer === 'right' && commentSidebar) {
    let newWidth = window.innerWidth - e.clientX;
    if (newWidth >= 260 && newWidth <= 650) {
      commentSidebar.style.width = `${newWidth}px`;
    }
  }
});

document.addEventListener('mouseup', () => {
  if (activeResizer) {
    activeResizer = null;
    document.body.style.cursor = 'default';
  }
});

function getRandomPastelColor() {
  let hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 75%, 90%)`;
}

const topicsRef = ref(db, 'topics');

onValue(topicsRef, (snapshot) => {
  topicsData = snapshot.val() || {};
  let topicKeys = Object.keys(topicsData);

  if (topicKeys.length === 0) {
    let newRef = push(topicsRef);
    set(newRef, { title: '새 주제' });
    currentTabId = newRef.key;
  } else if (!currentTabId || !topicsData[currentTabId]) {
    currentTabId = topicKeys[0];
  }

  renderTabs();
  listenToCurrentTabIdeas();
});

function listenToCurrentTabIdeas() {
  if (!currentTabId) return;
  let currentIdeasRef = ref(db, `ideas/${currentTabId}`);
  onValue(currentIdeasRef, (snapshot) => {
    ideasData = snapshot.val() || {};
    renderBoard();
    renderSearchList();
    if (currentModalIdeaId && ideasData[currentModalIdeaId]) {
      renderComments(ideasData[currentModalIdeaId]);
    } else {
      resetSidebar();
    }
  });
}

function renderTabs() {
  if (!tabsList) return;
  tabsList.innerHTML = '';

  Object.keys(topicsData).forEach((tabId) => {
    let tab = topicsData[tabId];
    let isSelected = tabId === currentTabId;

    let tabEl = document.createElement('div');
    tabEl.className = `tab-item ${isSelected ? 'active' : ''}`;

    let titleInput = document.createElement('input');
    titleInput.className = 'tab-title-input';
    titleInput.value = tab.title || '새 주제';
    
    titleInput.addEventListener('change', () => {
      let newTitle = titleInput.value.trim() || '새 주제';
      update(ref(db, `topics/${tabId}`), { title: newTitle });
    });

    let closeBtn = document.createElement('button');
    closeBtn.className = 'close-tab-btn';
    closeBtn.textContent = '✕';
    closeBtn.title = '주제 삭제';

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Object.keys(topicsData).length <= 1) {
        alert('최소 하나의 주제는 유지되어야 합니다.');
        return;
      }
      if (confirm(`'${tab.title}' 주제를 삭제하시겠습니까?`)) {
        remove(ref(db, `topics/${tabId}`));
        remove(ref(db, `ideas/${tabId}`));
        if (currentTabId === tabId) {
          currentTabId = null;
        }
      }
    });

    tabEl.addEventListener('click', () => {
      if (currentTabId !== tabId) {
        currentTabId = tabId;
        currentModalIdeaId = null;
        renderTabs();
        listenToCurrentTabIdeas();
      }
    });

    tabEl.appendChild(titleInput);
    tabEl.appendChild(closeBtn);
    tabsList.appendChild(tabEl);
  });
}

if (addTabBtn) {
  addTabBtn.addEventListener('click', () => {
    let newRef = push(topicsRef);
    set(newRef, { title: '새 주제' }).then(() => {
      currentTabId = newRef.key;
      currentModalIdeaId = null;
      renderTabs();
      listenToCurrentTabIdeas();
    });
  });
}

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim().toLowerCase();
    renderSearchList();
  });
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    renderSearchList();
  });
});

if (submitBtn) {
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    createIdea();
  });
}

if (ideaInput) {
  ideaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      createIdea();
    }
  });
}

if (commentSubmitBtn) {
  commentSubmitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    addComment();
  });
}

if (commentInput) {
  commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addComment();
    }
  });
}

if (top3Btn) {
  top3Btn.addEventListener('click', () => {
    renderTop3();
    if (top3ModalOverlay) top3ModalOverlay.style.display = 'flex';
  });
}

if (top3ModalOverlay) {
  top3ModalOverlay.addEventListener('click', (e) => {
    if (e.target === top3ModalOverlay) {
      top3ModalOverlay.style.display = 'none';
    }
  });
}

function createIdea() {
  if (!ideaInput || !currentTabId) return;
  let text = ideaInput.value.trim();
  if (!text) return;

  push(ref(db, `ideas/${currentTabId}`), {
    text: text,
    bgColor: getRandomPastelColor(),
    voters: {},
    comments: [],
    timestamp: Date.now()
  }).then(() => {
    ideaInput.value = '';
  }).catch((err) => {
    console.error("아이디어 등록 실패:", err);
  });
}

function deleteIdea(id, event) {
  event.stopPropagation();
  if (!currentTabId) return;
  if (confirm('이 아이디어를 삭제하시겠습니까?')) {
    if (currentModalIdeaId === id) {
      currentModalIdeaId = null;
      resetSidebar();
    }
    remove(ref(db, `ideas/${currentTabId}/${id}`)).catch((err) => console.error("삭제 실패:", err));
  }
}

function voteIdea(id, event) {
  event.stopPropagation();
  let idea = ideasData[id];
  if (!idea || !currentTabId) return;

  let btn = event.currentTarget;
  let box = btn.closest('.idea-box');

  btn.classList.add('anim-active');
  if (box) box.classList.add('anim-active');

  setTimeout(() => {
    let voters = idea.voters || {};
    if (voters[clientId]) {
      delete voters[clientId];
      update(ref(db, `ideas/${currentTabId}/${id}`), { voters: voters });
    } else {
      update(ref(db, `ideas/${currentTabId}/${id}/voters`), { [clientId]: true });
    }
  }, 150);
}

function renderBoard() {
  if (!board) return;
  board.innerHTML = '';

  let isMobile = window.innerWidth <= 768;
  let keys = Object.keys(ideasData);

  if (keys.length === 0) {
    board.innerHTML = `<div style="color:#94a3b8; font-weight:600; text-align:center; width:100%; margin-top:60px;">이 주제의 첫 번째 아이디어를 등록해보세요!</div>`;
    return;
  }

  keys.forEach(id => {
    let idea = ideasData[id];
    let voters = idea.voters ? Object.keys(idea.voters) : [];
    let voteCount = voters.length;
    let isVoted = idea.voters && idea.voters[clientId];
    let comments = idea.comments ? Object.values(idea.comments) : [];
    let bgColor = idea.bgColor || 'hsl(260, 85%, 92%)';

    let box = document.createElement('div');
    box.className = 'idea-box';
    if (currentModalIdeaId === id) {
      box.classList.add('selected');
    }

    if (isMobile) {
      box.style.width = '100%';
      box.style.minHeight = '100px';
      box.style.fontSize = `${Math.min(14 + voteCount * 0.8, 20)}px`;
      box.style.padding = '16px';
    } else {
      box.style.width = `${Math.min(240 + voteCount * 25, 600)}px`;
      box.style.flexGrow = 1 + (voteCount * 0.5);
      box.style.minHeight = `${Math.min(130 + voteCount * 15, 350)}px`;
      box.style.fontSize = `${Math.min(15 + voteCount * 1.5, 32)}px`;
      box.style.padding = `${Math.min(18 + voteCount * 2, 42)}px`;
    }
    box.style.backgroundColor = bgColor;

    box.innerHTML = `
      <button class="delete-card-btn" title="삭제">✕</button>
      <div class="idea-text">${idea.text}</div>
      <div class="idea-footer" style="margin-top: 16px;">
        <span>코멘트 ${comments.length}</span>
        <button class="vote-btn main-vote-btn ${isVoted ? 'voted' : ''}">
          👍 ${voteCount}
        </button>
      </div>
    `;

    box.querySelector('.delete-card-btn')?.addEventListener('click', (e) => deleteIdea(id, e));
    box.querySelector('.main-vote-btn')?.addEventListener('click', (e) => voteIdea(id, e));
    box.addEventListener('click', () => selectIdeaForSidebar(id));

    board.appendChild(box);
  });
}

function renderSearchList() {
  if (!searchResultList) return;
  searchResultList.innerHTML = '';

  let keys = Object.keys(ideasData);

  let filteredKeys = keys.filter(id => {
    let idea = ideasData[id];
    return idea.text.toLowerCase().includes(searchQuery);
  });

  filteredKeys.sort((a, b) => {
    let ideaA = ideasData[a];
    let ideaB = ideasData[b];
    let votesA = ideaA.voters ? Object.keys(ideaA.voters).length : 0;
    let votesB = ideaB.voters ? Object.keys(ideaB.voters).length : 0;
    let commentsA = ideaA.comments ? Object.keys(ideaA.comments).length : 0;
    let commentsB = ideaB.comments ? Object.keys(ideaB.comments).length : 0;

    if (currentSort === 'votes') return votesB - votesA;
    if (currentSort === 'comments') return commentsB - commentsA;
    return (ideaB.timestamp || 0) - (ideaA.timestamp || 0);
  });

  if (searchResultCount) {
    searchResultCount.textContent = `아이디어 목록 (${filteredKeys.length}개)`;
  }

  if (filteredKeys.length === 0) {
    searchResultList.innerHTML = `<div style="color:#9ca3af; text-align:center; margin-top:30px; font-size:0.9rem;">검색 결과가 없습니다.</div>`;
    return;
  }

  filteredKeys.forEach(id => {
    let idea = ideasData[id];
    let voters = idea.voters ? Object.keys(idea.voters) : [];
    let voteCount = voters.length;
    let comments = idea.comments ? Object.values(idea.comments) : [];

    let listItem = document.createElement('div');
    listItem.className = `search-result-item ${currentModalIdeaId === id ? 'selected' : ''}`;
    listItem.innerHTML = `
      <div class="search-item-text">${idea.text}</div>
      <div class="search-item-footer">
        <span>👍 ${voteCount} · 댓글 ${comments.length}</span>
      </div>
    `;

    listItem.addEventListener('click', () => {
      selectIdeaForSidebar(id);
      let targetBox = Array.from(board.children).find(box => 
        box.querySelector('.idea-text').textContent === idea.text
      );
      if (targetBox) {
        targetBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });

    searchResultList.appendChild(listItem);
  });
}

function selectIdeaForSidebar(id) {
  currentModalIdeaId = id;
  let idea = ideasData[id];
  if (!idea) return;

  document.querySelectorAll('.idea-box').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('.search-result-item').forEach(i => i.classList.remove('selected'));
  
  let titleElem = document.getElementById('modal-idea-text');
  if (titleElem) titleElem.textContent = `"${idea.text}"`;

  if (sidebarInputGroup) sidebarInputGroup.style.display = 'flex';
  
  renderComments(idea);
  renderBoard();
  renderSearchList();
}

function resetSidebar() {
  let titleElem = document.getElementById('modal-idea-text');
  if (titleElem) titleElem.textContent = `아이디어를 선택하세요`;
  
  let list = document.getElementById('comment-list');
  if (list) list.innerHTML = `<div style="color:#9ca3af; text-align:center; margin-top:40px;">카드를 선택하면 코멘트가 여기에 표시됩니다.</div>`;
  
  if (sidebarInputGroup) sidebarInputGroup.style.display = 'none';
}

function addComment() {
  if (!commentInput || !currentModalIdeaId || !currentTabId) return;
  let text = commentInput.value.trim();
  if (!text) return;

  push(ref(db, `ideas/${currentTabId}/${currentModalIdeaId}/comments`), text).then(() => {
    commentInput.value = '';
  }).catch((err) => {
    console.error("코멘트 등록 실패:", err);
  });
}

function renderComments(idea) {
  let list = document.getElementById('comment-list');
  if (!list) return;

  list.innerHTML = '';
  let comments = idea.comments ? Object.values(idea.comments) : [];

  if (comments.length === 0) {
    list.innerHTML = `<div style="color:#9ca3af; text-align:center; margin-top:20px;">첫 코멘트를 남겨보세요!</div>`;
  } else {
    comments.forEach(c => {
      let item = document.createElement('div');
      item.className = 'comment-item';
      item.textContent = c;
      list.appendChild(item);
    });
  }
}

function renderTop3() {
  if (!top3List) return;
  top3List.innerHTML = '';

  let ideasArray = Object.keys(ideasData).map(id => {
    let idea = ideasData[id];
    let voters = idea.voters ? Object.keys(idea.voters) : [];
    return {
      id: id,
      text: idea.text,
      bgColor: idea.bgColor || 'hsl(260, 85%, 92%)',
      voteCount: voters.length
    };
  });

  ideasArray.sort((a, b) => b.voteCount - a.voteCount);

  let top3 = ideasArray.slice(0, 3);

  if (top3.length === 0 || top3[0].voteCount === 0) {
    top3List.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:20px;">아직 등록되거나 투표된 아이디어가 없습니다!</div>`;
    return;
  }

  let rankBadges = ['1등', '2등', '3등'];

  top3.forEach((item, index) => {
    let el = document.createElement('div');
    el.className = 'top3-item';
    el.style.backgroundColor = item.bgColor;

    el.innerHTML = `
      <span class="top3-rank">${rankBadges[index] || index + 1}</span>
      <span class="top3-text">${item.text}</span>
      <span class="top3-count">👍 ${item.voteCount}</span>
    `;

    top3List.appendChild(el);
  });
}
