async function check() {
  try {
    const res = await fetch('https://esech1n0.itch.io/varado', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    console.log('Status:', res.status);
    const html = await res.text();
    console.log('Page title match:', html.match(/<title>([^<]+)<\/title>/i)?.[1]);
    const iframe = html.match(/<iframe[^>]+src="([^">]+)"/i);
    console.log('Iframe src:', iframe ? iframe[1] : 'none');
    if (iframe) {
      const iframeUrl = iframe[1].startsWith('//') ? 'https:' + iframe[1] : iframe[1];
      const iRes = await fetch(iframeUrl);
      console.log('Iframe status:', iRes.status);
      const iHtml = await iRes.text();
      console.log('Iframe HTML first 300 chars:', iHtml.substring(0, 300));
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
check();

