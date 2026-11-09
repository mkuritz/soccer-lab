/* Old standalone route -> integrated Hub view. Keeps only the supported native player ID (?player=<digits>). */
(function(){var q=new URLSearchParams(location.search),p=q.get('player'),o=new URLSearchParams();if(p&&/^\d{1,10}$/.test(p))o.set('vzplayer',p);
var to='index.html'+(o.toString()?'?'+o:'')+'#viz-shotmap';window.__vizRedirect=to;try{location.replace(to)}catch(e){}})();
