// --- Firebase  ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
const firebaseConfig = {
  databaseURL: "https://script01-d56c4-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ideasRef = ref(db, 'ideas');
const topicRef = ref(db, 'topic');

// --- 인지체크(재투표 불가) ---
let clientId = localStorage.getItem('brainstorm_client_id');
if (!clientId) {
  clientId = 'user_' + Math.random().toString(36).substring(2, 9);
  localStorage.setItem('brainstorm_client_id', clientId);
}

let ideasData = {};
let currentModalIdeaId = null;

const board = document.getElementById('board');
const topicInput = document.getElementById('topic-input');
const ideaInput = document.getElementById('idea-input');
const submitBtn = document.getElementById('submit-btn');
const modalOverlay = document.getElementById('modal-overlay');
const commentInput = document.getElementById('comment-input');
const commentSubmitBtn = document.getElementById('comment-submit-btn');

const top3Btn = document.getElementById('top3-btn');
const top3ModalOverlay = document.getElementById('top3-modal-overlay');
const top3List = document.getElementById('top3-list');

// ---  랜덤 자동 색상 지정 ---
function getRandomPastelColor() {
  const hue = Math.floor(Math.random() * 360);
  return `hsl(${hue}, 75%, 90%)`;
}

// --- 파이어베이스 데이터 가져오기 ---
onValue(ideasRef, (snapshot) => {
  ideasData = snapshot.val() || {};
  renderBoard();
  if (currentModalIdeaId && ideasData[currentModalIdeaId]) {
    renderComments(ideasData[currentModalIdeaId]);
  }
});

onValue(topicRef, (snapshot) => {
  const topic = snapshot.val();
  if (topic && topicInput) topicInput.value = topic;
});

if (topicInput) {
  topicInput.addEventListener('change', () => {
    update(ref(db), { topic: topicInput.value });
  });
}

if (submitBtn) submitBtn.addEventListener('click', createIdea);

if (ideaInput) {
  ideaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      createIdea();
    }
  });
}

if (commentSubmitBtn) commentSubmitBtn.addEventListener('click', addComment);

if (commentInput) {
  commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addComment();
  });
}

if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      modalOverlay.style.display = 'none';
      currentModalIdeaId = null;
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

// --- main ---
// 박스 생성
function createIdea() {
  const text = ideaInput.value.trim();
  if (!text) return;

  push(ideasRef, {
    text: text,
    bgColor: getRandomPastelColor(),
    voters: {},
    comments: []
  });
  ideaInput.value = '';
}

// 박스 제거
function deleteIdea(id, event) {
  event.stopPropagation();
  if (confirm('이 아이디어를 삭제하시겠습니까?')) {
    remove(ref(db, `ideas/${id}`)).catch((err) => console.error("삭제 실패:", err));
  }
}

function voteIdea(id, event) {
  event.stopPropagation();
  const idea = ideasData[id];
  if (!idea) return;

  const btn = event.currentTarget;
  const box = btn.closest('.idea-box');

  btn.classList.add('anim-active');
  if (box) box.classList.add('anim-active');

  setTimeout(() => {
    const voters = idea.voters || {};
    if (voters[clientId]) {
      delete voters[clientId];
      update(ref(db, `ideas/${id}`), { voters: voters });
    } else {
      update(ref(db, `ideas/${id}/voters`), { [clientId]: true });
    }
  }, 150);
}

function renderBoard() {
  if (!board) return;
  board.innerHTML = '';

  const isMobile = window.innerWidth <= 768;

  Object.keys(ideasData).forEach(id => {
    const idea = ideasData[id];
    const voters = idea.voters ? Object.keys(idea.voters) : [];
    const voteCount = voters.length;
    const isVoted = idea.voters && idea.voters[clientId];
    const comments = idea.comments ? Object.values(idea.comments) : [];
    const bgColor = idea.bgColor || 'hsl(260, 85%, 92%)';

    const box = document.createElement('div');
    box.className = 'idea-box';

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
        <span> 코멘트 ${comments.length}</span>
        <button class="vote-btn main-vote-btn ${isVoted ? 'voted' : ''}">
          👍 ${voteCount}
        </button>
      </div>
    `;

    box.querySelector('.delete-card-btn')?.addEventListener('click', (e) => deleteIdea(id, e));
    box.querySelector('.main-vote-btn')?.addEventListener('click', (e) => voteIdea(id, e));
    box.addEventListener('dblclick', () => openModal(id));

    board.appendChild(box);
  });
}

// 댓글 팝업 생성
function openModal(id) {
  currentModalIdeaId = id;
  const idea = ideasData[id];
  if (!idea) return;

  const titleElem = document.getElementById('modal-idea-text');
  if (titleElem) titleElem.textContent = `💡 "${idea.text}"`;
  
  renderComments(idea);
  if (modalOverlay) modalOverlay.style.display = 'flex';
}

// 팝업 입력 기능
function addComment() {
  const text = commentInput.value.trim();
  if (!text || !currentModalIdeaId) return;

  push(ref(db, `ideas/${currentModalIdeaId}/comments`), text);
  commentInput.value = '';
}

function renderComments(idea) {
  const list = document.getElementById('comment-list');
  if (!list) return;

  list.innerHTML = '';
  const comments = idea.comments ? Object.values(idea.comments) : [];

  if (comments.length === 0) {
    list.innerHTML = `<div style="color:#9ca3af; text-align:center;">첫 코멘트를 남겨보세요!</div>`;
  } else {
    comments.forEach(c => {
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.textContent = c;
      list.appendChild(item);
    });
  }
}

function renderTop3() {
  if (!top3List) return;
  top3List.innerHTML = '';

  const ideasArray = Object.keys(ideasData).map(id => {
    const idea = ideasData[id];
    const voters = idea.voters ? Object.keys(idea.voters) : [];
    return {
      id: id,
      text: idea.text,
      bgColor: idea.bgColor || 'hsl(260, 85%, 92%)',
      voteCount: voters.length
    };
  });

  ideasArray.sort((a, b) => b.voteCount - a.voteCount);

  const top3 = ideasArray.slice(0, 3);

  if (top3.length === 0 || top3[0].voteCount === 0) {
    top3List.innerHTML = `<div style="color:#9ca3af; text-align:center; padding:20px;">아직 등록되거나 투표된 아이디어가 없습니다!</div>`;
    return;
  }

  const rankBadges = ['🥇', '🥈', '🥉'];

  top3.forEach((item, index) => {
    const el = document.createElement('div');
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
