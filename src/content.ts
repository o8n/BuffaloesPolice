interface Misspellings {
  [key: string]: string;
}

const defaultMisspellings: Misspellings = {
  "バッファローズ": "バファローズ",
  "buffalose": "buffaloes",
  "Buffalos": "Buffaloes",
  "Buffalose": "Buffaloes",
  "buffalos": "Buffaloes",
  "オリックスバッファローズ": "オリックス・バファローズ"
};

let detectedMisspellings: Array<{
  misspelled: string;
  correct: string;
  context: string;
}> = [];

const seenKeys: Set<string> = new Set(); // 重複チェック用のキーセット

let isCardVisible = false;
let updateScheduled = false;
let cardInitialized = false; // カードが初期化されたかのフラグ

// カードとトグルボタンの位置を記憶
let cardPosition = {
  x: 20,
  y: 20
};

// マウスドラッグ用の変数
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// 拡張機能の固有のID（スタイルの衝突を避けるために使用）
const EXTENSION_ID = 'buffaloes-police-extension';

function initialize(): void {
  console.log('BuffaloesPolice content script loaded!');

  // スタイルを早めに挿入して確実に適用されるようにする
  injectStyles();

  chrome.storage.sync.get(['misspellings', 'cardPosition'], (data: { 
    misspellings?: Misspellings,
    cardPosition?: { x: number, y: number } 
  }) => {
    const misspellings = data.misspellings || defaultMisspellings;
    
    // 保存された位置があればロード
    if (data.cardPosition) {
      cardPosition = data.cardPosition;
    }

    // テキスト入力フィールドの監視
    setupInputMonitoring(misspellings);

    // ページコンテンツの監視
    waitForBodyAndObserve(misspellings);
  });

  // DOMの準備ができたらUIを作成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createUIElements);
  } else {
    createUIElements();
  }
}

// スタイルを動的に挿入する関数
function injectStyles(): void {
  const styleElement = document.createElement('style');
  styleElement.id = `${EXTENSION_ID}-styles`;
  styleElement.textContent = `
    .${EXTENSION_ID}-card {
      position: fixed;
      top: ${cardPosition.y}px;
      right: ${cardPosition.x}px;
      width: 420px;
      max-height: 400px;
      overflow-y: auto;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 2147483647; /* 最前面に表示 */
      font-family: Arial, sans-serif;
      transition: transform 0.3s ease, opacity 0.3s ease;
      transform-origin: top right;
      animation: ${EXTENSION_ID}-popIn 0.3s ease forwards;
    }

    @keyframes ${EXTENSION_ID}-popIn {
      0% {
        transform: scale(0.8);
        opacity: 0;
      }
      100% {
        transform: scale(1);
        opacity: 1;
      }
    }

    .${EXTENSION_ID}-card.hidden {
      transform: scale(0.8);
      opacity: 0;
      pointer-events: none;
    }

    .${EXTENSION_ID}-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background-color: #001f3f;
      color: goldenrod;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      cursor: move; /* ドラッグ可能を示す */
    }

    .${EXTENSION_ID}-card-title {
      font-weight: bold;
      font-size: 16px;
      margin: 0;
      color: goldenrod;
    }

    .${EXTENSION_ID}-card-close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      font-size: 18px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .${EXTENSION_ID}-card-content {
      padding: 10px 12px;
      background-color: white;
      color: black;
      font-size: 15px;
      line-height: 1.5;
      word-break: break-word;
    }

    .${EXTENSION_ID}-card-item {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #eee;
    }

    .${EXTENSION_ID}-card-item:last-child {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
    }

    .${EXTENSION_ID}-card-message {
      background-color: #fff9e6;
      border-left: 4px solid goldenrod;
      padding: 8px 12px;
      margin-bottom: 10px;
      font-weight: bold;
      color: #333;
      border-radius: 4px;
      white-space: pre-wrap;
    }

    .${EXTENSION_ID}-card-toggle {
      position: fixed;
      top: ${cardPosition.y}px;
      right: ${cardPosition.x}px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #001f3f;
      color: goldenrod;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move; /* ドラッグ可能を示す */
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      z-index: 2147483646; /* カードの下に表示 */
      font-weight: bold;
      font-size: 20px;
      border: none;
    }

    .${EXTENSION_ID}-card-toggle:hover {
      opacity: 0.9;
    }

    .${EXTENSION_ID}-card-toggle.hidden {
      display: none;
    }

    /* モバイル対応 */
    @media screen and (max-width: 480px) {
      .${EXTENSION_ID}-card {
        width: 90vw;
        right: 5vw;
      }
    }
  `;
  
  // styleがまだ挿入されていない場合のみ挿入
  if (!document.getElementById(`${EXTENSION_ID}-styles`)) {
    if (document.head) {
      document.head.appendChild(styleElement);
    } else {
      // headがない場合は、DOMContentLoadedを待つ
      document.addEventListener('DOMContentLoaded', () => {
        document.head.appendChild(styleElement);
      });
    }
  }
}

// 入力監視の設定
function setupInputMonitoring(misspellings: Misspellings): void {
  // 既存の入力フィールドを監視
  document.querySelectorAll('textarea, input[type="text"]').forEach((inputField) => {
    inputField.addEventListener('input', (event) => {
      const target = event.target as HTMLInputElement | HTMLTextAreaElement;
      checkText(target, misspellings);
    });
  });

  // 動的に追加される入力フィールドを監視
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
              node.addEventListener('input', (event) => {
                const target = event.target as HTMLInputElement | HTMLTextAreaElement;
                checkText(target, misspellings);
              });
            }
            // 子要素も確認
            node.querySelectorAll('textarea, input[type="text"]').forEach(inputField => {
              inputField.addEventListener('input', (event) => {
                const target = event.target as HTMLInputElement | HTMLTextAreaElement;
                checkText(target, misspellings);
              });
            });
          }
        });
      }
    });
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

function checkText(inputField: HTMLInputElement | HTMLTextAreaElement, misspellings: Misspellings): void {
  const content = inputField.value;

  Object.keys(misspellings).forEach(misspelledWord => {
    const correctWord = misspellings[misspelledWord];
    if (content.includes(misspelledWord)) {
      const context = getContext(content, misspelledWord);
      const key = `${misspelledWord}:${context}`;

      if (!seenKeys.has(key)) {
        console.warn(`誤表記を発見: ${misspelledWord} → ${correctWord}`);
        seenKeys.add(key);
        detectedMisspellings.push({ misspelled: misspelledWord, correct: correctWord, context });
        updateCardUIThrottled();
      }
    }
  });
}

function waitForBodyAndObserve(misspellings: Misspellings) {
  if (document.body) {
    observePageContent(misspellings);
  } else {
    setTimeout(() => waitForBodyAndObserve(misspellings), 100);
  }
}

function observePageContent(misspellings: Misspellings): void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) {
            const textContent = node.textContent || '';
            checkPageText(textContent, misspellings, node as Text);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const textNodes = getTextNodes(element);
            textNodes.forEach(textNode => {
              checkPageText(textNode.textContent || '', misspellings, textNode);
            });
          }
        });
      }
    });
  });

  if (document.body instanceof Node) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    const textNodes = getTextNodes(document.body);
    textNodes.forEach(textNode => {
      checkPageText(textNode.textContent || '', misspellings, textNode);
    });
  } else {
    console.warn('observePageContent: document.body が null のため監視できませんでした');
  }
}

function getTextNodes(element: Element): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  return textNodes;
}

function checkPageText(text: string, misspellings: Misspellings, node: Text): void {
  Object.keys(misspellings).forEach(misspelledWord => {
    const correctWord = misspellings[misspelledWord];
    if (text.includes(misspelledWord)) {
      const context = getContext(text, misspelledWord);
      const key = `${misspelledWord}:${context}`;
      if (!seenKeys.has(key)) {
        console.warn(`ページ内で誤表記を発見: ${misspelledWord} → ${correctWord}`);
        seenKeys.add(key);
        detectedMisspellings.push({ misspelled: misspelledWord, correct: correctWord, context });
        updateCardUIThrottled();
      }
    }
  });
}

function getContext(text: string, misspelledWord: string): string {
  const index = text.indexOf(misspelledWord);
  const start = Math.max(0, index - 10);
  const end = Math.min(text.length, index + misspelledWord.length + 10);
  return text.substring(start, end);
}

function createUIElements(): void {
  if (!document.body) {
    setTimeout(createUIElements, 100);
    return;
  }
  
  if (cardInitialized) {
    return;
  }
  
  createCardUI();
  cardInitialized = true;
}

function createCardUI(): void {
  // 既存の要素を削除（重複防止）
  removeExistingElements();

  // トグルボタン作成
  const toggleButton = document.createElement('button');
  toggleButton.className = `${EXTENSION_ID}-card-toggle`;
  toggleButton.textContent = 'B';
  toggleButton.title = 'バファローズ警察';
  
  // クリックイベント
  toggleButton.addEventListener('click', (event) => {
    if (!isDragging) {
      toggleCardVisibility(event);
    }
  });
  
  // ドラッグイベント
  setupDragEvents(toggleButton);

  // カード作成
  const card = document.createElement('div');
  card.className = `${EXTENSION_ID}-card hidden`;
  card.id = `${EXTENSION_ID}-card`;

  // カードヘッダー
  const cardHeader = document.createElement('div');
  cardHeader.className = `${EXTENSION_ID}-card-header`;
  
  // ヘッダーのドラッグイベント
  setupDragEvents(cardHeader);

  const cardTitle = document.createElement('h3');
  cardTitle.className = `${EXTENSION_ID}-card-title`;
  cardTitle.textContent = 'バファローズ警察';

  const closeButton = document.createElement('button');
  closeButton.className = `${EXTENSION_ID}-card-close`;
  closeButton.textContent = '×';
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation(); // ヘッダーのイベントが発火しないようにする
    hideCard();
  });

  cardHeader.appendChild(cardTitle);
  cardHeader.appendChild(closeButton);

  const cardContent = document.createElement('div');
  cardContent.className = `${EXTENSION_ID}-card-content`;
  cardContent.id = `${EXTENSION_ID}-card-content`;

  card.appendChild(cardHeader);
  card.appendChild(cardContent);
  
  // 要素を追加
  document.body.appendChild(toggleButton);
  document.body.appendChild(card);

  // 初期状態は非表示に
  isCardVisible = false;
  
  // カードの位置を設定
  updateElementPositions();
  
  // 空のカードコンテンツを初期化
  updateCardUI();
}

// 既存の要素を削除する
function removeExistingElements(): void {
  const existingCard = document.getElementById(`${EXTENSION_ID}-card`);
  const existingToggle = document.querySelector(`.${EXTENSION_ID}-card-toggle`);
  
  if (existingCard) {
    existingCard.remove();
  }
  
  if (existingToggle) {
    existingToggle.remove();
  }
}

// ドラッグイベントを設定
function setupDragEvents(element: HTMLElement): void {
  element.addEventListener('mousedown', (event) => {
    isDragging = false; // ドラッグ開始前にリセット
    
    // 右クリックの場合は処理しない
    if (event.button !== 0) return;
    
    // カードかトグルボタンの要素を取得
    const card = document.getElementById(`${EXTENSION_ID}-card`);
    const toggle = document.querySelector(`.${EXTENSION_ID}-card-toggle`) as HTMLElement;
    
    // ドラッグ対象の要素（カードまたはトグル）
    const targetElement = isCardVisible ? card : toggle;
    
    if (!targetElement) return;
    
    // 現在の要素の位置を取得
    const rect = targetElement.getBoundingClientRect();
    
    // クリック位置と要素の左上の差分を計算
    dragOffsetX = event.clientX - rect.left;
    dragOffsetY = event.clientY - rect.top;
    
    // マウスが動いたときのイベント
    const mouseMoveHandler = (moveEvent: MouseEvent) => {
      isDragging = true; // ドラッグ中フラグをセット
      
      // 新しい位置を計算
      const newX = window.innerWidth - (moveEvent.clientX - dragOffsetX + rect.width);
      const newY = moveEvent.clientY - dragOffsetY;
      
      // 画面外に出ないように調整
      cardPosition.x = Math.max(10, Math.min(newX, window.innerWidth - 50));
      cardPosition.y = Math.max(10, Math.min(newY, window.innerHeight - 50));
      
      // 位置を更新
      updateElementPositions();
      
      // 位置を保存
      chrome.storage.sync.set({ cardPosition });
    };
    
    // マウスを離したときのイベント
    const mouseUpHandler = () => {
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      
      // クリックとしても処理されないように少し待つ
      setTimeout(() => {
        isDragging = false;
      }, 10);
    };
    
    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
  });
}

// 要素の位置を更新
function updateElementPositions(): void {
  const card = document.getElementById(`${EXTENSION_ID}-card`);
  const toggle = document.querySelector(`.${EXTENSION_ID}-card-toggle`) as HTMLElement;
  
  if (card) {
    card.style.top = `${cardPosition.y}px`;
    card.style.right = `${cardPosition.x}px`;
  }
  
  if (toggle) {
    toggle.style.top = `${cardPosition.y}px`;
    toggle.style.right = `${cardPosition.x}px`;
  }
}

function updateCardUIThrottled(): void {
  if (updateScheduled) return;
  updateScheduled = true;
  setTimeout(() => {
    updateCardUI();
    updateScheduled = false;
  }, 100);
}

function updateCardUI(): void {
  const cardContent = document.getElementById(`${EXTENSION_ID}-card-content`);
  
  if (!cardContent) {
    console.warn('カードUI要素が見つかりません。再作成します。');
    createUIElements();
    return;
  }

  cardContent.innerHTML = '';

  if (detectedMisspellings.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '誤表記は検出されていません。';
    cardContent.appendChild(emptyMessage);
    
    // 誤表記がなければカードを隠す
    if (isCardVisible) {
      hideCard();
    }
  } else {
    detectedMisspellings.forEach(item => {
      const misspellingItem = document.createElement('div');
      misspellingItem.className = `${EXTENSION_ID}-card-item`;
    
      const message = document.createElement('div');
      message.className = `${EXTENSION_ID}-card-message`;
      message.innerHTML = `🚨🚨 ピピーーー！！🚨🚨バファローズ警察です👮<br>
      あなた <strong>${item.misspelled}</strong> と入力しましたね？<br>
      正しくは <strong>${item.correct}</strong> です！`;

      misspellingItem.appendChild(message);
      cardContent.appendChild(misspellingItem);
    });
    
    // 誤表記があれば自動的にカードを表示
    if (!isCardVisible && detectedMisspellings.length > 0) {
      showCard();
    }
  }
}

function toggleCardVisibility(event?: Event): void {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  if (isCardVisible) {
    hideCard();
  } else {
    showCard();
  }
}

function showCard(): void {
  const card = document.getElementById(`${EXTENSION_ID}-card`);
  const toggleButton = document.querySelector(`.${EXTENSION_ID}-card-toggle`);

  if (!card || !toggleButton) {
    console.warn('カードUI要素が見つかりません。');
    return;
  }

  card.classList.remove('hidden');
  toggleButton.classList.add('hidden');
  isCardVisible = true;
}

function hideCard(): void {
  const card = document.getElementById(`${EXTENSION_ID}-card`);
  const toggleButton = document.querySelector(`.${EXTENSION_ID}-card-toggle`);

  if (!card || !toggleButton) {
    console.warn('カードUI要素が見つかりません。');
    return;
  }

  card.classList.add('hidden');
  toggleButton.classList.remove('hidden');
  isCardVisible = false;
}

// 拡張機能の初期化
initialize();