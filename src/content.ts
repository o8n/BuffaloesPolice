interface Misspellings {
  [key: string]: string;
}

// 誤表記リスト（初期値）
const defaultMisspellings: Misspellings = {
  "バッファローズ": "バファローズ",
  "buffalose": "buffaloes",
  "Buffalos": "Buffaloes",
  "Buffalose": "Buffaloes",
  "buffalos": "Buffaloes",
  "オリックスバッファローズ": "オリックス・バファローズ"
};

// 検出された誤表記を保存する配列
let detectedMisspellings: Array<{
  misspelled: string;
  correct: string;
  context: string;
}> = [];

// カードUIの状態
let isCardVisible = false;

// 初期化関数
function initialize(): void {
  console.log('BuffaloesPolice content script loaded!');

  // カスタム誤表記リストを読み込む
  chrome.storage.sync.get('misspellings', (data: { misspellings?: Misspellings }) => {
    const misspellings: Misspellings = data.misspellings || defaultMisspellings;
    
    // テキストフィールドやテキストエリアの監視
    document.querySelectorAll('textarea, input[type="text"]').forEach((inputField) => {
      inputField.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        checkText(target, misspellings);
      });
    });

    // ページ内のテキストを監視（MutationObserverを使用）
    waitForBodyAndObserve(misspellings);
  });

  // カードUIを作成
  safeCreateCardUI();
}

// テキストの誤表記をチェック
function checkText(inputField: HTMLInputElement | HTMLTextAreaElement, misspellings: Misspellings): void {
  const content = inputField.value;
  
  Object.keys(misspellings).forEach(misspelledWord => {
    const correctWord = misspellings[misspelledWord];
    
    if (content.includes(misspelledWord)) {
      // 誤表記を検出
      console.warn(`誤表記を発見: ${misspelledWord} → ${correctWord}`);
      
      // 誤表記の前後のコンテキストを取得
      const context = getContext(content, misspelledWord);
      
      // 検出された誤表記を配列に追加（重複チェック）
      if (!detectedMisspellings.some(item => 
        item.misspelled === misspelledWord && 
        item.context === context)) {
        detectedMisspellings.push({
          misspelled: misspelledWord,
          correct: correctWord,
          context
        });
        
        // カードUIを更新
        updateCardUI();
      }
    }
  });
}

// ページ内のテキストを監視
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
  
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // 初期ロード時にも既存のテキストをチェック
    const textNodes = getTextNodes(document.body);
    textNodes.forEach(textNode => {
      checkPageText(textNode.textContent || '', misspellings, textNode);
    });
  } else {
    console.warn('observePageContent: document.body が null のため監視できませんでした');
  }
}

function waitForBodyAndObserve(misspellings: Misspellings) {
  if (document.body) {
    observePageContent(misspellings);
  } else {
    setTimeout(() => waitForBodyAndObserve(misspellings), 100);
  }
}

// ページ内のテキストノードを取得
function getTextNodes(element: Element): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null
  );
  
  let node: Node | null;
  while (node = walker.nextNode()) {
    textNodes.push(node as Text);
  }
  
  return textNodes;
}

// ページ内のテキストをチェック
function checkPageText(text: string, misspellings: Misspellings, node: Text): void {
  Object.keys(misspellings).forEach(misspelledWord => {
    const correctWord = misspellings[misspelledWord];
    
    if (text.includes(misspelledWord)) {
      // 誤表記を検出
      console.warn(`ページ内で誤表記を発見: ${misspelledWord} → ${correctWord}`);
      
      // 誤表記の前後のコンテキストを取得
      const context = getContext(text, misspelledWord);
      
      // 検出された誤表記を配列に追加（重複チェック）
      if (!detectedMisspellings.some(item => 
        item.misspelled === misspelledWord && 
        item.context === context)) {
        detectedMisspellings.push({
          misspelled: misspelledWord,
          correct: correctWord,
          context
        });
        
        // カードUIを更新
        updateCardUI();
      }
    }
  });
}

// 誤表記の前後のコンテキストを取得
function getContext(text: string, misspelledWord: string): string {
  const index = text.indexOf(misspelledWord);
  const start = Math.max(0, index - 10);
  const end = Math.min(text.length, index + misspelledWord.length + 10);
  
  return text.substring(start, end);
}

// カードUIを作成
function createCardUI(): void {
  if (!document.body) {
    console.warn('document.body がまだ存在しません。createCardUI をスキップ');
    return;
  }
  // カードのトグルボタン
  const toggleButton = document.createElement('button');
  toggleButton.className = 'buffaloes-police-card-toggle';
  toggleButton.textContent = 'B';
  toggleButton.title = 'バファローズ警察';
  toggleButton.addEventListener('click', toggleCardVisibility);
  
  // カードのコンテナ
  const card = document.createElement('div');
  card.className = 'buffaloes-police-card hidden';
  card.id = 'buffaloes-police-card';
  
  // カードのヘッダー
  const cardHeader = document.createElement('div');
  cardHeader.className = 'buffaloes-police-card-header';
  
  const cardTitle = document.createElement('h3');
  cardTitle.className = 'buffaloes-police-card-title';
  cardTitle.textContent = 'バファローズ警察';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'buffaloes-police-card-close';
  closeButton.textContent = '×';
  closeButton.addEventListener('click', hideCard);
  
  cardHeader.appendChild(cardTitle);
  cardHeader.appendChild(closeButton);
  
  // カードのコンテンツ
  const cardContent = document.createElement('div');
  cardContent.className = 'buffaloes-police-card-content';
  cardContent.id = 'buffaloes-police-card-content';
  
  card.appendChild(cardHeader);
  card.appendChild(cardContent);
  
  // スタイルシートを追加
  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles/card.css');
  
  // DOMに追加
  document.head.appendChild(styleLink);
  document.body.appendChild(toggleButton);
  document.body.appendChild(card);
}

function safeCreateCardUI() {
  if (!document.body) {
    // DOM 構築が終わるのを待って再試行
    setTimeout(safeCreateCardUI, 100);
    return;
  }
  createCardUI();
}

// カードUIを更新
function updateCardUI(): void {
  const cardContent = document.getElementById('buffaloes-police-card-content');
  if (!cardContent) return;
  
  // カードの内容をクリア
  cardContent.innerHTML = '';
  
  if (detectedMisspellings.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '誤表記は検出されていません。';
    cardContent.appendChild(emptyMessage);
  } else {
    // 検出された誤表記を表示
    detectedMisspellings.forEach(item => {
      const misspellingItem = document.createElement('div');
      misspellingItem.className = 'buffaloes-police-card-item';
      
      const title = document.createElement('div');
      title.className = 'buffaloes-police-card-item-title';
      title.textContent = `誤表記: ${item.misspelled}`;
      
      const correction = document.createElement('div');
      correction.className = 'buffaloes-police-card-item-correction';
      correction.textContent = `正しい表記: ${item.correct}`;
      
      const context = document.createElement('div');
      context.className = 'buffaloes-police-card-item-context';
      context.textContent = `コンテキスト: "${item.context}"`;
      
      misspellingItem.appendChild(title);
      misspellingItem.appendChild(correction);
      misspellingItem.appendChild(context);
      
      cardContent.appendChild(misspellingItem);
    });
  }
  
  // カードが非表示の場合はトグルボタンを表示
  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');
  if (toggleButton) {
    toggleButton.classList.remove('hidden');
  }
}

// カードの表示/非表示を切り替え
function toggleCardVisibility(): void {
  const card = document.getElementById('buffaloes-police-card');
  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');
  
  if (!card || !toggleButton) return;
  
  if (card.classList.contains('hidden')) {
    // カードを表示
    card.classList.remove('hidden');
    toggleButton.classList.add('hidden');
    isCardVisible = true;
  } else {
    // カードを非表示
    hideCard();
  }
}

// カードを非表示
function hideCard(): void {
  const card = document.getElementById('buffaloes-police-card');
  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');
  
  if (!card || !toggleButton) return;
  
  card.classList.add('hidden');
  toggleButton.classList.remove('hidden');
  isCardVisible = false;
}

// 初期化
initialize();
// document.addEventListener('DOMContentLoaded', initialize);
