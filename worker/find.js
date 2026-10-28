// /find/<object>: the same app, with a title and preview text for that object so shared links unfurl well. <base> keeps relative assets working under /find/.
export const slugOf = name => String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
export function findPage(html, origin, rawName, img) {   // img: a preview picture path (e.g. /og/find/ton-618.jpg) when one exists
  let name = ''; try { name = decodeURIComponent(rawName || ''); } catch {} name = name.replace(/[<>"&\u0000-\u001f]/g, '').slice(0, 60).trim() || 'a real astronomical object';
  const title = `I discovered ${name} on Scorcher`, desc = `${name} is one of 146 real astronomical objects you can find by playing Scorcher, the daily Wikipedia link race. Space is cold. Warm it up.`, e = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return html.replace('<head>', `<head><base href="${origin}/">`).replace(/<title>[^<]*<\/title>/, `<title>${e(title)}</title>`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, `$1${e(title)}"`).replace(/(<meta property="og:description" content=")[^"]*"/, `$1${e(desc)}"`).replace(/(<meta property="og:url" content=")[^"]*"/, `$1${origin}/find/${encodeURIComponent(name)}"`)
    .replace(/(<meta property="og:image" content=")[^"]*"/, img ? `$1${origin}${img}"` : '$&').replace(/(<meta name="twitter:image" content=")[^"]*"/, img ? `$1${origin}${img}"` : '$&');
}
