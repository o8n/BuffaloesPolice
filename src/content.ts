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

function initialize(): void {
  console.log('BuffaloesPolice content script loaded!');

  chrome.storage.sync.get('misspellings', (data: { misspellings?: Misspellings }) => {
    const misspellings = data.misspellings || defaultMisspellings;

    document.querySelectorAll('textarea, input[type="text"]').forEach((inputField) => {
      inputField.addEventListener('input', (event) => {
        const target = event.target as HTMLInputElement | HTMLTextAreaElement;
        checkText(target, misspellings);
      });
    });

    waitForBodyAndObserve(misspellings);
  });

  safeCreateCardUI();
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

function safeCreateCardUI() {
  if (!document.body) {
    setTimeout(safeCreateCardUI, 100);
    return;
  }
  createCardUI();
}

function createCardUI(): void {
  const toggleButton = document.createElement('button');
  toggleButton.className = 'buffaloes-police-card-toggle';
  toggleButton.textContent = 'B';
  toggleButton.title = 'バファローズ警察';
  toggleButton.addEventListener('click', toggleCardVisibility);

  const card = document.createElement('div');
  card.className = 'buffaloes-police-card hidden';
  card.id = 'buffaloes-police-card';

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

  const cardContent = document.createElement('div');
  cardContent.className = 'buffaloes-police-card-content';
  cardContent.id = 'buffaloes-police-card-content';

  card.appendChild(cardHeader);
  card.appendChild(cardContent);

  const styleLink = document.createElement('link');
  styleLink.rel = 'stylesheet';
  styleLink.href = chrome.runtime.getURL('styles/card.css');

  document.head.appendChild(styleLink);
  document.body.appendChild(toggleButton);
  document.body.appendChild(card);

  isCardVisible = false;
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
  const cardContent = document.getElementById('buffaloes-police-card-content');
  if (!cardContent) return;

  cardContent.innerHTML = '';

  if (detectedMisspellings.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = '誤表記は検出されていません。';
    cardContent.appendChild(emptyMessage);
  } else {
    detectedMisspellings.forEach(item => {
      const misspellingItem = document.createElement('div');
      misspellingItem.className = 'buffaloes-police-card-item';
    
      const message = document.createElement('div');
      message.className = 'buffaloes-police-card-message';
      message.innerHTML = `🚨🚨 ピピーーー！！🚨🚨バファローズ警察です👮<br>
      あなた <strong>${item.misspelled}</strong> と入力しましたね？<br>
      正しくは <strong>${item.correct}</strong> です！`;

      misspellingItem.appendChild(message);
      cardContent.appendChild(misspellingItem);
    });
  }

  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');
  if (toggleButton) {
    toggleButton.classList.remove('hidden');
  }

  if (!isCardVisible && detectedMisspellings.length > 0) {
    const card = document.getElementById('buffaloes-police-card');
    const toggleButton = document.querySelector('.buffaloes-police-card-toggle');
    if (card && toggleButton) {
      card.classList.remove('hidden');
      toggleButton.classList.add('hidden');
      isCardVisible = true;
    }
  }
}

function toggleCardVisibility(): void {
  const card = document.getElementById('buffaloes-police-card');
  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');

  if (!card || !toggleButton) return;

  if (card.classList.contains('hidden')) {
    card.classList.remove('hidden');
    toggleButton.classList.add('hidden');
    isCardVisible = true;
  } else {
    hideCard();
  }
}

function hideCard(): void {
  const card = document.getElementById('buffaloes-police-card');
  const toggleButton = document.querySelector('.buffaloes-police-card-toggle');

  if (!card || !toggleButton) return;

  card.classList.add('hidden');
  toggleButton.classList.remove('hidden');
  isCardVisible = false;
}

// 起動
initialize();
