export type ClickEvent = { link_id:string; clicked_at:string; links:{ code:string }|null };

export function summarizeClicks(events:ClickEvent[], days=7) {
  const dates = Array.from({length:days},(_,index) => new Date(Date.now() - (days - index - 1) * 86_400_000).toISOString().slice(0,10));
  const clicks = Object.create(null) as Record<string,number>;
  const links = Object.create(null) as Record<string,number>;
  for (const event of events) { const day=event.clicked_at.slice(0,10); if (day in clicks) clicks[day]++; if (event.links?.code) links[event.links.code]=(links[event.links.code]??0)+1; }
  return { total:events.length, daily:dates.map(date=>({date,clicks:clicks[date]??0})), links:Object.entries(links).map(([code,clicks])=>({code,clicks})).sort((a,b)=>b.clicks-a.clicks).slice(0,5) };
}
