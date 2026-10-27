'use strict';
// Stand-in Wikipedia articles for the demo recording only (the sandbox cannot reach Wikipedia). The real game code, UI and heat logic run unchanged;
// only the article text it fetches is replaced. Each page is parsed and cleaned by the same WikiClean the live game uses.
const L = (t, txt) => `<a href="/wiki/${t.replace(/ /g, '_')}" title="${t}">${txt || t}</a>`;
const page = (intro, secs) => `<div class="mw-parser-output"><p>${intro}</p>${secs.map(([h, ps]) => `<h2 id="${h.replace(/ /g, '_')}">${h}</h2>${ps.map(p => `<p>${p}</p>`).join('')}`).join('')}</div>`;
const G = (title, a) => page(`${title} is the subject of this short demonstration article. ${a}`, [['Overview', ['This page stands in for the real article so the demo can run offline.']]]);
const PAGES = {
  Pizza: page(`<b>Pizza</b> is a dish of Italian origin consisting of a usually round, flat base of leavened wheat dough topped with ${L('Tomato', 'tomatoes')}, ${L('Cheese', 'cheese')} and often other ingredients, baked at a high temperature, traditionally in a wood-fired oven. A small pizza is sometimes called a pizzetta.`, [
    ['History', [`Flatbreads with toppings have been eaten around the ${L('Mediterranean Sea', 'Mediterranean')} for thousands of years. The modern dish developed in ${L('Naples')}, in ${L('Italy')}, in the 18th and 19th centuries, where it began as an inexpensive food for working people.`, `The best known early version, topped with tomato, mozzarella and basil, is said to have been named for a queen of Italy in the 1880s.`]],
    ['Types', [`Styles differ widely. ${L('Naples', 'Neapolitan')} pizza has a soft, thin centre and a puffy crust, while other regions favour thicker bases or crisp, thin ones.`, `Toppings range from simple ${L('Cheese', 'mozzarella')} and tomato to vegetables, cured meats and seafood.`]],
    ['Preparation', [`The dough is made from flour, water, yeast and salt, then left to rise. It is stretched by hand, topped, and baked for only a few minutes in a very hot oven.`]]]),
  Italy: page(`<b>Italy</b> is a country in Southern Europe, located on a boot-shaped peninsula in the ${L('Mediterranean Sea', 'Mediterranean Sea')}. Its capital and largest city is ${L('Rome')}.`, [
    ['History', [`The Italian peninsula was the heart of the Roman Republic and later the Roman Empire. Ancient ${L('Rome')} came to rule most of the Mediterranean world, including ${L('Egypt')}, which became a Roman province in 30 BC.`, `After the fall of the western empire, Italy was divided into many states until its unification in the 19th century.`]],
    ['Culture', [`Italy is famous for its art, architecture, music and food, including ${L('Pizza')} and pasta, and is home to more UNESCO World Heritage Sites than any other country.`]],
    ['Geography', [`The country is crossed by the Alps in the north and the Apennines down its length, and includes the large islands of Sicily and Sardinia.`]]]),
  Egypt: page(`<b>Egypt</b> is a transcontinental country spanning the northeast corner of ${L('Africa')} and the Sinai Peninsula in Asia. Its capital is ${L('Cairo')}.`, [
    ['Geography', [`Most of the country is desert, and almost all of its people live in the narrow green strip along the ${L('Nile')} and in its delta, where the river flows north into the ${L('Mediterranean Sea', 'Mediterranean')}.`, `The Nile has shaped Egyptian life for thousands of years, providing water, fertile soil and a highway for trade.`]],
    ['History', [`Ancient Egypt was one of the earliest civilisations. It is remembered for its pharaohs, hieroglyphic writing and monuments such as the ${L('Pyramid', 'pyramids')} of Giza.`]],
    ['Wildlife', [`Along the river live many species of birds, fish and reptiles, and in the past the ${L('Hippopotamus', 'hippopotamus')} was common in the Nile.`]]]),
  Nile: page(`The <b>Nile</b> is a major north-flowing river in northeastern ${L('Africa')}. It flows into the ${L('Mediterranean Sea', 'Mediterranean Sea')} and is one of the longest rivers in the world.`, [
    ['Course', [`The river has two main tributaries, the White Nile and the Blue Nile, which join at Khartoum in Sudan before the river flows north through ${L('Egypt')}.`]],
    ['Ecology', [`The waters and banks of the Nile support papyrus reeds, many birds, and large animals such as the ${L('Hippopotamus', 'hippopotamus')}. The river is also home to the Nile ${L('Crocodile', 'crocodile')}, one of the largest freshwater predators in Africa.`]],
    ['Human use', [`Communities along the river have farmed its floodplain since ancient times, and today it supplies water for drinking, farming and electricity.`]]]),
  Crocodile: page(`<b>Crocodiles</b> are large semiaquatic reptiles that live throughout the tropics in Africa, Asia, the Americas and Australia. They are ambush predators with powerful jaws.`, [
    ['Biology', [`Crocodiles can stay almost completely still in the water, with only their eyes and nostrils showing, before striking at prey on the bank.`]]]),
  Naples: G('Naples', `It is a city in southern ${L('Italy')}, known for its food and as the birthplace of ${L('Pizza')}.`),
  Tomato: G('The tomato', `It is the fruit of a plant native to the Americas and is central to many dishes, including ${L('Pizza')}.`),
  Cheese: G('Cheese', `It is a dairy product made in many forms, from soft ${L('Pizza', 'pizza')} cheeses to hard aged ones.`),
  'Mediterranean Sea': G('The Mediterranean Sea', `It lies between ${L('Europe')}, ${L('Africa')} and Asia, and touches ${L('Italy')} and ${L('Egypt')}.`),
  Rome: G('Rome', `It is the capital of ${L('Italy')}, and was the centre of the ancient Roman Empire.`),
  Africa: G('Africa', `It is the second-largest continent and is home to the ${L('Nile')} and ${L('Egypt')}.`),
  Cairo: G('Cairo', `It is the capital of ${L('Egypt')}, on the banks of the ${L('Nile')}.`),
  Pyramid: G('A pyramid', `The pyramids of ${L('Egypt')} are among the best known monuments in the world.`),
  Hippopotamus: G('The hippopotamus', `It is a large mostly aquatic mammal found in rivers of ${L('Africa')} such as the ${L('Nile')}.`),
  Europe: G('Europe', `It is a continent that includes ${L('Italy')}.`)
};
// pages that link to the target (Crocodile), for the game's heat signal
const BACKLINKS = { Crocodile: ['Nile', 'Africa', 'Hippopotamus', 'Egypt', 'Reptile', 'Alligator', 'Predator'] };
function articleHtml(title) { return PAGES[title] || G(title, `Return to ${L('Pizza')}.`); }
module.exports = { PAGES, BACKLINKS, articleHtml };
