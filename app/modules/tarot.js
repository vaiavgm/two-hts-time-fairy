/* eslint-disable no-unused-vars */

class Participant {
  constructor(user) {
    this.user = user;
    this.cards = [];
  }
}

class Arcana {
  constructor(card, description) {
    this.card = card;
    this.description = description;
  }
}

const participants = [];

function getArcana() {
  const arcanaCards = [];
  arcanaCards.push(new Arcana("The Fool", "The Fool is the first card in a Tarot deck because he is the most vulnerable of all the Tarot's archetypes. He has not yet experienced the ups and downs of life, leaving him unaware of the magnitude of life's challenges, and the strength and potential he holds. When The Fool comes up in a Tarot reading, you are encouraged to take on his open, willing energy and embrace all that lies ahead of you without worry."));
  arcanaCards.push(new Arcana("The Magician", "The Magician card is a reminder that you are a unique being, and have many gifts that others do not hold. These skills set you apart from the crowd, and can help you begin new projects or overcome adversity. When The Magician comes up in your Tarot reading, it's a reminder that you needn't wait -- you already hold everything you need to move forward and accomplish what you've set out to do."));
  arcanaCards.push(new Arcana("The High Priestess", "The most intuitive, connected card in the whole Tarot deck, The High Priestess is a card of awareness and subconsciousness. This card urges you to listen to your inner voice and to follow your instincts. Your mind knows far, far more than you think it does, and The High Priestess embodies this concept. When she arises in your Tarot reading, stop looking for answers in the outside world and instead, turn within for the guidance you seek."));
  arcanaCards.push(new Arcana("The Empress", "The Empress is the most feminine card in the Tarot, and greatly encourages compassion, beauty, and love. She is deeply connected to Mother Nature, and her influence is powerful when you absorb the energy of the natural world around you."));
  arcanaCards.push(new Arcana("The Emperor", "The Emperor is a card of leadership and power. He is an authoritative force who has been through many experiences to achieve this status. He represents structure and solidity, and reminds you that you, too, hold immense amounts of power over your own life, and what happens to it."));
  arcanaCards.push(new Arcana("The Hierophant", "The Hierophant is like a messenger from the heavens. He is experienced in spirituality and guidance, and his job is to bring these lessons down to us here in the real world. When The Hierophant comes up in your Tarot reading, you're encouraged to follow the rules, and to find a spiritual perspective on your current situation."));
  arcanaCards.push(new Arcana("The Lovers", "It's no surprise The Lovers card represents the close relationships in your life. If it comes up in your Tarot reading, your love life is in need of extra focus and attention. However, this is just as much a card about your values and decisions. You may find The Lovers come up when you are at a crossroads, and must consider all the possible consequences of your choices."));
  arcanaCards.push(new Arcana("The Chariot", "The Chariot card is connected to your natural drive and determination, and can indicate an upcoming victory. This card reminds you that your greatest successes won't come through limited thinking -- when you combine the knowledge of your mind with that of your heart and spirit, you are an unstoppable force."));
  arcanaCards.push(new Arcana("Strength", "One of the most obviously named cards in a Tarot deck, Strength is most definitely a card about strength -- but not physical strength. The Strength card represents the fortitude of your heart, your level of courage, and your ability to withstand anything life hands you. If this card arises in your Tarot reading, you are reminded that you are strong enough to handle whatever you are facing -- and will come out of it with even more power than you had before."));
  arcanaCards.push(new Arcana("The Hermit", "The Hermit yearns to be alone. He knows that the only way to process what is happening in life is to withdraw from the noise of the world and create a quiet space of solitude. When The Hermit comes up in your reading, the answers you need will come from within. Be very still, and listen..."));
  arcanaCards.push(new Arcana("Wheel of Fortune", "The Wheel of Fortune is constantly revolving -- sometimes you will be at the top, and sometimes you will be at the bottom. This Tarot card reminds you that nothing is permanent, and, good or bad, you must cherish the lessons that this moment is bringing you."));
  arcanaCards.push(new Arcana("Justice", "Justice is your firm-but-fair reminder that karma is real, and there is a consequence for every action. Whatever life is handing you at this moment comes from decisions you've made in the past, and whether it's a punishment or a reward, it is exactly what you deserve. When this card comes up in your Tarot reading, make sure you are acting fairly in all your interactions with others."));
  arcanaCards.push(new Arcana("The Hanged Man", "The Hanged Man is a card that comes up when you are in limbo. He tells you that sometimes small sacrifices must be made in order to benefit the bigger picture. When The Hanged Man arises in your reading, you likely want to make a move, but don't even know where to begin. Begin by letting go. Lightening your grip on something that's no longer working for you or detaching from the outcome of your situation can help you release yourself."));
  arcanaCards.push(new Arcana("Death", "One of the most misunderstood cards in a Tarot deck, Death is not a card about physical death. The Death card speaks of cycles -- endings, yes, but beginnings too -- and is a reminder that all things must pass. Hanging on to relationships, feelings, fears, or situations from the past will hinder you from allowing new, better things to enter your life. Take comfort in knowing that in every ending lies a chance for a new beginning."));
  arcanaCards.push(new Arcana("Temperance", "The Temperance card is a master of moderation. She encourages peace and patience, and reminds you to go with the flow of your life instead of trying to force its pace or direction. When Temperance turns up in your Tarot reading, it is a message to take things as they come, and remain flexible enough to change with the changes."));
  arcanaCards.push(new Arcana("The Devil", "The Devil card carries heavy feelings of restraint and powerlessness. When he comes up in your Tarot reading, you are likely feeling like you have no control and are stuck in a situation you don't want to be in. The Devil has convinced you that you have no options, but this couldn't be further from the truth. You are not being trapped by external forces, but by your own limitations or unwillingness to move forward. You hold the keys to your own freedom, but it's up to you to open the lock."));
  arcanaCards.push(new Arcana("The Tower", "Perhaps the most dreaded card in a Tarot deck, The Tower is a representation of destruction. The Tower often comes up when everything in your life feels like its crumbling, and you have no way of stopping it. The message of this card is to just let it fall. The weakest parts of your life must be torn down in order to build something strong and sturdy in their place -- something that can last a lifetime."));
  arcanaCards.push(new Arcana("The Star", "The Star is the embodiment of hope and healing. She is a calming influence that brings messages of renewal, optimism, and inspiration. When The Star comes up in your Tarot reading, she reminds you that the universe is working in your favor, and encourages you to have faith in where you are being taken."));
  arcanaCards.push(new Arcana("The Moon", "The Moon card is greatly connected to your subconscious. It represents the thoughts, feelings, doubts and fears that you carry internally. When The Moon arises in your Tarot reading, you may be feeling anxious, allowing these fears to override the memories of your past and your faith in the future. Do not be deceived -- you can't believe everything that you see, hear ... or think. If you can draw these feelings to the surface and address them, you can rid yourself of worry."));
  arcanaCards.push(new Arcana("The Sun", "The Sun is a powerfully uplifting card, representing happiness, joy, vitality, and optimism. When The Sun comes up in your Tarot reading, it is an positive sign that things are working well for you and that you're moving in the right direction. Lift your head and realize all the good situations and people that are surrounding you now and always."));
  arcanaCards.push(new Arcana("Judgment", "Judgment is a card where your past and your future come together. You are being called on to review your decisions and your actions until now, to ensure they are in-line with where you ultimately want to go. The Judgment card reminds you that your future is not set in stone, and that it's never too late to make a change for the better."));
  arcanaCards.push(new Arcana("The World", "The World is the last card of the Major Arcana, and represents completion, success, and fulfillment. When she arises in your Tarot Reading, The World shows you that you are exactly where you are meant to be on your path. You have a greater understanding of who you are after all you've been through, and you're ready for the next phase of your journey."));

  return arcanaCards;
}

function getTheme(card0, card1, card2) {
  return "```Your past: " + card0.card + "\nYour present: " + card1.card + "\nYour future: " + card2.card + "```";
}

function getDetailedDescription(card0, card1, card2) {
  return "```The meaning of your major arcana:\n(Past) " + card0.card + ": " + card0.description + "\n(Present) " + card1.card + ": " + card1.description + "\n(Future) " + card2.card + ": " + card2.description + "```";
}

module.exports = {
  name: "tarot",
  description: "shows your past, present, and future",

  async execute(message, args) {
    const channel = message.channel;

    for (const p of participants) {
      if (p.user === message.author) {
        await channel.send("found!");
        if (p.cards.length > 0) {
          await channel.send(getTheme(p.cards[0], p.cards[1], p.cards[2]));
          return;
        }
      }
    }

    const arcanaInstance = getArcana();

    const past = arcanaInstance.splice(Math.floor(Math.random() * arcanaInstance.length), 1)[0];
    const present = arcanaInstance.splice(Math.floor(Math.random() * arcanaInstance.length), 1)[0];
    const future = arcanaInstance.splice(Math.floor(Math.random() * arcanaInstance.length), 1)[0];

    const newParticipant = new Participant(message.author);
    newParticipant.cards.push(past);
    newParticipant.cards.push(present);
    newParticipant.cards.push(future);

    participants.push(newParticipant);

    await channel.send(getTheme(past, present, future));
  },

  async detail(message, args) {
    const channel = message.channel;

    for (const p in participants) {
      if (p.user == message.author) {
        await channel.send("found!");
        if (p.cards.length > 0) {
          await channel.send(getDetailedDescription(p.cards[0], p.cards[1], p.cards[2]));
        }
      }
    }
  },
};
