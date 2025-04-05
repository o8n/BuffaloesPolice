// 保存された誤表記リストをロードして表示
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('misspellings', (data: { misspellings?: { [key: string]: string } }) => {
    const textArea = document.getElementById('customMisspellings') as HTMLTextAreaElement;
    textArea.value = JSON.stringify(data.misspellings || {}, null, 2);
  });
});

// ユーザーが編集したリストを保存
document.getElementById('save')!.addEventListener('click', () => {
  try {
    const misspellings = JSON.parse(
      (document.getElementById('customMisspellings') as HTMLTextAreaElement).value
    );
    
    chrome.storage.sync.set({ misspellings }, () => {
      alert('Misspellings saved!');
    });
  } catch (error) {
    alert(`Error parsing JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
});
