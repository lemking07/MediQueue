// Each tab derives its role from its URL. No localStorage or shared role flag.
(()=>{
 const admin=location.pathname.startsWith('/admin/');
 window.mqRoleUrl=url=>admin && /^\/(staff|admin\.html|logout|force-logout)/.test(url)?'/admin'+url:url;
 if(!admin)return;
 const nativeFetch=window.fetch.bind(window);
 window.fetch=(input,options)=>{
  if(typeof input==='string' && input.startsWith('/api/')) input='/admin'+input;
  return nativeFetch(input,options);
 };
 const rewrite=()=>document.querySelectorAll('a[href]').forEach(a=>{
  const href=a.getAttribute('href');
  const next=mqRoleUrl(href);if(next!==href)a.setAttribute('href',next);
 });
 document.addEventListener('DOMContentLoaded',()=>{
  rewrite();new MutationObserver(rewrite).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
 });
})();
