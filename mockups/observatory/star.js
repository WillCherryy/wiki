// a sharp, physically shaded star: limb darkening, two scales of convection cells (Worley noise), temperature colour ramp, chromosphere rim and halo
(function(){
  function rng(s){return function(){s=(s+0x6D2B79F5)|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function hash2(x,y,s){let h=Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,982451653);h=Math.imul(h^h>>>13,1274126177);h^=h>>>16;return(h>>>0)/4294967296}
  function worley(x,y,s){const xi=Math.floor(x),yi=Math.floor(y);let f1=9,f2=9,id=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=xi+i,cy=yi+j,px=cx+hash2(cx,cy,s),py=cy+hash2(cx,cy,s+7),d=(px-x)*(px-x)+(py-y)*(py-y);if(d<f1){f2=f1;f1=d;id=hash2(cx,cy,s+13)}else if(d<f2)f2=d}return[Math.sqrt(f1),Math.sqrt(f2),id]}
  const fbm=(x,y,s)=>vnoise(x,y,s)*.5+vnoise(x*2.1,y*2.1,s+1)*.28+vnoise(x*4.3,y*4.3,s+2)*.14+vnoise(x*8.7,y*8.7,s+3)*.08;
  function vnoise(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),fx=x-xi,fy=y-yi,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);const a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
  const ramps={cool:[[0,[40,4,2]],[.3,[150,28,8]],[.55,[226,78,22]],[.78,[255,148,60]],[1,[255,226,170]]],sun:[[0,[90,30,4]],[.35,[214,110,24]],[.65,[255,190,80]],[.85,[255,232,170]],[1,[255,252,236]]],hot:[[0,[20,40,120]],[.4,[110,150,255]],[.75,[200,220,255]],[1,[250,252,255]]]};
  function ramp(r,t){t=Math.max(0,Math.min(1,t));let i=1;while(i<r.length-1&&t>r[i][0])i++;const[a,ca]=r[i-1],[b,cb]=r[i],k=(t-a)/(b-a);return[ca[0]+(cb[0]-ca[0])*k,ca[1]+(cb[1]-ca[1])*k,ca[2]+(cb[2]-ca[2])*k]}
  window.drawStar=function(g,cx,cy,R,o){o=o||{};const rp=ramps[o.ramp||'sun'],big=o.big||4,fine=o.fine||22,seed=o.seed||1,limb=o.limb==null?.72:o.limb,contrast=o.contrast||.5;
    // halo
    const hr=R*(o.halo||2.4),gr=g.createRadialGradient(cx,cy,R*.9,cx,cy,hr),hc=ramp(rp,.75).map(Math.round);gr.addColorStop(0,`rgba(${hc},.55)`);gr.addColorStop(.25,`rgba(${hc},.16)`);gr.addColorStop(1,`rgba(${hc},0)`);g.fillStyle=gr;g.beginPath();g.arc(cx,cy,hr,0,7);g.fill();
    const S=Math.ceil(R*2+2),img=g.createImageData(S,S),D=img.data,x0=Math.round(cx-R)-1,y0=Math.round(cy-R)-1;
    for(let py=0;py<S;py++)for(let px=0;px<S;px++){const x=(px+x0+.5-cx)/R,y=(py+y0+.5-cy)/R,r2=x*x+y*y;if(r2>1)continue;const mu=Math.sqrt(1-r2),
      // project onto the sphere so cells foreshorten toward the limb
      lon=Math.atan2(x,mu),lat=Math.asin(Math.max(-1,Math.min(1,y)));
      const wx=fbm(lon*2+seed,lat*2,seed)-.5,wy=fbm(lon*2,lat*2+seed,seed+4)-.5,u=(lon+wx*.5)*big/1.6+seed,v=(lat+wy*.5)*big/1.6,[a1,a2,ida]=worley(u,v,seed),sm=t=>t<=0?0:t>=1?1:t*t*(3-2*t),cell=(.55+.45*ida)*(1-.55*sm(a1/.75))*(.72+.28*sm((a2-a1)/.4)),u2=(lon+wx*.15)*fine/1.6,v2=(lat+wy*.15)*fine/1.6,[b1,b2,idb]=worley(u2,v2,seed+3),gran=(.6+.4*idb)*(.5+.5*sm((b2-b1)/.3)),n=fbm(u*1.5,v*1.5,seed+9);
      let I=(1-limb*(1-mu)-.18*(1-mu)*(1-mu))*(1-contrast+contrast*(.62*cell+.38*gran))*(.72+.56*n);
      const edge=Math.min(1,(1-Math.sqrt(r2))*R/1.2),c=ramp(rp,I*1.02),k=(py*S+px)*4;D[k]=c[0];D[k+1]=c[1];D[k+2]=c[2];D[k+3]=255*Math.min(1,edge)}
    const tmp=document.createElement('canvas');tmp.width=tmp.height=S;tmp.getContext('2d').putImageData(img,0,0);g.drawImage(tmp,x0,y0);
    // a thin chromosphere rim
    g.strokeStyle=`rgba(${ramp(rp,.9).map(Math.round)},.35)`;g.lineWidth=Math.max(.6,R*.008);g.beginPath();g.arc(cx,cy,R*1.004,0,7);g.stroke();};
  window.drawNebula=function(g,cx,cy,R,col,seed){const r=rng(seed||3);g.save();g.globalCompositeOperation='lighter';for(let i=0;i<900;i++){const a=r()*6.283,d=R*(1.15+Math.pow(r(),1.6)*2.2),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d*.92,s=R*(.03+.12*r()),gr=g.createRadialGradient(x,y,0,x,y,s);gr.addColorStop(0,`rgba(${col},${.05*(1-(d-R)/(R*2.6))})`);gr.addColorStop(1,`rgba(${col},0)`);g.fillStyle=gr;g.fillRect(x-s,y-s,s*2,s*2)}g.restore()};
  window.drawField=function(g,w,h,n,seed){const r=rng(seed||5);for(let i=0;i<n;i++){const x=r()*w,y=r()*h,b=Math.pow(r(),4),s=.3+b*1.4,t=r();g.fillStyle=t<.2?`rgba(255,214,190,${.25+.7*b})`:t<.4?`rgba(200,216,255,${.25+.7*b})`:`rgba(255,255,255,${.2+.75*b})`;g.beginPath();g.arc(x,y,s,0,7);g.fill()}};
})();
