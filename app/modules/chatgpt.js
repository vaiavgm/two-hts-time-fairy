/* eslint-disable no-unused-vars */
// const { SlashCommandBuilder } = require("@discordjs/builders");
// 
// require("dotenv").config();
// 
// // -- OpenAI API start (TODO - extract to separate file/module, if possible)
// const { OpenAI } = require("openai");
// // eslint-disable-next-line no-unused-vars
// const openai = new OpenAI({
//     api_key: process.env.OPENAI_API_KEY,
// });
// // -- OpenAI API end
// 
// 
// module.exports = {
//     data: new SlashCommandBuilder().setName("prompt").setDescription("Calls the ChatGPT API"),
// 
//     async execute(interaction, user)
//     {
//         const userprompt = interaction.options.getString("prompt");
// 
//         const completion = await openai.completions.create({
//             model: "text-davinci-003",
//             prompt: `Write something nice about ${userprompt}`,
//             max_tokens: 30,
//         });
// 
//         await interaction.reply(completion.choices[0].text);
//     },
// };
