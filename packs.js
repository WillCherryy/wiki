// Companion packs: themed puzzles with a click goal. `goal` is a fallback; tools/build-packs.js
// verifies each pair against real Wikipedia links and writes packs.json with par and the shortest route.
const PACKS = [
  { id: 'pop', name: 'Pop culture', emoji: '🎬', hue: 330, puzzles: [
    { from: 'Shrek', to: 'Napoleon' }, { from: 'Beyoncé', to: 'Mount Everest' }, { from: 'Minecraft', to: 'Cleopatra' },
    { from: 'Taylor Swift', to: 'Volcano' }, { from: 'Star Wars', to: 'Honey' }, { from: 'Pokémon', to: 'Black Death' },
    { from: 'The Beatles', to: 'Photosynthesis' }, { from: 'Harry Potter', to: 'Antarctica' }, { from: 'Michael Jackson', to: 'Ancient Egypt' },
    { from: 'Game of Thrones', to: 'Vikings' }, { from: 'Super Mario', to: 'Renaissance' }, { from: 'Netflix', to: 'Whale' } ] },
  { id: 'history', name: 'History', emoji: '🏛️', hue: 40, puzzles: [
    { from: 'Julius Caesar', to: 'Coffee' }, { from: 'Black Death', to: 'Printing press' }, { from: 'Cleopatra', to: 'Moon' },
    { from: 'French Revolution', to: 'Chocolate' }, { from: 'Industrial Revolution', to: 'Jazz' }, { from: 'Genghis Khan', to: 'Pizza' },
    { from: 'Titanic', to: 'Penicillin' }, { from: 'World War II', to: 'Piano' }, { from: 'Silk Road', to: 'Tea' },
    { from: 'Ancient Egypt', to: 'Association football' }, { from: 'Alexander the Great', to: 'Elephant' }, { from: 'Cold War', to: 'Pacific Ocean' } ] },
  { id: 'science', name: 'Science', emoji: '🔬', hue: 205, puzzles: [
    { from: 'Atom', to: 'Pizza' }, { from: 'DNA', to: 'Association football' }, { from: 'Black hole', to: 'Tea' },
    { from: 'Photosynthesis', to: 'Egypt' }, { from: 'Gravity', to: 'William Shakespeare' }, { from: 'Electricity', to: 'Opera' },
    { from: 'Evolution', to: 'Chess' }, { from: 'Vaccine', to: 'Mount Everest' }, { from: 'Periodic table', to: 'Brazil' },
    { from: 'Quantum mechanics', to: 'Pasta' }, { from: 'Dinosaur', to: 'Internet' }, { from: 'Moon', to: 'Democracy' } ] }
];
PACKS.forEach(p => p.puzzles.forEach(z => { z.goal = 4; }));
if (typeof module !== 'undefined') module.exports = PACKS;
