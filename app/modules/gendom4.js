// Gendom 4: every player writes a little sentence in four parts (who / does what / where / when). The parts of all
// players are shuffled, so everybody receives a sentence built from four other players' parts, e.g.
// "The telephone eats pizza on the moon during the lunch break." The round handling is in system/gendom.js.

const { createGame } = require("../system/gendom");

const SLOTS = [
    {
        name: "who",
        label: "who",
        description: "(1/4) WHO: one person, animal or thing, e.g. \"the dog\" or \"my grandma\"",
        examples: ["the dog", "my grandma"],
        maxLength: 60,
    },
    {
        name: "does-what",
        label: "does what",
        description: "(2/4) DOES WHAT: a verb and what goes with it, e.g. \"eats pizza\" or \"hides a sock\"",
        examples: ["eats pizza", "hides a sock"],
        maxLength: 60,
    },
    {
        name: "where",
        label: "where",
        description: "(3/4) WHERE: a place, e.g. \"in the kitchen\" or \"on the moon\"",
        examples: ["in the kitchen", "on the moon"],
        maxLength: 60,
    },
    {
        name: "when",
        label: "when",
        description: "(4/4) WHEN: a time, e.g. \"at midnight\" or \"during the lunch break\"",
        examples: ["at midnight", "during the lunch break"],
        maxLength: 60,
    },
];

const INTRO = [
    "\u{1F3B2} **Gendom 4** is open in this channel!",
    "Write a little sentence in four parts with `/gendom4 join`:",
    "- **who**: one person, animal or thing, e.g. `the dog`",
    "- **does what**: a verb with what goes with it, e.g. `eats pizza`",
    "- **where**: a place, e.g. `in the kitchen`",
    "- **when**: a time, e.g. `at midnight`",
    "Your parts stay secret. When the themes are handed out, everybody gets a sentence made of other players' parts, e.g. *The telephone requires power on the moon during the lunch break.*",
].join("\n");

// Joins the parts into one sentence: inner parts lose trailing punctuation, the first letter is capitalised and
// the sentence ends with a full stop unless it already ends with "!" or "?"
function buildSentence(parts)
{
    const cleaned = parts.map((part, i) => part.replace(i < parts.length - 1 ? /[\s.,;:!?]+$/ : /[\s.,;:]+$/, ""));
    let sentence = cleaned.join(" ");
    sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);
    return /[!?]$/.test(sentence) ? sentence : sentence + ".";
}

module.exports = createGame({
    name: "gendom4",
    title: "Gendom 4",
    description: "Play Gendom 4: write who does what where when, get a sentence mixed from other players' parts!",
    joinDescription: "Join with 4 parts: who + does what + where + when. Join again to replace your entry",
    entryNoun: "phrase",
    slots: SLOTS,
    // Otherwise a small round can hand somebody "the man eats pizza", i.e. the start of another player's original sentence
    apart: [["who", "does-what"]],
    intro: INTRO,
    buildTheme: sources => buildSentence(sources.map(source => source.word)),
});

module.exports.buildSentence = buildSentence;
