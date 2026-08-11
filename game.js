(function() {
  'use strict';

  // ============ i18n ============
  const i18n = {
    ru: {
      loading: 'Загрузка...',
      score: 'Счёт',
      replace_card: 'Заменить',
      new_game_btn: 'Новая игра',
      undo: 'Отмена',
      hint: 'Подсказка',
      ad_short: 'реклама',
      current: 'Текущая',
      next: 'Следующая',
      empty: 'пусто',
      filled: 'заполнено',
      victory_title: 'Победа!',
      victory_message: 'Поздравляем! Вы достигли 2048!',
      play_again: 'Играть снова',
      no_space_title: 'Нет места',
      no_space_message: 'Все столбцы заполнены, ходов больше нет.',
      clear_3_columns: 'Очистить 3 столбца',
      new_game: 'Новая игра',
      game_over_title: 'Игра окончена',
      ad_loading: 'Загрузка рекламы...',
      ad_error: 'Реклама недоступна',
      confirm_new_game: 'Начать новую игру? Текущий прогресс будет потерян.',
      yes: 'Да',
      cancel: 'Отмена',
      watch_ad: 'Посмотреть',
      replace_ad_title: 'Замена карты',
      replace_ad_text: 'Бесплатные замены закончились. Посмотреть рекламу, чтобы заменить карту?',
      undo_ad_title: 'Отмена хода',
      undo_ad_text: 'Бесплатные отмены закончились. Посмотреть рекламу, чтобы отменить ход?',
      hint_ad_title: 'Подсказка',
      hint_ad_text: 'Бесплатные подсказки закончились. Посмотреть рекламу, чтобы получить подсказку?',
      ad_not_available: 'Реклама сейчас недоступна. Попробуйте позже.',
    },
    en: {
      loading: 'Loading...',
      score: 'Score',
      replace_card: 'Replace',
      new_game_btn: 'New Game',
      undo: 'Undo',
      hint: 'Hint',
      ad_short: 'Ad',
      current: 'Current',
      next: 'Next',
      empty: 'empty',
      filled: 'filled',
      victory_title: 'Victory!',
      victory_message: 'Congratulations! You reached 2048!',
      play_again: 'Play again',
      no_space_title: 'No space',
      no_space_message: 'All columns are full, no moves left.',
      clear_3_columns: 'Clear 3 columns',
      new_game: 'New game',
      game_over_title: 'Game Over',
      ad_loading: 'Loading ad...',
      ad_error: 'Ad unavailable',
      confirm_new_game: 'Start a new game? Current progress will be lost.',
      yes: 'Yes',
      cancel: 'Cancel',
      watch_ad: 'Watch',
      replace_ad_title: 'Replace card',
      replace_ad_text: 'Free replacements used up. Watch an ad to replace the card?',
      undo_ad_title: 'Undo move',
      undo_ad_text: 'Free undos used up. Watch an ad to undo the move?',
      hint_ad_title: 'Hint',
      hint_ad_text: 'Free hints used up. Watch an ad to get a hint?',
      ad_not_available: 'Ad is currently unavailable. Try again later.',
    }
  };

  let currentLang = 'ru';

  function t(key) {
    return (i18n[currentLang] && i18n[currentLang][key]) || i18n['en'][key] || key;
  }

  function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    updateAllButtonTexts();
  }

  // ============ Константы ============
  const RANK_LABELS = { 128: 'J', 256: 'Q', 512: 'K', 1024: 'A' };
  const SUITS = ['♠', '♥', '♦', '♣'];

  const CARD_SPAWN_WEIGHTS = [
    { value: 2, weight: 65 },
    { value: 4, weight: 20 },
    { value: 8, weight: 10 },
    { value: 16, weight: 5 }
  ];

  function getDecorativeSuit(value) {
    const idx = Math.round(Math.log2(value)) % SUITS.length;
    return SUITS[idx];
  }

  function formatCardLabel(value) {
    return RANK_LABELS[value] || value.toString();
  }

  // ============ DOM ============
  const loadingScreen = document.getElementById('loading-screen');
  const gameContainer = document.getElementById('game-container');
  const scoreValueEl = document.getElementById('score-value');
  const currentCardPreview = document.getElementById('current-card-preview');
  const nextCardPreview = document.getElementById('next-card-preview');
  const replaceCardBtn = document.getElementById('replace-card-btn');
  const newGameBtn = document.getElementById('btn-new-game');
  const undoBtn = document.getElementById('btn-undo');
  const hintBtn = document.getElementById('btn-hint');
  const columnsContainer = document.getElementById('columns-container');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalMessage = document.getElementById('modal-message');
  const modalButtons = document.getElementById('modal-buttons');
  const houseBtns = document.querySelectorAll('.house-btn');

  // ============ Состояние ============
  const MAX_CARDS_PER_COLUMN = 5;
  const COLUMNS_COUNT = 5;
  const HOUSE_VALUES = [128, 256, 512, 1024];
  const WIN_VALUE = 2048;
  const FREE_REPLACES = 3;
  const FREE_UNDOS = 3;
  const FREE_HINTS = 3;
  const MAX_HISTORY = 20;

  let columns = [];
  let currentCard = null;
  let nextCard = null;
  let score = 0;
  let bestScore = 0;
  let selectedColumn = -1;
  let isProcessing = false;
  let gameOver = false;
  let victoryShown = false;
  let houses = {};
  let freeReplacesLeft = FREE_REPLACES;
  let freeUndosLeft = FREE_UNDOS;
  let freeHintsLeft = FREE_HINTS;
  let historyStack = [];
  let hintTimeout = null;

  function initCardValue() {
    const totalWeight = CARD_SPAWN_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const item of CARD_SPAWN_WEIGHTS) {
      if (roll < item.weight) return item.value;
      roll -= item.weight;
    }
    return 2;
  }

  function generateCardElement(value) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card playing-card';
    cardEl.setAttribute('data-value', value);

    const topLeft = document.createElement('div');
    topLeft.className = 'card-corner top-left';
    const tlVal = document.createElement('span');
    tlVal.className = 'corner-value';
    tlVal.textContent = formatCardLabel(value);
    const tlSuit = document.createElement('span');
    tlSuit.className = 'corner-suit';
    tlSuit.textContent = getDecorativeSuit(value);
    topLeft.appendChild(tlVal);
    topLeft.appendChild(tlSuit);

    const watermark = document.createElement('div');
    watermark.className = 'card-center-watermark';
    watermark.textContent = getDecorativeSuit(value);

    const center = document.createElement('div');
    center.className = 'card-center-num';
    center.textContent = formatCardLabel(value);

    const bottomRight = document.createElement('div');
    bottomRight.className = 'card-corner bottom-right';
    const brVal = document.createElement('span');
    brVal.className = 'corner-value';
    brVal.textContent = formatCardLabel(value);
    const brSuit = document.createElement('span');
    brSuit.className = 'corner-suit';
    brSuit.textContent = getDecorativeSuit(value);
    bottomRight.appendChild(brVal);
    bottomRight.appendChild(brSuit);

    cardEl.appendChild(topLeft);
    cardEl.appendChild(watermark);
    cardEl.appendChild(center);
    cardEl.appendChild(bottomRight);

    return cardEl;
  }

  function updateCardPreview(element, value) {
    element.setAttribute('data-value', value);
    const tlVal = element.querySelector('.top-left .corner-value');
    const tlSuit = element.querySelector('.top-left .corner-suit');
    const center = element.querySelector('.card-center-num');
    const watermark = element.querySelector('.card-center-watermark');
    const brVal = element.querySelector('.bottom-right .corner-value');
    const brSuit = element.querySelector('.bottom-right .corner-suit');
    const label = formatCardLabel(value);
    const suit = getDecorativeSuit(value);
    if (tlVal) tlVal.textContent = label;
    if (tlSuit) tlSuit.textContent = suit;
    if (center) center.textContent = label;
    if (watermark) watermark.textContent = suit;
    if (brVal) brVal.textContent = label;
    if (brSuit) brSuit.textContent = suit;
  }

  function saveSnapshot() {
    historyStack.push({
      columns: columns.map(c => [...c]),
      houses: { ...houses },
      currentCard,
      nextCard,
      score,
      gameOver,
      victoryShown,
    });
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
  }

  function restoreSnapshot(s) {
    columns = s.columns.map(c => [...c]);
    houses = { ...s.houses };
    currentCard = s.currentCard;
    nextCard = s.nextCard;
    score = s.score;
    gameOver = s.gameOver;
    victoryShown = s.victoryShown;
    selectedColumn = -1;
    updateUI();
    updateCardPreview(currentCardPreview, currentCard);
    updateCardPreview(nextCardPreview, nextCard);
    renderAllColumns();
    updateHouseDisplay();
    updateAllButtonTexts();
    hideModal();
  }

  function initGame() {
    columns = Array.from({ length: COLUMNS_COUNT }, () => []);
    currentCard = initCardValue();
    nextCard = initCardValue();
    score = 0;
    selectedColumn = -1;
    isProcessing = false;
    gameOver = false;
    victoryShown = false;
    freeReplacesLeft = FREE_REPLACES;
    freeUndosLeft = FREE_UNDOS;
    freeHintsLeft = FREE_HINTS;
    historyStack = [];
    houses = {};
    HOUSE_VALUES.forEach(v => { houses[v] = false; });

    updateUI();
    renderAllColumns();
    updateHouseDisplay();
    updateCardPreview(currentCardPreview, currentCard);
    updateCardPreview(nextCardPreview, nextCard);
    updateAllButtonTexts();
    hideModal();
    clearHints();
  }

  function updateUI() {
    scoreValueEl.textContent = score;
  }

  function updateActionButtons() {
    replaceCardBtn.disabled = isProcessing || (gameOver && victoryShown);
    undoBtn.disabled = historyStack.length === 0 || isProcessing || (gameOver && victoryShown);
    hintBtn.disabled = isProcessing || (gameOver && victoryShown);
  }

  function updateAllButtonTexts() {
    updateReplaceButtonText();
    updateUndoButtonText();
    updateHintButtonText();
    updateActionButtons();
  }

  function updateReplaceButtonText() {
    if (freeReplacesLeft > 0) {
      replaceCardBtn.textContent = t('replace_card') + ' (' + freeReplacesLeft + ')';
    } else {
      replaceCardBtn.textContent = t('replace_card') + ' (' + t('ad_short') + ')';
    }
  }

  function updateUndoButtonText() {
    if (freeUndosLeft > 0) {
      undoBtn.textContent = t('undo') + ' (' + freeUndosLeft + ')';
    } else {
      undoBtn.textContent = t('undo') + ' (' + t('ad_short') + ')';
    }
  }

  function updateHintButtonText() {
    if (freeHintsLeft > 0) {
      hintBtn.textContent = t('hint') + ' (' + freeHintsLeft + ')';
    } else {
      hintBtn.textContent = t('hint') + ' (' + t('ad_short') + ')';
    }
  }

  function clearHints() {
    if (hintTimeout) { clearTimeout(hintTimeout); hintTimeout = null; }
    document.querySelectorAll('.hint-glow').forEach(el => el.classList.remove('hint-glow'));
  }

  function renderColumn(idx) {
    const el = columnsContainer.children[idx];
    if (!el) return;
    el.innerHTML = '';
    columns[idx].forEach((val, cardIdx) => {
      const cardEl = generateCardElement(val);
      if (selectedColumn === idx && cardIdx === columns[idx].length - 1) cardEl.classList.add('selected');
      cardEl.addEventListener('click', (e) => { e.stopPropagation(); onCardClick(idx); });
      el.appendChild(cardEl);
    });
    el.classList.toggle('filled', columns[idx].length >= MAX_CARDS_PER_COLUMN);
  }

  function renderAllColumns() {
    for (let i = 0; i < COLUMNS_COUNT; i++) renderColumn(i);
  }

  function updateHouseDisplay() {
    houseBtns.forEach(btn => {
      const val = parseInt(btn.getAttribute('data-house'), 10);
      const placeholder = btn.querySelector('.house-placeholder');
      btn.classList.toggle('filled', houses[val]);
      if (placeholder) placeholder.textContent = formatCardLabel(val);
    });
  }

  function canPlaceOrMerge(columnIndex, cardValue) {
    if (columns[columnIndex].length < MAX_CARDS_PER_COLUMN) return true;
    const top = columns[columnIndex][columns[columnIndex].length - 1];
    return top === cardValue;
  }

  function getTopCardValue(idx) {
    const col = columns[idx];
    return col.length ? col[col.length - 1] : null;
  }

  function placeCurrentCard(colIdx) {
    if (!canPlaceOrMerge(colIdx, currentCard)) return false;
    if (isProcessing || gameOver || victoryShown) return false;

    saveSnapshot();
    isProcessing = true;

    try {
      const top = getTopCardValue(colIdx);
      if (top === currentCard) {
        columns[colIdx].pop();
        const merged = currentCard * 2;
        score += merged;
        if (score > bestScore) { bestScore = score; saveGameState(); }
        columns[colIdx].push(merged);
        checkWinCondition(merged);
        chainMerge(colIdx);
      } else {
        columns[colIdx].push(currentCard);
      }

      if (!victoryShown) advanceTurn();
      renderAllColumns();
      if (!victoryShown) checkLoseCondition();
    } finally {
      isProcessing = false;
      updateAllButtonTexts();
      saveGameState();
    }
    return true;
  }

  function chainMerge(colIdx) {
    let col = columns[colIdx];
    let merged = true;
    let combo = 1;
    while (merged && col.length >= 2) {
      const a = col[col.length - 1], b = col[col.length - 2];
      if (a === b) {
        const nv = a * 2;
        col.pop(); col.pop(); col.push(nv);
        combo++;
        score += nv * combo;
        if (score > bestScore) { bestScore = score; saveGameState(); }
        checkWinCondition(nv);
      } else merged = false;
    }
  }

  function advanceTurn() {
    currentCard = nextCard;
    nextCard = initCardValue();
    updateCardPreview(currentCardPreview, currentCard);
    updateCardPreview(nextCardPreview, nextCard);
    selectedColumn = -1;
    updateUI();
  }

  function checkWinCondition(value) {
    if (value >= WIN_VALUE && !victoryShown) {
      victoryShown = true;
      gameOver = true;
      updateUI();
      saveGameState();
      showVictoryModal();
    }
  }

  function checkLoseCondition() {
    if (gameOver) return;
    if (columns.some(c => c.length < MAX_CARDS_PER_COLUMN)) return;
    if (checkAnyMergePossible()) return;
    if (checkAnyHouseMove()) return;
    gameOver = true;
    showNoSpaceModal();
  }

  function checkAnyMergePossible() {
    const tops = columns.map(c => c.length ? c[c.length - 1] : null);
    for (let i = 0; i < tops.length; i++) {
      if (tops[i] === null) return true;
      for (let j = 0; j < tops.length; j++) {
        if (i !== j && tops[i] === tops[j] && canPlaceOrMerge(j, tops[i])) return true;
      }
    }
    if (currentCard !== null) {
      for (let i = 0; i < tops.length; i++) {
        if (tops[i] === currentCard && canPlaceOrMerge(i, currentCard)) return true;
      }
    }
    return false;
  }

  function checkAnyHouseMove() {
    for (const v of HOUSE_VALUES) {
      if (houses[v]) continue;
      for (let i = 0; i < columns.length; i++) {
        if (getTopCardValue(i) === v) return true;
      }
    }
    return false;
  }

  function moveCard(from, to) {
    if (from === to) return false;
    if (isProcessing || gameOver || victoryShown) return false;

    const fromVal = getTopCardValue(from);
    if (fromVal === null) return false;
    const toVal = getTopCardValue(to);

    if (toVal === null && columns[to].length < MAX_CARDS_PER_COLUMN) {
      saveSnapshot();
      isProcessing = true;
      try {
        columns[from].pop();
        columns[to].push(fromVal);
        selectedColumn = -1;
        renderAllColumns();
      } finally {
        isProcessing = false;
        updateAllButtonTexts();
        saveGameState();
      }
      return true;
    }

    if (toVal === fromVal && canPlaceOrMerge(to, fromVal)) {
      saveSnapshot();
      isProcessing = true;
      try {
        columns[from].pop();
        columns[to].pop();
        const merged = fromVal * 2;
        score += merged;
        if (score > bestScore) { bestScore = score; saveGameState(); }
        columns[to].push(merged);
        checkWinCondition(merged);
        chainMerge(to);
        selectedColumn = -1;
        renderAllColumns();
        if (!victoryShown) checkLoseCondition();
      } finally {
        isProcessing = false;
        updateAllButtonTexts();
        saveGameState();
      }
      return true;
    }

    return false;
  }

  function onColumnClick(idx) {
    if (isProcessing || gameOver || victoryShown) return;
    clearHints();
    if (selectedColumn >= 0) {
      if (!moveCard(selectedColumn, idx)) { selectedColumn = -1; renderAllColumns(); updateAllButtonTexts(); }
    } else {
      placeCurrentCard(idx);
    }
  }

  function onCardClick(idx) {
    if (isProcessing || gameOver || victoryShown) return;
    clearHints();
    if (selectedColumn === idx) { selectedColumn = -1; renderAllColumns(); updateAllButtonTexts(); return; }
    if (selectedColumn >= 0) {
      if (!moveCard(selectedColumn, idx)) { selectedColumn = -1; renderAllColumns(); updateAllButtonTexts(); }
      return;
    }
    if (!columns[idx].length) return;
    selectedColumn = idx;
    renderAllColumns();
    updateAllButtonTexts();
  }

  function onHouseClick(val) {
    if (isProcessing || gameOver || victoryShown || houses[val]) return;
    clearHints();
    for (let i = 0; i < columns.length; i++) {
      if (getTopCardValue(i) === val) {
        saveSnapshot();
        isProcessing = true;
        try {
          columns[i].pop();
          houses[val] = true;
          updateHouseDisplay();
          renderColumn(i);
          if (!victoryShown) checkLoseCondition();
        } finally {
          isProcessing = false;
          updateAllButtonTexts();
          saveGameState();
        }
        return;
      }
    }
  }

  // ============ Undo ============
  function performUndo() {
    if (!historyStack.length || isProcessing || victoryShown) return;
    freeUndosLeft--;
    restoreSnapshot(historyStack.pop());
    updateUI();
    saveGameState();
    updateAllButtonTexts();
  }

  // ============ Hint ============
  function findHint() {
    for (const v of HOUSE_VALUES) {
      if (houses[v]) continue;
      for (let i = 0; i < columns.length; i++) {
        if (getTopCardValue(i) === v) return { type: 'house', col: i, houseVal: v };
      }
    }
    if (currentCard !== null) {
      for (let i = 0; i < columns.length; i++) {
        if (getTopCardValue(i) === currentCard && canPlaceOrMerge(i, currentCard)) return { type: 'place', col: i };
      }
    }
    for (let from = 0; from < columns.length; from++) {
      const fv = getTopCardValue(from);
      if (fv === null) continue;
      for (let to = 0; to < columns.length; to++) {
        if (from === to) continue;
        if (getTopCardValue(to) === fv && canPlaceOrMerge(to, fv)) return { type: 'move', from, to };
      }
    }
    if (currentCard !== null) {
      for (let i = 0; i < columns.length; i++) {
        if (columns[i].length === 0) return { type: 'place', col: i };
      }
    }
    let minI = 0;
    for (let i = 1; i < columns.length; i++) {
      if (columns[i].length < columns[minI].length && columns[i].length < MAX_CARDS_PER_COLUMN) minI = i;
    }
    return { type: 'place', col: minI };
  }

  function displayHint() {
    clearHints();
    const h = findHint();
    if (h.type === 'house') {
      const card = columnsContainer.children[h.col]?.querySelector('.playing-card:last-child');
      if (card) card.classList.add('hint-glow');
      houseBtns.forEach(b => { if (+b.getAttribute('data-house') === h.houseVal) b.classList.add('hint-glow'); });
    } else if (h.type === 'place') {
      columnsContainer.children[h.col]?.classList.add('hint-glow');
    } else if (h.type === 'move') {
      const c = columnsContainer.children[h.from]?.querySelector('.playing-card:last-child');
      if (c) c.classList.add('hint-glow');
      columnsContainer.children[h.to]?.classList.add('hint-glow');
    }
    hintTimeout = setTimeout(clearHints, 2500);
  }

  function showHint() {
    if (isProcessing || gameOver || victoryShown) return;
    freeHintsLeft--;
    updateAllButtonTexts();
    saveGameState();
    displayHint();
  }

  // ============ Replace ============
  function handleReplaceCard() {
    if (isProcessing || gameOver || victoryShown) return;
    freeReplacesLeft--;
    currentCard = 8;
    updateCardPreview(currentCardPreview, currentCard);
    updateAllButtonTexts();
    saveGameState();
  }

  // ============ Новая игра ============
  function startNewGame() {
    if (isProcessing) return;
    clearHints();
    if (gameOver || victoryShown) {
      hideModal();
      initGame();
      renderAllColumns();
      updateHouseDisplay();
      return;
    }
    showModal(t('new_game_btn'), t('confirm_new_game'), [
      { text: t('yes'), cls: 'primary', callback: () => { hideModal(); initGame(); renderAllColumns(); updateHouseDisplay(); } },
      { text: t('cancel'), cls: 'secondary', callback: hideModal }
    ]);
  }

  // ============ Modals ============
  function showModal(title, msg, buttons) {
    clearHints();
    modalTitle.textContent = title;
    modalMessage.textContent = msg;
    modalButtons.innerHTML = '';
    buttons.forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'modal-btn ' + (b.cls || 'primary');
      btn.textContent = b.text;
      btn.addEventListener('click', b.callback);
      modalButtons.appendChild(btn);
    });
    modalOverlay.style.display = 'flex';
  }

  function hideModal() { modalOverlay.style.display = 'none'; }

  function showVictoryModal() {
    showModal(t('victory_title'), t('victory_message'), [
      { text: t('play_again'), cls: 'primary', callback: () => { hideModal(); initGame(); renderAllColumns(); updateHouseDisplay(); } }
    ]);
  }

  function showNoSpaceModal() {
    showModal(t('no_space_title'), t('no_space_message'), [
      { text: t('clear_3_columns'), cls: 'rewarded', callback: () => { clearRandomColumns(3); gameOver = false; victoryShown = false; hideModal(); renderAllColumns(); updateAllButtonTexts(); saveGameState(); } },
      { text: t('new_game'), cls: 'primary', callback: () => { hideModal(); initGame(); renderAllColumns(); updateHouseDisplay(); } }
    ]);
  }

  function clearRandomColumns(count) {
    const nonEmpty = [];
    columns.forEach((col, idx) => {
      if (col.length > 0) nonEmpty.push(idx);
    });

    for (let i = nonEmpty.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nonEmpty[i], nonEmpty[j]] = [nonEmpty[j], nonEmpty[i]];
    }

    const toClear = Math.min(count, nonEmpty.length);
    for (let i = 0; i < toClear; i++) {
      const idx = nonEmpty[i];
      columns[idx] = [];
    }
  }

  // ============ Сохранения ============
  function saveGameState() {
    const data = {
      columns, currentCard, nextCard, score, bestScore, houses, gameOver, victoryShown,
      freeReplacesLeft, freeUndosLeft, freeHintsLeft
    };
    saveToLocalStorage(data);
  }

  function saveToLocalStorage(data) {
    try {
      localStorage.setItem('kosynka2048_state', JSON.stringify(data));
      localStorage.setItem('kosynka2048_bestScore', bestScore);
    } catch (e) {}
  }

  function loadGameState() {
    loadFromLocalStorage();
    initGameAfterLoad();
  }

  function loadFromLocalStorage() {
    try {
      const s = localStorage.getItem('kosynka2048_state');
      if (s) restoreState(JSON.parse(s));
      const sb = localStorage.getItem('kosynka2048_bestScore');
      if (sb !== null) bestScore = parseInt(sb, 10);
    } catch (e) {}
  }

  function restoreState(data) {
    if (data.columns) columns = data.columns;
    if (data.currentCard) currentCard = data.currentCard;
    if (data.nextCard) nextCard = data.nextCard;
    if (data.score !== undefined) score = data.score;
    if (data.bestScore !== undefined) bestScore = data.bestScore;
    if (data.houses) houses = data.houses;
    if (data.gameOver !== undefined) gameOver = data.gameOver;
    if (data.victoryShown !== undefined) victoryShown = data.victoryShown;
    if (data.freeReplacesLeft !== undefined) freeReplacesLeft = data.freeReplacesLeft;
    if (data.freeUndosLeft !== undefined) freeUndosLeft = data.freeUndosLeft;
    if (data.freeHintsLeft !== undefined) freeHintsLeft = data.freeHintsLeft;
  }

  function initGameAfterLoad() {
    if (!currentCard) currentCard = initCardValue();
    if (!nextCard) nextCard = initCardValue();
    if (!columns || columns.length !== COLUMNS_COUNT) columns = Array.from({ length: COLUMNS_COUNT }, () => []);
    if (!houses || !Object.keys(houses).length) { houses = {}; HOUSE_VALUES.forEach(v => { houses[v] = false; }); }

    updateCardPreview(currentCardPreview, currentCard);
    updateCardPreview(nextCardPreview, nextCard);
    updateUI();
    renderAllColumns();
    updateHouseDisplay();
    updateAllButtonTexts();

    if (gameOver && !victoryShown) {
      if (columns.some(c => c.includes(WIN_VALUE))) { victoryShown = true; showVictoryModal(); }
      else showNoSpaceModal();
    }

    if (!gameOver) checkLoseCondition();

    loadingScreen.style.display = 'none';
    gameContainer.style.display = 'flex';
  }

  function buildColumns() {
    columnsContainer.innerHTML = '';
    for (let i = 0; i < COLUMNS_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'column';
      el.addEventListener('click', () => onColumnClick(i));
      columnsContainer.appendChild(el);
    }
  }

  function bindEvents() {
    replaceCardBtn.addEventListener('click', handleReplaceCard);
    newGameBtn.addEventListener('click', startNewGame);
    undoBtn.addEventListener('click', performUndo);
    hintBtn.addEventListener('click', showHint);
    houseBtns.forEach(b => b.addEventListener('click', () => onHouseClick(+b.getAttribute('data-house'))));
  }

  function start() { buildColumns(); bindEvents(); applyLanguage(); loadGameState(); }
  document.addEventListener('DOMContentLoaded', start);
})();