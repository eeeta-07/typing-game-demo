export async function loadSiteMode() {
  const response = await fetch('./site-config.json');
  if (!response.ok) throw new Error('設定を読み込めません。ページを再読み込みしてください。');
  const mode = await response.json();
  if (!mode.demo) return mode;
  if (!document.getElementById('demo-badge')) {
    const badge = document.createElement('span');
    badge.id='demo-badge';badge.className='demo-badge';badge.textContent='デモ版';
    document.body.append(badge);
  }
  document.querySelectorAll('a[href$="ranking.html"],.register-panel').forEach(el=>el.hidden=true);
  document.getElementById('name-note').textContent='本名でなくてOK。名前と成績は保存しません。';
  const note = document.querySelector('#result > .fine');
  if (note) note.textContent='デモ版のため、この記録は保存されません。';
  if (mode.feedbackUrl) {
    const url = new URL(mode.feedbackUrl);
    if (url.protocol !== 'https:') throw new Error('感想フォームのURLを確認してください。');
    const link = document.createElement('a');
    link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';
    link.className='ranking-link';link.textContent='感想を送る（30秒・任意）';
    document.getElementById('result').append(link);
  }
  return mode;
}
