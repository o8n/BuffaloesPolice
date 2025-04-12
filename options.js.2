// 保存された誤表記リストをロードして表示
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get('misspellings', (data) => {
    document.getElementById('customMisspellings').value = JSON.stringify(data.misspellings || {}, null, 2);
  });
});

// ユーザーが編集したリストを保存
document.getElementById('save').addEventListener('click', () => {
  let misspellings = JSON.parse(document.getElementById('customMisspellings').value);
  chrome.storage.sync.set({ misspellings }, () => {
    alert('Misspellings saved!');
  });
});
