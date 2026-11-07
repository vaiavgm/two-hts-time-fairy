// Gendom 3: players each submit a word (modifier); the words are pooled and everybody receives a random
// genre combined with somebody else's word, e.g. "dank Techno". The round handling is in system/gendom.js.

const { createGame } = require("../system/gendom");
const { nextGenre } = require("../system/gendom-logic");

module.exports = createGame({
    name: "gendom3",
    title: "Gendom 3",
    description: "Play Gendom 3: send a word, get a random genre with somebody else's word!",
    joinDescription: "Join with one word. Join again to replace your word before the themes are handed out",
    entryNoun: "word",
    slots: [
        { name: "word", label: "word", description: "One adjective, e.g. \"dank\" or \"wet\"", examples: ["dank", "wet"], maxLength: 40 },
    ],
    intro: "\u{1F3B2} **Gendom 3** is open in this channel! Join with `/gendom3 join` and a word, e.g. \"dank\". The word stays secret.",
    createState: () => ({ genreBuffer: [] }),
    buildTheme: (sources, state) => sources[0].word + " " + nextGenre(state.genreBuffer),
});
