// Page text and route for each version of the race advert. Pick one with race.html?story=<name> (default: wiggins).
// Every sentence is plain and true, because the camera passes over it: the page is background, but it should still be right.
(function () {
  const L = t => `<span class="l">${t}</span>`;
  window.RACE_CONTENT = {
    wiggins: {
      file: '', loops: [2, 9], holes: [3, 7],
      route: ['Cycling', 'bicycle', 'world', 'Tour de France', 'Olympic Games', 'Great Britain', 'London', 'Sydney', 'Europe', 'Australia', 'BBC', 'British Broadcasting Corporation', 'Australian Broadcasting Corporation'],
      html: `<h1>Bradley Wiggins</h1><div class="sub">British former professional road and track racing cyclist</div>
<div class="box"><div class="ph">photo</div><b>Born</b>Kilburn, London<b>Nationality</b>British<b>Discipline</b>Road and track</div>
<p>${L('Cycling')} is the use of bicycles for transport, recreation and sport. A ${L('bicycle')} is a human-powered vehicle with two wheels, and the sport is practised on roads, tracks and trails across the ${L('world')}.</p>
<p>Races on the road are often organised in stages. The best known is the ${L('Tour de France')}, held every year in ${L('France')} and its neighbouring countries, while track events are run in indoor arenas called ${L('velodromes')}.</p>
<h2>Overview</h2>
<p>The ${L('Olympic Games')} are a major international multi-sport event held every four years. Cycling has been part of the programme since the first modern Games, and the ${L('Great Britain')} team has competed in every edition.</p>
<div class="quote">Every link is a door to another page.</div>
<p>${L('London')} is the capital of England and the United Kingdom, and it has hosted the Games three times. ${L('Sydney')} is the capital city of New South Wales and hosted the Games in the year 2000.</p>
<h2>History</h2>
<p>The first ${L('Wikipedia')} article was written in 2001. Today the encyclopedia has millions of pages, connected by links that let a reader move from one subject to almost any other in only a few clicks.</p>
<ul><li>${L('Europe')} has a long tradition of road racing.</li><li>${L('Australia')} is both a country and a continent.</li><li>The ${L('BBC')} is the national broadcaster of the United Kingdom.</li></ul>
<p>Broadcasting made cycling a spectator sport. The ${L('British Broadcasting Corporation')} was founded in 1922, and public broadcasters elsewhere followed, including the ${L('Australian Broadcasting Corporation')}, which is Australia's public broadcaster.</p>
<h2>See also</h2>
<p>${L('Sport')} ${L('Television')} ${L('Journalism')} ${L('Radio')} ${L('Media')} ${L('Culture')} ${L('Australian Broadcasting Corporation')}</p><div style="height:300px"></div>`
    },
    newton: {
      file: '-newton', loops: [2, 8], holes: [3, 9],
      route: ['France', 'Seine', 'Europe', 'Eiffel Tower', 'Sorbonne', 'Marie Curie', 'Blaise Pascal', 'Science', 'Physics', 'Mathematics', 'Royal Society', 'Gravity', 'Isaac Newton'],
      html: `<h1>Paris</h1><div class="sub">Capital and most populous city of France</div>
<div class="box"><div class="ph">photo</div><b>Country</b>France<b>Region</b>Ile-de-France<b>Type</b>Capital city</div>
<p>Paris is the capital and most populous city of ${L('France')}. It stands on the banks of the ${L('Seine')} in the north of the country, and its metropolitan area is one of the largest in ${L('Europe')}.</p>
<p>The city is known for the ${L('Eiffel Tower')}, the Louvre and the cathedral of Notre-Dame. It has been a centre of art, fashion and learning for centuries.</p>
<h2>Overview</h2>
<p>Paris is home to many universities and research institutes, including the ${L('Sorbonne')}. Scientists such as ${L('Marie Curie')} and ${L('Blaise Pascal')} worked in the city.</p>
<div class="quote">Every link is a door to another page.</div>
<p>${L('Science')} is the systematic study of the natural world. Its branches include ${L('Physics')}, which describes matter, energy and motion, and ${L('Mathematics')}, the language in which many laws are written.</p>
<h2>History</h2>
<p>In the seventeenth century, scientists across the continent began to share their findings in societies and journals. The ${L('Royal Society')}, founded in London in 1660, is one of the oldest scientific academies in the world.</p>
<ul><li>${L('Gravity')} is the force by which objects with mass attract each other.</li><li>Calculus is the mathematics of change.</li><li>Optics is the study of light.</li></ul>
<p>One of the most influential members of the Royal Society was ${L('Isaac Newton')}, an English mathematician and physicist who described the laws of motion and universal gravitation.</p>
<h2>See also</h2>
<p>Cambridge London Astronomy Philosophy Isaac Newton</p><div style="height:300px"></div>`
    }
  };
})();
